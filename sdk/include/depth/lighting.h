/**
 * @file lighting.h
 * @brief Lighting estimation from background images.
 *
 * Analyzes a background plate to estimate the scene's lighting
 * conditions: direction, color temperature, brightness, and
 * shadow characteristics. This allows 3D objects composited
 * onto the image to match the existing lighting naturally.
 */

#pragma once

#include "depth/types.h"
#include "depth/image.h"

namespace depth {

/**
 * Estimated lighting parameters derived from image analysis.
 */
struct LightingEstimate {
    /// Overall scene brightness, normalized [0, 2]. 1.0 = medium.
    float brightness = 1.0f;

    /// Dominant light direction in degrees [0, 360].
    /// 0 = right, 90 = top, 180 = left, 270 = bottom.
    float direction_angle = 45.0f;

    /// Light elevation [0, 1]. 0 = horizon, 1 = directly above.
    float elevation = 0.6f;

    /// Dominant light color (color temperature approximation).
    Color light_color = Color::white();

    /// Average scene color for ambient fill lighting.
    Color ambient_color = {0.5f, 0.5f, 0.5f, 1.0f};

    /// Contrast/shadow hardness hint [0, 1]. 0 = flat, 1 = harsh shadows.
    float contrast = 0.5f;
};

/**
 * Configuration for the lighting estimator.
 */
struct LightingEstimateConfig {
    /// Analysis resolution. Image is downsampled to this size for speed.
    /// Higher = more accurate but slower. Default: 128.
    uint32_t sample_resolution = 128;

    /// Number of quadrant subdivisions for directional analysis.
    /// 2 = standard 4-quadrant, 3 = 9-zone, 4 = 16-zone.
    uint32_t grid_divisions = 2;
};

/**
 * Estimate lighting conditions from a background image.
 *
 * @param image       The background plate to analyze.
 * @param config      Optional configuration overrides.
 * @return            Estimated lighting parameters.
 *
 * Thread-safe: yes (operates on a const image reference).
 */
LightingEstimate estimate_lighting(
    const Image& image,
    const LightingEstimateConfig& config = {}
);

} // namespace depth
