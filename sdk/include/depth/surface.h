/**
 * @file surface.h
 * @brief Surface plane detection and collision.
 *
 * Surfaces are 3D planes that represent physical surfaces in the
 * background image (floors, tables, shelves, walls). Objects snap
 * to these surfaces for realistic placement.
 *
 * Surfaces can be defined manually (from user-drawn quads on the
 * image) or detected automatically from image analysis.
 */

#pragma once

#include "depth/types.h"
#include <array>
#include <optional>
#include <vector>

namespace depth {

/**
 * A surface plane in the scene, defined by its 3D transform and size.
 */
struct SurfacePlane {
    /// Unique identifier
    uint32_t id = 0;

    /// 4 corner points in normalized image coordinates [0,1].
    /// Order: top-left, top-right, bottom-right, bottom-left.
    std::array<Vec2, 4> image_corners;

    /// Derived 3D properties
    Transform transform;
    float width = 1.0f;
    float depth = 1.0f;

    /// Is this surface active for collision?
    bool active = true;
};

/**
 * Convert 4 image-space corner points into a 3D surface plane.
 *
 * Uses perspective heuristics to estimate the plane's position,
 * tilt, and size from how the quad is drawn on the image.
 *
 * @param corners  4 points in normalized image coordinates [0,1].
 *                 Order doesn't matter — they will be sorted.
 * @return         A SurfacePlane with estimated 3D properties.
 */
SurfacePlane surface_from_corners(const std::array<Vec2, 4>& corners);

/**
 * Result of a surface collision query.
 */
struct CollisionResult {
    /// Did the object hit a surface?
    bool hit = false;

    /// Y position where the object should rest (top of surface).
    float surface_y = 0.0f;

    /// Which surface was hit (index into the surfaces array).
    uint32_t surface_index = 0;
};

/**
 * Find the highest active surface directly below a world position.
 *
 * @param position    The 3D position to test (typically the object's position).
 * @param surfaces    All surface planes in the scene.
 * @return            Collision result, or {hit=false} if no surface below.
 */
CollisionResult find_surface_below(
    const Vec3& position,
    const std::vector<SurfacePlane>& surfaces
);

/**
 * Snap an object's Y position to sit on the nearest surface below it.
 *
 * @param position        The object's current position (modified in place).
 * @param object_half_h   Half the object's height (for bottom-edge placement).
 * @param surfaces        All surface planes in the scene.
 * @return                true if snapped to a surface, false if no surface found.
 */
bool snap_to_surface(
    Vec3& position,
    float object_half_h,
    const std::vector<SurfacePlane>& surfaces
);

} // namespace depth
