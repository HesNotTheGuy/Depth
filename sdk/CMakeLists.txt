cmake_minimum_required(VERSION 3.20)
project(depth VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Options
option(DEPTH_BUILD_EXAMPLES "Build example applications" ON)
option(DEPTH_BUILD_TESTS "Build tests" ON)
option(DEPTH_SHARED_LIBS "Build as shared library" OFF)

# Library type
if(DEPTH_SHARED_LIBS)
    set(LIB_TYPE SHARED)
else()
    set(LIB_TYPE STATIC)
endif()

# Collect sources
file(GLOB_RECURSE DEPTH_SOURCES
    src/*.cpp
    src/*.h
)

# Exclude WASM-specific files from the core library — they are
# compiled separately into the depth_wasm executable.
list(FILTER DEPTH_SOURCES EXCLUDE REGEX ".*depth_c_api\\.cpp$")
list(FILTER DEPTH_SOURCES EXCLUDE REGEX ".*depth_embind\\.cpp$")
# Sidecar has its own main(); excluded from the core lib.
list(FILTER DEPTH_SOURCES EXCLUDE REGEX ".*sidecar/.*\\.cpp$")

# Core library
add_library(depth ${LIB_TYPE} ${DEPTH_SOURCES})

target_include_directories(depth
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
        $<INSTALL_INTERFACE:include>
    PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/src
        ${CMAKE_CURRENT_SOURCE_DIR}/third_party/stb
)

# Platform-specific GPU backend
if(EMSCRIPTEN)
    target_compile_definitions(depth PRIVATE DEPTH_BACKEND_SOFTWARE=1)
elseif(APPLE)
    target_compile_definitions(depth PRIVATE DEPTH_BACKEND_METAL=1)
    # target_link_libraries(depth PRIVATE "-framework Metal" "-framework MetalKit")
elseif(WIN32)
    target_compile_definitions(depth PRIVATE DEPTH_BACKEND_VULKAN=1)
    # find_package(Vulkan REQUIRED)
    # target_link_libraries(depth PRIVATE Vulkan::Vulkan)
else()
    target_compile_definitions(depth PRIVATE DEPTH_BACKEND_VULKAN=1)
endif()

# Compiler warnings
if(MSVC)
    target_compile_options(depth PRIVATE /W4)
    target_compile_definitions(depth PRIVATE _USE_MATH_DEFINES)
elseif(NOT EMSCRIPTEN)
    target_compile_options(depth PRIVATE -Wall -Wextra -Wpedantic)
endif()

# ── Emscripten / WASM build ──────────────────────────────
if(EMSCRIPTEN)
    option(DEPTH_WASM_EMBIND "Build with Embind JS bindings" ON)

    # Emscripten compiles sources directly into the final output,
    # so we create an executable (not a library) that produces
    # depth.js + depth.wasm.
    add_executable(depth_wasm src/depth_c_api.cpp)
    target_link_libraries(depth_wasm PRIVATE depth)
    target_include_directories(depth_wasm PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/include
    )

    # Core WASM flags
    set(DEPTH_WASM_LINK_FLAGS
        "-s WASM=1"
        "-s MODULARIZE=1"
        "-s EXPORT_NAME='DepthModule'"
        "-s EXPORT_ES6=1"
        "-s ALLOW_MEMORY_GROWTH=1"
        "-s ENVIRONMENT='web'"
        "-s NO_EXIT_RUNTIME=1"
        "-s FILESYSTEM=0"
    )

    # Exported C functions (the _-prefixed names Emscripten expects)
    set(DEPTH_WASM_EXPORTS
        "_depth_wasm_scene_create"
        "_depth_wasm_scene_destroy"
        "_depth_wasm_scene_set_background"
        "_depth_wasm_scene_add_object"
        "_depth_wasm_scene_set_object_transform"
        "_depth_wasm_scene_set_object_material"
        "_depth_wasm_render"
        "_depth_wasm_free_pixels"
        "_depth_wasm_version"
        "_malloc"
        "_free"
    )
    list(JOIN DEPTH_WASM_EXPORTS "," DEPTH_EXPORTS_STR)
    list(APPEND DEPTH_WASM_LINK_FLAGS
        "-s EXPORTED_FUNCTIONS='[${DEPTH_EXPORTS_STR}]'"
        "-s EXPORTED_RUNTIME_METHODS='[\"cwrap\",\"ccall\",\"getValue\",\"setValue\",\"HEAPU8\"]'"
    )

    # Embind bindings (optional, adds nicer OOP JS API)
    if(DEPTH_WASM_EMBIND)
        target_sources(depth_wasm PRIVATE src/depth_embind.cpp)
        list(APPEND DEPTH_WASM_LINK_FLAGS "--bind")
    endif()

    # Apply link flags
    list(JOIN DEPTH_WASM_LINK_FLAGS " " DEPTH_WASM_LINK_FLAGS_STR)
    set_target_properties(depth_wasm PROPERTIES
        OUTPUT_NAME "depth"
        SUFFIX ".js"
        LINK_FLAGS "${DEPTH_WASM_LINK_FLAGS_STR}"
    )

    # Compiler flags for WASM targets
    target_compile_options(depth PRIVATE -fno-exceptions)
    target_compile_options(depth_wasm PRIVATE -fno-exceptions)

    message(STATUS "[Depth] Emscripten WASM build enabled")
    if(DEPTH_WASM_EMBIND)
        message(STATUS "[Depth] Embind bindings: ON")
    endif()
endif()

# ── depth_sidecar (native JSON-over-stdio bridge for the Electron host) ──
if(NOT EMSCRIPTEN)
    add_executable(depth_sidecar src/sidecar/sidecar_main.cpp)
    target_link_libraries(depth_sidecar PRIVATE depth)
    target_include_directories(depth_sidecar PRIVATE
        ${CMAKE_CURRENT_SOURCE_DIR}/include
    )
    if(MSVC)
        target_compile_options(depth_sidecar PRIVATE /W4)
        target_compile_definitions(depth_sidecar PRIVATE _USE_MATH_DEFINES NOMINMAX)
    else()
        target_compile_options(depth_sidecar PRIVATE -Wall -Wextra)
    endif()
endif()

# Examples (skip for WASM — the HTML demo is standalone)
if(DEPTH_BUILD_EXAMPLES AND NOT EMSCRIPTEN)
    add_subdirectory(examples)
endif()

# Tests (skip for WASM)
if(DEPTH_BUILD_TESTS AND NOT EMSCRIPTEN)
    add_subdirectory(tests)
endif()

# Install (native only)
if(NOT EMSCRIPTEN)
    install(TARGETS depth
        EXPORT depthTargets
        LIBRARY DESTINATION lib
        ARCHIVE DESTINATION lib
        RUNTIME DESTINATION bin
    )

    install(DIRECTORY include/depth
        DESTINATION include
    )

    install(EXPORT depthTargets
        FILE depthConfig.cmake
        NAMESPACE depth::
        DESTINATION lib/cmake/depth
    )
endif()
