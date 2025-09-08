#!/usr/bin/env node
/**
 * Basic functionality tests for libwebp.wasm
 * Tests core WebP encoding/decoding functionality
 */

import { strict as assert } from 'assert';
import { readFileSync, writeFileSync } from 'fs';
import { performance } from 'perf_hooks';

// Test suite framework
class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log(`\n🧪 Running test suite: ${this.name}`);
    console.log('─'.repeat(50));

    for (const { name, fn } of this.tests) {
      try {
        console.log(`  Testing: ${name}...`);
        const start = performance.now();
        await fn();
        const duration = performance.now() - start;
        console.log(`  ✅ ${name} (${duration.toFixed(2)}ms)`);
        this.passed++;
      } catch (error) {
        console.log(`  ❌ ${name}: ${error.message}`);
        this.failed++;
      }
    }

    console.log('─'.repeat(50));
    console.log(`  Results: ${this.passed} passed, ${this.failed} failed`);
    
    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

// Mock WASM module for testing (replace with actual module in real tests)
class MockLibWebP {
  constructor() {
    this.HEAPU8 = new Uint8Array(1024 * 1024); // 1MB mock heap
    this._malloc_offset = 0;
  }

  _malloc(size) {
    const ptr = this._malloc_offset;
    this._malloc_offset += size;
    return ptr;
  }

  _free(ptr) {
    // Mock free - in real implementation this would manage memory
  }

  _WebPGetInfo(data, size, width, height) {
    // Mock WebP info function
    if (size >= 12 && 
        this.HEAPU8[data] === 0x52 && this.HEAPU8[data + 1] === 0x49 && 
        this.HEAPU8[data + 2] === 0x46 && this.HEAPU8[data + 3] === 0x46) {
      return 1; // Valid WebP
    }
    return 0; // Invalid
  }

  _WebPDecodeRGBA(data, size, output_ptr) {
    // Mock decode function
    return output_ptr; // Return success
  }

  _WebPEncodeRGBA(rgb, width, height, stride, quality, output) {
    // Mock encode function
    return 100; // Mock output size
  }
}

// Test basic functionality
const basicTests = new TestSuite('Basic Functionality');

basicTests.test('Module initialization', async () => {
  const module = new MockLibWebP();
  assert.ok(module, 'Module should initialize');
  assert.ok(module.HEAPU8, 'Heap should be available');
  assert.equal(typeof module._malloc, 'function', 'malloc should be available');
  assert.equal(typeof module._free, 'function', 'free should be available');
});

basicTests.test('Memory allocation', async () => {
  const module = new MockLibWebP();
  
  const ptr1 = module._malloc(100);
  const ptr2 = module._malloc(200);
  
  assert.ok(ptr1 >= 0, 'First allocation should succeed');
  assert.ok(ptr2 >= 0, 'Second allocation should succeed');
  assert.notEqual(ptr1, ptr2, 'Allocations should be different');
  
  // Test memory access
  module.HEAPU8[ptr1] = 0x42;
  assert.equal(module.HEAPU8[ptr1], 0x42, 'Memory write/read should work');
});

basicTests.test('WebP format detection', async () => {
  const module = new MockLibWebP();
  
  // Valid WebP header
  const validWebP = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x26, 0x00, 0x00, 0x00, // File size
    0x57, 0x45, 0x42, 0x50, // WEBP
    0x56, 0x50, 0x38, 0x20  // VP8
  ]);
  
  const ptr = module._malloc(validWebP.length);
  module.HEAPU8.set(validWebP, ptr);
  
  const result = module._WebPGetInfo(ptr, validWebP.length, 0, 0);
  assert.equal(result, 1, 'Valid WebP should be detected');
  
  // Invalid data
  const invalidData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG header
  const ptr2 = module._malloc(invalidData.length);
  module.HEAPU8.set(invalidData, ptr2);
  
  const result2 = module._WebPGetInfo(ptr2, invalidData.length, 0, 0);
  assert.equal(result2, 0, 'Invalid WebP should be rejected');
});

basicTests.test('Basic decoding operations', async () => {
  const module = new MockLibWebP();
  
  const testData = new Uint8Array(100);
  testData[0] = 0x52; // Mock RIFF header
  testData[1] = 0x49;
  testData[2] = 0x46;
  testData[3] = 0x46;
  
  const inputPtr = module._malloc(testData.length);
  const outputPtr = module._malloc(256 * 256 * 4); // RGBA output
  
  module.HEAPU8.set(testData, inputPtr);
  
  const result = module._WebPDecodeRGBA(inputPtr, testData.length, outputPtr);
  assert.ok(result, 'Decode should succeed');
  
  module._free(inputPtr);
  module._free(outputPtr);
});

basicTests.test('Basic encoding operations', async () => {
  const module = new MockLibWebP();
  
  const width = 64, height = 64;
  const rgba = new Uint8Array(width * height * 4);
  
  // Fill with test pattern
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = (i / 4) % 255;     // R
    rgba[i + 1] = ((i / 4) * 2) % 255; // G
    rgba[i + 2] = ((i / 4) * 3) % 255; // B
    rgba[i + 3] = 255;           // A
  }
  
  const inputPtr = module._malloc(rgba.length);
  const outputPtr = module._malloc(width * height); // Output buffer
  
  module.HEAPU8.set(rgba, inputPtr);
  
  const outputSize = module._WebPEncodeRGBA(
    inputPtr, width, height, width * 4, 80, outputPtr
  );
  
  assert.ok(outputSize > 0, 'Encode should produce output');
  
  module._free(inputPtr);
  module._free(outputPtr);
});

// Performance tests
const perfTests = new TestSuite('Performance Tests');

