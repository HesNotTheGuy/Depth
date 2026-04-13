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
if(APPLE)
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
else()
    target_compile_options(depth PRIVATE -Wall -Wextra -Wpedantic)
endif()

# Examples
if(DEPTH_BUILD_EXAMPLES)
    add_subdirectory(examples)
endif()

# Tests
if(DEPTH_BUILD_TESTS)
    add_subdirectory(tests)
endif()

# Install
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
