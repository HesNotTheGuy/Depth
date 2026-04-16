#!/bin/bash
# Build the Depth SDK as a WebAssembly module.
#
# Prerequisites:
#   - Emscripten SDK installed and activated (emsdk activate latest)
#   - emcmake / emcc on PATH
#
# Usage:
#   ./build_wasm.sh            # Release build
#   ./build_wasm.sh debug      # Debug build with assertions
#
# Output:
#   build-wasm/depth.js        # ES6 module loader
#   build-wasm/depth.wasm      # WebAssembly binary

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BUILD_TYPE="${1:-Release}"
if [ "$BUILD_TYPE" = "debug" ] || [ "$BUILD_TYPE" = "Debug" ]; then
    BUILD_TYPE="Debug"
fi

BUILD_DIR="build-wasm"

echo "=== Depth SDK WASM Build ==="
echo "Build type: ${BUILD_TYPE}"
echo ""

# Verify emcmake is available
if ! command -v emcmake &> /dev/null; then
    echo "Error: emcmake not found."
    echo "Install the Emscripten SDK: https://emscripten.org/docs/getting_started/"
    echo "Then run: source emsdk_env.sh"
    exit 1
fi

# Configure
echo "[1/2] Configuring..."
emcmake cmake -B "${BUILD_DIR}" \
    -DCMAKE_BUILD_TYPE="${BUILD_TYPE}" \
    -DDEPTH_BUILD_EXAMPLES=OFF \
    -DDEPTH_BUILD_TESTS=OFF \
    -DDEPTH_WASM_EMBIND=ON

# Build
echo "[2/2] Building..."
cmake --build "${BUILD_DIR}" --parallel

echo ""
echo "=== Build complete ==="
echo "Output:"
echo "  ${BUILD_DIR}/depth.js"
echo "  ${BUILD_DIR}/depth.wasm"
echo ""
echo "To use in a web page:"
echo "  import DepthModule from './depth.js';"
echo "  const depth = await DepthModule();"
