/**
 * @file types.h
 * @brief Core types used throughout the Depth SDK.
 */

#pragma once

#include <cstdint>
#include <array>

namespace depth {

struct Vec2 {
    float x = 0.0f;
    float y = 0.0f;
};

struct Vec3 {
    float x = 0.0f;
    float y = 0.0f;
    float z = 0.0f;

    Vec3 operator+(const Vec3& o) const { return {x + o.x, y + o.y, z + o.z}; }
    Vec3 operator-(const Vec3& o) const { return {x - o.x, y - o.y, z - o.z}; }
    Vec3 operator*(float s) const { return {x * s, y * s, z * s}; }
};

struct Vec4 {
    float x = 0.0f;
    float y = 0.0f;
    float z = 0.0f;
    float w = 1.0f;
};

/// RGBA color, components in [0, 1]
struct Color {
    float r = 1.0f;
    float g = 1.0f;
    float b = 1.0f;
    float a = 1.0f;

    static Color from_hex(uint32_t hex);
    static Color white() { return {1, 1, 1, 1}; }
    static Color black() { return {0, 0, 0, 1}; }
};

/// Axis-aligned bounding box
struct AABB {
    Vec3 min;
    Vec3 max;
};

/// Transform: position + rotation (euler) + uniform scale
struct Transform {
    Vec3 position = {0, 0, 0};
    Vec3 rotation = {0, 0, 0};  // euler angles in radians
    float scale = 1.0f;
};

/// Supported image pixel formats
enum class PixelFormat : uint8_t {
    RGBA8,    // 4 bytes per pixel, 8 bits per channel
    RGB8,     // 3 bytes per pixel
    BGRA8,    // Windows-native ordering
    RGBAf32,  // 4 floats per pixel (HDR)
};

/// Supported export formats
enum class ExportFormat : uint8_t {
    PNG,
    JPEG,
    WebP,
};

/// Material presets
enum class MaterialPreset : uint8_t {
    Matte,
    Glossy,
    Metallic,
    Glass,
    Plastic,
};

/// Primitive geometry types
enum class GeometryType : uint8_t {
    Box,
    Cylinder,
    Sphere,
    Cone,
    Torus,
    Plane,
    Custom,  // loaded from mesh file

    // Mockup geometry types (matching web app)
    Mug,
    Phone,
    Bottle,
    Bag,
    Card,
};

/// Result type for operations that can fail
enum class Status : uint8_t {
    Ok = 0,
    InvalidInput,
    FileNotFound,
    UnsupportedFormat,
    GPUError,
    OutOfMemory,
};

} // namespace depth
