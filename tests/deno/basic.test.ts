/**
 * Basic functionality tests for libwebp.wasm
 */

import { assert, assertEquals, assertExists } from "@std/assert"
import { LibWebP, createLibWebP, WebPColorspace } from "../../src/lib/index.ts"

// Test helper functions
function createTestImageRGBA(width: number, height: number): Uint8Array {
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (i / 4) % 256     // Red pattern
    data[i + 1] = 128           // Green constant
    data[i + 2] = 255           // Blue constant
    data[i + 3] = 255           // Alpha opaque
  }
  return data
}

function createSolidColorImage(width: number, height: number, r: number, g: number, b: number, a: number = 255): Uint8Array {
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = a
  }
  return data
}

Deno.test("LibWebP class initialization", async () => {
  const libwebp = new LibWebP()
  await libwebp.initialize()

  assertExists(libwebp)
  assertEquals(typeof libwebp.getCapabilities, "function")
  assertEquals(typeof libwebp.encode, "function")
  assertEquals(typeof libwebp.decode, "function")

  libwebp.destroy()
})

Deno.test("createLibWebP convenience function", async () => {
  const libwebp = await createLibWebP()

  assertExists(libwebp)

  const capabilities = libwebp.getCapabilities()
  assertExists(capabilities)
  assertEquals(typeof capabilities.simdSupport, "boolean")
  assertEquals(typeof capabilities.threadingSupport, "boolean")

  libwebp.destroy()
})

Deno.test("WebP capabilities detection", async () => {
  const libwebp = await createLibWebP()

  const capabilities = libwebp.getCapabilities()
  assert(capabilities.animationSupport, "Animation support should be enabled")
  assert(capabilities.losslessSupport, "Lossless support should be enabled")
  assert(capabilities.alphaSupport, "Alpha support should be enabled")
  assert(capabilities.nearLosslessSupport, "Near-lossless support should be enabled")

  libwebp.destroy()
})

Deno.test("WebP version information", async () => {
  const libwebp = await createLibWebP()

  const version = libwebp.getVersion()
  assert(version.encoder > 0, "Encoder version should be positive")
  assert(version.decoder > 0, "Decoder version should be positive")

  libwebp.destroy()
})

Deno.test("Small image encoding and decoding", async () => {
  const libwebp = await createLibWebP()

  const width = 32
  const height = 32
  const imageData = createTestImageRGBA(width, height)

  // Encode
  const encoded = await libwebp.encode(imageData, width, height, { quality: 75 })
  assert(encoded.size > 0, "Encoded size should be positive")
  assertExists(encoded.data)
  assertEquals(encoded.width, width)
  assertEquals(encoded.height, height)

  // Decode
  const decoded = await libwebp.decode(encoded.data)
  assertEquals(decoded.width, width)
  assertEquals(decoded.height, height)
  assertEquals(decoded.size, width * height * 4)
  assertEquals(decoded.format, WebPColorspace.RGBA)

  libwebp.destroy()
})

Deno.test("Lossless encoding", async () => {
  const libwebp = await createLibWebP()

  const width = 50
  const height = 50
  const imageData = createSolidColorImage(width, height, 255, 0, 0) // Solid red

  // Encode lossless
  const encoded = await libwebp.encode(imageData, width, height, {
    lossless: true
  })

  assert(encoded.size > 0, "Lossless encoded size should be positive")
  assertExists(encoded.data)

  // Decode and verify perfect reconstruction
  const decoded = await libwebp.decode(encoded.data)
  assertEquals(decoded.width, width)
  assertEquals(decoded.height, height)

  // For solid color, lossless should give perfect reconstruction
  // Check first few pixels to verify
  for (let i = 0; i < 40; i += 4) {
    assertEquals(decoded.data[i], 255, `Red component at pixel ${i/4}`)
    assertEquals(decoded.data[i + 1], 0, `Green component at pixel ${i/4}`)
    assertEquals(decoded.data[i + 2], 0, `Blue component at pixel ${i/4}`)
    assertEquals(decoded.data[i + 3], 255, `Alpha component at pixel ${i/4}`)
  }

  libwebp.destroy()
})

