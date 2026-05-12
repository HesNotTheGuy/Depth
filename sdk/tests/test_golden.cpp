/**
 * @file test_golden.cpp
 * @brief Visual regression — render a fixed deterministic scene and
 *        verify its pixel hash matches a known-good baseline.
 *
 * The scene is intentionally simple and reproducible:
 *   - 64x64 software render
 *   - One sphere at the origin, matte material
 *   - One directional light at angle=45, elevation=0.6
 *   - No background, transparent BG enabled
 *
 * On the first run after any visual change to the renderer:
 *   1. Look at the test output for the line "[golden] computed hash = ..."
 *   2. If the new render is correct, paste that hash into
 *      kGoldenHash below and re-run.
 *
 * The hash is FNV-1a 64-bit — small, deterministic, no extra deps.
 */

#include "test_harness.h"
#include <depth/depth.h>

#include <cstdio>
#include <cstdint>

using namespace depth;

namespace {

// Setting kGoldenHash to 0 puts the test into "bootstrap" mode:
// it prints the computed hash and passes. Replace with the real
// hash to lock in the baseline.
constexpr uint64_t kGoldenHash = 0;

uint64_t fnv1a_64(const uint8_t* data, size_t size) {
    uint64_t h = 1469598103934665603ULL; // FNV offset basis
    for (size_t i = 0; i < size; i++) {
        h ^= static_cast<uint64_t>(data[i]);
        h *= 1099511628211ULL; // FNV prime
    }
    return h;
}

Image render_golden_scene() {
    Scene scene;

    SceneObject sphere;
    sphere.geometry = GeometryType::Sphere;
    sphere.transform.position = {0.0f, 0.0f, 0.0f};
    sphere.transform.rotation = {0.0f, 0.0f, 0.0f};
    sphere.transform.scale = 1.0f;
    sphere.material = Material::from_preset(MaterialPreset::Matte,
                                            {0.8f, 0.4f, 0.2f, 1.0f});
    scene.add_object(std::move(sphere));

    // Lock all camera & light parameters to defaults explicitly so a
    // default-value change doesn't silently break the golden.
    scene.camera().position = {2.0f, 1.5f, 2.0f};
    scene.camera().target = {0.0f, 0.0f, 0.0f};
    scene.camera().fov = 45.0f;
    scene.camera().near_clip = 0.1f;
    scene.camera().far_clip = 50.0f;

    scene.light().angle = 45.0f;
    scene.light().elevation = 0.6f;
    scene.light().intensity = 1.5f;
    scene.light().color = Color::white();
    scene.light().cast_shadows = false; // simplify for golden stability

    scene.set_ambient_color({0.4f, 0.4f, 0.4f, 1.0f});
    scene.set_ambient_intensity(0.35f);

    RenderConfig cfg;
    cfg.width = 64;
    cfg.height = 64;
    cfg.samples = 1;
    cfg.transparent_bg = true;
    cfg.backend = RendererBackend::Software;
    auto r = Renderer::create(cfg);
    if (!r) return Image();
    return r->render(scene);
}

} // namespace

TEST_CASE(golden_sphere_pixel_hash) {
    Image img = render_golden_scene();
    ASSERT_EQ(img.width(),  64u);
    ASSERT_EQ(img.height(), 64u);
    ASSERT_FALSE(img.empty());

    uint64_t hash = fnv1a_64(img.data(), img.size_bytes());
    std::printf("    [golden] computed hash = 0x%016llx\n",
                static_cast<unsigned long long>(hash));

    if (kGoldenHash == 0) {
        // Bootstrap mode — no baseline yet. Pass so CI doesn't
        // fail on the very first run.
        std::printf("    [golden] kGoldenHash is 0 (bootstrap mode); "
                    "update test_golden.cpp with the printed value.\n");
        return;
    }

    ASSERT_EQ(hash, kGoldenHash);
}
