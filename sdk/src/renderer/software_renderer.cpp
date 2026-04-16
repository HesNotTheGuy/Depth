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
    Vec2 uv;
};

struct Triangle {
    Vertex v[3];
};

// ── Mesh generation ───────────────────────────────────

static std::vector<Triangle> generate_box() {
    // Unit box centered at origin, each face gets standard 0-1 UVs
    struct Face { Vec3 n; Vec3 corners[4]; };
    const Face faces[] = {
        {{0,0,1},  {{ .5, .5, .5},{-.5, .5, .5},{-.5,-.5, .5},{ .5,-.5, .5}}},
        {{0,0,-1}, {{-.5, .5,-.5},{ .5, .5,-.5},{ .5,-.5,-.5},{-.5,-.5,-.5}}},
        {{1,0,0},  {{ .5, .5,-.5},{ .5, .5, .5},{ .5,-.5, .5},{ .5,-.5,-.5}}},
        {{-1,0,0}, {{-.5, .5, .5},{-.5, .5,-.5},{-.5,-.5,-.5},{-.5,-.5, .5}}},
        {{0,1,0},  {{ .5, .5,-.5},{-.5, .5,-.5},{-.5, .5, .5},{ .5, .5, .5}}},
        {{0,-1,0}, {{ .5,-.5, .5},{-.5,-.5, .5},{-.5,-.5,-.5},{ .5,-.5,-.5}}},
    };
    // Standard quad UVs: (1,1), (0,1), (0,0), (1,0)
    const Vec2 uvs[4] = {{1,1},{0,1},{0,0},{1,0}};
    std::vector<Triangle> tris;
    for (auto& f : faces) {
        tris.push_back({{{f.corners[0], f.n, uvs[0]}, {f.corners[1], f.n, uvs[1]}, {f.corners[2], f.n, uvs[2]}}});
        tris.push_back({{{f.corners[0], f.n, uvs[0]}, {f.corners[2], f.n, uvs[2]}, {f.corners[3], f.n, uvs[3]}}});
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

            // Spherical UV mapping: u = phi/(2*pi), v = theta/pi
            float u0 = static_cast<float>(j) / segs;
            float u1 = static_cast<float>(j + 1) / segs;
            float v0 = static_cast<float>(i) / segs;
            float v1 = static_cast<float>(i + 1) / segs;
            Vec2 uv00 = {u0, v0}, uv10 = {u0, v1};
            Vec2 uv01 = {u1, v0}, uv11 = {u1, v1};

            if (i > 0)
                tris.push_back({{{p00, n00, uv00}, {p10, n10, uv10}, {p11, n11, uv11}}});
            if (i < segs - 1)
                tris.push_back({{{p00, n00, uv00}, {p11, n11, uv11}, {p01, n01, uv01}}});
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

        // Side UVs: u = angle/(2*pi), v = 0 (bottom) to 1 (top)
        float u0 = static_cast<float>(i) / segs;
        float u1 = static_cast<float>(i + 1) / segs;

        // Side quads
        tris.push_back({{{p0t, n0, {u0,1}}, {p0b, n0, {u0,0}}, {p1b, n1, {u1,0}}}});
        tris.push_back({{{p0t, n0, {u0,1}}, {p1b, n1, {u1,0}}, {p1t, n1, {u1,1}}}});

        // Top cap - planar projection from XZ to UV
        Vec3 top_n = {0, 1, 0};
        tris.push_back({{{Vec3{0,h,0}, top_n, {0.5f,0.5f}},
                         {p0t, top_n, {c0*0.5f+0.5f, s0*0.5f+0.5f}},
                         {p1t, top_n, {c1*0.5f+0.5f, s1*0.5f+0.5f}}}});

        // Bottom cap - planar projection
        Vec3 bot_n = {0, -1, 0};
        tris.push_back({{{Vec3{0,-h,0}, bot_n, {0.5f,0.5f}},
                         {p1b, bot_n, {c1*0.5f+0.5f, s1*0.5f+0.5f}},
                         {p0b, bot_n, {c0*0.5f+0.5f, s0*0.5f+0.5f}}}});
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

        // Side UVs: u = angle/(2*pi), v = 0 (base) to 1 (tip)
        float u0 = static_cast<float>(i) / segs;
        float u1 = static_cast<float>(i + 1) / segs;
        float u_mid = (u0 + u1) * 0.5f;

        tris.push_back({{{tip, nt, {u_mid,1}}, {p0, n0, {u0,0}}, {p1, n1, {u1,0}}}});

        // Bottom cap - planar projection
        Vec3 bot_n = {0, -1, 0};
        tris.push_back({{{Vec3{0,-h,0}, bot_n, {0.5f,0.5f}},
                         {p1, bot_n, {c1*0.5f+0.5f, s1*0.5f+0.5f}},
                         {p0, bot_n, {c0*0.5f+0.5f, s0*0.5f+0.5f}}}});
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

            // Torus UVs: u = ring angle/(2*pi), v = tube angle/(2*pi)
            float u0 = static_cast<float>(i) / ring_segs;
            float u1 = static_cast<float>(i + 1) / ring_segs;
            float v0 = static_cast<float>(j) / tube_segs;
            float v1 = static_cast<float>(j + 1) / tube_segs;
            Vec2 uv00 = {u0, v0}, uv10 = {u1, v0};
            Vec2 uv01 = {u0, v1}, uv11 = {u1, v1};

            tris.push_back({{{p00, n00, uv00}, {p10, n10, uv10}, {p11, n11, uv11}}});
            tris.push_back({{{p00, n00, uv00}, {p11, n11, uv11}, {p01, n01, uv01}}});
        }
    }
    return tris;
}

