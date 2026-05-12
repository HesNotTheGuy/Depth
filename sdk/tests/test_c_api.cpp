/**
 * @file test_c_api.cpp
 * @brief Coverage for the flat C API in depth/depth_c.h.
 */

#include "test_harness.h"
#include <depth/depth_c.h>

#include <cstdlib>
#include <vector>

TEST_CASE(c_api_version_nonnull) {
    const char* v = depth_version();
    ASSERT_TRUE(v != nullptr);
    ASSERT_TRUE(v[0] != '\0');
}

TEST_CASE(c_api_scene_lifecycle) {
    auto* s = depth_scene_create();
    ASSERT_TRUE(s != nullptr);
    depth_scene_destroy(s);
}

TEST_CASE(c_api_set_background_pixels) {
    auto* s = depth_scene_create();
    ASSERT_TRUE(s != nullptr);

    const uint32_t w = 16, h = 16;
    std::vector<uint8_t> px(w * h * 4, 0);
    for (size_t i = 0; i < px.size(); i += 4) {
        px[i + 0] = 200; px[i + 1] = 180; px[i + 2] = 160; px[i + 3] = 255;
    }
    auto st = depth_scene_set_background_pixels(s, w, h, px.data());
    ASSERT_EQ(static_cast<int>(st), static_cast<int>(DEPTH_OK));
    depth_scene_destroy(s);
}

TEST_CASE(c_api_set_background_null_input) {
    auto* s = depth_scene_create();
    auto st = depth_scene_set_background_pixels(s, 16, 16, nullptr);
    ASSERT_EQ(static_cast<int>(st), static_cast<int>(DEPTH_ERR_INVALID_INPUT));

    auto st2 = depth_scene_set_background_pixels(nullptr, 16, 16, nullptr);
    ASSERT_EQ(static_cast<int>(st2), static_cast<int>(DEPTH_ERR_INVALID_INPUT));
    depth_scene_destroy(s);
}

TEST_CASE(c_api_add_object_and_set_material) {
    auto* s = depth_scene_create();
    uint32_t id = depth_scene_add_object(s, DEPTH_GEOMETRY_BOX, 0.0f, 0.5f, 0.0f);
    ASSERT_GT(id, 0u);

    depth_object_set_transform(s, id, 1.0f, 2.0f, 3.0f, 0.0f, 0.5f, 0.0f, 1.5f);
    depth_object_set_material(s, id, DEPTH_MATERIAL_METALLIC, 0.8f, 0.2f, 0.1f, 0.4f);
    depth_object_set_metalness(s, id, 0.9f);

    depth_scene_remove_object(s, id);
    depth_scene_destroy(s);
}

TEST_CASE(c_api_all_new_geometry_enums_accepted) {
    auto* s = depth_scene_create();
    const DepthGeometry geoms[] = {
        DEPTH_GEOMETRY_BOX, DEPTH_GEOMETRY_CYLINDER, DEPTH_GEOMETRY_SPHERE,
        DEPTH_GEOMETRY_CONE, DEPTH_GEOMETRY_TORUS, DEPTH_GEOMETRY_PLANE,
        DEPTH_GEOMETRY_MUG, DEPTH_GEOMETRY_PHONE, DEPTH_GEOMETRY_BOTTLE,
        DEPTH_GEOMETRY_BAG, DEPTH_GEOMETRY_CARD, DEPTH_GEOMETRY_DONUT,
        DEPTH_GEOMETRY_LAPTOP, DEPTH_GEOMETRY_TABLET, DEPTH_GEOMETRY_CAN,
        DEPTH_GEOMETRY_BOOK,
    };
    for (auto g : geoms) {
        uint32_t id = depth_scene_add_object(s, g, 0.0f, 0.0f, 0.0f);
        ASSERT_GT(id, 0u);
    }
    depth_scene_destroy(s);
}

TEST_CASE(c_api_surface_and_snap) {
    auto* s = depth_scene_create();
    uint32_t surf = depth_scene_add_surface(s,
        0.2f, 0.6f,  0.8f, 0.6f,
        0.9f, 0.9f,  0.1f, 0.9f);
    ASSERT_GT(surf, 0u);
    uint32_t obj = depth_scene_add_object(s, DEPTH_GEOMETRY_BOX, 0.0f, 5.0f, 0.0f);
    ASSERT_GT(obj, 0u);
    depth_scene_snap_objects(s);    // must not crash
    depth_scene_remove_surface(s, surf);
    depth_scene_destroy(s);
}

