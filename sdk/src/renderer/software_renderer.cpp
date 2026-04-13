#include "depth/renderer.h"

#include <cmath>
#include <algorithm>
#include <vector>
#include <limits>

namespace depth {

// ── Math helpers ──────────────────────────────────────

struct Mat4 {
    float m[4][4] = {};

    static Mat4 identity() {
        Mat4 r;
        r.m[0][0] = r.m[1][1] = r.m[2][2] = r.m[3][3] = 1.0f;
        return r;
    }

    Vec4 operator*(const Vec4& v) const {
        return {
            m[0][0]*v.x + m[0][1]*v.y + m[0][2]*v.z + m[0][3]*v.w,
            m[1][0]*v.x + m[1][1]*v.y + m[1][2]*v.z + m[1][3]*v.w,
            m[2][0]*v.x + m[2][1]*v.y + m[2][2]*v.z + m[2][3]*v.w,
            m[3][0]*v.x + m[3][1]*v.y + m[3][2]*v.z + m[3][3]*v.w,
        };
    }

    Mat4 operator*(const Mat4& b) const {
        Mat4 r;
        for (int i = 0; i < 4; i++)
            for (int j = 0; j < 4; j++) {
                r.m[i][j] = 0;
                for (int k = 0; k < 4; k++)
                    r.m[i][j] += m[i][k] * b.m[k][j];
            }
        return r;
    }
};

static Vec3 normalize(Vec3 v) {
    float len = std::sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
    if (len < 1e-8f) return {0, 1, 0};
    return {v.x/len, v.y/len, v.z/len};
}

static Vec3 cross(Vec3 a, Vec3 b) {
    return {a.y*b.z - a.z*b.y, a.z*b.x - a.x*b.z, a.x*b.y - a.y*b.x};
}

static float dot(Vec3 a, Vec3 b) {
    return a.x*b.x + a.y*b.y + a.z*b.z;
}

static Mat4 look_at(Vec3 eye, Vec3 target, Vec3 up) {
    Vec3 f = normalize(target - eye);
    Vec3 r = normalize(cross(f, up));
    Vec3 u = cross(r, f);

    Mat4 m = Mat4::identity();
    m.m[0][0] = r.x;  m.m[0][1] = r.y;  m.m[0][2] = r.z;  m.m[0][3] = -dot(r, eye);
    m.m[1][0] = u.x;  m.m[1][1] = u.y;  m.m[1][2] = u.z;  m.m[1][3] = -dot(u, eye);
    m.m[2][0] = -f.x; m.m[2][1] = -f.y; m.m[2][2] = -f.z; m.m[2][3] = dot(f, eye);
    return m;
}

static Mat4 perspective(float fov_deg, float aspect, float near, float far) {
    float rad = fov_deg * static_cast<float>(M_PI) / 180.0f;
    float t = std::tan(rad / 2.0f);
    Mat4 m = {};
    m.m[0][0] = 1.0f / (aspect * t);
    m.m[1][1] = 1.0f / t;
    m.m[2][2] = -(far + near) / (far - near);
    m.m[2][3] = -2.0f * far * near / (far - near);
    m.m[3][2] = -1.0f;
    return m;
}

static Mat4 model_matrix(const Transform& t) {
    // Scale → RotateZ → RotateY → RotateX → Translate
    float cx = std::cos(t.rotation.x), sx = std::sin(t.rotation.x);
    float cy = std::cos(t.rotation.y), sy = std::sin(t.rotation.y);
    float cz = std::cos(t.rotation.z), sz = std::sin(t.rotation.z);
    float s = t.scale;

    Mat4 m = Mat4::identity();
    m.m[0][0] = s * (cy*cz);
    m.m[0][1] = s * (sx*sy*cz - cx*sz);
    m.m[0][2] = s * (cx*sy*cz + sx*sz);
    m.m[0][3] = t.position.x;
    m.m[1][0] = s * (cy*sz);
    m.m[1][1] = s * (sx*sy*sz + cx*cz);
    m.m[1][2] = s * (cx*sy*sz - sx*cz);
    m.m[1][3] = t.position.y;
    m.m[2][0] = s * (-sy);
    m.m[2][1] = s * (sx*cy);
    m.m[2][2] = s * (cx*cy);
    m.m[2][3] = t.position.z;
    return m;
}

// ── Vertex / Triangle ─────────────────────────────────

struct Vertex {
    Vec3 pos;
    Vec3 normal;
};

struct Triangle {
    Vertex v[3];
};

// ── Mesh generation ───────────────────────────────────

static std::vector<Triangle> generate_box() {
    // Unit box centered at origin
    struct Face { Vec3 n; Vec3 corners[4]; };
    const Face faces[] = {
        {{0,0,1},  {{ .5, .5, .5},{-.5, .5, .5},{-.5,-.5, .5},{ .5,-.5, .5}}},
        {{0,0,-1}, {{-.5, .5,-.5},{ .5, .5,-.5},{ .5,-.5,-.5},{-.5,-.5,-.5}}},
        {{1,0,0},  {{ .5, .5,-.5},{ .5, .5, .5},{ .5,-.5, .5},{ .5,-.5,-.5}}},
        {{-1,0,0}, {{-.5, .5, .5},{-.5, .5,-.5},{-.5,-.5,-.5},{-.5,-.5, .5}}},
        {{0,1,0},  {{ .5, .5,-.5},{-.5, .5,-.5},{-.5, .5, .5},{ .5, .5, .5}}},
        {{0,-1,0}, {{ .5,-.5, .5},{-.5,-.5, .5},{-.5,-.5,-.5},{ .5,-.5,-.5}}},
    };
    std::vector<Triangle> tris;
    for (auto& f : faces) {
        tris.push_back({{{f.corners[0], f.n}, {f.corners[1], f.n}, {f.corners[2], f.n}}});
        tris.push_back({{{f.corners[0], f.n}, {f.corners[2], f.n}, {f.corners[3], f.n}}});
    }
    return tris;
}

static std::vector<Triangle> generate_sphere(int segs = 24) {
    std::vector<Triangle> tris;
    float r = 0.5f;
    for (int i = 0; i < segs; i++) {
        float theta0 = static_cast<float>(M_PI) * i / segs;
        float theta1 = static_cast<float>(M_PI) * (i + 1) / segs;
        float st0 = std::sin(theta0), ct0 = std::cos(theta0);
        float st1 = std::sin(theta1), ct1 = std::cos(theta1);
        for (int j = 0; j < segs; j++) {
            float phi0 = 2.0f * static_cast<float>(M_PI) * j / segs;
            float phi1 = 2.0f * static_cast<float>(M_PI) * (j + 1) / segs;
            float sp0 = std::sin(phi0), cp0 = std::cos(phi0);
            float sp1 = std::sin(phi1), cp1 = std::cos(phi1);

            Vec3 p00 = {r*st0*cp0, r*ct0, r*st0*sp0};
            Vec3 p10 = {r*st1*cp0, r*ct1, r*st1*sp0};
            Vec3 p01 = {r*st0*cp1, r*ct0, r*st0*sp1};
            Vec3 p11 = {r*st1*cp1, r*ct1, r*st1*sp1};
            Vec3 n00 = normalize(p00), n10 = normalize(p10);
            Vec3 n01 = normalize(p01), n11 = normalize(p11);

            if (i > 0)
                tris.push_back({{{p00, n00}, {p10, n10}, {p11, n11}}});
            if (i < segs - 1)
                tris.push_back({{{p00, n00}, {p11, n11}, {p01, n01}}});
        }
    }
    return tris;
}

static std::vector<Triangle> generate_cylinder(int segs = 24) {
    std::vector<Triangle> tris;
    float r = 0.5f, h = 0.5f;
    for (int i = 0; i < segs; i++) {
        float a0 = 2.0f * static_cast<float>(M_PI) * i / segs;
        float a1 = 2.0f * static_cast<float>(M_PI) * (i + 1) / segs;
        float c0 = std::cos(a0), s0 = std::sin(a0);
        float c1 = std::cos(a1), s1 = std::sin(a1);

        Vec3 p0t = {r*c0, h, r*s0}, p1t = {r*c1, h, r*s1};
        Vec3 p0b = {r*c0, -h, r*s0}, p1b = {r*c1, -h, r*s1};
        Vec3 n0 = {c0, 0, s0}, n1 = {c1, 0, s1};

        // Side quads
        tris.push_back({{{p0t, n0}, {p0b, n0}, {p1b, n1}}});
        tris.push_back({{{p0t, n0}, {p1b, n1}, {p1t, n1}}});

        // Top cap
        Vec3 top_n = {0, 1, 0};
        tris.push_back({{{Vec3{0,h,0}, top_n}, {p0t, top_n}, {p1t, top_n}}});

        // Bottom cap
        Vec3 bot_n = {0, -1, 0};
        tris.push_back({{{Vec3{0,-h,0}, bot_n}, {p1b, bot_n}, {p0b, bot_n}}});
    }
    return tris;
}

static std::vector<Triangle> generate_cone(int segs = 24) {
    std::vector<Triangle> tris;
    float r = 0.5f, h = 0.5f;
    Vec3 tip = {0, h, 0};
    for (int i = 0; i < segs; i++) {
        float a0 = 2.0f * static_cast<float>(M_PI) * i / segs;
        float a1 = 2.0f * static_cast<float>(M_PI) * (i + 1) / segs;
        float c0 = std::cos(a0), s0 = std::sin(a0);
        float c1 = std::cos(a1), s1 = std::sin(a1);

        Vec3 p0 = {r*c0, -h, r*s0}, p1 = {r*c1, -h, r*s1};
        // Cone normals: slant direction
        float slant = r / (2*h);
        Vec3 n0 = normalize(Vec3{c0, slant, s0});
        Vec3 n1 = normalize(Vec3{c1, slant, s1});
        Vec3 nt = normalize(Vec3{(c0+c1)*0.5f, slant, (s0+s1)*0.5f});

        tris.push_back({{{tip, nt}, {p0, n0}, {p1, n1}}});

        // Bottom cap
        Vec3 bot_n = {0, -1, 0};
        tris.push_back({{{Vec3{0,-h,0}, bot_n}, {p1, bot_n}, {p0, bot_n}}});
    }
    return tris;
}

static std::vector<Triangle> generate_torus(int ring_segs = 16, int tube_segs = 24) {
    std::vector<Triangle> tris;
    float R = 0.4f, r = 0.15f;
    for (int i = 0; i < ring_segs; i++) {
        float theta0 = 2.0f * static_cast<float>(M_PI) * i / ring_segs;
        float theta1 = 2.0f * static_cast<float>(M_PI) * (i + 1) / ring_segs;
        for (int j = 0; j < tube_segs; j++) {
            float phi0 = 2.0f * static_cast<float>(M_PI) * j / tube_segs;
            float phi1 = 2.0f * static_cast<float>(M_PI) * (j + 1) / tube_segs;

            auto pt = [&](float theta, float phi) -> Vec3 {
                float ct = std::cos(theta), st = std::sin(theta);
                float cp = std::cos(phi), sp = std::sin(phi);
                return {(R + r*cp)*ct, r*sp, (R + r*cp)*st};
            };
            auto nm = [&](float theta, float phi) -> Vec3 {
                float ct = std::cos(theta), st = std::sin(theta);
                float cp = std::cos(phi), sp = std::sin(phi);
                return normalize(Vec3{cp*ct, sp, cp*st});
            };

            Vec3 p00 = pt(theta0, phi0), p10 = pt(theta1, phi0);
            Vec3 p01 = pt(theta0, phi1), p11 = pt(theta1, phi1);
            Vec3 n00 = nm(theta0, phi0), n10 = nm(theta1, phi0);
            Vec3 n01 = nm(theta0, phi1), n11 = nm(theta1, phi1);

            tris.push_back({{{p00, n00}, {p10, n10}, {p11, n11}}});
            tris.push_back({{{p00, n00}, {p11, n11}, {p01, n01}}});
        }
    }
    return tris;
}

static std::vector<Triangle> generate_mesh(GeometryType type) {
    switch (type) {
        case GeometryType::Box:      return generate_box();
        case GeometryType::Sphere:   return generate_sphere();
        case GeometryType::Cylinder: return generate_cylinder();
        case GeometryType::Cone:     return generate_cone();
        case GeometryType::Torus:    return generate_torus();
        case GeometryType::Plane: {
            Vec3 n = {0, 1, 0};
            return {{{{Vec3{-.5f,0,.5f}, n}, {Vec3{.5f,0,.5f}, n}, {Vec3{.5f,0,-.5f}, n}}},
                    {{{Vec3{-.5f,0,.5f}, n}, {Vec3{.5f,0,-.5f}, n}, {Vec3{-.5f,0,-.5f}, n}}}};
        }
        default: return generate_box();
    }
}

// ── Software Renderer ─────────────────────────────────

class SoftwareRenderer : public Renderer {
public:
    explicit SoftwareRenderer(const RenderConfig& config) {
        config_ = config;
    }

