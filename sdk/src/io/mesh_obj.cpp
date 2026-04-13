#include "depth/mesh.h"

#include <cmath>
#include <cstdio>
#include <cstring>
#include <sstream>
#include <algorithm>
#include <limits>

namespace depth {

static Vec3 compute_face_normal(Vec3 a, Vec3 b, Vec3 c) {
    Vec3 e1 = b - a;
    Vec3 e2 = c - a;
    Vec3 n = {e1.y*e2.z - e1.z*e2.y,
              e1.z*e2.x - e1.x*e2.z,
              e1.x*e2.y - e1.y*e2.x};
    float len = std::sqrt(n.x*n.x + n.y*n.y + n.z*n.z);
    if (len < 1e-8f) return {0, 1, 0};
    return {n.x/len, n.y/len, n.z/len};
}

static AABB compute_bounds(const std::vector<MeshVertex>& verts) {
    AABB b;
    b.min = {std::numeric_limits<float>::max(),
             std::numeric_limits<float>::max(),
             std::numeric_limits<float>::max()};
    b.max = {std::numeric_limits<float>::lowest(),
             std::numeric_limits<float>::lowest(),
             std::numeric_limits<float>::lowest()};
    for (const auto& v : verts) {
        b.min.x = std::min(b.min.x, v.position.x);
        b.min.y = std::min(b.min.y, v.position.y);
        b.min.z = std::min(b.min.z, v.position.z);
        b.max.x = std::max(b.max.x, v.position.x);
        b.max.y = std::max(b.max.y, v.position.y);
        b.max.z = std::max(b.max.z, v.position.z);
    }
    return b;
}

// Parse a face index like "1/2/3", "1//3", or "1"
struct FaceIdx {
    int v = 0;   // 1-based position index
    int vn = 0;  // 1-based normal index (0 = none)
};

static FaceIdx parse_face_index(const std::string& token) {
    FaceIdx fi;
    // Format: v, v/vt, v/vt/vn, v//vn
    auto slash1 = token.find('/');
    if (slash1 == std::string::npos) {
        fi.v = std::atoi(token.c_str());
        return fi;
    }
    fi.v = std::atoi(token.substr(0, slash1).c_str());
    auto slash2 = token.find('/', slash1 + 1);
    if (slash2 != std::string::npos) {
        std::string vn_str = token.substr(slash2 + 1);
        if (!vn_str.empty()) fi.vn = std::atoi(vn_str.c_str());
    }
    return fi;
}

Mesh Mesh::load_obj_from_memory(const char* data, size_t size, Status* status) {
    Mesh mesh;
    std::vector<Vec3> positions;
    std::vector<Vec3> normals;

    std::istringstream stream(std::string(data, size));
    std::string line;

    while (std::getline(stream, line)) {
        // Strip carriage return
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.empty() || line[0] == '#') continue;

        std::istringstream ls(line);
        std::string prefix;
        ls >> prefix;

        if (prefix == "v") {
            Vec3 p;
            ls >> p.x >> p.y >> p.z;
            positions.push_back(p);
        } else if (prefix == "vn") {
            Vec3 n;
            ls >> n.x >> n.y >> n.z;
            normals.push_back(n);
        } else if (prefix == "f") {
            // Collect face vertex indices
            std::vector<FaceIdx> face;
            std::string tok;
            while (ls >> tok) {
                face.push_back(parse_face_index(tok));
            }

            // Triangulate (fan from first vertex)
            for (size_t i = 2; i < face.size(); i++) {
                FaceIdx idx[3] = {face[0], face[i-1], face[i]};
                Vec3 pos[3];

                for (int k = 0; k < 3; k++) {
                    int vi = idx[k].v;
                    // Handle negative (relative) indices
                    if (vi < 0) vi = static_cast<int>(positions.size()) + vi + 1;
                    if (vi < 1 || vi > static_cast<int>(positions.size())) {
                        if (status) *status = Status::InvalidInput;
                        return {};
                    }
                    pos[k] = positions[vi - 1];
                }

                // Get or compute normals
                Vec3 nrm[3];
                bool has_normals = true;
                for (int k = 0; k < 3; k++) {
                    int ni = idx[k].vn;
                    if (ni < 0) ni = static_cast<int>(normals.size()) + ni + 1;
                    if (ni >= 1 && ni <= static_cast<int>(normals.size())) {
                        nrm[k] = normals[ni - 1];
                    } else {
                        has_normals = false;
                    }
                }

                if (!has_normals) {
                    Vec3 fn = compute_face_normal(pos[0], pos[1], pos[2]);
                    nrm[0] = nrm[1] = nrm[2] = fn;
                }

                for (int k = 0; k < 3; k++) {
                    mesh.vertices.push_back({pos[k], nrm[k]});
                }
            }
        }
        // Silently skip vt, mtllib, usemtl, s, o, g, etc.
    }

    if (mesh.vertices.empty()) {
        if (status) *status = Status::InvalidInput;
        return {};
    }

    mesh.bounds = compute_bounds(mesh.vertices);
    if (status) *status = Status::Ok;
    return mesh;
}

Mesh Mesh::load_obj(const std::string& path, Status* status) {
    FILE* f = fopen(path.c_str(), "rb");
    if (!f) {
        if (status) *status = Status::FileNotFound;
        return {};
    }

    fseek(f, 0, SEEK_END);
    long len = ftell(f);
    fseek(f, 0, SEEK_SET);

    std::vector<char> buf(len);
    size_t read = fread(buf.data(), 1, len, f);
    fclose(f);

    return load_obj_from_memory(buf.data(), read, status);
}

} // namespace depth
