/**
 * WASM-Native Filesystem and Caching Implementation for libwebp.wasm
 * 
 * This file implements WASM-native patterns including:
 * - IDBFS persistent storage for image caching
 * - Async resource loading with emscripten_async_wget
 * - Virtual file system organization
 * - Progressive loading and cache management
 * 
 * Copyright 2025 Superstruct Ltd, New Zealand
 * Licensed under BSD-3-Clause (same as libwebp)
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <errno.h>
#include <time.h>

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#include <emscripten/fetch.h>
#include <emscripten/html5.h>
#endif

#include "webp/encode.h"
#include "webp/decode.h"
#include "wasm_native.h"

// Virtual directory paths following WASM-native patterns
#define WASM_NATIVE_IMAGE_CACHE    "/image-cache"
#define WASM_NATIVE_TEMP_DIR       "/temp"
#define WASM_NATIVE_CDN_DIR        "/cdn-images"
#define WASM_NATIVE_PACKAGES_DIR   "/image-packages"
#define WASM_NATIVE_USER_DIR       "/user-uploads"
#define WASM_NATIVE_ASSETS_DIR     "/assets"

// Cache configuration
#define MAX_CACHE_ENTRIES          100
#define MAX_CACHE_AGE_MS          (7 * 24 * 60 * 60 * 1000)  // 7 days
#define CACHE_CLEANUP_INTERVAL_MS (60 * 60 * 1000)           // 1 hour

// Cache entry structure
typedef struct {
    char* key;
    char* file_path;
    uint64_t timestamp;
    size_t size;
    int access_count;
} WASMNativeCacheEntry;

// Global cache state
static struct {
    WASMNativeCacheEntry entries[MAX_CACHE_ENTRIES];
    int count;
    int persistent_storage_available;
    uint64_t last_cleanup;
    size_t total_size;
} g_cache = {0};

// Async loading callback structure
typedef struct {
    char* url;
    char* cache_key;
    void (*callback)(const char* file_path, int success, void* user_data);
    void* user_data;
} AsyncLoadContext;

/**
 * Initialize WASM-native file system
 * Sets up virtual directories and mounts IDBFS if available
 */
EMSCRIPTEN_KEEPALIVE
int wasm_native_init_filesystem(void) {
    printf("Initializing WASM-native file system...\n");
    
    // Create virtual directory structure
    const char* directories[] = {
        WASM_NATIVE_IMAGE_CACHE,
        WASM_NATIVE_TEMP_DIR,
        WASM_NATIVE_CDN_DIR,
        WASM_NATIVE_PACKAGES_DIR,
        WASM_NATIVE_USER_DIR,
        NULL
    };
    
    for (int i = 0; directories[i]; i++) {
        if (mkdir(directories[i], 0755) != 0 && errno != EEXIST) {
            printf("Warning: Failed to create directory %s: %s\n", 
                   directories[i], strerror(errno));
        }
    }
    
#ifdef __EMSCRIPTEN__
    // Try to mount IDBFS for persistent storage
    EM_ASM({
        try {
            FS.mkdir('/image-cache');
            FS.mount(FS.filesystems.IDBFS, {}, '/image-cache');
            
            // Synchronize with IndexedDB
            FS.syncfs(true, function(err) {
                if (!err) {
                    console.log('✅ IDBFS persistent storage initialized');
                    Module._wasm_native_set_persistent_storage(1);
                } else {
                    console.warn('⚠️ IDBFS sync failed, using memory-only cache:', err);
                    Module._wasm_native_set_persistent_storage(0);
                }
            });
        } catch (e) {
            console.warn('⚠️ IDBFS mounting failed, using memory-only cache:', e);
            Module._wasm_native_set_persistent_storage(0);
        }
    });
#else
    g_cache.persistent_storage_available = 0;
#endif
    
    printf("WASM-native file system initialized\n");
    return 1;
}

/**
 * Set persistent storage availability (called from JavaScript)
 */
EMSCRIPTEN_KEEPALIVE
void wasm_native_set_persistent_storage(int available) {
    g_cache.persistent_storage_available = available;
    printf("Persistent storage: %s\n", available ? "enabled" : "disabled");
}

/**
 * Generate cache key from URL and parameters
 */
