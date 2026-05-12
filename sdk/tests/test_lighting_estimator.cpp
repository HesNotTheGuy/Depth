/**
 * @file test_lighting_estimator.cpp
 * @brief Tests for estimate_lighting() — quadrant analysis & bright-spot detection.
 */

#include "test_harness.h"
#include <depth/depth.h>
#include <cstring>

using namespace depth;

namespace {

Image make_rgba(uint32_t w, uint32_t h) {
    return Image(w, h, PixelFormat::RGBA8);
}

void set_pixel(Image& img, uint32_t x, uint32_t y, uint8_t r, uint8_t g, uint8_t b, uint8_t a = 255) {
    if (x >= img.width() || y >= img.height()) return;
    uint8_t* p = img.data() + (y * img.width() + x) * 4;
    p[0] = r; p[1] = g; p[2] = b; p[3] = a;
}

void fill_rect(Image& img, uint32_t x0, uint32_t y0, uint32_t x1, uint32_t y1,
               uint8_t r, uint8_t g, uint8_t b) {
    for (uint32_t y = y0; y < y1; y++)
        for (uint32_t x = x0; x < x1; x++)
            set_pixel(img, x, y, r, g, b);
}

void fill_all(Image& img, uint8_t r, uint8_t g, uint8_t b) {
    fill_rect(img, 0, 0, img.width(), img.height(), r, g, b);
}

} // namespace

TEST_CASE(lighting_top_bright_bottom_dark_elevation_high) {
    Image img = make_rgba(64, 64);
    fill_rect(img, 0, 0, 64, 32, 255, 255, 255);   // top: white
    fill_rect(img, 0, 32, 64, 64, 10, 10, 10);     // bottom: near-black

    // Use the configured grid_divisions for a clear top/bottom contrast.
    LightingEstimateConfig cfg;
    cfg.grid_divisions = 4;
    auto est = estimate_lighting(img, cfg);

    ASSERT_GT(est.brightness, 0.0f);
    ASSERT_GT(est.elevation, 0.7f);
}

TEST_CASE(lighting_bright_spot_upper_right_detected) {
    // 64x64 dark image with a clear bright cluster in upper-right.
    Image img = make_rgba(64, 64);
    fill_all(img, 8, 8, 8);
    // Place a bright 12x12 spot at (48..60, 4..16) — upper right.
    fill_rect(img, 48, 4, 60, 16, 250, 250, 250);

    auto est = estimate_lighting(img);
    ASSERT_GT(est.detected_lights.size(), size_t{0});
    if (!est.detected_lights.empty()) {
        const auto& first = est.detected_lights[0];
        // Upper-right means x > 0.5 and y < 0.5 in normalized coords.
        ASSERT_GT(first.x, 0.5f);
        ASSERT_LT(first.y, 0.5f);
        ASSERT_GT(first.intensity, 0.7f);
    }
}

TEST_CASE(lighting_all_black_no_spots) {
    Image img = make_rgba(64, 64);
    fill_all(img, 0, 0, 0);
    auto est = estimate_lighting(img);
    // brightness clamped to >=0.2 by impl, but should be at floor.
    ASSERT_LT(est.brightness, 0.3f);
    ASSERT_EQ(est.detected_lights.size(), size_t{0});
}

TEST_CASE(lighting_estimate_reproducible) {
    Image img = make_rgba(64, 64);
    // Gradient: left dark -> right bright.
    for (uint32_t y = 0; y < 64; y++) {
        for (uint32_t x = 0; x < 64; x++) {
            uint8_t v = static_cast<uint8_t>((x * 255) / 63);
            set_pixel(img, x, y, v, v, v);
        }
    }
    auto a = estimate_lighting(img);
    auto b = estimate_lighting(img);

    ASSERT_NEAR(a.brightness, b.brightness, 1e-5f);
    ASSERT_NEAR(a.direction_angle, b.direction_angle, 1e-3f);
    ASSERT_NEAR(a.elevation, b.elevation, 1e-5f);
    ASSERT_NEAR(a.contrast, b.contrast, 1e-5f);
    ASSERT_EQ(a.detected_lights.size(), b.detected_lights.size());
    for (size_t i = 0; i < a.detected_lights.size(); i++) {
        ASSERT_NEAR(a.detected_lights[i].x,         b.detected_lights[i].x,         1e-5f);
        ASSERT_NEAR(a.detected_lights[i].y,         b.detected_lights[i].y,         1e-5f);
        ASSERT_NEAR(a.detected_lights[i].intensity, b.detected_lights[i].intensity, 1e-5f);
    }
}

TEST_CASE(lighting_empty_image_returns_default) {
    Image empty;
    auto est = estimate_lighting(empty);
    // Default-constructed LightingEstimate has brightness == 1.0
    ASSERT_NEAR(est.brightness, 1.0f, 1e-5f);
    ASSERT_EQ(est.detected_lights.size(), size_t{0});
}

TEST_CASE(lighting_gradient_direction_points_right) {
    // Brightness rising left -> right should produce angle near 0 (right).
    Image img = make_rgba(64, 64);
    for (uint32_t y = 0; y < 64; y++)
        for (uint32_t x = 0; x < 64; x++) {
            uint8_t v = static_cast<uint8_t>((x * 255) / 63);
            set_pixel(img, x, y, v, v, v);
        }
    auto est = estimate_lighting(img);
    // Angle should be near 0 or 360 (i.e. cos(angle) close to 1).
    bool near_right = (est.direction_angle < 45.0f) || (est.direction_angle > 315.0f);
    ASSERT_TRUE(near_right);
}
