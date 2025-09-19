/**
 * Comprehensive demo for libwebp.wasm - Full-featured WebP processing demonstration
 *
 * Features demonstrated:
 * - SIMD-optimized encoding/decoding
 * - Performance benchmarking
 * - Memory usage tracking
 * - Error handling patterns
 * - WebP capabilities detection
 */

import { LibWebP, WebPColorspace } from "./src/lib/index.ts"

// Test image data - create a simple red gradient for testing
function createTestImageRGBA(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = Math.floor((x / width) * 255)     // Red gradient
      data[i + 1] = Math.floor((y / height) * 255) // Green gradient
      data[i + 2] = 128                             // Blue constant
      data[i + 3] = 255                             // Alpha opaque
    }
  }

  return data
}

async function demonstrateWebPProcessing() {
  console.log("🚀 Starting libwebp.wasm comprehensive demo...")
  console.log("=" .repeat(50))

  try {
    // Initialize libwebp with custom options
    console.log("📦 Initializing libwebp.wasm...")
    const webp = new LibWebP({
      timeout: 10000,
      maxMemoryMB: 256
    })

    await webp.initialize()
    console.log("✅ libwebp.wasm initialized successfully")

    // Display capabilities
    console.log("\n🔧 WebP Capabilities:")
    const capabilities = webp.getCapabilities()
    console.log(`  SIMD Support: ${capabilities.simdSupport ? '✅' : '❌'}`)
    console.log(`  Threading Support: ${capabilities.threadingSupport ? '✅' : '❌'}`)
    console.log(`  Animation Support: ${capabilities.animationSupport ? '✅' : '❌'}`)
    console.log(`  Lossless Support: ${capabilities.losslessSupport ? '✅' : '❌'}`)
    console.log(`  Alpha Support: ${capabilities.alphaSupport ? '✅' : '❌'}`)

    // Display version info
    const version = webp.getVersion()
    console.log(`  Encoder Version: ${version.encoder}`)
    console.log(`  Decoder Version: ${version.decoder}`)

    // Test with different image sizes for performance comparison
    const testSizes = [
      { width: 64, height: 64, name: "Small (64x64)" },
      { width: 256, height: 256, name: "Medium (256x256)" },
      { width: 512, height: 512, name: "Large (512x512)" }
    ]

    for (const testSize of testSizes) {
      console.log(`\n🖼️  Testing ${testSize.name}...`)

      // Create test image
      const imageData = createTestImageRGBA(testSize.width, testSize.height)
      console.log(`  Created ${testSize.width}x${testSize.height} RGBA image (${imageData.length} bytes)`)

      // Test lossy encoding
      console.log("  📦 Encoding (lossy, quality 75)...")
      const startEncode = performance.now()
      const encoded = await webp.encode(imageData, testSize.width, testSize.height, {
        quality: 75,
        lossless: false
      })
      const encodeTime = performance.now() - startEncode

      console.log(`  ✅ Encoded in ${encodeTime.toFixed(2)}ms`)
      console.log(`  📊 Compression: ${imageData.length} → ${encoded.size} bytes (${(encoded.size / imageData.length * 100).toFixed(1)}%)`)

      // Test decoding
      console.log("  🔓 Decoding...")
      const startDecode = performance.now()
      const decoded = await webp.decode(encoded.data!)
      const decodeTime = performance.now() - startDecode

      console.log(`  ✅ Decoded in ${decodeTime.toFixed(2)}ms`)
      console.log(`  📊 Output: ${decoded.width}x${decoded.height} RGBA (${decoded.size} bytes)`)

      // Verify dimensions
      if (decoded.width !== testSize.width || decoded.height !== testSize.height) {
        throw new Error(`Dimension mismatch: expected ${testSize.width}x${testSize.height}, got ${decoded.width}x${decoded.height}`)
      }

      // Test lossless encoding for comparison
      console.log("  📦 Encoding (lossless)...")
      const startLossless = performance.now()
      const encodedLossless = await webp.encode(imageData, testSize.width, testSize.height, {
        lossless: true
      })
      const losslessTime = performance.now() - startLossless

      console.log(`  ✅ Lossless encoded in ${losslessTime.toFixed(2)}ms`)
      console.log(`  📊 Lossless size: ${encodedLossless.size} bytes (${(encodedLossless.size / imageData.length * 100).toFixed(1)}%)`)

      // Performance summary
      const totalPixels = testSize.width * testSize.height
      const encodeSpeed = totalPixels / encodeTime * 1000 // pixels per second
      const decodeSpeed = totalPixels / decodeTime * 1000

      console.log(`  ⚡ Encode Speed: ${(encodeSpeed / 1000000).toFixed(2)} Mpixels/sec`)
      console.log(`  ⚡ Decode Speed: ${(decodeSpeed / 1000000).toFixed(2)} Mpixels/sec`)
    }

    // Test image info extraction
    console.log("\n📋 Testing image info extraction...")
    const testImageData = createTestImageRGBA(128, 128)
    const encodedForInfo = await webp.encode(testImageData, 128, 128, { quality: 80 })
    const imageInfo = await webp.getImageInfo(encodedForInfo.data!)

    console.log(`  Detected dimensions: ${imageInfo.width}x${imageInfo.height}`)
    console.log(`  Has alpha: ${imageInfo.hasAlpha}`)
    console.log(`  Has animation: ${imageInfo.hasAnimation}`)
    console.log(`  Format: ${imageInfo.format}`)

    // Performance metrics summary
    console.log("\n📊 Performance Metrics:")
    const metrics = webp.getPerformanceMetrics()
    console.log(`  Last decode time: ${metrics.decodeTime.toFixed(2)}ms`)
    console.log(`  Last encode time: ${metrics.encodeTime.toFixed(2)}ms`)
    console.log(`  SIMD utilization count: ${metrics.simdUtilization}`)
    console.log(`  Last compression ratio: ${(metrics.compressionRatio * 100).toFixed(1)}%`)

    // Test error handling
    console.log("\n🚨 Testing error handling...")
    try {
      const invalidWebP = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]) // Invalid WebP data
      await webp.decode(invalidWebP)
      console.log("  ❌ Should have thrown error for invalid data")
    } catch (error) {
      console.log(`  ✅ Correctly caught error: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Cleanup
    console.log("\n🧹 Cleaning up...")
    webp.destroy()
    console.log("  ✅ Resources freed")

    console.log("\n🎉 Demo completed successfully!")
    console.log("=" .repeat(50))

  } catch (error) {
    console.error("❌ Demo failed:", error instanceof Error ? error.message : String(error))
    throw error
  }
}

// Run the demo
if (import.meta.main) {
  await demonstrateWebPProcessing()
}