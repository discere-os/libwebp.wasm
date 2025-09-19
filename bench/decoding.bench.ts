/**
 * WebP decoding benchmarks for libwebp.wasm
 * Measures real-world decoding performance across different WebP types
 */

import { createLibWebP } from "../src/lib/index.ts"

// Test image generators
function createTestImage(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = Math.floor((x / width) * 255)       // Red gradient
      data[i + 1] = Math.floor((y / height) * 255)   // Green gradient
      data[i + 2] = 128                               // Blue constant
      data[i + 3] = 255                               // Alpha opaque
    }
  }
  return data
}

function createComplexImage(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      // Complex pattern that's challenging to compress
      const pattern = Math.sin(x * 0.1) * Math.cos(y * 0.1) * Math.sin((x + y) * 0.05)
      data[i] = Math.floor((Math.sin(x * 0.02) + 1) * 127.5)
      data[i + 1] = Math.floor((Math.cos(y * 0.02) + 1) * 127.5)
      data[i + 2] = Math.floor((pattern + 1) * 127.5)
      data[i + 3] = 255
    }
  }
  return data
}

// Global setup - pre-encode test images
let libwebp: any = null
let smallWebPLossy: Uint8Array
let smallWebPLossless: Uint8Array
let mediumWebPLossy: Uint8Array
let mediumWebPLossless: Uint8Array
let largeWebPLossy: Uint8Array
let complexWebPLossy: Uint8Array

// Setup before benchmarks
await (async () => {
  libwebp = await createLibWebP()
  console.log(`WebP initialized for decoding benchmarks (SIMD: ${libwebp.getCapabilities().simdSupport ? 'ON' : 'OFF'})`)

  // Pre-encode test images for decoding benchmarks
  console.log("Preparing encoded WebP images for decoding benchmarks...")

  const smallImage = createTestImage(256, 256)
  const mediumImage = createTestImage(512, 512)
  const largeImage = createTestImage(1024, 1024)
  const complexImage = createComplexImage(512, 512)

  // Encode test images
  smallWebPLossy = (await libwebp.encode(smallImage, 256, 256, { quality: 75 })).data
  smallWebPLossless = (await libwebp.encode(smallImage, 256, 256, { lossless: true })).data
  mediumWebPLossy = (await libwebp.encode(mediumImage, 512, 512, { quality: 75 })).data
  mediumWebPLossless = (await libwebp.encode(mediumImage, 512, 512, { lossless: true })).data
  largeWebPLossy = (await libwebp.encode(largeImage, 1024, 1024, { quality: 75 })).data
  complexWebPLossy = (await libwebp.encode(complexImage, 512, 512, { quality: 75 })).data

  console.log("✅ Encoded test images ready for decoding benchmarks")
})()

// Small image decoding benchmarks
Deno.bench("WebP decode 256x256 lossy", () => {
  libwebp.decode(smallWebPLossy)
})

Deno.bench("WebP decode 256x256 lossless", () => {
  libwebp.decode(smallWebPLossless)
})

// Medium image decoding benchmarks
Deno.bench("WebP decode 512x512 lossy", () => {
  libwebp.decode(mediumWebPLossy)
})

Deno.bench("WebP decode 512x512 lossless", () => {
  libwebp.decode(mediumWebPLossless)
})

// Large image decoding benchmark
Deno.bench("WebP decode 1024x1024 lossy", () => {
  libwebp.decode(largeWebPLossy)
})

// Complex content decoding benchmark
Deno.bench("WebP decode complex content 512x512", () => {
  libwebp.decode(complexWebPLossy)
})

// Image info extraction (lightweight operation)
Deno.bench("WebP getImageInfo 512x512", () => {
  libwebp.getImageInfo(mediumWebPLossy)
})

// Mixed encode-decode workflow (real-world usage)
Deno.bench("WebP encode-decode cycle 256x256", async () => {
  const testImage = createTestImage(256, 256)
  const encoded = await libwebp.encode(testImage, 256, 256, { quality: 75 })
  const decoded = await libwebp.decode(encoded.data)
  // Verify basic correctness
  if (decoded.width !== 256 || decoded.height !== 256) {
    throw new Error("Encode-decode cycle failed")
  }
})

// Throughput measurements
Deno.bench("Decoding throughput - 512x512", async () => {
  const startTime = performance.now()
  const iterations = 10

  for (let i = 0; i < iterations; i++) {
    await libwebp.decode(mediumWebPLossy)
  }

  const endTime = performance.now()
  const totalTime = endTime - startTime
  const avgTime = totalTime / iterations
  const pixelsPerSecond = (512 * 512 * iterations) / (totalTime / 1000)
  const megapixelsPerSecond = pixelsPerSecond / 1_000_000

  console.log(`\n📊 Decoding Throughput Results:`)
  console.log(`   Average time per 512x512 decode: ${avgTime.toFixed(2)}ms`)
  console.log(`   Throughput: ${megapixelsPerSecond.toFixed(2)} Mpixels/sec`)
})

// Memory efficiency test
Deno.bench("Memory efficiency - repeated decode", async () => {
  // This benchmark measures if there are memory leaks in repeated decoding
  for (let i = 0; i < 20; i++) {
    const decoded = await libwebp.decode(mediumWebPLossy)
    // Verify each decode
    if (decoded.width !== 512 || decoded.height !== 512) {
      throw new Error(`Decode ${i} failed dimension check`)
    }
  }
})

// Comprehensive format support benchmark
Deno.bench("Format comparison - lossy vs lossless decode", async () => {
  const lossyStart = performance.now()
  await libwebp.decode(mediumWebPLossy)
  const lossyTime = performance.now() - lossyStart

  const losslessStart = performance.now()
  await libwebp.decode(mediumWebPLossless)
  const losslessTime = performance.now() - losslessStart

  console.log(`\n📊 Format Performance Comparison (512x512):`)
  console.log(`   Lossy decode: ${lossyTime.toFixed(2)}ms`)
  console.log(`   Lossless decode: ${losslessTime.toFixed(2)}ms`)
  console.log(`   Ratio: ${(losslessTime / lossyTime).toFixed(2)}x`)
})

// Cleanup after benchmarks
globalThis.addEventListener("unload", () => {
  if (libwebp) {
    libwebp.destroy()
  }
})