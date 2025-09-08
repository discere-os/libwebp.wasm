/**
 * TypeScript definitions for libwebp.wasm v1.4.0
 * Professional WASM-native interface for WebP image processing
 *
 * Based on libwebp v1.4.0 with SIMD optimizations and advanced WebP features
 */

// WebP Color Spaces
export enum WebPColorspace {
  YUV = 0,
  YUVA = 1,
  RGB = 2,
  RGBA = 3,
  ARGB = 4,
  BGRA = 5,
  BGRA_PRE_MUL = 6,
  BGR = 7,
  ALPHA_PLANE = 8
}

// WebP Encoding Preset
export enum WebPPreset {
  DEFAULT = 0,    // Default preset
  PICTURE = 1,    // Digital picture (portrait, inner shot)
  PHOTO = 2,      // Outdoor photograph (landscape)
  DRAWING = 3,    // Hand or line drawing
  ICON = 4,       // Small-sized colorful images
  TEXT = 5        // Text-like images
}

// WebP Image Hint
export enum WebPImageHint {
  DEFAULT = 0,    // No particular hint
  PICTURE = 1,    // Digital picture (portrait, inner shot)
  PHOTO = 2,      // Outdoor photograph (landscape)
  GRAPH = 3       // Discrete tone image (graph, map-tile etc)
}

// WebP Error codes
export enum WebPErrorCode {
  OK = 0,
  OUT_OF_MEMORY = 1,
  BITSTREAM_OUT_OF_MEMORY = 2,
  NULL_PARAMETER = 3,
  INVALID_CONFIGURATION = 4,
  BAD_DIMENSION = 5,
  PARTITION0_OVERFLOW = 6,
  PARTITION_OVERFLOW = 7,
  BAD_WRITE = 8,
  FILE_TOO_BIG = 9,
  USER_ABORT = 10,
  LAST = 11
}

// WebP Decoding State
export enum WebPDecodingState {
  HEADER_PARSING_FINALIZED = 0,
  HEADER_PARSED = 1,
  HEADER_PARSED_OK = 2,
  NOT_ENOUGH_DATA = 3,
  SUSPENDED = 4,
  DONE = 5,
  ERROR = 6
}

// Basic Emscripten module interface (simplified)
interface EmscriptenModule {
  _malloc(size: number): number
  _free(ptr: number): void
  ccall(ident: string, returnType: string, argTypes: string[], args: any[]): any
  HEAPU8: Uint8Array
  HEAPU32: Uint32Array
}

// Main libwebp.wasm module interface
export interface LibWebPModule extends EmscriptenModule {
  // Memory management
  _malloc(size: number): number
  _free(ptr: number): void

  // Basic WebP decoding functions
  _WebPGetDecoderVersion(): number
  _WebPGetInfo(data: number, dataSize: number, width: number, height: number): number
  _WebPDecodeRGBA(data: number, dataSize: number, width: number, height: number): number
  _WebPDecodeRGB(data: number, dataSize: number, width: number, height: number): number
  _WebPDecodeBGRA(data: number, dataSize: number, width: number, height: number): number
  _WebPDecodeBGR(data: number, dataSize: number, width: number, height: number): number
  _WebPDecodeYUV(data: number, dataSize: number, width: number, height: number): number

  // Advanced WebP decoding functions
  _WebPDecodeRGBAInto(data: number, dataSize: number, output: number, outputSize: number, outputStride: number): number
  _WebPDecodeRGBInto(data: number, dataSize: number, output: number, outputSize: number, outputStride: number): number
  _WebPDecodeBGRAInto(data: number, dataSize: number, output: number, outputSize: number, outputStride: number): number
  _WebPDecodeBGRInto(data: number, dataSize: number, output: number, outputSize: number, outputStride: number): number
  _WebPDecodeYUVInto(data: number, dataSize: number, luma: number, lumaSize: number, lumaStride: number,
                     u: number, uSize: number, uStride: number,
                     v: number, vSize: number, vStride: number): number

  // Basic WebP encoding functions
  _WebPGetEncoderVersion(): number
  _WebPEncodeRGBA(rgba: number, width: number, height: number, stride: number, qualityFactor: number, output: number): number
  _WebPEncodeRGB(rgb: number, width: number, height: number, stride: number, qualityFactor: number, output: number): number
  _WebPEncodeBGRA(bgra: number, width: number, height: number, stride: number, qualityFactor: number, output: number): number
  _WebPEncodeBGR(bgr: number, width: number, height: number, stride: number, qualityFactor: number, output: number): number

  // Lossless encoding
  _WebPEncodeLosslessRGBA(rgba: number, width: number, height: number, stride: number, output: number): number
  _WebPEncodeLosslessRGB(rgb: number, width: number, height: number, stride: number, output: number): number
  _WebPEncodeLosslessBGRA(bgra: number, width: number, height: number, stride: number, output: number): number
  _WebPEncodeLosslessBGR(bgr: number, width: number, height: number, stride: number, output: number): number

  // WASM-native optimized functions
  _webp_wasm_decode_rgba_simd(data: number, dataSize: number, width: number, height: number, output: number): number
  _webp_wasm_encode_rgba_simd(rgba: number, width: number, height: number, quality: number, output: number): number
  _webp_wasm_get_simd_support(): number
  _webp_wasm_set_simd_enabled(enabled: number): void

