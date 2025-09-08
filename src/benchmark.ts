/**
 * LibWebP WASM Benchmark - Performance testing with native C/C++ implementation
 */

import { LibWebP, createLibWebP } from './lib/index.js'

interface BenchmarkResult {
  operation: string
  iterations: number
  totalTime: number
  avgTime: number
  throughput: number
  memoryUsage: number
}

/**
 * Comprehensive WebP performance benchmarks
 */
async function runBenchmarks() {
  console.log('🔥 LibWebP WASM Performance Benchmarks')
  console.log('=====================================')

  try {
    const webp = await createLibWebP()
    console.log('✅ LibWebP initialized')

    const capabilities = webp.getCapabilities()
    console.log(`🚀 SIMD Support: ${capabilities.simdSupport ? 'Enabled' : 'Disabled'}`)

    const results: BenchmarkResult[] = []

    // Test different image sizes
    const testSizes = [
      { width: 256, height: 256, name: '256x256' },
      { width: 512, height: 512, name: '512x512' },
      { width: 1024, height: 1024, name: '1024x1024' },
      { width: 2048, height: 2048, name: '2048x2048' }
    ]

    for (const size of testSizes) {
      console.log(`\n📊 Testing ${size.name} images...`)

      const testImage = createTestPattern(size.width, size.height)
      const iterations = size.width <= 512 ? 10 : 5

      // Benchmark encoding
      const encodeStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await webp.encode(testImage, size.width, size.height, { quality: 75 })
      }
      const encodeTime = performance.now() - encodeStart

      results.push({
        operation: `Encode ${size.name}`,
        iterations,
        totalTime: encodeTime,
        avgTime: encodeTime / iterations,
        throughput: (size.width * size.height * iterations) / (encodeTime / 1000),
        memoryUsage: testImage.length
      })

      // Benchmark decoding
      const encoded = await webp.encode(testImage, size.width, size.height, { quality: 75 })

      const decodeStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        await webp.decode(encoded.data)
      }
      const decodeTime = performance.now() - decodeStart

      results.push({
        operation: `Decode ${size.name}`,
        iterations,
        totalTime: decodeTime,
        avgTime: decodeTime / iterations,
        throughput: (size.width * size.height * iterations) / (decodeTime / 1000),
        memoryUsage: encoded.data.length
      })
    }

    // Display results
    console.log('\n📈 Benchmark Results:')
    console.log('=====================================')
    console.table(results.map(r => ({
      Operation: r.operation,
      'Avg Time (ms)': r.avgTime.toFixed(2),
      'Throughput (pixels/sec)': Math.round(r.throughput).toLocaleString(),
      'Memory (KB)': Math.round(r.memoryUsage / 1024)
    })))

    const metrics = webp.getPerformanceMetrics()
    console.log('\n🎯 Performance Summary:')
    console.log(`  SIMD Operations: ${metrics.simdUtilization}`)
    console.log(`  Average Compression: ${(metrics.compressionRatio * 100).toFixed(1)}%`)

    webp.destroy()
    console.log('\n✅ Benchmarks completed successfully!')

  } catch (error) {
    console.error('\n❌ Benchmark failed:', (error as Error).message)
  }
}

/**
 * Create test pattern with varying complexity
 */
function createTestPattern(width: number, height: number): Uint8Array {
  const imageData = new Uint8Array(width * height * 4) // RGBA

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4

      // Create complex pattern for better compression testing
      const noise = Math.random() * 50
      const gradient = (x + y) / (width + height)
      const wave = Math.sin((x + y) * 0.01) * 127 + 128

      imageData[index] = Math.min(255, gradient * 255 + noise)     // R
      imageData[index + 1] = Math.min(255, wave + noise)          // G
      imageData[index + 2] = Math.min(255, (1 - gradient) * 255 + noise) // B
      imageData[index + 3] = 255                                  // A
    }
  }

  return imageData
}

// Run benchmarks
if (typeof window !== 'undefined') {
  window.addEventListener('load', runBenchmarks)
} else {
  runBenchmarks().catch(console.error)
}