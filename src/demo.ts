/**
 * LibWebP WASM Demo - WebP processing with SIMD optimizations
 * Demonstrates native C/C++ WebP functionality via minimal TypeScript bindings
 */

import { LibWebP, WebPColorspace, createLibWebP } from './lib/index.js'

/**
 * Demo: WebP encoding and decoding with performance metrics
 */
async function webpDemo() {
  console.log('🔥 LibWebP WASM Demo - Native-Level WebP Processing')
  console.log('================================================')

  try {
    // Initialize LibWebP with maximum browser features
    const webp = await createLibWebP({
      cdnUrl: 'https://cdn.discere.cloud/npm/@discere-os/libwebp.wasm/',
      maxMemoryMB: 256
    })

    console.log('✅ LibWebP initialized successfully')

    // Display capabilities
    const capabilities = webp.getCapabilities()
    console.log('\n📊 WebP Capabilities:')
    console.log(`  SIMD Support: ${capabilities.simdSupport ? '✅' : '❌'}`)
    console.log(`  Threading: ${capabilities.threadingSupport ? '✅' : '❌'}`)
    console.log(`  Animation: ${capabilities.animationSupport ? '✅' : '❌'}`)
    console.log(`  Lossless: ${capabilities.losslessSupport ? '✅' : '❌'}`)
    console.log(`  Alpha: ${capabilities.alphaSupport ? '✅' : '❌'}`)

    // Display version information
    const version = webp.getVersion()
    console.log(`\n🔢 LibWebP Version:`)
    console.log(`  Encoder: ${version.encoder}`)
    console.log(`  Decoder: ${version.decoder}`)

    // Create a test image (gradient pattern)
    const width = 512
    const height = 512
    const testImage = createTestImage(width, height)

    console.log(`\n🎨 Created test image: ${width}x${height} (${testImage.length} bytes)`)

    // Test different encoding quality levels
    const qualities = [25, 50, 75, 90]

    for (const quality of qualities) {
      console.log(`\n🔧 Encoding at quality ${quality}...`)

      const startTime = performance.now()

      // Encode to WebP using native C/C++ implementation
      const encoded = await webp.encode(testImage, width, height, {
        quality,
        method: 6,        // Maximum compression effort
        autoFilter: true,
        useSharpYUV: true // Better color conversion
      })

      const encodeTime = performance.now() - startTime
      const compressionRatio = encoded.data.length / testImage.length

      console.log(`  ⚡ Encoded in ${encodeTime.toFixed(2)}ms`)
      console.log(`  📦 Size: ${encoded.data.length} bytes (${(compressionRatio * 100).toFixed(1)}% of original)`)

      // Test decoding
      const decodeStartTime = performance.now()
      const decoded = await webp.decode(encoded.data)
      const decodeTime = performance.now() - decodeStartTime

      console.log(`  🔄 Decoded in ${decodeTime.toFixed(2)}ms`)
      console.log(`  🖼️  Output: ${decoded.width}x${decoded.height}, ${decoded.data.length} bytes`)

      // Verify dimensions match
      if (decoded.width !== width || decoded.height !== height) {
        throw new Error('Decoded image dimensions do not match original')
      }
    }

    // Test lossless encoding
    console.log(`\n🔧 Testing lossless encoding...`)
    const losslessStart = performance.now()

    const lossless = await webp.encode(testImage, width, height, {
      lossless: true,
      exact: true,
      method: 6
    })

    const losslessTime = performance.now() - losslessStart
    const losslessRatio = lossless.data.length / testImage.length

    console.log(`  ⚡ Lossless encoded in ${losslessTime.toFixed(2)}ms`)
    console.log(`  📦 Size: ${lossless.data.length} bytes (${(losslessRatio * 100).toFixed(1)}% of original)`)

    // Display final performance metrics
    const metrics = webp.getPerformanceMetrics()
    console.log(`\n📈 Performance Summary:`)
    console.log(`  Average decode time: ${metrics.decodeTime.toFixed(2)}ms`)
    console.log(`  Average encode time: ${metrics.encodeTime.toFixed(2)}ms`)
    console.log(`  SIMD utilization: ${metrics.simdUtilization} operations`)
    console.log(`  Best compression ratio: ${(metrics.compressionRatio * 100).toFixed(1)}%`)

    // Cleanup
    webp.destroy()
    console.log('\n✅ Demo completed successfully!')

  } catch (error) {
    console.error('\n❌ Demo failed:', (error as Error).message)
    console.error(error)
  }
}

/**
 * Create a test image with gradient pattern (RGBA)
 */
function createTestImage(width: number, height: number): Uint8Array {
  const imageData = new Uint8Array(width * height * 4) // RGBA

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4

      // Create a colorful gradient pattern
      const r = Math.floor((x / width) * 255)
      const g = Math.floor((y / height) * 255)
      const b = Math.floor(((x + y) / (width + height)) * 255)
      const a = 255 // Fully opaque

      imageData[index] = r
      imageData[index + 1] = g
      imageData[index + 2] = b
      imageData[index + 3] = a
    }
  }

  return imageData
}

/**
 * Browser compatibility check
 */
function checkBrowserCompatibility(): boolean {
  const requirements = {
    webAssembly: typeof WebAssembly !== 'undefined',
    simd: typeof (WebAssembly as any).simd !== 'undefined',
    // Note: We target WebGPU+SIMD browsers only
    webGPU: typeof navigator !== 'undefined' && 'gpu' in navigator
  }

  console.log('🌐 Browser Compatibility Check:')
  console.log(`  WebAssembly: ${requirements.webAssembly ? '✅' : '❌'}`)
  console.log(`  WASM SIMD: ${requirements.simd ? '✅' : '❌'}`)
  console.log(`  WebGPU: ${requirements.webGPU ? '✅' : '❌'}`)

  const compatible = requirements.webAssembly && requirements.simd

  if (!compatible) {
    console.log('\n⚠️  Please upgrade to Chrome/Edge 113+ for full native-level performance')
  }

  return compatible
}

// Run demo when module loads
if (typeof window !== 'undefined') {
  // Browser environment
  window.addEventListener('load', async () => {
    if (checkBrowserCompatibility()) {
      await webpDemo()
    }
  })
} else if (typeof process !== 'undefined') {
  // Node.js environment
  webpDemo().catch(console.error)
}