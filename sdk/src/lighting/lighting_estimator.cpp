#include "depth/lighting.h"

#include <algorithm>
#include <cmath>
#include <numeric>
#include <queue>

namespace depth {

namespace {

/**
 * Detect bright spots in an image using BFS flood-fill clustering.
 * Returns up to 4 detected lights sorted by intensity (descending).
 */
std::vector<DetectedLight> detect_bright_spots(const Image& image) {
    const uint32_t src_w = image.width();
    const uint32_t src_h = image.height();
    if (src_w == 0 || src_h == 0) return {};

    // Downscale to ~100x75 for analysis
    const uint32_t analysis_w = 100;
    const uint32_t analysis_h = std::max(1u, (src_h * analysis_w) / src_w);
    const uint32_t total = analysis_w * analysis_h;

    // Build luminance map at analysis resolution
    std::vector<float> lum(total);
    std::vector<float> r_buf(total), g_buf(total), b_buf(total);
    float max_lum = 0.0f;

    for (uint32_t ay = 0; ay < analysis_h; ay++) {
        for (uint32_t ax = 0; ax < analysis_w; ax++) {
            // Map analysis coords back to source image
            uint32_t sx = (ax * src_w) / analysis_w;
            uint32_t sy = (ay * src_h) / analysis_h;
            Color c = image.pixel_at(sx, sy);

            uint32_t idx = ay * analysis_w + ax;
            float r = c.r * 255.0f;
            float g = c.g * 255.0f;
            float b = c.b * 255.0f;
            float l = 0.299f * r + 0.587f * g + 0.114f * b;

            r_buf[idx] = r;
            g_buf[idx] = g;
            b_buf[idx] = b;
            lum[idx] = l;
            max_lum = std::max(max_lum, l);
        }
    }

    // Too dark for meaningful detection
    if (max_lum < 100.0f) return {};

    // Threshold: 85% of max luminance
    const float threshold = max_lum * 0.85f;

    std::vector<uint8_t> visited(total, 0);
    std::vector<DetectedLight> spots;

    // Cluster tracking for sorting by size
    struct SpotData {
        DetectedLight light;
        uint32_t pixel_count;
    };
    std::vector<SpotData> candidates;

    static const int dx[] = {1, -1, 0, 0};
    static const int dy[] = {0, 0, 1, -1};

    for (uint32_t y = 0; y < analysis_h; y++) {
        for (uint32_t x = 0; x < analysis_w; x++) {
            uint32_t idx = y * analysis_w + x;
            if (visited[idx] || lum[idx] < threshold) continue;

            // BFS flood fill
            std::queue<uint32_t> queue;
            queue.push(idx);
            visited[idx] = 1;

            float sum_x = 0, sum_y = 0;
            float sum_r = 0, sum_g = 0, sum_b = 0, sum_lum = 0;
            uint32_t count = 0;

            while (!queue.empty()) {
                uint32_t pi = queue.front();
                queue.pop();

                uint32_t px = pi % analysis_w;
                uint32_t py = pi / analysis_w;

                sum_x += static_cast<float>(px);
                sum_y += static_cast<float>(py);
                sum_r += r_buf[pi];
                sum_g += g_buf[pi];
                sum_b += b_buf[pi];
                sum_lum += lum[pi];
                count++;

                // 4-connected neighbors
                for (int d = 0; d < 4; d++) {
                    int nx = static_cast<int>(px) + dx[d];
                    int ny = static_cast<int>(py) + dy[d];
                    if (nx < 0 || nx >= static_cast<int>(analysis_w) ||
                        ny < 0 || ny >= static_cast<int>(analysis_h)) continue;
                    uint32_t ni = static_cast<uint32_t>(ny) * analysis_w + static_cast<uint32_t>(nx);
                    if (visited[ni] || lum[ni] < threshold) continue;
                    visited[ni] = 1;
                    queue.push(ni);
                }
            }

            // Filter noise: require at least 4 pixels
            if (count < 4) continue;

            DetectedLight light;
            light.x = (sum_x / count) / static_cast<float>(analysis_w);
            light.y = (sum_y / count) / static_cast<float>(analysis_h);
            light.color = {
                (sum_r / count) / 255.0f,
                (sum_g / count) / 255.0f,
                (sum_b / count) / 255.0f,
                1.0f
            };
            light.intensity = (sum_lum / count) / 255.0f;

            candidates.push_back({light, count});
        }
    }

    // Sort by cluster size descending, keep top 4
    std::sort(candidates.begin(), candidates.end(),
        [](const SpotData& a, const SpotData& b) {
            return a.pixel_count > b.pixel_count;
        });

    size_t limit = std::min(candidates.size(), size_t{4});
    std::vector<DetectedLight> result;
    result.reserve(limit);
    for (size_t i = 0; i < limit; i++) {
        result.push_back(candidates[i].light);
    }
    return result;
}

} // anonymous namespace

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

    // Detect bright spots (potential light sources)
    result.detected_lights = detect_bright_spots(image);

    return result;
}

} // namespace depth