// ── Mockup geometry generators ───────────────────────

static std::vector<Triangle> generate_mug(int segs = 24) {
    std::vector<Triangle> tris;
    // Cylinder body: radius 0.35, height 0.8, centered at origin
    float r = 0.35f, hh = 0.4f; // half-height
    for (int i = 0; i < segs; i++) {
        float a0 = 2.0f * static_cast<float>(M_PI) * i / segs;
        float a1 = 2.0f * static_cast<float>(M_PI) * (i + 1) / segs;
        float c0 = std::cos(a0), s0 = std::sin(a0);
        float c1 = std::cos(a1), s1 = std::sin(a1);

        Vec3 p0t = {r*c0, hh, r*s0}, p1t = {r*c1, hh, r*s1};
        Vec3 p0b = {r*c0, -hh, r*s0}, p1b = {r*c1, -hh, r*s1};
        Vec3 n0 = {c0, 0, s0}, n1 = {c1, 0, s1};

        float u0 = static_cast<float>(i) / segs;
        float u1 = static_cast<float>(i + 1) / segs;

        // Side quads
        tris.push_back({{{p0t, n0, {u0,1}}, {p0b, n0, {u0,0}}, {p1b, n1, {u1,0}}}});
        tris.push_back({{{p0t, n0, {u0,1}}, {p1b, n1, {u1,0}}, {p1t, n1, {u1,1}}}});

        // Top cap
        Vec3 top_n = {0, 1, 0};
        tris.push_back({{{Vec3{0,hh,0}, top_n, {0.5f,0.5f}},
                         {p0t, top_n, {c0*0.5f+0.5f, s0*0.5f+0.5f}},
                         {p1t, top_n, {c1*0.5f+0.5f, s1*0.5f+0.5f}}}});

        // Bottom cap
        Vec3 bot_n = {0, -1, 0};
        tris.push_back({{{Vec3{0,-hh,0}, bot_n, {0.5f,0.5f}},
                         {p1b, bot_n, {c1*0.5f+0.5f, s1*0.5f+0.5f}},
                         {p0b, bot_n, {c0*0.5f+0.5f, s0*0.5f+0.5f}}}});
    }

    // Torus handle: half-arc on the +X side, R=0.18, r=0.04
    float R = 0.18f, tr = 0.04f;
    int ring_segs = 12, tube_segs = 8;
    for (int i = 0; i < ring_segs; i++) {
        float theta0 = -static_cast<float>(M_PI) / 2.0f + static_cast<float>(M_PI) * i / ring_segs;
        float theta1 = -static_cast<float>(M_PI) / 2.0f + static_cast<float>(M_PI) * (i + 1) / ring_segs;
        for (int j = 0; j < tube_segs; j++) {
            float phi0 = 2.0f * static_cast<float>(M_PI) * j / tube_segs;
            float phi1 = 2.0f * static_cast<float>(M_PI) * (j + 1) / tube_segs;

            auto pt = [&](float theta, float phi) -> Vec3 {
                float ct = std::cos(theta), st = std::sin(theta);
                float cp = std::cos(phi), sp = std::sin(phi);
                float lx = (R + tr * cp) * ct;
                float ly = (R + tr * cp) * st;
                float lz = tr * sp;
                return {0.35f + lz, ly, lx};
            };
            auto nm = [&](float theta, float phi) -> Vec3 {
                float ct = std::cos(theta), st = std::sin(theta);
                float cp = std::cos(phi), sp = std::sin(phi);
                return normalize(Vec3{sp, cp * st, cp * ct});
            };

            Vec3 p00 = pt(theta0, phi0), p10 = pt(theta1, phi0);
            Vec3 p01 = pt(theta0, phi1), p11 = pt(theta1, phi1);
            Vec3 n00 = nm(theta0, phi0), n10 = nm(theta1, phi0);
            Vec3 n01 = nm(theta0, phi1), n11 = nm(theta1, phi1);

            float hu0 = static_cast<float>(i) / ring_segs;
            float hu1 = static_cast<float>(i + 1) / ring_segs;
            float hv0 = static_cast<float>(j) / tube_segs;
            float hv1 = static_cast<float>(j + 1) / tube_segs;

            tris.push_back({{{p00, n00, {hu0,hv0}}, {p10, n10, {hu1,hv0}}, {p11, n11, {hu1,hv1}}}});
            tris.push_back({{{p00, n00, {hu0,hv0}}, {p11, n11, {hu1,hv1}}, {p01, n01, {hu0,hv1}}}});
        }
    }
    return tris;
}

