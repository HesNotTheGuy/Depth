/**
 * @file mesh.h
 * @brief OBJ mesh loading for the Depth SDK.
 *
 * Loads Wavefront OBJ files into a triangle mesh representation
 * that can be used with Custom geometry objects.
 */

#pragma once

#include "depth/types.h"
#include <cstdint>
#include <string>
#include <vector>

namespace depth {

/**
 * A single vertex with position and normal.
 */
struct MeshVertex {
    Vec3 position;
    Vec3 normal;
};

/**
 * A triangle mesh loaded from an OBJ file.
 */
struct Mesh {
    std::vector<MeshVertex> vertices;  // 3 per triangle (non-indexed)
    AABB bounds;

    /// Number of triangles in the mesh.
    uint32_t triangle_count() const {
        return static_cast<uint32_t>(vertices.size() / 3);
    }

    bool empty() const { return vertices.empty(); }

    /**
     * Load a mesh from an OBJ file.
     *
     * Supports positions (v), normals (vn), and face definitions (f).
     * If normals are not present in the file, they are computed per-face.
     *
     * @param path    Path to the .obj file.
     * @param status  Optional status output.
     * @return        Loaded mesh, or empty mesh on failure.
     */
    static Mesh load_obj(const std::string& path, Status* status = nullptr);

    /**
     * Load a mesh from OBJ data in memory.
     */
    static Mesh load_obj_from_memory(const char* data, size_t size, Status* status = nullptr);
};

} // namespace depth
