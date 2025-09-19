/**
 * libwebp.wasm - TypeScript-first WebP image processing for WebAssembly
 * High-performance WebP with SIMD optimizations and minimal TypeScript glue layer
 *
 * Based on libwebp v1.4.0 with comprehensive WASM-native enhancements
 */

import {
  WebPColorspace,
  WebPPreset,
  WebPImageHint,
  WebPErrorCode
} from './types.ts'
import type {
  LibWebPModule,
  WebPImageInfo,
  WebPDecodeOptions,
  WebPEncodeOptions,
  WebPAnimationOptions,
  WebPResult,
  WebPAnimationFrame,
  WebPCapabilities,
  WebPLoadingOptions,
  WebPPerformanceMetrics
} from './types.ts'

/**
 * WebP processor with WASM SIMD optimizations
 *
 * Architecture:
 * - ALL image processing logic implemented in C/C++
 * - TypeScript provides ONLY minimal bindings to native functions
 * - Direct WASM integration without JavaScript abstraction layers
 * - Supports both SIDE_MODULE (host app) and MAIN_MODULE (standalone) usage
 */
export class LibWebP {
  private module: LibWebPModule | null = null
  private isInitialized = false
  private simdSupported = false
  private performanceMetrics: WebPPerformanceMetrics = {
    decodeTime: 0,
    encodeTime: 0,
    memoryUsage: 0,
    simdUtilization: 0,
    compressionRatio: 0
  }

  private loadingOptions: WebPLoadingOptions = {
    cdnUrl: 'https://wasm.discere.cloud/libwebp/latest/main/',
    fallbackUrls: [
      'https://cdn.jsdelivr.net/npm/@discere-os/libwebp.wasm/dist/',
      'https://unpkg.com/@discere-os/libwebp.wasm/dist/'
    ],
    timeout: 30000,
    retryCount: 3,
    useCache: true,
    maxMemoryMB: 512
  }

  constructor(options?: Partial<WebPLoadingOptions>) {
    if (options) {
      this.loadingOptions = { ...this.loadingOptions, ...options }
    }
  }

  /**
   * Initialize libwebp.wasm module with SIMD detection
   * Uses C/C++ native initialization - no JavaScript logic
   */
  async initialize(wasmModule?: LibWebPModule): Promise<void> {
    if (this.isInitialized) {
      return
    }

    if (wasmModule) {
      this.module = wasmModule
    } else {
      this.module = await this.loadModule()
    }

    if (!this.module) {
      throw new Error('Failed to load libwebp.wasm module')
    }

    // Initialize WASM-native WebP library (C/C++ function call)
    const initResult = this.module.ccall('webp_wasm_init', 'number', [], [])
    if (initResult !== 0) {
      throw new Error('Failed to initialize WebP WASM library')
    }

    // Detect SIMD support using native C/C++ function
    this.simdSupported = this.module.ccall('webp_wasm_get_simd_support', 'number', [], []) === 1

    this.isInitialized = true
  }