TEST_CASE(c_api_shadow_setters) {
    auto* s = depth_scene_create();
    depth_set_shadow_opacity(s, 0.33f);
    depth_set_shadow_softness(s, 0.66f);
    depth_set_shadow_color(s, 0.1f, 0.2f, 0.3f);
    // Null scene should not crash.
    depth_set_shadow_opacity(nullptr, 0.5f);
    depth_set_shadow_softness(nullptr, 0.5f);
    depth_set_shadow_color(nullptr, 0.5f, 0.5f, 0.5f);
    depth_scene_destroy(s);
}

TEST_CASE(c_api_point_light_add) {
    auto* s = depth_scene_create();
    uint32_t id = depth_add_point_light(s, 1, 2, 3, 1.0f, 0.5f, 0.25f, 2.0f);
    ASSERT_GT(id, 0u);
    depth_scene_destroy(s);
}

TEST_CASE(c_api_set_light_manual) {
    auto* s = depth_scene_create();
    depth_scene_set_light(s, 45.0f, 0.7f, 1.5f, 1.0f, 0.95f, 0.9f);
    depth_scene_destroy(s);
}

TEST_CASE(c_api_render_to_buffer_no_background) {
    auto* s = depth_scene_create();
    uint32_t id = depth_scene_add_object(s, DEPTH_GEOMETRY_SPHERE, 0, 0, 0);
    ASSERT_GT(id, 0u);

    // With no background the renderer uses defaults (1920x1080). Use a
    // small background so the buffer encode stays cheap.
    const uint32_t w = 32, h = 32;
    std::vector<uint8_t> px(w * h * 4, 128);
    for (size_t i = 3; i < px.size(); i += 4) px[i] = 255;
    depth_scene_set_background_pixels(s, w, h, px.data());

    uint8_t* out = nullptr;
    size_t out_size = 0;
    auto st = depth_render_to_buffer(s, &out, &out_size, DEPTH_FORMAT_PNG);
    ASSERT_EQ(static_cast<int>(st), static_cast<int>(DEPTH_OK));
    ASSERT_TRUE(out != nullptr);
    ASSERT_GT(out_size, size_t{0});
    if (out) depth_free_buffer(out);

    depth_scene_destroy(s);
}

TEST_CASE(c_api_auto_lighting_no_background) {
    auto* s = depth_scene_create();
    auto est = depth_scene_auto_lighting(s);
    // Without a background the impl returns a zeroed struct.
    ASSERT_NEAR(est.brightness, 0.0f, 1e-5f);
    depth_scene_destroy(s);
}

TEST_CASE(c_api_auto_lighting_with_background) {
    auto* s = depth_scene_create();
    const uint32_t w = 32, h = 32;
    std::vector<uint8_t> px(w * h * 4, 0);
    for (size_t i = 0; i < px.size(); i += 4) {
        px[i + 0] = 220; px[i + 1] = 200; px[i + 2] = 180; px[i + 3] = 255;
    }
    depth_scene_set_background_pixels(s, w, h, px.data());
    auto est = depth_scene_auto_lighting(s);
    ASSERT_GT(est.brightness, 0.0f);
    depth_scene_destroy(s);
}

TEST_CASE(c_api_null_safety) {
    // All public mutators should tolerate a null scene without crashing.
    depth_scene_destroy(nullptr);
    ASSERT_EQ(depth_scene_add_object(nullptr, DEPTH_GEOMETRY_BOX, 0, 0, 0), 0u);
    depth_object_set_transform(nullptr, 1, 0, 0, 0, 0, 0, 0, 1);
    depth_object_set_material(nullptr, 1, DEPTH_MATERIAL_MATTE, 1, 1, 1, 0.5f);
    depth_object_set_metalness(nullptr, 1, 0.5f);
    depth_scene_remove_object(nullptr, 1);
    depth_scene_snap_objects(nullptr);
    depth_scene_remove_surface(nullptr, 1);
    ASSERT_EQ(depth_add_point_light(nullptr, 0, 0, 0, 1, 1, 1, 1.0f), 0u);
    // depth_scene_set_light has no return, just must not crash.
    depth_scene_set_light(nullptr, 0, 0, 0, 1, 1, 1);
}
