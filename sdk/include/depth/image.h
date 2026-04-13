/**
 * @file image.h
 * @brief Image loading, creation, and manipulation.
 */

#pragma once

#include "depth/types.h"
#include <cstddef>
#include <memory>
#include <string>
#include <vector>

namespace depth {

/**
 * CPU-side image buffer.
 *
 * This is the main way to get pixel data into and out of the SDK.
 * The SDK does not own or manage GPU textures directly — the host
 * application is responsible for uploading to its own GPU context
 * if needed. For the built-in renderer, Image is passed directly.
 */
class Image {
public:
    Image() = default;
    Image(uint32_t width, uint32_t height, PixelFormat format = PixelFormat::RGBA8);

    /// Load from file (PNG, JPEG, WebP, BMP, TGA)
    static Image load(const std::string& path, Status* status = nullptr);

    /// Load from memory buffer
    static Image load_from_memory(const uint8_t* data, size_t size, Status* status = nullptr);

    /// Create from raw pixel data (copies the data)
    static Image from_pixels(uint32_t width, uint32_t height, PixelFormat format,
                             const uint8_t* pixels);

    /// Save to file
    Status save(const std::string& path, ExportFormat format = ExportFormat::PNG,
                int quality = 95) const;

    /// Encode to memory buffer
    std::vector<uint8_t> encode(ExportFormat format = ExportFormat::PNG,
                                int quality = 95) const;

    uint32_t width() const { return width_; }
    uint32_t height() const { return height_; }
    PixelFormat format() const { return format_; }
    const uint8_t* data() const { return pixels_.data(); }
    uint8_t* data() { return pixels_.data(); }
    size_t size_bytes() const { return pixels_.size(); }
    bool empty() const { return pixels_.empty(); }

    /// Get pixel color at (x, y). Bounds-checked.
    Color pixel_at(uint32_t x, uint32_t y) const;

private:
    uint32_t width_ = 0;
    uint32_t height_ = 0;
    PixelFormat format_ = PixelFormat::RGBA8;
    std::vector<uint8_t> pixels_;
};

} // namespace depth