static std::vector<Triangle> generate_phone() {
    // Simple box slab: 0.76 x 1.5 x 0.08, centered at origin
    float hw = 0.38f, hh = 0.75f, hd = 0.04f;
    struct Face { Vec3 n; Vec3 corners[4]; };
    const Face faces[] = {
        {{0,0,1},  {{ hw, hh, hd},{-hw, hh, hd},{-hw,-hh, hd},{ hw,-hh, hd}}},
        {{0,0,-1}, {{-hw, hh,-hd},{ hw, hh,-hd},{ hw,-hh,-hd},{-hw,-hh,-hd}}},
        {{1,0,0},  {{ hw, hh,-hd},{ hw, hh, hd},{ hw,-hh, hd},{ hw,-hh,-hd}}},
        {{-1,0,0}, {{-hw, hh, hd},{-hw, hh,-hd},{-hw,-hh,-hd},{-hw,-hh, hd}}},
        {{0,1,0},  {{ hw, hh,-hd},{-hw, hh,-hd},{-hw, hh, hd},{ hw, hh, hd}}},
        {{0,-1,0}, {{ hw,-hh, hd},{-hw,-hh, hd},{-hw,-hh,-hd},{ hw,-hh,-hd}}},
    };
    const Vec2 uvs[4] = {{1,1},{0,1},{0,0},{1,0}};
    std::vector<Triangle> tris;
    for (auto& f : faces) {
        tris.push_back({{{f.corners[0], f.n, uvs[0]}, {f.corners[1], f.n, uvs[1]}, {f.corners[2], f.n, uvs[2]}}});
        tris.push_back({{{f.corners[0], f.n, uvs[0]}, {f.corners[2], f.n, uvs[2]}, {f.corners[3], f.n, uvs[3]}}});
    }
    return tris;
}

static std::vector<Triangle> generate_bottle(int segs = 32) {
    std::vector<Triangle> tris;
    struct ProfilePt { float r; float y; };
    const ProfilePt profile[] = {
        {0.0f,  0.0f},   // bottom center
        {0.25f, 0.0f},   // body bottom
        {0.25f, 0.6f},   // body top
        {0.22f, 0.65f},  // shoulder
        {0.1f,  0.8f},   // neck start
        {0.08f, 0.8f},   // neck
        {0.08f, 1.0f},   // neck top
        {0.1f,  1.0f},   // cap lip
        {0.1f,  1.05f},  // cap top
        {0.0f,  1.05f},  // top center
    };
    const int n_pts = 10;
    const float y_offset = -0.525f;
    const float total_h = 1.05f;

    for (int s = 0; s < segs; s++) {
        float a0 = 2.0f * static_cast<float>(M_PI) * s / segs;
        float a1 = 2.0f * static_cast<float>(M_PI) * (s + 1) / segs;
        float c0 = std::cos(a0), s0_val = std::sin(a0);
        float c1 = std::cos(a1), s1_val = std::sin(a1);
        float u0 = static_cast<float>(s) / segs;
        float u1 = static_cast<float>(s + 1) / segs;

        for (int p = 0; p < n_pts - 1; p++) {
            float r0 = profile[p].r, y0 = profile[p].y + y_offset;
            float r1 = profile[p + 1].r, y1 = profile[p + 1].y + y_offset;

            Vec3 p00 = {r0 * c0, y0, r0 * s0_val};
            Vec3 p01 = {r0 * c1, y0, r0 * s1_val};
            Vec3 p10 = {r1 * c0, y1, r1 * s0_val};
            Vec3 p11 = {r1 * c1, y1, r1 * s1_val};

            float dy = profile[p + 1].y - profile[p].y;
            float dr = profile[p + 1].r - profile[p].r;
            float nx = dy, ny = -dr;
            float nlen = std::sqrt(nx * nx + ny * ny);
            if (nlen < 1e-8f) { nx = 1.0f; ny = 0.0f; }
            else { nx /= nlen; ny /= nlen; }

            Vec3 n00_v = normalize(Vec3{nx * c0, ny, nx * s0_val});
            Vec3 n01_v = normalize(Vec3{nx * c1, ny, nx * s1_val});

            float v0 = profile[p].y / total_h;
            float v1 = profile[p + 1].y / total_h;

            if (r0 > 1e-6f && r1 > 1e-6f) {
                tris.push_back({{{p00, n00_v, {u0,v0}}, {p10, n00_v, {u0,v1}}, {p11, n01_v, {u1,v1}}}});
                tris.push_back({{{p00, n00_v, {u0,v0}}, {p11, n01_v, {u1,v1}}, {p01, n01_v, {u1,v0}}}});
            } else if (r0 < 1e-6f && r1 > 1e-6f) {
                Vec3 cn = {0, (ny < 0) ? -1.0f : 1.0f, 0};
                tris.push_back({{{p00, cn, {(u0+u1)*0.5f,v0}}, {p10, n00_v, {u0,v1}}, {p11, n01_v, {u1,v1}}}});
            } else if (r0 > 1e-6f && r1 < 1e-6f) {
                Vec3 cn = {0, (ny > 0) ? 1.0f : -1.0f, 0};
                tris.push_back({{{p00, n00_v, {u0,v0}}, {p10, cn, {(u0+u1)*0.5f,v1}}, {p01, n01_v, {u1,v0}}}});
            }
        }
    }
    return tris;
}

