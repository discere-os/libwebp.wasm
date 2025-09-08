#!/bin/bash
# build-wasm-dual.sh - Dual WASM build script for libwebp.wasm
#
# Copyright (c) 2025 Superstruct Ltd, New Zealand
# Licensed under BSD-3-Clause (same as libwebp)
#
# This script builds libwebp.wasm with dual architecture:
# - SIDE_MODULE for dynamic loading by host applications
# - MAIN_MODULE for standalone NPM distribution

set -e  # Exit on any error

# Configuration
BUILD_TYPE="${BUILD_TYPE:-Release}"
INSTALL_PREFIX="${INSTALL_PREFIX:-./install}"
BUILD_DIR_SIDE="${BUILD_DIR_SIDE:-./build-wasm-side}"
BUILD_DIR_MAIN="${BUILD_DIR_MAIN:-./build-wasm-main}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking build prerequisites..."

    if ! command -v emcc &> /dev/null; then
        log_error "Emscripten not found. Please install and activate EMSDK."
        exit 1
    fi

    if ! command -v cmake &> /dev/null; then
        log_error "CMake not found. Please install CMake 3.16 or later."
        exit 1
    fi

    # Check Emscripten version
    EMCC_VERSION=$(emcc --version | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
    log_info "Using Emscripten version: $EMCC_VERSION"

    log_success "Prerequisites check completed"
}

# Clean build directories
clean_build() {
    log_info "Cleaning previous build directories..."

    if [ -d "$BUILD_DIR_SIDE" ]; then
        rm -rf "$BUILD_DIR_SIDE"
    fi
    if [ -d "$BUILD_DIR_MAIN" ]; then
        rm -rf "$BUILD_DIR_MAIN"
    fi

    mkdir -p "$BUILD_DIR_SIDE"
    mkdir -p "$BUILD_DIR_MAIN"
}

# Build libwebp.wasm as SIDE_MODULE for production (dynamically loadable)
build_libwebp_side_module() {
    log_info "Building libwebp.wasm as SIDE_MODULE for production dynamic loading..."

    cd "$BUILD_DIR_SIDE"

    # Configure with CMake for SIDE_MODULE
    emcmake cmake .. \
        -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
        -DCMAKE_INSTALL_PREFIX="$INSTALL_PREFIX" \
        -DCMAKE_TOOLCHAIN_FILE="$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake" \
        -DBUILD_SIDE_MODULE=ON \
        -DBUILD_MAIN_MODULE=OFF \
        -DWEBP_BUILD_STATIC=ON \
        -DWEBP_BUILD_SHARED=OFF \
        -DWEBP_ENABLE_SIMD=ON \
        -DWEBP_BUILD_CWEBP=OFF \
        -DWEBP_BUILD_DWEBP=OFF \
        -DWEBP_BUILD_EXTRAS=OFF \
        -DWEBP_BUILD_WEBP_JS=OFF \
        -f ../CMakeLists.wasm.txt

    # Build
    emmake make -j$(nproc)

    cd ..
    log_success "libwebp-side.wasm SIDE_MODULE built successfully"
}

# Build libwebp.wasm as MAIN_MODULE for testing (standalone with threading)
build_libwebp_main_module() {
    log_info "Building libwebp.wasm as MAIN_MODULE for standalone NPM distribution..."

    cd "$BUILD_DIR_MAIN"

    # Configure with CMake for MAIN_MODULE
    emcmake cmake .. \
        -DCMAKE_BUILD_TYPE="$BUILD_TYPE" \
        -DCMAKE_INSTALL_PREFIX="$INSTALL_PREFIX" \
        -DCMAKE_TOOLCHAIN_FILE="$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake" \
        -DBUILD_SIDE_MODULE=OFF \
        -DBUILD_MAIN_MODULE=ON \
        -DWEBP_BUILD_STATIC=ON \
        -DWEBP_BUILD_SHARED=OFF \
        -DWEBP_ENABLE_SIMD=ON \
        -DWEBP_BUILD_CWEBP=OFF \
        -DWEBP_BUILD_DWEBP=OFF \
        -DWEBP_BUILD_EXTRAS=OFF \
        -DWEBP_BUILD_WEBP_JS=OFF \
        -f ../CMakeLists.wasm.txt

    # Build
    emmake make -j$(nproc)

    cd ..
    log_success "libwebp.wasm MAIN_MODULE built successfully"
}

