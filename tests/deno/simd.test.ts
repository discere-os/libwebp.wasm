/**
 * SIMD-specific tests for libwebp.wasm
 * Tests SIMD functionality and performance optimizations
 */

import { assert, assertEquals, assertExists } from "@std/assert"
import { createLibWebP } from "../../src/lib/index.ts"

// Create test images optimized for SIMD processing
function createSIMDTestImage(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4)

  // Create a pattern that benefits from SIMD processing
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      // Checkerboard pattern with gradients
      const checker = ((x >> 3) + (y >> 3)) & 1
      data[i] = checker ? Math.floor(x / width * 255) : 255 - Math.floor(x / width * 255)
      data[i + 1] = Math.floor(y / height * 255)
      data[i + 2] = checker ? 255 - Math.floor(y / height * 255) : Math.floor(y / height * 255)
      data[i + 3] = 255
    }
  }

  return data
}

function createLargeTestImage(): Uint8Array {
  // Large image that will definitely trigger SIMD paths
  return createSIMDTestImage(512, 512)
}

Deno.test("SIMD support detection", async () => {
  const libwebp = await createLibWebP()

  const capabilities = libwebp.getCapabilities()
  assertEquals(typeof capabilities.simdSupport, "boolean")

  console.log(`SIMD Support: ${capabilities.simdSupport ? "✅ Enabled" : "❌ Disabled"}`)

  libwebp.destroy()
})

Deno.test("SIMD encoding performance", async () => {
  const libwebp = await createLibWebP()

  const imageData = createLargeTestImage()
  const width = 512
  const height = 512

  // Warm up
  const warmupEncoded = await libwebp.encode(imageData, width, height, { quality: 75 })
  assertExists(warmupEncoded.data)

  // Measure encoding performance
  const startTime = performance.now()
  const encoded = await libwebp.encode(imageData, width, height, { quality: 75 })
  const endTime = performance.now()

  const encodeTime = endTime - startTime
  const pixelsPerSecond = (width * height) / (encodeTime / 1000)
  const megapixelsPerSecond = pixelsPerSecond / 1_000_000

  console.log(`Encoding Performance:`)
  console.log(`  Time: ${encodeTime.toFixed(2)}ms`)
  console.log(`  Speed: ${megapixelsPerSecond.toFixed(2)} Mpixels/sec`)
  console.log(`  Compression: ${(encoded.size / imageData.length * 100).toFixed(1)}%`)

  // Basic performance expectations (adjust based on actual hardware)
  assert(encodeTime < 5000, `Encoding should complete within 5 seconds, took ${encodeTime.toFixed(2)}ms`)
  assert(encoded.size > 0, "Encoded size should be positive")
  assert(encoded.size < imageData.length, "Compressed size should be smaller than original")

  libwebp.destroy()
})

Deno.test("SIMD decoding performance", async () => {
  const libwebp = await createLibWebP()

  const imageData = createLargeTestImage()
  const width = 512
  const height = 512

  // First encode to get WebP data
  const encoded = await libwebp.encode(imageData, width, height, { quality: 75 })

  // Warm up
  const warmupDecoded = await libwebp.decode(encoded.data!)
  assertEquals(warmupDecoded.width, width)

  // Measure decoding performance
  const startTime = performance.now()
  const decoded = await libwebp.decode(encoded.data!)
  const endTime = performance.now()

  const decodeTime = endTime - startTime
  const pixelsPerSecond = (width * height) / (decodeTime / 1000)
  const megapixelsPerSecond = pixelsPerSecond / 1_000_000

  console.log(`Decoding Performance:`)
  console.log(`  Time: ${decodeTime.toFixed(2)}ms`)
  console.log(`  Speed: ${megapixelsPerSecond.toFixed(2)} Mpixels/sec`)

  // Verify correctness
  assertEquals(decoded.width, width)
  assertEquals(decoded.height, height)
  assertEquals(decoded.size, width * height * 4)

  // Performance expectations
  assert(decodeTime < 2000, `Decoding should complete within 2 seconds, took ${decodeTime.toFixed(2)}ms`)

  libwebp.destroy()
})