static void generate_cache_key(const char* url, const char* params, char* key, size_t key_size) {
    // Simple hash-based key generation
    unsigned long hash = 5381;
    const char* str = url;
    int c;
    
    while ((c = *str++)) {
        hash = ((hash << 5) + hash) + c;
    }
    
    if (params) {
        str = params;
        while ((c = *str++)) {
            hash = ((hash << 5) + hash) + c;
        }
    }
    
    snprintf(key, key_size, "webp_%08lx", hash);
}

/**
 * Get current timestamp in milliseconds
 */
static uint64_t get_current_time_ms(void) {
#ifdef __EMSCRIPTEN__
    return (uint64_t)emscripten_get_now();
#else
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t)(ts.tv_sec * 1000 + ts.tv_nsec / 1000000);
#endif
}

/**
 * Find cache entry by key
 */
static WASMNativeCacheEntry* find_cache_entry(const char* key) {
    for (int i = 0; i < g_cache.count; i++) {
        if (g_cache.entries[i].key && strcmp(g_cache.entries[i].key, key) == 0) {
            return &g_cache.entries[i];
        }
    }
    return NULL;
}

/**
 * Add entry to cache
 */
static int add_cache_entry(const char* key, const char* file_path, size_t size) {
    if (g_cache.count >= MAX_CACHE_ENTRIES) {
        // Remove oldest entry (simple LRU)
        int oldest = 0;
        uint64_t oldest_time = g_cache.entries[0].timestamp;
        
        for (int i = 1; i < g_cache.count; i++) {
            if (g_cache.entries[i].timestamp < oldest_time) {
                oldest_time = g_cache.entries[i].timestamp;
                oldest = i;
            }
        }
        
        // Free old entry
        free(g_cache.entries[oldest].key);
        free(g_cache.entries[oldest].file_path);
        g_cache.total_size -= g_cache.entries[oldest].size;
        
        // Move last entry to freed slot
        if (oldest != g_cache.count - 1) {
            g_cache.entries[oldest] = g_cache.entries[g_cache.count - 1];
        }
        g_cache.count--;
    }
    
    // Add new entry
    WASMNativeCacheEntry* entry = &g_cache.entries[g_cache.count];
    entry->key = strdup(key);
    entry->file_path = strdup(file_path);
    entry->timestamp = get_current_time_ms();
    entry->size = size;
    entry->access_count = 1;
    
    g_cache.total_size += size;
    g_cache.count++;
    
    return 1;
}

/**
 * Cleanup expired cache entries
 */
static void cleanup_cache(void) {
    uint64_t current_time = get_current_time_ms();
    uint64_t cutoff_time = current_time - MAX_CACHE_AGE_MS;
    
    int write_index = 0;
    
    for (int read_index = 0; read_index < g_cache.count; read_index++) {
        WASMNativeCacheEntry* entry = &g_cache.entries[read_index];
        
        if (entry->timestamp < cutoff_time) {
            // Entry expired - remove file and free memory
            remove(entry->file_path);
            free(entry->key);
            free(entry->file_path);
            g_cache.total_size -= entry->size;
        } else {
            // Keep entry - move to write position if needed
            if (write_index != read_index) {
                g_cache.entries[write_index] = *entry;
            }
            write_index++;
        }
    }
    
    g_cache.count = write_index;
    g_cache.last_cleanup = current_time;
    
    printf("Cache cleanup: %d entries remaining, %zu bytes total\n", 
           g_cache.count, g_cache.total_size);
}

/**
 * Check if cache needs periodic cleanup
 */
static void check_cache_cleanup(void) {
    uint64_t current_time = get_current_time_ms();
    
    if (current_time - g_cache.last_cleanup > CACHE_CLEANUP_INTERVAL_MS) {
        cleanup_cache();
    }
}

/**
 * Async loading completion callback
 */