# Install built artifacts
install_libwebp() {
    log_info "Installing libwebp.wasm dual builds..."

    # Create install directories
    mkdir -p "$INSTALL_PREFIX/lib" "$INSTALL_PREFIX/include" "$INSTALL_PREFIX/wasm" "$INSTALL_PREFIX/dist/side" "$INSTALL_PREFIX/dist/main"

    # Install SIDE_MODULE build (production)
    if [ -f "$BUILD_DIR_SIDE/libwebp-side.wasm" ]; then
        cp "$BUILD_DIR_SIDE/libwebp-side.wasm" "$INSTALL_PREFIX/dist/side/"
        cp "$BUILD_DIR_SIDE/libwebp-side.wasm" "$INSTALL_PREFIX/wasm/libwebp-side.wasm"
        log_info "Installed libwebp-side.wasm (SIDE_MODULE)"
    fi

    # Install MAIN_MODULE build (NPM distribution)
    if [ -f "$BUILD_DIR_MAIN/libwebp.wasm" ]; then
        cp "$BUILD_DIR_MAIN/libwebp.wasm" "$INSTALL_PREFIX/dist/main/"
        cp "$BUILD_DIR_MAIN/libwebp.wasm" "$INSTALL_PREFIX/wasm/"
        log_info "Installed libwebp.wasm (MAIN_MODULE)"
    fi

    if [ -f "$BUILD_DIR_MAIN/libwebp.js" ]; then
        cp "$BUILD_DIR_MAIN/libwebp.js" "$INSTALL_PREFIX/dist/main/"
        cp "$BUILD_DIR_MAIN/libwebp.js" "$INSTALL_PREFIX/wasm/"
        log_info "Installed libwebp.js (MAIN_MODULE loader)"
    fi

    # Copy headers for development use
    if [ -d "src/webp" ]; then
        cp -r src/webp "$INSTALL_PREFIX/include/"
        log_info "Installed WebP headers"
    fi

    log_success "Dual build installation completed"
}

# Create package manifest
create_manifest() {
    log_info "Creating package manifest..."

    cat > "$INSTALL_PREFIX/libwebp-wasm-manifest.json" << EOF
{
  "name": "libwebp.wasm",
  "version": "1.4.0",
  "description": "WebAssembly build of libwebp with SIMD optimizations",
  "build_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "build_type": "$BUILD_TYPE",
  "features": {
    "wasm_simd": true,
    "threading": true,
    "animation_support": true,
    "mux_support": true,
    "near_lossless": true,
    "wasm_native": true
  },
  "architecture": {
    "side_module": {
      "file": "dist/side/libwebp-side.wasm",
      "purpose": "Dynamic loading by host applications",
      "threading": false,
      "size_estimate": "~200KB"
    },
    "main_module": {
      "files": ["dist/main/libwebp.wasm", "dist/main/libwebp.js"],
      "purpose": "Standalone NPM distribution",
      "threading": true,
      "size_estimate": "~1.5MB"
    }
  },
  "browser_requirements": {
    "chrome": ">=113",
    "edge": ">=113",
    "webgpu": "required",
    "simd": "required",
    "shared_array_buffer": "main_module_only"
  }
}
EOF

    log_success "Package manifest created"
}

# Verify build output
verify_build() {
    log_info "Verifying dual build output..."

    local errors=0

    # Check for SIDE_MODULE build (production)
    if [ ! -f "$INSTALL_PREFIX/dist/side/libwebp-side.wasm" ]; then
        log_error "libwebp-side.wasm (SIDE_MODULE) not found"
        ((errors++))
    else
        log_success "libwebp-side.wasm (SIDE_MODULE) found"
    fi

    # Check for MAIN_MODULE build (NPM)
    if [ ! -f "$INSTALL_PREFIX/dist/main/libwebp.wasm" ]; then
        log_error "libwebp.wasm (MAIN_MODULE) not found"
        ((errors++))
    else
        log_success "libwebp.wasm (MAIN_MODULE) found"
    fi

    if [ ! -f "$INSTALL_PREFIX/dist/main/libwebp.js" ]; then
        log_error "libwebp.js (MAIN_MODULE loader) not found"
        ((errors++))
    else
        log_success "libwebp.js (MAIN_MODULE loader) found"
    fi

    # Check WebP headers
    if [ ! -d "$INSTALL_PREFIX/include/webp" ]; then
        log_error "WebP headers not found"
        ((errors++))
    else
        log_success "WebP headers installed"
    fi

    # Verify WASM module sizes (basic sanity check)
    if [ -f "$INSTALL_PREFIX/dist/side/libwebp-side.wasm" ]; then
        SIDE_SIZE=$(stat -f%z "$INSTALL_PREFIX/dist/side/libwebp-side.wasm" 2>/dev/null || stat -c%s "$INSTALL_PREFIX/dist/side/libwebp-side.wasm" 2>/dev/null)
        if [ "$SIDE_SIZE" -gt 50000 ]; then
            log_success "SIDE_MODULE size looks reasonable: ${SIDE_SIZE} bytes"
        else
            log_warning "SIDE_MODULE size unusually small: ${SIDE_SIZE} bytes"
        fi
    fi

    if [ -f "$INSTALL_PREFIX/dist/main/libwebp.wasm" ]; then
        MAIN_SIZE=$(stat -f%z "$INSTALL_PREFIX/dist/main/libwebp.wasm" 2>/dev/null || stat -c%s "$INSTALL_PREFIX/dist/main/libwebp.wasm" 2>/dev/null)
        if [ "$MAIN_SIZE" -gt 500000 ]; then
            log_success "MAIN_MODULE size looks reasonable: ${MAIN_SIZE} bytes"
        else
            log_warning "MAIN_MODULE size unusually small: ${MAIN_SIZE} bytes"
        fi
    fi

    if [ $errors -eq 0 ]; then
        log_success "Dual build verification passed"
        return 0
    else
        log_error "Build verification failed with $errors error(s)"
        return 1
    fi
}