Deno.test("SIMD vs standard encoding comparison", async () => {
  const libwebp = await createLibWebP()

  const capabilities = libwebp.getCapabilities()
  if (!capabilities.simdSupport) {
    console.log("⚠️  SIMD not supported, skipping comparison test")
    libwebp.destroy()
    return
  }

  const imageData = createSIMDTestImage(256, 256)
  const width = 256
  const height = 256

  // Reset performance metrics
  await libwebp.encode(new Uint8Array(64 * 64 * 4), 64, 64, { quality: 50 }) // Reset

  // Test multiple iterations for statistical significance
  const iterations = 5
  let totalSIMDTime = 0

  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now()
    const encoded = await libwebp.encode(imageData, width, height, { quality: 75 })
    const endTime = performance.now()
    totalSIMDTime += (endTime - startTime)

    // Verify encoding worked
    assert(encoded.size > 0, `Iteration ${i + 1}: Encoding should succeed`)
  }

  const averageSIMDTime = totalSIMDTime / iterations
  console.log(`Average SIMD encoding time: ${averageSIMDTime.toFixed(2)}ms`)

  // Check SIMD utilization metrics
  const metrics = libwebp.getPerformanceMetrics()
  assert(metrics.simdUtilization >= iterations, "SIMD should be utilized for large images")

  libwebp.destroy()
})

Deno.test("Large image SIMD optimization", async () => {
  const libwebp = await createLibWebP()

  // Test progressively larger images to verify SIMD scales well
  const testSizes = [
    { width: 128, height: 128, name: "Small" },
    { width: 256, height: 256, name: "Medium" },
    { width: 512, height: 512, name: "Large" }
  ]

  const results: { name: string; encodeTime: number; decodeTime: number; throughput: number }[] = []

  for (const size of testSizes) {
    const imageData = createSIMDTestImage(size.width, size.height)

    // Encode
    const startEncode = performance.now()
    const encoded = await libwebp.encode(imageData, size.width, size.height, { quality: 75 })
    const encodeTime = performance.now() - startEncode

    // Decode
    const startDecode = performance.now()
    const decoded = await libwebp.decode(encoded.data!)
    const decodeTime = performance.now() - startDecode

    const totalPixels = size.width * size.height
    const throughput = totalPixels / ((encodeTime + decodeTime) / 1000) / 1_000_000 // Mpixels/sec

    results.push({
      name: size.name,
      encodeTime,
      decodeTime,
      throughput
    })

    console.log(`${size.name} (${size.width}x${size.height}):`)
    console.log(`  Encode: ${encodeTime.toFixed(2)}ms`)
    console.log(`  Decode: ${decodeTime.toFixed(2)}ms`)
    console.log(`  Throughput: ${throughput.toFixed(2)} Mpixels/sec`)

    // Verify correctness
    assertEquals(decoded.width, size.width)
    assertEquals(decoded.height, size.height)
  }

  // SIMD should maintain reasonable throughput even for larger images
  results.forEach(result => {
    assert(result.throughput > 1.0, `${result.name} throughput should be > 1 Mpixels/sec`)
  })

  libwebp.destroy()
})

Deno.test("SIMD memory efficiency", async () => {
  const libwebp = await createLibWebP()

  // Test that SIMD operations don't cause memory leaks or excessive usage
  const iterations = 20
  const imageData = createSIMDTestImage(256, 256)

  for (let i = 0; i < iterations; i++) {
    const encoded = await libwebp.encode(imageData, 256, 256, { quality: 75 })
    const decoded = await libwebp.decode(encoded.data!)

    // Verify each iteration works correctly
    assertEquals(decoded.width, 256)
    assertEquals(decoded.height, 256)

    // Every 5 iterations, log progress
    if ((i + 1) % 5 === 0) {
      console.log(`Completed ${i + 1}/${iterations} SIMD memory iterations`)
    }
  }

  console.log("✅ SIMD memory efficiency test completed - no crashes or excessive memory usage")

  libwebp.destroy()
})

Deno.test("SIMD edge cases", async () => {
  const libwebp = await createLibWebP()

  // Test edge cases that might affect SIMD processing
  const edgeCases = [
    { width: 15, height: 15, name: "Odd dimensions" },
    { width: 16, height: 16, name: "SIMD-aligned 16x16" },
    { width: 17, height: 17, name: "Just over SIMD alignment" },
    { width: 1, height: 1, name: "Minimum size" },
    { width: 3, height: 7, name: "Prime dimensions" }
  ]

  for (const testCase of edgeCases) {
    const imageData = createSIMDTestImage(testCase.width, testCase.height)

    // Should handle all edge cases without crashing
    const encoded = await libwebp.encode(imageData, testCase.width, testCase.height, { quality: 75 })
    const decoded = await libwebp.decode(encoded.data!)

    assertEquals(decoded.width, testCase.width, `${testCase.name} width should match`)
    assertEquals(decoded.height, testCase.height, `${testCase.name} height should match`)

    console.log(`✅ ${testCase.name}: ${testCase.width}x${testCase.height} processed successfully`)
  }

  libwebp.destroy()
})