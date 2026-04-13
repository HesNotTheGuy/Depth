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

// ── PBR Shading (Cook-Torrance BRDF) ─────────────────

static float clampf(float v, float lo, float hi) {
    return std::max(lo, std::min(hi, v));
}

// Fresnel-Schlick approximation
static Vec3 fresnel_schlick(float cos_theta, Vec3 f0) {
    float t = 1.0f - cos_theta;
    float t2 = t * t;
    float t5 = t2 * t2 * t;
    return {f0.x + (1.0f - f0.x) * t5,
            f0.y + (1.0f - f0.y) * t5,
            f0.z + (1.0f - f0.z) * t5};
}

// GGX/Trowbridge-Reitz normal distribution
static float distribution_ggx(float ndoth, float alpha) {
    float a2 = alpha * alpha;
    float d = ndoth * ndoth * (a2 - 1.0f) + 1.0f;
    return a2 / (static_cast<float>(M_PI) * d * d + 1e-7f);
}

// Smith's geometry function (Schlick-GGX)
static float geometry_schlick_ggx(float ndotv, float k) {
    return ndotv / (ndotv * (1.0f - k) + k + 1e-7f);
}

static float geometry_smith(float ndotv, float ndotl, float roughness) {
    float r1 = roughness + 1.0f;
    float k = (r1 * r1) / 8.0f;
    return geometry_schlick_ggx(ndotv, k) * geometry_schlick_ggx(ndotl, k);
}

// Compute lighting contribution from a single light source
struct LightContrib {
    Vec3 color; // linear RGB result for this light
};

