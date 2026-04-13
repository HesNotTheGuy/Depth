#include "depth/lighting.h"

#include <algorithm>
#include <cmath>
#include <numeric>

namespace depth {

LightingEstimate estimate_lighting(const Image& image, const LightingEstimateConfig& config) {
    LightingEstimate result;

    if (image.empty()) {
        return result;
    }

    const uint32_t w = image.width();
    const uint32_t h = image.height();

    // Compute per-grid-cell average luminance
    const uint32_t divs = config.grid_divisions;
    const uint32_t cells = divs * divs;
    std::vector<float> cell_lum(cells, 0.0f);
    std::vector<uint32_t> cell_count(cells, 0);

    float total_r = 0, total_g = 0, total_b = 0;
    float total_lum = 0;
    float min_lum = 255.0f, max_lum = 0.0f;
    uint32_t pixel_count = 0;

    // Sample at reduced resolution for speed
    const uint32_t step = std::max(1u, std::min(w, h) / config.sample_resolution);

    for (uint32_t y = 0; y < h; y += step) {
        for (uint32_t x = 0; x < w; x += step) {
            Color c = image.pixel_at(x, y);
            float r = c.r * 255.0f;
            float g = c.g * 255.0f;
            float b = c.b * 255.0f;
            float lum = 0.299f * r + 0.587f * g + 0.114f * b;

            // Determine which grid cell this pixel belongs to
            uint32_t cx = std::min((x * divs) / w, divs - 1);
            uint32_t cy = std::min((y * divs) / h, divs - 1);
            uint32_t cell_idx = cy * divs + cx;
            cell_lum[cell_idx] += lum;
            cell_count[cell_idx]++;

            total_r += r;
            total_g += g;
            total_b += b;
            total_lum += lum;
            min_lum = std::min(min_lum, lum);
            max_lum = std::max(max_lum, lum);
            pixel_count++;
        }
    }

    if (pixel_count == 0) return result;

    // Average per cell
    for (uint32_t i = 0; i < cells; i++) {
        if (cell_count[i] > 0) {
            cell_lum[i] /= cell_count[i];
        }
    }

    // Compute weighted light direction from cell luminances
    float dx = 0, dy = 0;
    for (uint32_t cy = 0; cy < divs; cy++) {
        for (uint32_t cx = 0; cx < divs; cx++) {
            float lum = cell_lum[cy * divs + cx];
            // Map cell position to [-1, 1]
            float nx = (static_cast<float>(cx) / (divs - 1)) * 2.0f - 1.0f;
            float ny = (static_cast<float>(cy) / (divs - 1)) * 2.0f - 1.0f;
            dx += nx * lum;
            dy -= ny * lum; // flip Y (image Y is top-down)
        }
    }

    float angle = std::atan2(dy, dx) * (180.0f / static_cast<float>(M_PI));
    if (angle < 0) angle += 360.0f;
    result.direction_angle = angle;

    // Elevation: if top is brighter than bottom, light is high
    float top_lum = 0, bottom_lum = 0;
    uint32_t top_count = 0, bottom_count = 0;
    for (uint32_t cx = 0; cx < divs; cx++) {
        for (uint32_t cy = 0; cy < divs / 2; cy++) {
            top_lum += cell_lum[cy * divs + cx];
            top_count++;
        }
        for (uint32_t cy = divs / 2; cy < divs; cy++) {
            bottom_lum += cell_lum[cy * divs + cx];
            bottom_count++;
        }
    }
    if (top_count > 0) top_lum /= top_count;
    if (bottom_count > 0) bottom_lum /= bottom_count;
    result.elevation = std::clamp((top_lum - bottom_lum) / 128.0f + 0.5f, 0.0f, 1.0f);

    // Average color
    float avg_r = total_r / pixel_count;
    float avg_g = total_g / pixel_count;
    float avg_b = total_b / pixel_count;
    result.ambient_color = {avg_r / 255.0f, avg_g / 255.0f, avg_b / 255.0f, 1.0f};

    // Color temperature from warm/cool bias
    float warmth = (avg_r - avg_b) / 255.0f;
    result.light_color = {
        std::clamp((200.0f + warmth * 55.0f) / 255.0f, 0.0f, 1.0f),
        std::clamp((190.0f + warmth * 30.0f) / 255.0f, 0.0f, 1.0f),
        std::clamp((180.0f - warmth * 40.0f) / 255.0f, 0.0f, 1.0f),
        1.0f
    };

    // Brightness
    float avg_lum = total_lum / pixel_count;
    result.brightness = std::clamp(avg_lum / 128.0f, 0.2f, 2.0f);

    // Contrast
    result.contrast = std::clamp((max_lum - min_lum) / 255.0f, 0.0f, 1.0f);

    return result;
}

} // namespace depth