#ifdef __EMSCRIPTEN__
static void async_load_onload(emscripten_fetch_t *fetch) {
    AsyncLoadContext* ctx = (AsyncLoadContext*)fetch->userData;
    
    if (fetch->status == 200) {
        // Save data to cache file
        char cache_file_path[256];
        snprintf(cache_file_path, sizeof(cache_file_path), 
                 "%s/%s.webp", WASM_NATIVE_CDN_DIR, ctx->cache_key);
        
        FILE* file = fopen(cache_file_path, "wb");
        if (file) {
            size_t written = fwrite(fetch->data, 1, fetch->numBytes, file);
            fclose(file);
            
            if (written == fetch->numBytes) {
                // Add to cache
                add_cache_entry(ctx->cache_key, cache_file_path, written);
                
                // Sync with persistent storage if available
                if (g_cache.persistent_storage_available) {
                    EM_ASM({
                        FS.syncfs(false, function(err) {
                            if (err) console.warn('Cache sync failed:', err);
                        });
                    });
                }
                
                printf("Successfully cached image from %s (%zu bytes)\n", 
                       ctx->url, written);
                
                if (ctx->callback) {
                    ctx->callback(cache_file_path, 1, ctx->user_data);
                }
            } else {
                printf("Failed to write cached image: %zu != %zu\n", 
                       written, fetch->numBytes);
                if (ctx->callback) {
                    ctx->callback(NULL, 0, ctx->user_data);
                }
            }
        } else {
            printf("Failed to open cache file for writing: %s\n", cache_file_path);
            if (ctx->callback) {
                ctx->callback(NULL, 0, ctx->user_data);
            }
        }
    } else {
        printf("Failed to load image from %s: HTTP %d\n", ctx->url, fetch->status);
        if (ctx->callback) {
            ctx->callback(NULL, 0, ctx->user_data);
        }
    }
    
    // Cleanup
    free(ctx->url);
    free(ctx->cache_key);
    free(ctx);
    emscripten_fetch_close(fetch);
}

static void async_load_onerror(emscripten_fetch_t *fetch) {
    AsyncLoadContext* ctx = (AsyncLoadContext*)fetch->userData;
    
    printf("Network error loading image from %s\n", ctx->url);
    
    if (ctx->callback) {
        ctx->callback(NULL, 0, ctx->user_data);
    }
    
    // Cleanup
    free(ctx->url);
    free(ctx->cache_key);
    free(ctx);
    emscripten_fetch_close(fetch);
}
#endif

/**
 * Load image from URL with caching
 */
EMSCRIPTEN_KEEPALIVE
int wasm_native_load_image_from_url(const char* url, const char* params,
                                  void (*callback)(const char* file_path, int success, void* user_data),
                                  void* user_data) {
    if (!url) {
        if (callback) callback(NULL, 0, user_data);
        return 0;
    }
    
    // Generate cache key
    char cache_key[64];
    generate_cache_key(url, params, cache_key, sizeof(cache_key));
    
    // Check cache first
    check_cache_cleanup();
    WASMNativeCacheEntry* entry = find_cache_entry(cache_key);
    
    if (entry) {
        // Cache hit - update access info and return
        entry->access_count++;
        entry->timestamp = get_current_time_ms();
        
        printf("Cache hit for %s -> %s\n", url, entry->file_path);
        
        if (callback) {
            callback(entry->file_path, 1, user_data);
        }
        return 1;
    }
    
    // Cache miss - need to download
    printf("Cache miss for %s, downloading...\n", url);
    
#ifdef __EMSCRIPTEN__
    AsyncLoadContext* ctx = malloc(sizeof(AsyncLoadContext));
    if (!ctx) {
        if (callback) callback(NULL, 0, user_data);
        return 0;
    }
    
    ctx->url = strdup(url);
    ctx->cache_key = strdup(cache_key);
    ctx->callback = callback;
    ctx->user_data = user_data;
    
    emscripten_fetch_attr_t attr;
    emscripten_fetch_attr_init(&attr);
    strcpy(attr.requestMethod, "GET");
    attr.attributes = EMSCRIPTEN_FETCH_LOAD_TO_MEMORY;
    attr.onsuccess = async_load_onload;
    attr.onerror = async_load_onerror;
    attr.userData = ctx;
    
    emscripten_fetch(&attr, url);
    return 1;
#else
    // Non-Emscripten environment - simulate success
    printf("Simulating async load for %s\n", url);
    if (callback) {
        callback("/simulated/path", 1, user_data);
    }
    return 1;
#endif
}

/**
 * Process image with caching
 */