    Image render(const Scene& scene) override {
        uint32_t w = config_.width, h = config_.height;
        Image output(w, h, PixelFormat::RGBA8);
        uint8_t* pixels = output.data();
        std::fill(pixels, pixels + output.size_bytes(), 0);

        // Depth buffer
        std::vector<float> zbuf(w * h, std::numeric_limits<float>::infinity());

        // Camera matrices
        const auto& cam = scene.camera();
        float aspect = static_cast<float>(w) / h;
        Mat4 view = look_at(cam.position, cam.target, {0, 1, 0});
        Mat4 proj = perspective(cam.fov, aspect, cam.near_clip, cam.far_clip);
        Mat4 vp = proj * view;

        // Light direction (world space, pointing toward the scene)
        const auto& light = scene.light();
        float light_rad = light.angle * static_cast<float>(M_PI) / 180.0f;
        Vec3 light_dir = normalize({
            std::cos(light_rad),
            light.elevation + 0.5f,
            std::sin(light_rad)
        });

        float ambient = scene.ambient_intensity();

        // Render each object
        for (const auto& obj : scene.objects()) {
            Mat4 model = model_matrix(obj.transform);
            Mat4 mvp = vp * model;

            auto mesh = generate_mesh(obj.geometry);
            const Color& base = obj.material.base_color;

            for (const auto& tri : mesh) {
                // Transform vertices to clip space
                struct ScreenVert {
                    float sx, sy, depth;
                    Vec3 world_normal;
                };
                ScreenVert sv[3];
                bool valid = true;

                for (int i = 0; i < 3; i++) {
                    Vec4 world = model * Vec4{tri.v[i].pos.x, tri.v[i].pos.y, tri.v[i].pos.z, 1.0f};
                    Vec4 clip = vp * world;

                    // Near-plane clipping (simplified: reject entire tri)
                    if (clip.w < 0.01f) { valid = false; break; }

                    float inv_w = 1.0f / clip.w;
                    float ndc_x = clip.x * inv_w;
                    float ndc_y = clip.y * inv_w;

                    sv[i].sx = (ndc_x + 1.0f) * 0.5f * w;
                    sv[i].sy = (1.0f - ndc_y) * 0.5f * h;
                    sv[i].depth = clip.z * inv_w;

                    // Transform normal to world space (ignoring non-uniform scale)
                    Vec4 wn = model * Vec4{tri.v[i].normal.x, tri.v[i].normal.y, tri.v[i].normal.z, 0.0f};
                    sv[i].world_normal = normalize({wn.x, wn.y, wn.z});
                }
                if (!valid) continue;

                // Bounding box
                float minx = std::min({sv[0].sx, sv[1].sx, sv[2].sx});
                float maxx = std::max({sv[0].sx, sv[1].sx, sv[2].sx});
                float miny = std::min({sv[0].sy, sv[1].sy, sv[2].sy});
                float maxy = std::max({sv[0].sy, sv[1].sy, sv[2].sy});

                int x0 = std::max(0, static_cast<int>(std::floor(minx)));
                int x1 = std::min(static_cast<int>(w) - 1, static_cast<int>(std::ceil(maxx)));
                int y0 = std::max(0, static_cast<int>(std::floor(miny)));
                int y1 = std::min(static_cast<int>(h) - 1, static_cast<int>(std::ceil(maxy)));

                // Edge function denominator for barycentric coords
                float denom = (sv[1].sy - sv[2].sy) * (sv[0].sx - sv[2].sx) +
                              (sv[2].sx - sv[1].sx) * (sv[0].sy - sv[2].sy);
                if (std::abs(denom) < 1e-6f) continue; // Degenerate triangle
                float inv_denom = 1.0f / denom;

                // Rasterize
                for (int py = y0; py <= y1; py++) {
                    for (int px = x0; px <= x1; px++) {
                        float fx = px + 0.5f, fy = py + 0.5f;

                        // Barycentric coordinates
                        float w0 = ((sv[1].sy - sv[2].sy) * (fx - sv[2].sx) +
                                    (sv[2].sx - sv[1].sx) * (fy - sv[2].sy)) * inv_denom;
                        float w1 = ((sv[2].sy - sv[0].sy) * (fx - sv[2].sx) +
                                    (sv[0].sx - sv[2].sx) * (fy - sv[2].sy)) * inv_denom;
                        float w2 = 1.0f - w0 - w1;

                        if (w0 < 0 || w1 < 0 || w2 < 0) continue;

                        // Interpolate depth
                        float z = w0 * sv[0].depth + w1 * sv[1].depth + w2 * sv[2].depth;
                        size_t idx = static_cast<size_t>(py) * w + px;

                        // Z-test
                        if (z >= zbuf[idx]) continue;
                        zbuf[idx] = z;

                        // Interpolate normal
                        Vec3 n = normalize({
                            w0*sv[0].world_normal.x + w1*sv[1].world_normal.x + w2*sv[2].world_normal.x,
                            w0*sv[0].world_normal.y + w1*sv[1].world_normal.y + w2*sv[2].world_normal.y,
                            w0*sv[0].world_normal.z + w1*sv[1].world_normal.z + w2*sv[2].world_normal.z,
                        });

                        // Lambert shading
                        float ndotl = std::max(0.0f, dot(n, light_dir));
                        float shade = std::clamp(ambient + ndotl * light.intensity * 0.5f, 0.0f, 1.0f);

                        size_t off = idx * 4;
                        pixels[off + 0] = static_cast<uint8_t>(std::clamp(base.r * shade * 255.0f, 0.0f, 255.0f));
                        pixels[off + 1] = static_cast<uint8_t>(std::clamp(base.g * shade * 255.0f, 0.0f, 255.0f));
                        pixels[off + 2] = static_cast<uint8_t>(std::clamp(base.b * shade * 255.0f, 0.0f, 255.0f));
                        pixels[off + 3] = 255;
                    }
                }
            }
        }

        return output;
    }

    void resize(uint32_t width, uint32_t height) override {
        config_.width = width;
        config_.height = height;
    }

    RendererBackend backend() const override {
        return RendererBackend::Software;
    }
};

// Factory
std::unique_ptr<Renderer> Renderer::create(const RenderConfig& config) {
    // TODO: Try Vulkan/Metal first based on platform, fall back to software
    return std::make_unique<SoftwareRenderer>(config);
}

} // namespace depth