  // Animation support
  _WebPAnimDecoderNew(webpData: number, decOptions: number): number
  _WebPAnimDecoderDelete(dec: number): void
  _WebPAnimDecoderGetNext(dec: number, buf: number, timestamp: number): number
  _WebPAnimDecoderHasMoreFrames(dec: number): number
  _WebPAnimDecoderReset(dec: number): void
  _WebPAnimDecoderGetInfo(dec: number, info: number): number

  _WebPAnimEncoderNew(width: number, height: number, encOptions: number): number
  _WebPAnimEncoderDelete(enc: number): void
  _WebPAnimEncoderAdd(enc: number, frame: number, timestamp: number, config: number): number
  _WebPAnimEncoderAssemble(enc: number, webpData: number): number

  // Memory and utility functions
  _WebPFree(ptr: number): void
  _WebPSafeMalloc(nmemb: number, size: number): number
  _WebPSafeFree(ptr: number, size: number): void

  // Error handling (WASM-native)
  _webp_wasm_get_last_error(): string
  _webp_wasm_set_error_callback(callback: number): void

  // Dynamic loading functions (MAIN_MODULE only)
  _dlopen?(filename: string, flags: number): number
  _dlsym?(handle: number, symbol: string): number
  _dlclose?(handle: number): number
}

// WebP image metadata
export interface WebPImageInfo {
  width: number
  height: number
  hasAlpha: boolean
  hasAnimation: boolean
  format: WebPColorspace
  quality?: number
  animFrameCount?: number
  animDuration?: number
}

// WebP decoding options
export interface WebPDecodeOptions {
  colorspace?: WebPColorspace
  cropLeft?: number
  cropTop?: number
  cropWidth?: number
  cropHeight?: number
  scaleWidth?: number
  scaleHeight?: number
  dithering?: boolean
  alphaDithering?: boolean
  flip?: boolean
  useThreads?: boolean
  bypassFiltering?: boolean
  noFancyUpsampling?: boolean
}

// WebP encoding options
export interface WebPEncodeOptions {
  quality?: number            // 0-100, default 75
  method?: number            // 0-6, default 4
  targetSize?: number        // Target size in bytes
  targetPSNR?: number        // Target PSNR
  segments?: number          // 1-4, default 4
  snsStrength?: number       // 0-100, default 50
  filterStrength?: number    // 0-100, default 60
  filterSharpness?: number   // 0-7, default 0
  filterType?: number        // 0-1, default 1
  autoFilter?: boolean       // Default false
  alphaCompression?: number  // 0-1, default 1
  alphaFiltering?: number    // 0-2, default 1
  alphaQuality?: number      // 0-100, default 100
  pass?: number              // 1-10, default 1
  showCompressed?: boolean   // Default false
  preprocessing?: number     // 0-7, default 0
  partitions?: number        // 0-3, default 0
  partitionLimit?: number    // 0-100, default 0
  preset?: WebPPreset        // Default WebPPreset.DEFAULT
  imageHint?: WebPImageHint  // Default WebPImageHint.DEFAULT
  lossless?: boolean         // Default false
  exact?: boolean           // Default false
  nearLossless?: number      // 0-100, default 100
  useDeltaPalette?: boolean  // Default false
  useSharpYUV?: boolean      // Default false
}

// WebP animation options
export interface WebPAnimationOptions {
  backgroundColor?: number   // RGBA background color
  loopCount?: number        // 0 = infinite
  minimize?: boolean        // Minimize output size
  allowMixed?: boolean      // Allow mixed lossy/lossless frames
  verbose?: boolean         // Verbose output
  kMax?: number            // Maximum distance for color-cache
  kMin?: number            // Minimum distance for color-cache
}

// WebP processing result
export interface WebPResult {
  data: Uint8Array
  width: number
  height: number
  format: WebPColorspace
  quality?: number
  size: number
}

// WebP animation frame
export interface WebPAnimationFrame {
  data: Uint8Array
  timestamp: number
  duration: number
  width: number
  height: number
  x: number
  y: number
  dispose: boolean
  blend: boolean
}

// WebP capabilities detection
export interface WebPCapabilities {
  simdSupport: boolean
  threadingSupport: boolean
  animationSupport: boolean
  losslessSupport: boolean
  alphaSupport: boolean
  nearLosslessSupport: boolean
}

// WebP loading options
export interface WebPLoadingOptions {
  cdnUrl: string
  fallbackUrls: string[]
  timeout?: number
  retryCount?: number
  useCache?: boolean
  maxMemoryMB?: number
}

// Error classes
export class WebPError extends Error {
  constructor(message: string, public readonly code?: number) {
    super(message)
    this.name = 'WebPError'
  }
}

export class WebPFormatError extends WebPError {
  constructor(message: string) {
    super(message)
    this.name = 'WebPFormatError'
  }
}

export class WebPMemoryError extends WebPError {
  constructor(message: string) {
    super(message)
    this.name = 'WebPMemoryError'
  }
}

export class WebPEncodingError extends WebPError {
  constructor(message: string) {
    super(message)
    this.name = 'WebPEncodingError'
  }
}

// Performance monitoring
export interface WebPPerformanceMetrics {
  decodeTime: number
  encodeTime: number
  memoryUsage: number
  simdUtilization: number
  compressionRatio: number
}