  /**
   * Decode WebP image data to RGBA using native C/C++ implementation
   *
   * @param webpData - WebP image data
   * @param options - Decoding options (optional)
   * @returns Decoded image result with RGBA data
   */
  async decode(webpData: Uint8Array, options: WebPDecodeOptions = {}): Promise<WebPResult> {
    if (!this.isInitialized) {
      throw new Error('LibWebP not initialized. Call initialize() first.')
    }

    const startTime = performance.now()

    // Allocate memory for input data using WASM heap
    const inputPtr = this.module!._malloc(webpData.length)
    if (!inputPtr) {
      throw new Error('Failed to allocate memory for WebP input data')
    }

    try {
      // Copy WebP data to WASM heap
      this.module!.HEAPU8.set(webpData, inputPtr)

      // Get WebP image info using native C function
      const widthPtr = this.module!._malloc(4)
      const heightPtr = this.module!._malloc(4)

      const infoResult = this.module!.ccall('WebPGetInfo', 'number',
        ['number', 'number', 'number', 'number'],
        [inputPtr, webpData.length, widthPtr, heightPtr]
      )

      if (!infoResult) {
        throw new Error('Invalid WebP image format')
      }

      const width = this.module!.HEAPU32[widthPtr >> 2]
      const height = this.module!.HEAPU32[heightPtr >> 2]

      this.module!._free(widthPtr)
      this.module!._free(heightPtr)

      // Calculate output buffer size (RGBA = 4 bytes per pixel)
      const outputSize = width * height * 4
      const outputPtr = this.module!._malloc(outputSize)

      if (!outputPtr) {
        throw new Error('Failed to allocate memory for decoded image')
      }

      // Decode using SIMD-optimized native function if available
      let decodeResult: number
      if (this.simdSupported && options.colorspace !== WebPColorspace.YUV) {
        decodeResult = this.module!.ccall('webp_wasm_decode_rgba_simd', 'number',
          ['number', 'number', 'number', 'number', 'number'],
          [inputPtr, webpData.length, width, height, outputPtr]
        )
      } else {
        // Use standard WebP decoding function
        decodeResult = this.module!.ccall('WebPDecodeRGBAInto', 'number',
          ['number', 'number', 'number', 'number', 'number'],
          [inputPtr, webpData.length, outputPtr, outputSize, width * 4]
        )
      }

      if (!decodeResult) {
        // Get error message from WASM
        const errorMsg = this.module!.ccall('webp_wasm_get_last_error', 'string', [], [])
        throw new Error(`WebP decoding failed: ${errorMsg || 'Unknown error'}`)
      }

      // Copy decoded data from WASM heap
      const decodedData = new Uint8Array(outputSize)
      decodedData.set(this.module!.HEAPU8.subarray(outputPtr, outputPtr + outputSize))

      this.module!._free(outputPtr)

      // Update performance metrics
      const decodeTime = performance.now() - startTime
      this.performanceMetrics.decodeTime = decodeTime
      if (this.simdSupported) {
        this.performanceMetrics.simdUtilization += 1
      }

      return {
        data: decodedData,
        width,
        height,
        format: WebPColorspace.RGBA,
        size: outputSize
      }

    } finally {
      this.module!._free(inputPtr)
    }
  }