static LightContrib shade_pbr(
    Vec3 N,          // surface normal
    Vec3 V,          // view direction (toward camera)
    Vec3 L,          // light direction (toward light)
    Vec3 light_col,  // light color * intensity
    Vec3 albedo,     // base color
    float metalness,
    float roughness
) {
    Vec3 H = normalize(L + V);
    float ndotl = std::max(0.0f, dot(N, L));
    float ndotv = std::max(0.001f, dot(N, V));
    float ndoth = std::max(0.0f, dot(N, H));
    float hdotv = std::max(0.0f, dot(H, V));

    // F0: reflectance at normal incidence
    // Dielectric: 0.04, Metal: albedo
    Vec3 f0 = {0.04f + metalness * (albedo.x - 0.04f),
               0.04f + metalness * (albedo.y - 0.04f),
               0.04f + metalness * (albedo.z - 0.04f)};

    float alpha = std::max(roughness * roughness, 0.001f);

    // Cook-Torrance specular BRDF
    float D = distribution_ggx(ndoth, alpha);
    float G = geometry_smith(ndotv, ndotl, roughness);
    Vec3 F = fresnel_schlick(hdotv, f0);

    float denom = 4.0f * ndotv * ndotl + 1e-4f;
    Vec3 specular = {(D * G * F.x) / denom,
                     (D * G * F.y) / denom,
                     (D * G * F.z) / denom};

    // Diffuse: only dielectric surfaces have diffuse
    float ks_avg = (F.x + F.y + F.z) / 3.0f;
    float kd = (1.0f - ks_avg) * (1.0f - metalness);
    Vec3 diffuse = {kd * albedo.x / static_cast<float>(M_PI),
                    kd * albedo.y / static_cast<float>(M_PI),
                    kd * albedo.z / static_cast<float>(M_PI)};

    // Combine
    Vec3 result = {(diffuse.x + specular.x) * light_col.x * ndotl,
                   (diffuse.y + specular.y) * light_col.y * ndotl,
                   (diffuse.z + specular.z) * light_col.z * ndotl};

    return {result};
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

        // Directional light direction (world space, pointing toward the scene)
        const auto& dir_light = scene.light();
        float light_rad = dir_light.angle * static_cast<float>(M_PI) / 180.0f;
        Vec3 dir_light_dir = normalize({
            std::cos(light_rad),
            dir_light.elevation + 0.5f,
            std::sin(light_rad)
        });
        Vec3 dir_light_col = {dir_light.color.r * dir_light.intensity,
                              dir_light.color.g * dir_light.intensity,
                              dir_light.color.b * dir_light.intensity};

        float ambient_i = scene.ambient_intensity();
        Color ambient_c = scene.ambient_color();

        // Background pixel data for refraction sampling
        const uint8_t* bg_pixels = nullptr;
        uint32_t bg_w = 0, bg_h = 0;
        if (scene.has_background()) {
            bg_pixels = scene.background().data();
            bg_w = scene.background().width();
            bg_h = scene.background().height();
        }

        // Render each object
        for (const auto& obj : scene.objects()) {
            Mat4 model = model_matrix(obj.transform);

            auto mesh = generate_mesh(obj.geometry);
            const Material& mat = obj.material;
            Vec3 albedo = {mat.base_color.r, mat.base_color.g, mat.base_color.b};

            for (const auto& tri : mesh) {
                // Transform vertices to clip space + world space
                struct ScreenVert {
                    float sx, sy, depth;
                    Vec3 world_normal;
                    Vec3 world_pos;
                };
                ScreenVert sv[3];
                bool valid = true;

                for (int i = 0; i < 3; i++) {
                    Vec4 world = model * Vec4{tri.v[i].pos.x, tri.v[i].pos.y, tri.v[i].pos.z, 1.0f};
                    Vec4 clip = vp * world;

                    if (clip.w < 0.01f) { valid = false; break; }

                    float inv_w = 1.0f / clip.w;
                    float ndc_x = clip.x * inv_w;
                    float ndc_y = clip.y * inv_w;

                    sv[i].sx = (ndc_x + 1.0f) * 0.5f * w;
                    sv[i].sy = (1.0f - ndc_y) * 0.5f * h;
                    sv[i].depth = clip.z * inv_w;
                    sv[i].world_pos = {world.x, world.y, world.z};

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

                float denom = (sv[1].sy - sv[2].sy) * (sv[0].sx - sv[2].sx) +
                              (sv[2].sx - sv[1].sx) * (sv[0].sy - sv[2].sy);
                if (std::abs(denom) < 1e-6f) continue;
                float inv_denom = 1.0f / denom;

                // Rasterize
                for (int py = y0; py <= y1; py++) {
                    for (int px = x0; px <= x1; px++) {
                        float fx = px + 0.5f, fy = py + 0.5f;

                        float bw0 = ((sv[1].sy - sv[2].sy) * (fx - sv[2].sx) +
                                     (sv[2].sx - sv[1].sx) * (fy - sv[2].sy)) * inv_denom;
                        float bw1 = ((sv[2].sy - sv[0].sy) * (fx - sv[2].sx) +
                                     (sv[0].sx - sv[2].sx) * (fy - sv[2].sy)) * inv_denom;
                        float bw2 = 1.0f - bw0 - bw1;

                        if (bw0 < 0 || bw1 < 0 || bw2 < 0) continue;

                        float z = bw0 * sv[0].depth + bw1 * sv[1].depth + bw2 * sv[2].depth;
                        size_t idx = static_cast<size_t>(py) * w + px;

                        if (z >= zbuf[idx]) continue;
                        zbuf[idx] = z;

                        // Interpolate normal and world position
                        Vec3 N = normalize({
                            bw0*sv[0].world_normal.x + bw1*sv[1].world_normal.x + bw2*sv[2].world_normal.x,
                            bw0*sv[0].world_normal.y + bw1*sv[1].world_normal.y + bw2*sv[2].world_normal.y,
                            bw0*sv[0].world_normal.z + bw1*sv[1].world_normal.z + bw2*sv[2].world_normal.z,
                        });
                        Vec3 world_p = {
                            bw0*sv[0].world_pos.x + bw1*sv[1].world_pos.x + bw2*sv[2].world_pos.x,
                            bw0*sv[0].world_pos.y + bw1*sv[1].world_pos.y + bw2*sv[2].world_pos.y,
                            bw0*sv[0].world_pos.z + bw1*sv[1].world_pos.z + bw2*sv[2].world_pos.z,
                        };

                        Vec3 V = normalize(cam.position - world_p);

                        // ── Accumulate lighting ──

                        // Ambient
                        Vec3 color = {ambient_c.r * ambient_i * albedo.x,
                                      ambient_c.g * ambient_i * albedo.y,
                                      ambient_c.b * ambient_i * albedo.z};

                        // Directional light (PBR)
                        auto dir_contrib = shade_pbr(N, V, dir_light_dir, dir_light_col,
                                                     albedo, mat.metalness, mat.roughness);
                        color.x += dir_contrib.color.x;
                        color.y += dir_contrib.color.y;
                        color.z += dir_contrib.color.z;

                        // Point lights (PBR)
                        for (const auto& pl : scene.point_lights()) {
                            if (!pl.visible) continue;
                            Vec3 to_light = pl.position - world_p;
                            float dist2 = dot(to_light, to_light);
                            float dist = std::sqrt(dist2);
                            if (dist > pl.range || dist < 1e-4f) continue;

                            Vec3 L = {to_light.x / dist, to_light.y / dist, to_light.z / dist};

                            // Inverse-square falloff with range attenuation
                            float attenuation = 1.0f / (1.0f + dist2);
                            float range_fade = 1.0f - clampf(dist / pl.range, 0.0f, 1.0f);
                            range_fade *= range_fade; // quadratic fade at edges
                            attenuation *= range_fade;

                            Vec3 pl_col = {pl.color.r * pl.intensity * attenuation,
                                           pl.color.g * pl.intensity * attenuation,
                                           pl.color.b * pl.intensity * attenuation};

                            auto pl_contrib = shade_pbr(N, V, L, pl_col,
                                                        albedo, mat.metalness, mat.roughness);
                            color.x += pl_contrib.color.x;
                            color.y += pl_contrib.color.y;
                            color.z += pl_contrib.color.z;
                        }

                        // Clearcoat (additional specular layer)
                        if (mat.clearcoat > 0.0f) {
                            float cc_rough = 0.1f; // clearcoat is always smooth
                            auto cc = shade_pbr(N, V, dir_light_dir, dir_light_col,
                                                {1,1,1}, 0.0f, cc_rough);
                            color.x += cc.color.x * mat.clearcoat * 0.25f;
                            color.y += cc.color.y * mat.clearcoat * 0.25f;
                            color.z += cc.color.z * mat.clearcoat * 0.25f;
                        }

                        // ── Glass refraction ──
                        float alpha_out = 1.0f;
                        if (mat.transmission > 0.0f && bg_pixels) {
                            // Approximate refraction: offset the background sample
                            // by the surface normal projected to screen space
                            float refract_strength = (mat.ior - 1.0f) * mat.transmission * 30.0f;
                            int ref_x = px + static_cast<int>(N.x * refract_strength);
                            int ref_y = py - static_cast<int>(N.y * refract_strength);

                            // Clamp to background bounds (scaled to bg resolution)
                            float u = clampf(static_cast<float>(ref_x) / w, 0.0f, 1.0f);
                            float v = clampf(static_cast<float>(ref_y) / h, 0.0f, 1.0f);
                            int bx = static_cast<int>(u * (bg_w - 1));
                            int by = static_cast<int>(v * (bg_h - 1));
                            size_t bg_idx = (static_cast<size_t>(by) * bg_w + bx) * 4;

                            Vec3 bg_col = {bg_pixels[bg_idx + 0] / 255.0f,
                                           bg_pixels[bg_idx + 1] / 255.0f,
                                           bg_pixels[bg_idx + 2] / 255.0f};

                            // Fresnel: more reflective at grazing angles
                            float fresnel = 0.04f + 0.96f * std::pow(1.0f - std::max(0.0f, dot(N, V)), 5.0f);
                            float transmit = mat.transmission * (1.0f - fresnel);

                            // Blend refracted background with surface color
                            color.x = color.x * (1.0f - transmit) + bg_col.x * transmit;
                            color.y = color.y * (1.0f - transmit) + bg_col.y * transmit;
                            color.z = color.z * (1.0f - transmit) + bg_col.z * transmit;

                            // Glass alpha: mostly transparent, Fresnel edges opaque
                            alpha_out = clampf(fresnel + (1.0f - mat.transmission) * 0.8f, 0.1f, 1.0f);
                        }

                        // Tone mapping (Reinhard) + gamma
                        color.x = color.x / (color.x + 1.0f);
                        color.y = color.y / (color.y + 1.0f);
                        color.z = color.z / (color.z + 1.0f);

                        // Gamma correction (linear → sRGB)
                        color.x = std::pow(color.x, 1.0f / 2.2f);
                        color.y = std::pow(color.y, 1.0f / 2.2f);
                        color.z = std::pow(color.z, 1.0f / 2.2f);

                        size_t off = idx * 4;
                        pixels[off + 0] = static_cast<uint8_t>(clampf(color.x * 255.0f, 0.0f, 255.0f));
                        pixels[off + 1] = static_cast<uint8_t>(clampf(color.y * 255.0f, 0.0f, 255.0f));
                        pixels[off + 2] = static_cast<uint8_t>(clampf(color.z * 255.0f, 0.0f, 255.0f));
                        pixels[off + 3] = static_cast<uint8_t>(clampf(alpha_out * 255.0f, 0.0f, 255.0f));
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