Deno.test("Multiple image sizes", async () => {
  const libwebp = await createLibWebP()

  const testSizes = [
    { width: 16, height: 16 },
    { width: 64, height: 64 },
    { width: 100, height: 50 },
    { width: 200, height: 300 }
  ]

  for (const size of testSizes) {
    const imageData = createTestImageRGBA(size.width, size.height)

    const encoded = await libwebp.encode(imageData, size.width, size.height, { quality: 80 })
    assert(encoded.size > 0, `Size ${size.width}x${size.height} should encode successfully`)

    const decoded = await libwebp.decode(encoded.data!)
    assertEquals(decoded.width, size.width, `Width should match for ${size.width}x${size.height}`)
    assertEquals(decoded.height, size.height, `Height should match for ${size.width}x${size.height}`)
  }

  libwebp.destroy()
})

Deno.test("Quality settings", async () => {
  const libwebp = await createLibWebP()

  const width = 64
  const height = 64
  const imageData = createTestImageRGBA(width, height)

  const qualities = [10, 50, 90]
  const encodedSizes: number[] = []

  for (const quality of qualities) {
    const encoded = await libwebp.encode(imageData, width, height, { quality })
    encodedSizes.push(encoded.size)
  }

  // Higher quality should generally produce larger files
  assert(encodedSizes[2] >= encodedSizes[1], "Quality 90 should be >= Quality 50")
  assert(encodedSizes[1] >= encodedSizes[0], "Quality 50 should be >= Quality 10")

  libwebp.destroy()
})

Deno.test("Image info extraction", async () => {
  const libwebp = await createLibWebP()

  const width = 80
  const height = 120
  const imageData = createTestImageRGBA(width, height)

  const encoded = await libwebp.encode(imageData, width, height, { quality: 75 })
  const info = await libwebp.getImageInfo(encoded.data!)

  assertEquals(info.width, width)
  assertEquals(info.height, height)
  assertEquals(info.format, WebPColorspace.RGBA)

  libwebp.destroy()
})

Deno.test("Performance metrics tracking", async () => {
  const libwebp = await createLibWebP()

  const width = 100
  const height = 100
  const imageData = createTestImageRGBA(width, height)

  // Perform encode/decode operations
  const encoded = await libwebp.encode(imageData, width, height, { quality: 75 })
  const decoded = await libwebp.decode(encoded.data!)

  const metrics = libwebp.getPerformanceMetrics()
  assert(metrics.encodeTime > 0, "Encode time should be recorded")
  assert(metrics.decodeTime > 0, "Decode time should be recorded")
  assert(metrics.compressionRatio > 0, "Compression ratio should be calculated")
  assert(metrics.compressionRatio < 1, "Compression ratio should be less than 1")

  libwebp.destroy()
})

Deno.test("Error handling - invalid WebP data", async () => {
  const libwebp = await createLibWebP()

  const invalidData = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00])

  try {
    await libwebp.decode(invalidData)
    assert(false, "Should have thrown error for invalid WebP data")
  } catch (error) {
    assert(error instanceof Error)
    assert(error.message.includes("WebP"), "Error message should mention WebP")
  }

  libwebp.destroy()
})

Deno.test("Error handling - invalid image dimensions", async () => {
  const libwebp = await createLibWebP()

  const imageData = createTestImageRGBA(10, 10) // 10x10 = 400 bytes

  try {
    // Try to encode with wrong dimensions
    await libwebp.encode(imageData, 20, 20, { quality: 75 }) // Claims 20x20 = 1600 bytes
    assert(false, "Should have thrown error for dimension mismatch")
  } catch (error) {
    assert(error instanceof Error)
    assert(error.message.includes("mismatch"), "Error message should mention mismatch")
  }

  libwebp.destroy()
})

Deno.test("Memory cleanup", async () => {
  const libwebp = await createLibWebP()

  // Perform some operations
  const imageData = createTestImageRGBA(50, 50)
  const encoded = await libwebp.encode(imageData, 50, 50, { quality: 75 })
  const decoded = await libwebp.decode(encoded.data!)

  // Cleanup should not throw
  libwebp.destroy()

  // Attempting operations after cleanup should throw
  try {
    await libwebp.encode(imageData, 50, 50, { quality: 75 })
    assert(false, "Should have thrown error after destroy")
  } catch (error) {
    assert(error instanceof Error)
    assert(error.message.includes("not initialized"), "Error should mention not initialized")
  }
})