EMSCRIPTEN_KEEPALIVE
int wasm_native_process_with_cache(const uint8_t* input_data, size_t input_size,
                                 const char* operation, const char* params,
                                 uint8_t** output_data, size_t* output_size) {
    if (!input_data || !input_size || !operation || !output_data || !output_size) {
        return 0;
    }
    
    // Generate cache key for processed result
    char cache_key[128];
    snprintf(cache_key, sizeof(cache_key), "processed_%s_%s_%08x", 
             operation, params ? params : "", 
             (unsigned int)(input_size ^ (uintptr_t)input_data));
    
    // Check cache
    check_cache_cleanup();
    WASMNativeCacheEntry* entry = find_cache_entry(cache_key);
    
    if (entry) {
        // Load cached result
        FILE* file = fopen(entry->file_path, "rb");
        if (file) {
            fseek(file, 0, SEEK_END);
            size_t size = ftell(file);
            fseek(file, 0, SEEK_SET);
            
            *output_data = malloc(size);
            if (*output_data && fread(*output_data, 1, size, file) == size) {
                *output_size = size;
                fclose(file);
                
                // Update cache stats
                entry->access_count++;
                entry->timestamp = get_current_time_ms();
                
                printf("Cache hit for processing operation %s\n", operation);
                return 1;
            }
            
            free(*output_data);
            *output_data = NULL;
            fclose(file);
        }
    }
    
    // Cache miss - perform processing
    printf("Processing %s (cache miss)...\n", operation);
    
    // For demonstration, we'll do a simple WebP re-encoding
    // In a real implementation, this would support various operations
    
    int width, height;
    if (!WebPGetInfo(input_data, input_size, &width, &height)) {
        printf("Invalid WebP input data\n");
        return 0;
    }
    
    // Decode to RGBA
    uint8_t* rgba_data = WebPDecodeRGBA(input_data, input_size, &width, &height);
    if (!rgba_data) {
        printf("Failed to decode WebP\n");
        return 0;
    }
    
    // Apply processing (example: adjust quality)
    float quality = 80.0f;  // default
    if (params && strstr(params, "quality=")) {
        sscanf(strstr(params, "quality="), "quality=%f", &quality);
    }
    
    // Re-encode with new settings
    size_t encoded_size = WebPEncodeRGBA(rgba_data, width, height, width * 4, 
                                       quality, output_data);
    
    WebPFree(rgba_data);
    
    if (encoded_size == 0) {
        printf("Failed to encode WebP\n");
        return 0;
    }
    
    *output_size = encoded_size;
    
    // Save to cache
    char cache_file_path[256];
    snprintf(cache_file_path, sizeof(cache_file_path), 
             "%s/%s.webp", WASM_NATIVE_IMAGE_CACHE, cache_key);
    
    FILE* cache_file = fopen(cache_file_path, "wb");
    if (cache_file) {
        if (fwrite(*output_data, 1, encoded_size, cache_file) == encoded_size) {
            add_cache_entry(cache_key, cache_file_path, encoded_size);
            
            // Sync with persistent storage
            if (g_cache.persistent_storage_available) {
#ifdef __EMSCRIPTEN__
                EM_ASM({
                    FS.syncfs(false, function(err) {
                        if (err) console.warn('Processing cache sync failed:', err);
                    });
                });
#endif
            }
            
            printf("Cached processing result for %s\n", operation);
        } else {
            printf("Failed to write processing cache\n");
        }
        fclose(cache_file);
    }
    
    return 1;
}

/**
 * Get cache statistics
 */
EMSCRIPTEN_KEEPALIVE
void wasm_native_get_cache_stats(int* entry_count, size_t* total_size, 
                                int* persistent_enabled) {
    check_cache_cleanup();
    
    if (entry_count) *entry_count = g_cache.count;
    if (total_size) *total_size = g_cache.total_size;
    if (persistent_enabled) *persistent_enabled = g_cache.persistent_storage_available;
}

/**
 * Clear cache
 */
EMSCRIPTEN_KEEPALIVE
int wasm_native_clear_cache(void) {
    printf("Clearing WASM-native cache...\n");
    
    // Remove all cache files and entries
    for (int i = 0; i < g_cache.count; i++) {
        remove(g_cache.entries[i].file_path);
        free(g_cache.entries[i].key);
        free(g_cache.entries[i].file_path);
    }
    
    g_cache.count = 0;
    g_cache.total_size = 0;
    
    // Sync with persistent storage
    if (g_cache.persistent_storage_available) {
#ifdef __EMSCRIPTEN__
        EM_ASM({
            FS.syncfs(false, function(err) {
                if (err) console.warn('Cache clear sync failed:', err);
                else console.log('Cache cleared and synced');
            });
        });
#endif
    }
    
    printf("Cache cleared (%d entries removed)\n", g_cache.count);
    return 1;
}