static std::vector<Triangle> generate_bag() {
    std::vector<Triangle> tris;
    float bw = 0.4f, tw = 0.45f;
    float hh = 0.45f;
    float hd = 0.125f;

    Vec3 btl = {-bw, -hh,  hd}, btr = { bw, -hh,  hd};
    Vec3 bbl = {-bw, -hh, -hd}, bbr = { bw, -hh, -hd};
    Vec3 ttl = {-tw,  hh,  hd}, ttr = { tw,  hh,  hd};
    Vec3 tbl = {-tw,  hh, -hd}, tbr = { tw,  hh, -hd};

    const Vec2 uv_00 = {0,0}, uv_10 = {1,0}, uv_01 = {0,1}, uv_11 = {1,1};

    auto quad = [&](Vec3 a, Vec3 b, Vec3 c, Vec3 d, Vec3 n) {
        tris.push_back({{{a, n, uv_11}, {b, n, uv_01}, {c, n, uv_00}}});
        tris.push_back({{{a, n, uv_11}, {c, n, uv_00}, {d, n, uv_10}}});
    };

    quad(ttr, ttl, btl, btr, normalize(Vec3{0, 0, 1}));
    quad(tbl, tbr, bbr, bbl, normalize(Vec3{0, 0, -1}));
    quad(tbr, ttr, btr, bbr, normalize(Vec3{hh * 2.0f, tw - bw, 0}));
    quad(ttl, tbl, bbl, btl, normalize(Vec3{-(hh * 2.0f), tw - bw, 0}));
    quad(ttr, tbr, tbl, ttl, Vec3{0, 1, 0});
    quad(btl, bbl, bbr, btr, Vec3{0, -1, 0});

    // Two small torus handles at top: R=0.1, r=0.015, half-arc at x=+-0.2
    float hR = 0.1f, hr = 0.015f;
    int ring_segs = 10, tube_segs = 6;
    for (int side = -1; side <= 1; side += 2) {
        float cx = side * 0.2f;
        for (int i = 0; i < ring_segs; i++) {
            float theta0 = static_cast<float>(M_PI) * i / ring_segs;
            float theta1 = static_cast<float>(M_PI) * (i + 1) / ring_segs;
            for (int j = 0; j < tube_segs; j++) {
                float phi0 = 2.0f * static_cast<float>(M_PI) * j / tube_segs;
                float phi1 = 2.0f * static_cast<float>(M_PI) * (j + 1) / tube_segs;

                auto pt = [&](float theta, float phi) -> Vec3 {
                    float ct = std::cos(theta), st = std::sin(theta);
                    float cp = std::cos(phi), sp = std::sin(phi);
                    return {cx + (hR + hr*cp)*ct, hh + (hR + hr*cp)*st, hr*sp};
                };
                auto nm_fn = [&](float theta, float phi) -> Vec3 {
                    float ct = std::cos(theta), st = std::sin(theta);
                    float cp = std::cos(phi), sp = std::sin(phi);
                    return normalize(Vec3{cp*ct, cp*st, sp});
                };

                Vec3 pa = pt(theta0, phi0), pb = pt(theta1, phi0);
                Vec3 pc = pt(theta0, phi1), pd = pt(theta1, phi1);
                Vec3 na = nm_fn(theta0, phi0), nb = nm_fn(theta1, phi0);
                Vec3 nc = nm_fn(theta0, phi1), nd = nm_fn(theta1, phi1);

                float hu0 = static_cast<float>(i) / ring_segs;
                float hu1 = static_cast<float>(i + 1) / ring_segs;
                float hv0 = static_cast<float>(j) / tube_segs;
                float hv1 = static_cast<float>(j + 1) / tube_segs;

                tris.push_back({{{pa, na, {hu0,hv0}}, {pb, nb, {hu1,hv0}}, {pd, nd, {hu1,hv1}}}});
                tris.push_back({{{pa, na, {hu0,hv0}}, {pd, nd, {hu1,hv1}}, {pc, nc, {hu0,hv1}}}});
            }
        }
    }
    return tris;
}

