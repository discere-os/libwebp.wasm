/**
 * WebP encoding benchmarks for libwebp.wasm
 * Measures real-world encoding performance across different scenarios
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

function createPhotoRealisticImage(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      // Simulate photo-realistic content with noise and patterns
      const noise = Math.random() * 50 - 25
      const pattern = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 50
      data[i] = Math.max(0, Math.min(255, 100 + pattern + noise))
      data[i + 1] = Math.max(0, Math.min(255, 150 + pattern * 0.8 + noise))
      data[i + 2] = Math.max(0, Math.min(255, 200 + pattern * 0.6 + noise))
      data[i + 3] = 255
    }
  }
  return data
}

function createSolidColorImage(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4)
  data.fill(128) // Gray
  // Set alpha channel to opaque
  for (let i = 3; i < data.length; i += 4) {
    data[i] = 255
  }
  return data
}

// Global setup
let libwebp: any = null

// Setup before benchmarks
await (async () => {
  libwebp = await createLibWebP()
  console.log(`WebP initialized for benchmarking (SIMD: ${libwebp.getCapabilities().simdSupport ? 'ON' : 'OFF'})`)
})()

// Small image encoding benchmarks
const smallImage = createTestImage(256, 256)

Deno.bench("WebP encode 256x256 quality 50", () => {
  libwebp.encode(smallImage, 256, 256, { quality: 50 })
})

Deno.bench("WebP encode 256x256 quality 75 (default)", () => {
  libwebp.encode(smallImage, 256, 256, { quality: 75 })
})

Deno.bench("WebP encode 256x256 quality 90", () => {
  libwebp.encode(smallImage, 256, 256, { quality: 90 })
})

Deno.bench("WebP encode 256x256 lossless", () => {
  libwebp.encode(smallImage, 256, 256, { lossless: true })
})

// Medium image encoding benchmarks
const mediumImage = createTestImage(512, 512)

Deno.bench("WebP encode 512x512 quality 75", () => {
  libwebp.encode(mediumImage, 512, 512, { quality: 75 })
})

Deno.bench("WebP encode 512x512 lossless", () => {
  libwebp.encode(mediumImage, 512, 512, { lossless: true })
})

// Large image encoding benchmarks
const largeImage = createTestImage(1024, 1024)

Deno.bench("WebP encode 1024x1024 quality 75", () => {
  libwebp.encode(largeImage, 1024, 1024, { quality: 75 })
})

// Content-type specific benchmarks
const photoImage = createPhotoRealisticImage(512, 512)
const solidImage = createSolidColorImage(512, 512)

Deno.bench("WebP encode photo-realistic 512x512", () => {
  libwebp.encode(photoImage, 512, 512, { quality: 75 })
})

Deno.bench("WebP encode solid color 512x512", () => {
  libwebp.encode(solidImage, 512, 512, { quality: 75 })
})

Deno.bench("WebP encode photo-realistic lossless 512x512", () => {
  libwebp.encode(photoImage, 512, 512, { lossless: true })
})

Deno.bench("WebP encode solid color lossless 512x512", () => {
  libwebp.encode(solidImage, 512, 512, { lossless: true })
})

// Throughput calculations (run after other benchmarks)
Deno.bench("Throughput measurement - 512x512", async () => {
  const startTime = performance.now()
  const iterations = 10

  for (let i = 0; i < iterations; i++) {
    await libwebp.encode(mediumImage, 512, 512, { quality: 75 })
  }

  const endTime = performance.now()
  const totalTime = endTime - startTime
  const avgTime = totalTime / iterations
  const pixelsPerSecond = (512 * 512 * iterations) / (totalTime / 1000)
  const megapixelsPerSecond = pixelsPerSecond / 1_000_000

  console.log(`\n📊 Encoding Throughput Results:`)
  console.log(`   Average time per 512x512 encode: ${avgTime.toFixed(2)}ms`)
  console.log(`   Throughput: ${megapixelsPerSecond.toFixed(2)} Mpixels/sec`)
})

// Cleanup after benchmarks
globalThis.addEventListener("unload", () => {
  if (libwebp) {
    libwebp.destroy()
  }
})