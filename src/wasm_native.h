/**
 * WASM-Native Filesystem and Caching Header for libwebp.wasm
 * 
 * This header defines the WASM-native API for advanced web integration
 * including persistent storage, async loading, and intelligent caching.
 * 
 * Copyright 2025 Superstruct Ltd, New Zealand
 * Licensed under BSD-3-Clause (same as libwebp)
 */

#ifndef WASM_NATIVE_H
#define WASM_NATIVE_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Initialize WASM-native file system with virtual directories and IDBFS
 * Returns: 1 on success, 0 on failure
 */
int wasm_native_init_filesystem(void);

/**
 * Set persistent storage availability (called from JavaScript after IDBFS sync)
 * @param available: 1 if persistent storage is available, 0 otherwise
 */
void wasm_native_set_persistent_storage(int available);

/**
 * Load image from URL with intelligent caching
 * 
 * This function implements the WASM-native pattern for async resource loading:
 * 1. Check local cache (memory + persistent storage)
 * 2. If cache miss, download asynchronously with emscripten_async_wget
 * 3. Store in cache with automatic management (LRU eviction, size limits)
 * 4. Sync with IndexedDB for persistence across browser sessions
 * 
 * @param url: URL to load image from
 * @param params: Optional parameters for cache key generation (can be NULL)
 * @param callback: Callback function called when loading completes
 * @param user_data: User data passed to callback
 * 
 * Returns: 1 if loading initiated successfully, 0 on error
 * 
 * Callback signature: void callback(const char* file_path, int success, void* user_data)
 * - file_path: Virtual file system path to loaded image (NULL on failure)
 * - success: 1 if successful, 0 if failed
 * - user_data: User data passed to wasm_native_load_image_from_url
 */
int wasm_native_load_image_from_url(const char* url, const char* params,
                                  void (*callback)(const char* file_path, int success, void* user_data),
                                  void* user_data);

/**
 * Process image with result caching
 * 
 * Implements intelligent caching for image processing operations:
 * 1. Generate cache key from input data, operation, and parameters
 * 2. Check cache for previously processed result
 * 3. If cache miss, perform processing and cache result
 * 4. Return processed data with cache statistics
 * 
 * @param input_data: Input image data
 * @param input_size: Size of input data
 * @param operation: Processing operation name (e.g., "resize", "compress")  
 * @param params: Operation parameters (e.g., "quality=80,width=500")
 * @param output_data: Pointer to receive output data (caller must free)
 * @param output_size: Pointer to receive output size
 * 
 * Returns: 1 on success, 0 on failure
 */
int wasm_native_process_with_cache(const uint8_t* input_data, size_t input_size,
                                 const char* operation, const char* params,
                                 uint8_t** output_data, size_t* output_size);

/**
 * Get cache statistics
 * 
 * @param entry_count: Pointer to receive number of cached entries (can be NULL)
 * @param total_size: Pointer to receive total cache size in bytes (can be NULL)  
 * @param persistent_enabled: Pointer to receive persistent storage status (can be NULL)
 */
void wasm_native_get_cache_stats(int* entry_count, size_t* total_size, 
                                int* persistent_enabled);

/**
 * Clear all cached data
 * Removes all cache entries and syncs with persistent storage
 * 
 * Returns: 1 on success, 0 on failure
 */
int wasm_native_clear_cache(void);

#ifdef __cplusplus
}
#endif

#endif // WASM_NATIVE_H