static std::vector<Triangle> generate_card() {
    float hw = 0.4375f, hh = 0.25f, hd = 0.005f;
    struct Face { Vec3 n; Vec3 corners[4]; };
    const Face faces[] = {
        {{0,0,1},  {{ hw, hh, hd},{-hw, hh, hd},{-hw,-hh, hd},{ hw,-hh, hd}}},
        {{0,0,-1}, {{-hw, hh,-hd},{ hw, hh,-hd},{ hw,-hh,-hd},{-hw,-hh,-hd}}},
        {{1,0,0},  {{ hw, hh,-hd},{ hw, hh, hd},{ hw,-hh, hd},{ hw,-hh,-hd}}},
        {{-1,0,0}, {{-hw, hh, hd},{-hw, hh,-hd},{-hw,-hh,-hd},{-hw,-hh, hd}}},
        {{0,1,0},  {{ hw, hh,-hd},{-hw, hh,-hd},{-hw, hh, hd},{ hw, hh, hd}}},
        {{0,-1,0}, {{ hw,-hh, hd},{-hw,-hh, hd},{-hw,-hh,-hd},{ hw,-hh,-hd}}},
    };
    const Vec2 uvs[4] = {{1,1},{0,1},{0,0},{1,0}};
    std::vector<Triangle> tris;
    for (auto& f : faces) {
        tris.push_back({{{f.corners[0], f.n, uvs[0]}, {f.corners[1], f.n, uvs[1]}, {f.corners[2], f.n, uvs[2]}}});
        tris.push_back({{{f.corners[0], f.n, uvs[0]}, {f.corners[2], f.n, uvs[2]}, {f.corners[3], f.n, uvs[3]}}});
    }
    return tris;
}