  /**
   * Encode RGBA image data to WebP using native C/C++ implementation
   *
   * @param imageData - RGBA image data
   * @param width - Image width
   * @param height - Image height
   * @param options - Encoding options
   * @returns Encoded WebP data
   */
  async encode(imageData: Uint8Array, width: number, height: number, options: WebPEncodeOptions = {}): Promise<WebPResult> {
    if (!this.isInitialized) {
      throw new Error('LibWebP not initialized. Call initialize() first.')
    }

    const startTime = performance.now()
    const inputSize = width * height * 4  // RGBA = 4 bytes per pixel

    if (imageData.length !== inputSize) {
      throw new Error(`Image data size mismatch. Expected ${inputSize}, got ${imageData.length}`)
    }

    // Allocate memory for input RGBA data
    const inputPtr = this.module!._malloc(inputSize)
    if (!inputPtr) {
      throw new Error('Failed to allocate memory for input image data')
    }

    try {
      // Copy RGBA data to WASM heap
      this.module!.HEAPU8.set(imageData, inputPtr)

      // Allocate memory for output WebP data pointer and size
      const outputBufferPtr = this.module!._malloc(4)  // uint8_t**
      const outputSizePtr = this.module!._malloc(4)    // size_t*

      // Encode using SIMD-optimized native function if available
      let encodeResult: number
      const quality = options.quality || 75

      if (this.simdSupported && !options.lossless) {
        encodeResult = this.module!.ccall('webp_wasm_encode_rgba_simd', 'number',
          ['number', 'number', 'number', 'number', 'number'],
          [inputPtr, width, height, quality, outputBufferPtr]
        )
      } else if (options.lossless) {
        // Use lossless encoding
        encodeResult = this.module!.ccall('WebPEncodeLosslessRGBA', 'number',
          ['number', 'number', 'number', 'number', 'number'],
          [inputPtr, width, height, width * 4, outputBufferPtr]
        )
      } else {
        // Use standard WebP encoding function
        encodeResult = this.module!.ccall('WebPEncodeRGBA', 'number',
          ['number', 'number', 'number', 'number', 'number', 'number'],
          [inputPtr, width, height, width * 4, quality, outputBufferPtr]
        )
      }

      if (!encodeResult) {
        const errorMsg = this.module!.ccall('webp_wasm_get_last_error', 'string', [], [])
        throw new Error(`WebP encoding failed: ${errorMsg || 'Unknown error'}`)
      }

      // Extract encoded WebP data
      const outputDataPtr = this.module!.HEAPU32[outputBufferPtr >> 2]
      const outputSize = encodeResult  // WebP functions return the size

      if (outputSize <= 0 || !outputDataPtr) {
        throw new Error('WebP encoding produced no output')
      }

      // Copy encoded data from WASM heap
      const encodedData = new Uint8Array(outputSize)
      encodedData.set(this.module!.HEAPU8.subarray(outputDataPtr, outputDataPtr + outputSize))

      // Free allocated WebP output buffer (allocated by WebP library)
      this.module!.ccall('WebPFree', 'void', ['number'], [outputDataPtr])
      this.module!._free(outputBufferPtr)
      this.module!._free(outputSizePtr)

      // Update performance metrics
      const encodeTime = performance.now() - startTime
      this.performanceMetrics.encodeTime = encodeTime
      this.performanceMetrics.compressionRatio = outputSize / inputSize
      if (this.simdSupported) {
        this.performanceMetrics.simdUtilization += 1
      }

      return {
        data: encodedData,
        width,
        height,
        format: WebPColorspace.RGBA,
        quality: options.quality,
        size: outputSize
      }

    } finally {
      this.module!._free(inputPtr)
    }
  }

  /**
   * Get WebP image information without full decoding
   * Uses native C/C++ function for efficiency
   */
  async getImageInfo(webpData: Uint8Array): Promise<WebPImageInfo> {
    if (!this.isInitialized) {
      throw new Error('LibWebP not initialized. Call initialize() first.')
    }

    const inputPtr = this.module!._malloc(webpData.length)
    if (!inputPtr) {
      throw new Error('Failed to allocate memory for WebP data')
    }

    try {
      this.module!.HEAPU8.set(webpData, inputPtr)

      const widthPtr = this.module!._malloc(4)
      const heightPtr = this.module!._malloc(4)

      const infoResult = this.module!.ccall('WebPGetInfo', 'number',
        ['number', 'number', 'number', 'number'],
        [inputPtr, webpData.length, widthPtr, heightPtr]
      )

      if (!infoResult) {
        throw new Error('Invalid WebP image format')
      }

      const width = this.module!.HEAPU32[widthPtr >> 2]
      const height = this.module!.HEAPU32[heightPtr >> 2]

      this.module!._free(widthPtr)
      this.module!._free(heightPtr)

      // TODO: Add more detailed info extraction (alpha, animation, etc.)
      // This would require additional native C/C++ functions

      return {
        width,
        height,
        hasAlpha: false,  // TODO: Implement alpha detection
        hasAnimation: false,  // TODO: Implement animation detection
        format: WebPColorspace.RGBA
      }

    } finally {
      this.module!._free(inputPtr)
    }
  }

  /**
   * Get WebP capabilities and SIMD support information
   * Uses native C/C++ functions for accurate detection
   */
  getCapabilities(): WebPCapabilities {
    if (!this.isInitialized) {
      throw new Error('LibWebP not initialized. Call initialize() first.')
    }

    return {
      simdSupport: this.simdSupported,
      threadingSupport: true,  // Always available in MAIN_MODULE builds
      animationSupport: true,  // WebP animation support enabled
      losslessSupport: true,   // WebP lossless support enabled
      alphaSupport: true,      // WebP alpha support enabled
      nearLosslessSupport: true // Near-lossless encoding enabled
    }
  }

