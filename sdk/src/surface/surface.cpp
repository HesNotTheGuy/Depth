#include "depth/surface.h"

#include <algorithm>
#include <cmath>

namespace depth {

namespace {

/// Sort 4 points into top-left, top-right, bottom-right, bottom-left order.
std::array<Vec2, 4> sort_corners(const std::array<Vec2, 4>& pts) {
    auto sorted = pts;
    // Sort by Y to split into top and bottom pairs
    std::sort(sorted.begin(), sorted.end(), [](const Vec2& a, const Vec2& b) {
        return a.y < b.y;
    });

    // Top pair: sort by X (left, right)
    if (sorted[0].x > sorted[1].x) std::swap(sorted[0], sorted[1]);
    // Bottom pair: sort by X (left, right)
    if (sorted[2].x > sorted[3].x) std::swap(sorted[2], sorted[3]);

    // Return: TL, TR, BR, BL
    return {sorted[0], sorted[1], sorted[3], sorted[2]};
}

} // namespace

SurfacePlane surface_from_corners(const std::array<Vec2, 4>& corners) {
    SurfacePlane plane;
    auto sorted = sort_corners(corners);
    plane.image_corners = sorted;

    const auto& tl = sorted[0];
    const auto& tr = sorted[1];
    const auto& br = sorted[2];
    const auto& bl = sorted[3];

    // Center in image space
    float cx = (tl.x + tr.x + br.x + bl.x) / 4.0f;
    float cy = (tl.y + tr.y + br.y + bl.y) / 4.0f;

    // Map to 3D position
    float pos_x = (cx - 0.5f) * 4.0f;
    float pos_y = (1.0f - cy) * 0.5f;
    float pos_z = (cy - 0.3f) * 3.0f;
    plane.transform.position = {pos_x, pos_y, pos_z};

    // Perspective-based tilt estimation
    float top_width = std::abs(tr.x - tl.x);
    float bottom_width = std::abs(br.x - bl.x);
    float left_height = std::abs(bl.y - tl.y);
    float right_height = std::abs(br.y - tr.y);

    float width_ratio = top_width / std::max(bottom_width, 0.001f);
    float tilt_x = -static_cast<float>(M_PI) / 2.0f + (1.0f - width_ratio) * 0.8f;
    float height_diff = right_height - left_height;
    float tilt_y = height_diff * 1.5f;

    plane.transform.rotation = {tilt_x, tilt_y, 0.0f};

    // Size from quad area
    float avg_width = (top_width + bottom_width) / 2.0f;
    float avg_height = (left_height + right_height) / 2.0f;
    plane.width = std::max(0.5f, avg_width * 6.0f);
    plane.depth = std::max(0.5f, avg_height * 6.0f);

    return plane;
}

CollisionResult find_surface_below(
    const Vec3& position,
    const std::vector<SurfacePlane>& surfaces
) {
    CollisionResult result;

    for (size_t i = 0; i < surfaces.size(); i++) {
        const auto& s = surfaces[i];
        if (!s.active) continue;

        float dx = position.x - s.transform.position.x;
        float dz = position.z - s.transform.position.z;
        float half_w = s.width / 2.0f;
        float half_d = s.depth / 2.0f;

        if (std::abs(dx) <= half_w && std::abs(dz) <= half_d) {
            float surface_y = s.transform.position.y;
            if (surface_y <= position.y) {
                if (!result.hit || surface_y > result.surface_y) {
                    result.hit = true;
                    result.surface_y = surface_y;
                    result.surface_index = static_cast<uint32_t>(i);
                }
            }
        }
    }

    return result;
}

bool snap_to_surface(
    Vec3& position,
    float object_half_h,
    const std::vector<SurfacePlane>& surfaces
) {
    auto result = find_surface_below(position, surfaces);
    if (result.hit) {
        position.y = result.surface_y + object_half_h;
        return true;
    }
    return false;
}

} // namespace depth