static std::vector<Triangle> generate_donut(int ring_segs = 24, int tube_segs = 16) {
    std::vector<Triangle> tris;
    float R = 0.35f, r = 0.15f;

    // Donut body (torus laid flat — swapped Y and Z)
    for (int i = 0; i < ring_segs; i++) {
        float theta0 = 2.0f * static_cast<float>(M_PI) * i / ring_segs;
        float theta1 = 2.0f * static_cast<float>(M_PI) * (i + 1) / ring_segs;
        for (int j = 0; j < tube_segs; j++) {
            float phi0 = 2.0f * static_cast<float>(M_PI) * j / tube_segs;
            float phi1 = 2.0f * static_cast<float>(M_PI) * (j + 1) / tube_segs;

            // Flat donut: X-Z plane, Y is up
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

            float u0 = static_cast<float>(i) / ring_segs;
            float u1 = static_cast<float>(i + 1) / ring_segs;
            float v0 = static_cast<float>(j) / tube_segs;
            float v1 = static_cast<float>(j + 1) / tube_segs;

            tris.push_back({{{p00, n00, {u0,v0}}, {p10, n10, {u1,v0}}, {p11, n11, {u1,v1}}}});
            tris.push_back({{{p00, n00, {u0,v0}}, {p11, n11, {u1,v1}}, {p01, n01, {u0,v1}}}});
        }
    }

    // Icing — slightly larger torus, only upper half (Y >= 0)
    float ir = r + 0.02f;
    for (int i = 0; i < ring_segs; i++) {
        float theta0 = 2.0f * static_cast<float>(M_PI) * i / ring_segs;
        float theta1 = 2.0f * static_cast<float>(M_PI) * (i + 1) / ring_segs;
        // Only upper half of tube: phi from 0 to PI
        int half_segs = tube_segs / 2;
        for (int j = 0; j < half_segs; j++) {
            float phi0 = static_cast<float>(M_PI) * j / half_segs;
            float phi1 = static_cast<float>(M_PI) * (j + 1) / half_segs;

            auto pt = [&](float theta, float phi) -> Vec3 {
                float ct = std::cos(theta), st = std::sin(theta);
                float cp = std::cos(phi), sp = std::sin(phi);
                return {(R + ir*cp)*ct, ir*sp, (R + ir*cp)*st};
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

            float u0 = static_cast<float>(i) / ring_segs;
            float u1 = static_cast<float>(i + 1) / ring_segs;
            float v0 = static_cast<float>(j) / half_segs;
            float v1 = static_cast<float>(j + 1) / half_segs;

            tris.push_back({{{p00, n00, {u0,v0}}, {p10, n10, {u1,v0}}, {p11, n11, {u1,v1}}}});
            tris.push_back({{{p00, n00, {u0,v0}}, {p11, n11, {u1,v1}}, {p01, n01, {u0,v1}}}});
        }
    }

    // Sprinkles — small cylinders on top of the donut
    int sprinkle_count = 24;
    // Simple deterministic "random" using golden ratio
    float golden = 1.618033988f;
    for (int s = 0; s < sprinkle_count; s++) {
        float angle = 2.0f * static_cast<float>(M_PI) * s / sprinkle_count;
        float radial_jitter = (std::fmod(s * golden, 1.0f) - 0.5f) * r * 1.2f;
        float radial = R + radial_jitter;
        float cx = std::cos(angle) * radial;
        float cz = std::sin(angle) * radial;
        float cy = r * 0.7f + std::fmod(s * golden * 0.3f, 0.03f);

        float sr = 0.008f, sh = 0.02f; // sprinkle radius and half-height
        // Tilted sprinkle: approximate as 2 triangles (tiny quad)
        float tilt = std::fmod(s * golden * 2.0f, static_cast<float>(M_PI));
        float dx = std::cos(tilt) * sh;
        float dz = std::sin(tilt) * sh;
        Vec3 pa = {cx - dx, cy + sr, cz - dz};
        Vec3 pb = {cx + dx, cy + sr, cz + dz};
        Vec3 pc = {cx + dx, cy - sr, cz + dz};
        Vec3 pd = {cx - dx, cy - sr, cz - dz};
        Vec3 sn = {0, 1, 0};
        tris.push_back({{{pa, sn, {0,0}}, {pb, sn, {1,0}}, {pc, sn, {1,1}}}});
        tris.push_back({{{pa, sn, {0,0}}, {pc, sn, {1,1}}, {pd, sn, {0,1}}}});
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
        case GeometryType::Mug:      return generate_mug();
        case GeometryType::Phone:    return generate_phone();
        case GeometryType::Bottle:   return generate_bottle();
        case GeometryType::Bag:      return generate_bag();
        case GeometryType::Card:     return generate_card();
        case GeometryType::Donut:    return generate_donut();
        case GeometryType::Plane: {
            // Plane UVs: u = x+0.5, v = z+0.5 (maps unit plane to 0-1)
            Vec3 n = {0, 1, 0};
            return {{{{Vec3{-.5f,0,.5f}, n, {0,1}}, {Vec3{.5f,0,.5f}, n, {1,1}}, {Vec3{.5f,0,-.5f}, n, {1,0}}}},
                    {{{Vec3{-.5f,0,.5f}, n, {0,1}}, {Vec3{.5f,0,-.5f}, n, {1,0}}, {Vec3{-.5f,0,-.5f}, n, {0,0}}}}};
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
    float roughness,
    float reflectivity = 0.04f  // F0 for dielectrics
) {
    Vec3 H = normalize(L + V);
    float ndotl = std::max(0.0f, dot(N, L));
    float ndotv = std::max(0.001f, dot(N, V));
    float ndoth = std::max(0.0f, dot(N, H));
    float hdotv = std::max(0.0f, dot(H, V));

    // F0: reflectance at normal incidence
    // Dielectric: reflectivity param, Metal: albedo
    Vec3 f0 = {reflectivity + metalness * (albedo.x - reflectivity),
               reflectivity + metalness * (albedo.y - reflectivity),
               reflectivity + metalness * (albedo.z - reflectivity)};

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
                    Vec2 uv;
                    float inv_w; // for perspective-correct interpolation
                };
                ScreenVert sv[3];
                bool valid = true;

                for (int i = 0; i < 3; i++) {
                    Vec4 world = model * Vec4{tri.v[i].pos.x, tri.v[i].pos.y, tri.v[i].pos.z, 1.0f};
                    Vec4 clip = vp * world;

                    if (clip.w < 0.01f) { valid = false; break; }

                    float iw = 1.0f / clip.w;
                    float ndc_x = clip.x * iw;
                    float ndc_y = clip.y * iw;

                    sv[i].sx = (ndc_x + 1.0f) * 0.5f * w;
                    sv[i].sy = (1.0f - ndc_y) * 0.5f * h;
                    sv[i].depth = clip.z * iw;
                    sv[i].world_pos = {world.x, world.y, world.z};
                    sv[i].uv = tri.v[i].uv;
                    sv[i].inv_w = iw;

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

                        // ── Texture sampling (perspective-correct UV interpolation) ──
                        Vec3 pixel_albedo = albedo;
                        if (mat.texture && !mat.texture->empty()) {
                            // Perspective-correct interpolation
                            float w0 = bw0 * sv[0].inv_w;
                            float w1 = bw1 * sv[1].inv_w;
                            float w2 = bw2 * sv[2].inv_w;
                            float inv_sum = 1.0f / (w0 + w1 + w2);

                            float tex_u = (w0 * sv[0].uv.x + w1 * sv[1].uv.x + w2 * sv[2].uv.x) * inv_sum;
                            float tex_v = (w0 * sv[0].uv.y + w1 * sv[1].uv.y + w2 * sv[2].uv.y) * inv_sum;

                            // Apply texture transform: rotation around center
                            if (mat.texture_rotation != 0.0f) {
                                float c = std::cos(mat.texture_rotation);
                                float s = std::sin(mat.texture_rotation);
                                float cu = tex_u - 0.5f, cv = tex_v - 0.5f;
                                tex_u = cu * c - cv * s + 0.5f;
                                tex_v = cu * s + cv * c + 0.5f;
                            }
                            // Apply repeat and offset
                            tex_u = tex_u * mat.texture_repeat.x + mat.texture_offset.x;
                            tex_v = tex_v * mat.texture_repeat.y + mat.texture_offset.y;

                            // Wrap to [0,1] (handle negatives)
                            tex_u = tex_u - std::floor(tex_u);
                            tex_v = tex_v - std::floor(tex_v);

                            uint32_t tex_w = mat.texture->width();
                            uint32_t tex_h = mat.texture->height();
                            uint32_t tx = static_cast<uint32_t>(tex_u * tex_w) % tex_w;
                            uint32_t ty = static_cast<uint32_t>(tex_v * tex_h) % tex_h;

                            Color texel = mat.texture->pixel_at(tx, ty);
                            // Multiply texture color with base color (matches web behavior)
                            pixel_albedo.x *= texel.r;
                            pixel_albedo.y *= texel.g;
                            pixel_albedo.z *= texel.b;
                        }

                        // ── Accumulate lighting ──

                        // Ambient
                        Vec3 color = {ambient_c.r * ambient_i * pixel_albedo.x,
                                      ambient_c.g * ambient_i * pixel_albedo.y,
                                      ambient_c.b * ambient_i * pixel_albedo.z};

                        // Directional light (PBR)
                        auto dir_contrib = shade_pbr(N, V, dir_light_dir, dir_light_col,
                                                     pixel_albedo, mat.metalness, mat.roughness,
                                                     mat.reflectivity);
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
                                                        pixel_albedo, mat.metalness, mat.roughness,
                                                        mat.reflectivity);
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

                        // Apply material opacity
                        alpha_out *= mat.opacity;

                        size_t off = idx * 4;
                        pixels[off + 0] = static_cast<uint8_t>(clampf(color.x * 255.0f, 0.0f, 255.0f));
                        pixels[off + 1] = static_cast<uint8_t>(clampf(color.y * 255.0f, 0.0f, 255.0f));
                        pixels[off + 2] = static_cast<uint8_t>(clampf(color.z * 255.0f, 0.0f, 255.0f));
                        pixels[off + 3] = static_cast<uint8_t>(clampf(alpha_out * 255.0f, 0.0f, 255.0f));
                    }
                }
            }
        }

        // ── Shadow pass ───────────────────────────────────
        // Project each object's bounding sphere onto the ground plane
        // and draw a soft circular contact shadow.
        float shadow_opacity = scene.shadow_opacity();
        float shadow_soft = scene.shadow_softness();
        Color shadow_col = scene.shadow_color();

        if (shadow_opacity > 0.0f) {
            // Find the lowest surface Y, default to 0
            float ground_y = 0.0f;
            for (const auto& surf : scene.surfaces()) {
                if (surf.active && surf.transform.position.y < ground_y)
                    ground_y = surf.transform.position.y;
            }

            // Map softness (0-1) to blur sigma in world units
            float blur_sigma = 0.2f + shadow_soft * 1.5f;

            for (const auto& obj : scene.objects()) {
                Vec3 obj_center = obj.transform.position;
                float obj_radius = obj.transform.scale * 0.5f;

                Vec3 shadow_center = {obj_center.x, ground_y, obj_center.z};

                float height_above = obj_center.y - obj_radius - ground_y;
                if (height_above < 0.0f) height_above = 0.0f;
                float shadow_radius = obj_radius + height_above * 0.3f + blur_sigma;

                float height_fade = 1.0f / (1.0f + height_above * 0.8f);
                float base_alpha = shadow_opacity * height_fade;

                // Project shadow bounds to screen space
                Vec3 corners_ws[4] = {
                    {shadow_center.x - shadow_radius, ground_y, shadow_center.z - shadow_radius},
                    {shadow_center.x + shadow_radius, ground_y, shadow_center.z - shadow_radius},
                    {shadow_center.x - shadow_radius, ground_y, shadow_center.z + shadow_radius},
                    {shadow_center.x + shadow_radius, ground_y, shadow_center.z + shadow_radius},
                };

                float smin_x = static_cast<float>(w), smax_x = 0.0f;
                float smin_y = static_cast<float>(h), smax_y = 0.0f;
                bool any_valid = false;

                for (int c = 0; c < 4; c++) {
                    Vec4 clip = vp * Vec4{corners_ws[c].x, corners_ws[c].y, corners_ws[c].z, 1.0f};
                    if (clip.w < 0.01f) continue;
                    float inv_w = 1.0f / clip.w;
                    float sx = (clip.x * inv_w + 1.0f) * 0.5f * w;
                    float sy = (1.0f - clip.y * inv_w) * 0.5f * h;
                    smin_x = std::min(smin_x, sx);
                    smax_x = std::max(smax_x, sx);
                    smin_y = std::min(smin_y, sy);
                    smax_y = std::max(smax_y, sy);
                    any_valid = true;
                }
                if (!any_valid) continue;

                int sx0 = std::max(0, static_cast<int>(std::floor(smin_x)));
                int sx1 = std::min(static_cast<int>(w) - 1, static_cast<int>(std::ceil(smax_x)));
                int sy0 = std::max(0, static_cast<int>(std::floor(smin_y)));
                int sy1 = std::min(static_cast<int>(h) - 1, static_cast<int>(std::ceil(smax_y)));

                for (int py = sy0; py <= sy1; py++) {
                    for (int px = sx0; px <= sx1; px++) {
                        Vec4 center_clip = vp * Vec4{shadow_center.x, shadow_center.y, shadow_center.z, 1.0f};
                        if (center_clip.w < 0.01f) continue;
                        float center_sx = (center_clip.x / center_clip.w + 1.0f) * 0.5f * w;
                        float center_sy = (1.0f - center_clip.y / center_clip.w) * 0.5f * h;

                        Vec4 edge_clip = vp * Vec4{shadow_center.x + shadow_radius, shadow_center.y, shadow_center.z, 1.0f};
                        if (edge_clip.w < 0.01f) continue;
                        float edge_sx = (edge_clip.x / edge_clip.w + 1.0f) * 0.5f * w;
                        float screen_radius = std::abs(edge_sx - center_sx);
                        if (screen_radius < 1.0f) screen_radius = 1.0f;

                        float dx = static_cast<float>(px) - center_sx;
                        float dy = static_cast<float>(py) - center_sy;
                        float dist_sq = dx * dx + dy * dy;
                        float r_sq = screen_radius * screen_radius;

                        if (dist_sq > r_sq) continue;

                        // Gaussian falloff
                        float norm_dist = std::sqrt(dist_sq) / screen_radius;
                        float falloff = std::exp(-norm_dist * norm_dist * 3.0f);
                        float alpha = base_alpha * falloff;
                        if (alpha < 0.005f) continue;

                        size_t pidx = (static_cast<size_t>(py) * w + px) * 4;
                        float existing_r = pixels[pidx + 0] / 255.0f;
                        float existing_g = pixels[pidx + 1] / 255.0f;
                        float existing_b = pixels[pidx + 2] / 255.0f;
                        float existing_a = pixels[pidx + 3] / 255.0f;

                        float sr = shadow_col.r;
                        float sg = shadow_col.g;
                        float sb = shadow_col.b;

                        if (existing_a > 0.01f) {
                            float blend_r = existing_r * (1.0f - alpha) + existing_r * sr * alpha;
                            float blend_g = existing_g * (1.0f - alpha) + existing_g * sg * alpha;
                            float blend_b = existing_b * (1.0f - alpha) + existing_b * sb * alpha;
                            pixels[pidx + 0] = static_cast<uint8_t>(clampf(blend_r * 255.0f, 0.0f, 255.0f));
                            pixels[pidx + 1] = static_cast<uint8_t>(clampf(blend_g * 255.0f, 0.0f, 255.0f));
                            pixels[pidx + 2] = static_cast<uint8_t>(clampf(blend_b * 255.0f, 0.0f, 255.0f));
                        } else {
                            pixels[pidx + 0] = static_cast<uint8_t>(clampf(sr * 255.0f, 0.0f, 255.0f));
                            pixels[pidx + 1] = static_cast<uint8_t>(clampf(sg * 255.0f, 0.0f, 255.0f));
                            pixels[pidx + 2] = static_cast<uint8_t>(clampf(sb * 255.0f, 0.0f, 255.0f));
                            pixels[pidx + 3] = static_cast<uint8_t>(clampf(alpha * 255.0f, 0.0f, 255.0f));
                        }
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
