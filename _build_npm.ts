/**
 * NPM Package Builder for libwebp.wasm
 * Creates NPM-compatible distribution from Deno-first TypeScript sources
 */

import { build, emptyDir } from "https://deno.land/x/dnt@0.40.0/mod.ts"

await emptyDir("./npm")

await build({
  entryPoints: ["./src/lib/index.ts"],
  outDir: "./npm",
  shims: {
    // Provide Node.js compatibility
    deno: false,
  },
  package: {
    // Copy from existing package.json but update to use built files
    name: "@discere-os/libwebp.wasm",
    version: "1.4.0",
    description: "High-performance WebP image processing with SIMD optimizations and TypeScript-first WASM-native experience",
    main: "esm/lib/index.js",
    module: "esm/lib/index.js",
    types: "esm/lib/index.d.ts",
    exports: {
      ".": {
        "import": "./esm/lib/index.js",
        "require": "./script/lib/index.js",
        "types": "./esm/lib/index.d.ts"
      },
      "./types": {
        "import": "./esm/lib/types.js",
        "require": "./script/lib/types.js",
        "types": "./esm/lib/types.d.ts"
      }
    },
    keywords: [
      "webp",
      "image",
      "compression",
      "wasm",
      "webassembly",
      "simd",
      "encoding",
      "decoding",
      "graphics",
      "typescript",
      "performance",
      "lossless",
      "animation"
    ],
    author: "Superstruct Ltd, New Zealand",
    license: "BSD-3-Clause",
    homepage: "https://github.com/discere-os/libwebp.wasm",
    repository: {
      type: "git",
      url: "https://github.com/discere-os/libwebp.wasm.git"
    },
    bugs: {
      url: "https://github.com/discere-os/libwebp.wasm/issues"
    },
    engines: {
      node: ">=18.0.0"
    },
    browserslist: [
      "Chrome >= 113",
      "Edge >= 113"
    ],
    files: [
      "esm/",
      "script/",
      "dist/",
      "README.md",
      "COPYING"
    ],
    publishConfig: {
      registry: "https://registry.npmjs.org/",
      access: "public"
    },
    cdn: {
      primary: "https://wasm.discere.cloud/libwebp/latest/main/",
      fallbacks: [
        "https://cdn.jsdelivr.net/npm/@discere-os/libwebp.wasm/",
        "https://unpkg.com/@discere-os/libwebp.wasm/"
      ]
    },
    webAssemblyRequirements: {
      simd: "required",
      threads: "main_module_only",
      webgpu: "recommended"
    },
    dependencyArchitecture: {
      class: "Class 1: Standalone Library",
      rationale: "WebP is a complete image format implementation without external dependencies"
    },
    performance: {
      benchmarks: "Available via npm run benchmark",
      simdSupport: "WASM SIMD optimizations for encoding/decoding",
      threadingSupport: "Multi-threaded processing in MAIN_MODULE builds",
      memoryOptimization: "Streaming decode/encode with minimal memory footprint",
      browserOptimization: "WebGPU+SIMD browsers only - no legacy fallbacks"
    }
  },
  compilerOptions: {
    target: "ES2022",
    lib: ["ES2022", "DOM"],
    importHelpers: false,
    skipLibCheck: true
  },
  // Copy additional files to NPM package
  postBuild: () => {
    // Copy WASM files if they exist
    try {
      Deno.copyFileSync("./install/wasm/libwebp-side.wasm", "./npm/dist/libwebp-side.wasm")
      Deno.copyFileSync("./install/wasm/libwebp-main.wasm", "./npm/dist/libwebp-main.wasm")
      Deno.copyFileSync("./install/wasm/libwebp-main.js", "./npm/dist/libwebp-main.js")
      console.log("✅ Copied WASM artifacts to NPM package")
    } catch (error) {
      console.warn("⚠️  WASM artifacts not found - run build:wasm first:", error.message)
    }

    // Copy license
    try {
      Deno.copyFileSync("./COPYING", "./npm/COPYING")
      console.log("✅ Copied license file")
    } catch (error) {
      console.warn("⚠️  License file not found:", error.message)
    }

    // Copy README
    try {
      Deno.copyFileSync("./README.md", "./npm/README.md")
      console.log("✅ Copied README")
    } catch (error) {
      console.warn("⚠️  README not found:", error.message)
    }

    console.log("\n📦 NPM package built successfully!")
    console.log("📂 Location: ./npm/")
    console.log("🚀 Publish with: cd npm && npm publish")
  }
})

console.log("\n✅ NPM build completed!")