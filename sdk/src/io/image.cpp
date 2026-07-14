#include "depth/image.h"
#include "stb_image.h"
#include "stb_image_write.h"

#include <cstring>
#include <algorithm>

namespace depth {

// ── Color ──────────────────────────────────────────────

Color Color::from_hex(uint32_t hex) {
    return {
        ((hex >> 16) & 0xFF) / 255.0f,
        ((hex >> 8) & 0xFF) / 255.0f,
        (hex & 0xFF) / 255.0f,
        1.0f
    };
}

// ── Helpers ────────────────────────────────────────────

static uint32_t bytes_per_pixel(PixelFormat fmt) {
    switch (fmt) {
        case PixelFormat::RGBA8:
        case PixelFormat::BGRA8:
            return 4;
        case PixelFormat::RGB8:
            return 3;
        case PixelFormat::RGBAf32:
            return 16;
    }
    return 4;
}

static std::string extension_lower(const std::string& path) {
    auto dot = path.rfind('.');
    if (dot == std::string::npos) return "";
    std::string ext = path.substr(dot + 1);
    std::transform(ext.begin(), ext.end(), ext.begin(),
                   [](unsigned char c) { return std::tolower(c); });
    return ext;
}

// ── Image ──────────────────────────────────────────────

Image::Image(uint32_t width, uint32_t height, PixelFormat format)
    : width_(width), height_(height), format_(format) {
    pixels_.resize(static_cast<size_t>(width) * height * bytes_per_pixel(format), 0);
}

Image Image::from_pixels(uint32_t width, uint32_t height, PixelFormat format,
                         const uint8_t* pixels) {
    Image img(width, height, format);
    std::memcpy(img.pixels_.data(), pixels, img.pixels_.size());
    return img;
}

Image Image::load(const std::string& path, Status* status) {
    int w, h, channels;
    // Always request 4 channels (RGBA)
    unsigned char* data = stbi_load(path.c_str(), &w, &h, &channels, 4);
    if (!data) {
        if (status) {
            // Try to distinguish file-not-found from format error
            FILE* f = fopen(path.c_str(), "rb");
            if (!f) {
                *status = Status::FileNotFound;
            } else {
                fclose(f);
                *status = Status::UnsupportedFormat;
            }
        }
        return {};
    }

    Image img;
    img.width_ = static_cast<uint32_t>(w);
    img.height_ = static_cast<uint32_t>(h);
    img.format_ = PixelFormat::RGBA8;
    img.pixels_.assign(data, data + (static_cast<size_t>(w) * h * 4));
    stbi_image_free(data);

    if (status) *status = Status::Ok;
    return img;
}

Image Image::load_from_memory(const uint8_t* data, size_t size, Status* status) {
    int w, h, channels;
    unsigned char* pixels = stbi_load_from_memory(
        data, static_cast<int>(size), &w, &h, &channels, 4);
    if (!pixels) {
        if (status) *status = Status::UnsupportedFormat;
        return {};
    }

    Image img;
    img.width_ = static_cast<uint32_t>(w);
    img.height_ = static_cast<uint32_t>(h);
    img.format_ = PixelFormat::RGBA8;
    img.pixels_.assign(pixels, pixels + (static_cast<size_t>(w) * h * 4));
    stbi_image_free(pixels);

    if (status) *status = Status::Ok;
    return img;
}

Status Image::save(const std::string& path, ExportFormat format, int quality) const {
    if (empty()) return Status::InvalidInput;

    // Convert to RGBA8 if needed for stb_image_write
    const uint8_t* write_data = pixels_.data();
    std::vector<uint8_t> converted;

    if (format_ == PixelFormat::BGRA8) {
        converted.resize(pixels_.size());
        for (size_t i = 0; i < pixels_.size(); i += 4) {
            converted[i + 0] = pixels_[i + 2]; // R
            converted[i + 1] = pixels_[i + 1]; // G
            converted[i + 2] = pixels_[i + 0]; // B
            converted[i + 3] = pixels_[i + 3]; // A
        }
        write_data = converted.data();
    } else if (format_ == PixelFormat::RGBAf32) {
        converted.resize(static_cast<size_t>(width_) * height_ * 4);
        const float* fp = reinterpret_cast<const float*>(pixels_.data());
        for (size_t i = 0; i < static_cast<size_t>(width_) * height_; i++) {
            converted[i * 4 + 0] = static_cast<uint8_t>(std::clamp(fp[i * 4 + 0], 0.0f, 1.0f) * 255.0f);
            converted[i * 4 + 1] = static_cast<uint8_t>(std::clamp(fp[i * 4 + 1], 0.0f, 1.0f) * 255.0f);
            converted[i * 4 + 2] = static_cast<uint8_t>(std::clamp(fp[i * 4 + 2], 0.0f, 1.0f) * 255.0f);
            converted[i * 4 + 3] = static_cast<uint8_t>(std::clamp(fp[i * 4 + 3], 0.0f, 1.0f) * 255.0f);
        }
        write_data = converted.data();
    }

    int w = static_cast<int>(width_);
    int h = static_cast<int>(height_);
    int ok = 0;

    switch (format) {
        case ExportFormat::PNG:
            ok = stbi_write_png(path.c_str(), w, h, 4, write_data, w * 4);
            break;
        case ExportFormat::JPEG:
            ok = stbi_write_jpg(path.c_str(), w, h, 4, write_data, quality);
            break;
        case ExportFormat::WebP:
            // stb_image_write doesn't support WebP — fall back to PNG
            ok = stbi_write_png(path.c_str(), w, h, 4, write_data, w * 4);
            break;
    }

    return ok ? Status::Ok : Status::UnsupportedFormat;
}

// Callback for stb_image_write to memory
struct WriteContext {
    std::vector<uint8_t>* buffer;
};

static void write_to_buffer(void* context, void* data, int size) {
    auto* ctx = static_cast<WriteContext*>(context);
    auto* bytes = static_cast<const uint8_t*>(data);
    ctx->buffer->insert(ctx->buffer->end(), bytes, bytes + size);
}

std::vector<uint8_t> Image::encode(ExportFormat format, int quality) const {
    if (empty()) return {};

    std::vector<uint8_t> buffer;
    WriteContext ctx{&buffer};

    int w = static_cast<int>(width_);
    int h = static_cast<int>(height_);
    const uint8_t* write_data = pixels_.data();

    // Handle format conversion same as save()
    std::vector<uint8_t> converted;
    if (format_ == PixelFormat::BGRA8) {
        converted.resize(pixels_.size());
        for (size_t i = 0; i < pixels_.size(); i += 4) {
            converted[i + 0] = pixels_[i + 2];
            converted[i + 1] = pixels_[i + 1];
            converted[i + 2] = pixels_[i + 0];
            converted[i + 3] = pixels_[i + 3];
        }
        write_data = converted.data();
    }

    switch (format) {
        case ExportFormat::PNG:
            stbi_write_png_to_func(write_to_buffer, &ctx, w, h, 4, write_data, w * 4);
            break;
        case ExportFormat::JPEG:
            stbi_write_jpg_to_func(write_to_buffer, &ctx, w, h, 4, write_data, quality);
            break;
        case ExportFormat::WebP:
            // Fallback to PNG
            stbi_write_png_to_func(write_to_buffer, &ctx, w, h, 4, write_data, w * 4);
            break;
    }

    return buffer;
}

Color Image::pixel_at(uint32_t x, uint32_t y) const {
    if (x >= width_ || y >= height_) {
        return Color::black();
    }

    uint32_t bpp = bytes_per_pixel(format_);
    size_t offset = (static_cast<size_t>(y) * width_ + x) * bpp;

    switch (format_) {
        case PixelFormat::RGBA8:
            return {
                pixels_[offset + 0] / 255.0f,
                pixels_[offset + 1] / 255.0f,
                pixels_[offset + 2] / 255.0f,
                pixels_[offset + 3] / 255.0f,
            };
        case PixelFormat::BGRA8:
            return {
                pixels_[offset + 2] / 255.0f,
                pixels_[offset + 1] / 255.0f,
                pixels_[offset + 0] / 255.0f,
                pixels_[offset + 3] / 255.0f,
            };
        case PixelFormat::RGB8:
            return {
                pixels_[offset + 0] / 255.0f,
                pixels_[offset + 1] / 255.0f,
                pixels_[offset + 2] / 255.0f,
                1.0f,
            };
        case PixelFormat::RGBAf32: {
            const float* fp = reinterpret_cast<const float*>(&pixels_[offset]);
            return {fp[0], fp[1], fp[2], fp[3]};
        }
    }
    return Color::black();
}

} // namespace depth
