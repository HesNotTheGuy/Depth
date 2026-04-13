/**
 * @file compositor.h
 * @brief Composites rendered 3D objects over a background plate.
 *
 * This is the final stage: take the background image and the
 * rendered 3D layer (with transparency) and blend them into
 * a single output image ready for export.
 */

#pragma once

#include "depth/types.h"
#include "depth/image.h"

namespace depth {

/**
 * Compositing blend mode.
 */
enum class BlendMode : uint8_t {
    Normal,       // Standard alpha-over
    Multiply,
    Screen,
    Overlay,
};

/**
 * Compositor configuration.
 */
struct CompositeConfig {
    BlendMode blend_mode = BlendMode::Normal;

    /// Global opacity of the 3D layer [0, 1].
    float layer_opacity = 1.0f;

    /// If true, output only the 3D layer (no background).
    bool foreground_only = false;
};

/**
 * Composite a rendered 3D layer over a background image.
 *
 * @param background   The background plate.
 * @param foreground   The rendered 3D layer (RGBA with transparency).
 * @param config       Compositing options.
 * @return             The final composited image.
 *
 * Both images must have the same dimensions. If they differ,
 * the foreground is scaled to match the background.
 */
Image composite(
    const Image& background,
    const Image& foreground,
    const CompositeConfig& config = {}
);

/**
 * Convenience: render a scene and composite in one call.
 *
 * Equivalent to:
 *   auto fg = renderer.render(scene);
 *   return composite(scene.background(), fg, config);
 */
Image render_composite(
    class Renderer& renderer,
    const Scene& scene,
    const CompositeConfig& config = {}
);

} // namespace depth
