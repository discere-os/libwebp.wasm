/**
 * Simple demo for libwebp.wasm - Quick WebP encoding/decoding example
 *
 * This is the example users should copy-paste from the README
 */

import { createLibWebP } from "./src/lib/index.ts"

// Create a simple 100x100 red square
function createRedSquare(): Uint8Array {
  const width = 100
  const height = 100
  const data = new Uint8Array(width * height * 4)

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255     // Red
    data[i + 1] = 0   // Green
    data[i + 2] = 0   // Blue
    data[i + 3] = 255 // Alpha
  }

  return data
}

async function quickDemo() {
  console.log("📦 Quick WebP demo starting...")

  // Initialize WebP
  const webp = await createLibWebP()
  console.log(`✅ WebP initialized (SIMD: ${webp.getCapabilities().simdSupport})`)

  // Create test image
  const imageData = createRedSquare()
  console.log(`🖼️  Created 100x100 red square (${imageData.length} bytes)`)

  // Encode to WebP
  const encoded = await webp.encode(imageData, 100, 100, { quality: 75 })
  console.log(`📦 Encoded to WebP: ${encoded.size} bytes (${(encoded.size / imageData.length * 100).toFixed(1)}% of original)`)

  // Decode back to RGBA
  const decoded = await webp.decode(encoded.data!)
  console.log(`🔓 Decoded back: ${decoded.width}x${decoded.height} RGBA (${decoded.size} bytes)`)

  // Verify it worked
  const success = decoded.width === 100 && decoded.height === 100 && decoded.size === 40000
  console.log(`${success ? '✅' : '❌'} Verification: ${success ? 'PASSED' : 'FAILED'}`)

  // Cleanup
  webp.destroy()
  console.log("🎉 Demo complete!")
}

if (import.meta.main) {
  await quickDemo()
}