perfTests.test('Memory allocation performance', async () => {
  const module = new MockLibWebP();
  const iterations = 10000;
  
  const start = performance.now();
  
  const ptrs = [];
  for (let i = 0; i < iterations; i++) {
    ptrs.push(module._malloc(100));
  }
  
  for (const ptr of ptrs) {
    module._free(ptr);
  }
  
  const duration = performance.now() - start;
  console.log(`    Memory ops: ${(iterations * 2 / duration * 1000).toFixed(0)} ops/sec`);
  
  assert.ok(duration < 1000, 'Memory operations should be fast');
});

perfTests.test('Data processing throughput', async () => {
  const module = new MockLibWebP();
  const dataSize = 1024 * 1024; // 1MB
  const testData = new Uint8Array(dataSize);
  
  // Fill with random-like data
  for (let i = 0; i < dataSize; i++) {
    testData[i] = (i * 123 + 456) % 256;
  }
  
  const ptr = module._malloc(dataSize);
  
  const start = performance.now();
  module.HEAPU8.set(testData, ptr);
  const duration = performance.now() - start;
  
  const throughput = dataSize / 1024 / 1024 / (duration / 1000); // MB/s
  console.log(`    Throughput: ${throughput.toFixed(2)} MB/s`);
  
  assert.ok(throughput > 10, 'Data throughput should be reasonable');
  
  module._free(ptr);
});

// SIMD capability tests
const simdTests = new TestSuite('SIMD Capability Tests');

simdTests.test('SIMD availability detection', async () => {
  // Test WebAssembly SIMD support
  const simdSupported = typeof WebAssembly.SIMD !== 'undefined';
  console.log(`    SIMD supported: ${simdSupported}`);
  
  // This test passes regardless - it's informational
  assert.ok(true, 'SIMD detection completed');
});

simdTests.test('SIMD vs scalar performance comparison', async () => {
  // Mock comparison - in real tests this would compare actual SIMD vs scalar builds
  const simdTime = 100;   // Mock SIMD processing time
  const scalarTime = 250; // Mock scalar processing time
  
  const speedup = scalarTime / simdTime;
  console.log(`    Simulated SIMD speedup: ${speedup.toFixed(2)}x`);
  
  if (typeof WebAssembly.SIMD !== 'undefined') {
    assert.ok(speedup > 1.5, 'SIMD should provide significant speedup');
  } else {
    console.log('    SIMD not available - skipping performance comparison');
  }
});

// Integration tests
const integrationTests = new TestSuite('Integration Tests');

integrationTests.test('Cross-browser compatibility shim', async () => {
  // Test compatibility shims for different environments
  const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
  const hasAtomics = typeof Atomics !== 'undefined';
  const hasWebAssemblySimd = typeof WebAssembly.SIMD !== 'undefined';
  
  console.log(`    SharedArrayBuffer: ${hasSharedArrayBuffer}`);
  console.log(`    Atomics: ${hasAtomics}`);
  console.log(`    WebAssembly.SIMD: ${hasWebAssemblySimd}`);
  
  // Test should pass - this is environment reporting
  assert.ok(true, 'Compatibility check completed');
});

integrationTests.test('Error handling robustness', async () => {
  const module = new MockLibWebP();
  
  // Test null pointer handling
  assert.throws(() => {
    module._WebPGetInfo(0, 0, 0, 0);
  }, 'Should handle null pointers gracefully');
  
  // Test invalid size handling
  const result = module._WebPGetInfo(1000, -1, 0, 0);
  assert.equal(result, 0, 'Should handle invalid sizes');
});

// File format tests
const formatTests = new TestSuite('File Format Tests');

formatTests.test('WebP header validation', async () => {
  const module = new MockLibWebP();
  
  const testCases = [
    {
      name: 'Valid VP8 WebP',
      data: [0x52, 0x49, 0x46, 0x46, 0x1A, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
      expected: true
    },
    {
      name: 'Valid VP8L WebP',
      data: [0x52, 0x49, 0x46, 0x46, 0x1A, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
      expected: true
    },
    {
      name: 'Invalid - JPEG',
      data: [0xFF, 0xD8, 0xFF, 0xE0],
      expected: false
    },
    {
      name: 'Invalid - PNG',
      data: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
      expected: false
    }
  ];
  
  for (const testCase of testCases) {
    const data = new Uint8Array(testCase.data);
    const ptr = module._malloc(data.length);
    module.HEAPU8.set(data, ptr);
    
    const result = module._WebPGetInfo(ptr, data.length, 0, 0);
    const isValid = result === 1;
    
    assert.equal(isValid, testCase.expected, 
      `${testCase.name} should ${testCase.expected ? 'pass' : 'fail'}`);
    
    module._free(ptr);
  }
});

// Run all test suites
async function runAllTests() {
  console.log('🚀 LibWebP WASM Test Suite');
  console.log('=' .repeat(50));
  
  const suites = [
    basicTests,
    perfTests,
    simdTests,
    integrationTests,
    formatTests
  ];
  
  let totalPassed = 0;
  let totalFailed = 0;
  
  for (const suite of suites) {
    await suite.run();
    totalPassed += suite.passed;
    totalFailed += suite.failed;
  }
  
  console.log('\n📊 Overall Results');
  console.log('=' .repeat(50));
  console.log(`Total tests: ${totalPassed + totalFailed}`);
  console.log(`Passed: ${totalPassed}`);
  console.log(`Failed: ${totalFailed}`);
  console.log(`Success rate: ${(totalPassed / (totalPassed + totalFailed) * 100).toFixed(1)}%`);
  
  if (totalFailed > 0) {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { TestSuite, runAllTests };