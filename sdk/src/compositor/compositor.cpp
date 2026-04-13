#include "depth/compositor.h"
#include "depth/renderer.h"

#include <algorithm>
#include <cmath>

namespace depth {

Image composite(
    const Image& background,
    const Image& foreground,
    const CompositeConfig& config
) {
    if (config.foreground_only) {
        return foreground;
    }

    uint32_t w = background.width();
    uint32_t h = background.height();
    Image output(w, h, PixelFormat::RGBA8);

    // TODO: handle foreground != background dimensions (scale foreground)

    for (uint32_t y = 0; y < h; y++) {
        for (uint32_t x = 0; x < w; x++) {
            Color bg = background.pixel_at(x, y);
            Color fg = foreground.pixel_at(x, y);
            float fa = fg.a * config.layer_opacity;

            Color out;
            switch (config.blend_mode) {
                case BlendMode::Normal:
                default:
                    out.r = fg.r * fa + bg.r * (1.0f - fa);
                    out.g = fg.g * fa + bg.g * (1.0f - fa);
                    out.b = fg.b * fa + bg.b * (1.0f - fa);
                    out.a = fa + bg.a * (1.0f - fa);
                    break;

                case BlendMode::Multiply:
                    out.r = (fg.r * bg.r) * fa + bg.r * (1.0f - fa);
                    out.g = (fg.g * bg.g) * fa + bg.g * (1.0f - fa);
                    out.b = (fg.b * bg.b) * fa + bg.b * (1.0f - fa);
                    out.a = fa + bg.a * (1.0f - fa);
                    break;

                case BlendMode::Screen:
                    out.r = (1.0f - (1.0f - fg.r) * (1.0f - bg.r)) * fa + bg.r * (1.0f - fa);
                    out.g = (1.0f - (1.0f - fg.g) * (1.0f - bg.g)) * fa + bg.g * (1.0f - fa);
                    out.b = (1.0f - (1.0f - fg.b) * (1.0f - bg.b)) * fa + bg.b * (1.0f - fa);
                    out.a = fa + bg.a * (1.0f - fa);
                    break;

                case BlendMode::Overlay: {
                    auto overlay = [](float a, float b) {
                        return a < 0.5f ? 2.0f * a * b : 1.0f - 2.0f * (1.0f - a) * (1.0f - b);
                    };
                    out.r = overlay(bg.r, fg.r) * fa + bg.r * (1.0f - fa);
                    out.g = overlay(bg.g, fg.g) * fa + bg.g * (1.0f - fa);
                    out.b = overlay(bg.b, fg.b) * fa + bg.b * (1.0f - fa);
                    out.a = fa + bg.a * (1.0f - fa);
                    break;
                }
            }

            // Write to output
            uint8_t* p = output.data() + (y * w + x) * 4;
            p[0] = static_cast<uint8_t>(std::clamp(out.r, 0.0f, 1.0f) * 255.0f);
            p[1] = static_cast<uint8_t>(std::clamp(out.g, 0.0f, 1.0f) * 255.0f);
            p[2] = static_cast<uint8_t>(std::clamp(out.b, 0.0f, 1.0f) * 255.0f);
            p[3] = static_cast<uint8_t>(std::clamp(out.a, 0.0f, 1.0f) * 255.0f);
        }
    }

    return output;
}

Image render_composite(
    Renderer& renderer,
    const Scene& scene,
    const CompositeConfig& config
) {
    Image fg = renderer.render(scene);

    if (!scene.has_background() || config.foreground_only) {
        return fg;
    }

    return composite(scene.background(), fg, config);
}

} // namespace depth