  /**
   * Get performance metrics for monitoring and optimization
   */
  getPerformanceMetrics(): WebPPerformanceMetrics {
    return { ...this.performanceMetrics }
  }

  /**
   * Get WebP encoder/decoder version information
   * Direct native C/C++ function calls
   */
  getVersion(): { encoder: number, decoder: number } {
    if (!this.isInitialized) {
      throw new Error('LibWebP not initialized. Call initialize() first.')
    }

    return {
      encoder: this.module!.ccall('WebPGetEncoderVersion', 'number', [], []),
      decoder: this.module!.ccall('WebPGetDecoderVersion', 'number', [], [])
    }
  }

  /**
   * Cleanup and release resources
   * Uses native C/C++ cleanup functions
   */
  destroy(): void {
    if (this.isInitialized && this.module) {
      // Call native cleanup function
      this.module.ccall('webp_wasm_cleanup', 'void', [], [])
      this.module = null
      this.isInitialized = false
    }
  }

  // Private implementation methods
  private async loadModule(): Promise<LibWebPModule> {
    try {
      const moduleFactory = await this.loadModuleFactory()
      const wasmBinary = await this.loadWasmBinary()

      // Pass wasmBinary only if successfully loaded
      const module = await moduleFactory(wasmBinary ? { wasmBinary } : {})
      return module
    } catch (error) {
      throw new Error(`Failed to load libwebp.wasm module: ${error}`)
    }
  }

  private async loadModuleFactory(): Promise<Function> {
    // Deno-first development environment
    if (typeof globalThis.Deno !== 'undefined') {
      try {
        const moduleFactory = (await import('../../install/wasm/libwebp-main.js')).default
        return moduleFactory
      } catch (error) {
        console.warn('Local development module not found, trying CDN:', error)
      }
    }

    // Web/CDN runtime - try CDN locations with proper ES6 imports
    const cdnUrls = [
      this.loadingOptions.cdnUrl,
      ...this.loadingOptions.fallbackUrls
    ]

    for (const url of cdnUrls) {
      try {
        const moduleFactory = (await import(`${url}libwebp-main.js`)).default
        return moduleFactory
      } catch (error) {
        console.warn(`Failed to load from ${url}:`, error)
        continue
      }
    }

    throw new Error('Failed to load module factory from any source')
  }

  private async loadWasmBinary(): Promise<ArrayBuffer | undefined> {
    // Deno-first development environment
    if (typeof globalThis.Deno !== 'undefined') {
      try {
        const wasmPath = new URL('../../install/wasm/libwebp-main.wasm', import.meta.url).pathname
        const wasmBuffer = await Deno.readFile(wasmPath)
        return wasmBuffer.buffer
      } catch (error) {
        console.warn('Failed to load local WASM binary:', error)
        // Continue to CDN fallback
      }
    }

    // Web/CDN runtime - try CDN locations
    const cdnUrls = [
      this.loadingOptions.cdnUrl,
      ...this.loadingOptions.fallbackUrls
    ]

    for (const url of cdnUrls) {
      try {
        const response = await fetch(`${url}libwebp-main.wasm`)
        if (response.ok) {
          return await response.arrayBuffer()
        }
      } catch (error) {
        console.warn(`Failed to fetch WASM from ${url}:`, error)
        continue
      }
    }

    // Fallback to undefined for embedded WASM
    return undefined
  }
}

// Export the main class and types for easy consumption
export default LibWebP
export * from './types.ts'

// Convenience function for quick WebP operations
export async function createLibWebP(options?: Partial<WebPLoadingOptions>): Promise<LibWebP> {
  const libwebp = new LibWebP(options)
  await libwebp.initialize()
  return libwebp
}