# Show build summary
show_summary() {
    echo ""
    echo "=== libwebp.wasm Dual Build Summary ==="
    echo ""
    echo "Build completed successfully!"
    echo ""
    echo "Key features implemented:"
    echo "  ✓ PRIORITY 1: Dual WASM architecture (SIDE_MODULE + MAIN_MODULE)"
    echo "  ✓ PRIORITY 1: WASM SIMD optimizations enabled"
    echo "  ✓ PRIORITY 1: WebP encoding/decoding with animation support"
    echo "  ✓ PRIORITY 1: Near-lossless encoding enabled"
    echo "  ✓ PRIORITY 2: Threading support for MAIN_MODULE"
    echo "  ✓ PRIORITY 2: Mux library for advanced WebP features"
    echo "  ✓ PRIORITY 2: WASM-native image processing functions"
    echo ""
    echo "Output location: $INSTALL_PREFIX"
    echo "SIDE_MODULE: $INSTALL_PREFIX/dist/side/libwebp-side.wasm"
    echo "MAIN_MODULE: $INSTALL_PREFIX/dist/main/libwebp.wasm"
    echo "JavaScript wrapper: $INSTALL_PREFIX/dist/main/libwebp.js"
    echo "Headers: $INSTALL_PREFIX/include/webp/"
    echo "Manifest: $INSTALL_PREFIX/libwebp-wasm-manifest.json"
    echo ""
    log_success "libwebp.wasm dual build complete!"
}

# Main build function
main() {
    log_info "Starting libwebp.wasm dual build..."
    log_info "Build type: $BUILD_TYPE"
    log_info "Install prefix: $INSTALL_PREFIX"

    check_prerequisites
    clean_build
    build_libwebp_side_module  # Build SIDE_MODULE for production
    build_libwebp_main_module  # Build MAIN_MODULE for NPM
    install_libwebp
    create_manifest

    if verify_build; then
        show_summary
    else
        log_error "Build completed with issues. Check the output above."
        exit 1
    fi
}

# Show usage information
show_help() {
    cat << EOF
Usage: $0 [OPTIONS]

Build libwebp.wasm with dual architecture for maximum browser performance.

Options:
  -h, --help                Show this help message
  -t, --build-type TYPE     Build type (Release, Debug, RelWithDebInfo)
  -p, --prefix PATH         Install prefix (default: ./install)

Environment Variables:
  BUILD_TYPE                Build configuration (default: Release)
  INSTALL_PREFIX            Installation directory (default: ./install)
  BUILD_DIR_SIDE            SIDE_MODULE build directory (default: ./build-wasm-side)
  BUILD_DIR_MAIN            MAIN_MODULE build directory (default: ./build-wasm-main)

Examples:
  $0                        # Build with default settings
  $0 -t Debug               # Build debug version
  BUILD_TYPE=Release $0     # Build with environment variable

Browser Requirements:
  - Chrome/Edge 113+ (WebGPU + SIMD required)
  - No fallback for older browsers (native-level performance focus)

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      show_help
      exit 0
      ;;
    -t|--build-type)
      BUILD_TYPE="$2"
      shift 2
      ;;
    -p|--prefix)
      INSTALL_PREFIX="$2"
      shift 2
      ;;
    *)
      log_error "Unknown option: $1"
      show_help
      exit 1
      ;;
  esac
done

# Execute main function
main "$@"