/**
 * @file test_compositor.cpp
 * @brief Coverage for composite() blend modes and configuration.
 */

#include "test_harness.h"
#include <depth/depth.h>

using namespace depth;

namespace {

Image solid(uint32_t w, uint32_t h, uint8_t r, uint8_t g, uint8_t b, uint8_t a = 255) {
    Image img(w, h, PixelFormat::RGBA8);
    for (size_t i = 0; i < img.size_bytes(); i += 4) {
        img.data()[i + 0] = r;
        img.data()[i + 1] = g;
        img.data()[i + 2] = b;
        img.data()[i + 3] = a;
    }
    return img;
}

} // namespace

TEST_CASE(compositor_normal_opaque_white_over_black) {
    auto bg = solid(8, 8, 0, 0, 0, 255);
    auto fg = solid(8, 8, 255, 255, 255, 255);
    auto out = composite(bg, fg);  // default Normal blend, full opacity
    auto p = out.pixel_at(4, 4);
    ASSERT_NEAR(p.r, 1.0f, 1.0f / 255.0f);
    ASSERT_NEAR(p.g, 1.0f, 1.0f / 255.0f);
    ASSERT_NEAR(p.b, 1.0f, 1.0f / 255.0f);
}

TEST_CASE(compositor_multiply_white_over_black_is_black) {
    auto bg = solid(8, 8, 0, 0, 0, 255);
    auto fg = solid(8, 8, 255, 255, 255, 255);
    CompositeConfig cfg;
    cfg.blend_mode = BlendMode::Multiply;
    auto out = composite(bg, fg, cfg);
    auto p = out.pixel_at(0, 0);
    // 0 * 1 = 0
    ASSERT_NEAR(p.r, 0.0f, 1.0f / 255.0f);
    ASSERT_NEAR(p.g, 0.0f, 1.0f / 255.0f);
    ASSERT_NEAR(p.b, 0.0f, 1.0f / 255.0f);
}

TEST_CASE(compositor_normal_half_alpha_blends_50_percent) {
    // bg=black, fg=white@alpha=128 (~0.502) → output ~= 0.502 grey.
    auto bg = solid(8, 8, 0, 0, 0, 255);
    auto fg = solid(8, 8, 255, 255, 255, 128);
    auto out = composite(bg, fg);
    auto p = out.pixel_at(4, 4);
    ASSERT_NEAR(p.r, 128.0f / 255.0f, 2.0f / 255.0f);
    ASSERT_NEAR(p.g, 128.0f / 255.0f, 2.0f / 255.0f);
    ASSERT_NEAR(p.b, 128.0f / 255.0f, 2.0f / 255.0f);
}

TEST_CASE(compositor_foreground_only_suppresses_background) {
    auto bg = solid(8, 8, 200, 100, 50, 255);
    auto fg = solid(8, 8, 0, 255, 0, 200);
    CompositeConfig cfg;
    cfg.foreground_only = true;
    auto out = composite(bg, fg, cfg);
    auto p = out.pixel_at(2, 2);
    // Output should equal foreground exactly.
    ASSERT_NEAR(p.r, 0.0f, 1.0f / 255.0f);
    ASSERT_NEAR(p.g, 1.0f, 1.0f / 255.0f);
    ASSERT_NEAR(p.b, 0.0f, 1.0f / 255.0f);
    ASSERT_NEAR(p.a, 200.0f / 255.0f, 2.0f / 255.0f);
}

TEST_CASE(compositor_screen_white_over_black_is_white) {
    auto bg = solid(8, 8, 0, 0, 0, 255);
    auto fg = solid(8, 8, 255, 255, 255, 255);
    CompositeConfig cfg;
    cfg.blend_mode = BlendMode::Screen;
    auto out = composite(bg, fg, cfg);
    auto p = out.pixel_at(0, 0);
    ASSERT_NEAR(p.r, 1.0f, 1.0f / 255.0f);
}

TEST_CASE(compositor_layer_opacity_zero_yields_background) {
    auto bg = solid(8, 8, 200, 100, 50, 255);
    auto fg = solid(8, 8, 0, 255, 0, 255);
    CompositeConfig cfg;
    cfg.layer_opacity = 0.0f;
    auto out = composite(bg, fg, cfg);
    auto p = out.pixel_at(4, 4);
    ASSERT_NEAR(p.r, 200.0f / 255.0f, 2.0f / 255.0f);
    ASSERT_NEAR(p.g, 100.0f / 255.0f, 2.0f / 255.0f);
    ASSERT_NEAR(p.b,  50.0f / 255.0f, 2.0f / 255.0f);
}

TEST_CASE(compositor_output_dimensions_match_background) {
    auto bg = solid(32, 24, 50, 50, 50, 255);
    auto fg = solid(32, 24, 100, 100, 100, 255);
    auto out = composite(bg, fg);
    ASSERT_EQ(out.width(),  32u);
    ASSERT_EQ(out.height(), 24u);
}
