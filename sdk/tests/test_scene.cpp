/**
 * @file test_scene.cpp
 * @brief Scene graph state, materials, lighting apply, snap, point lights.
 */

#include "test_harness.h"
#include <depth/depth.h>

using namespace depth;

TEST_CASE(scene_add_get_object) {
    Scene scene;
    SceneObject o;
    o.name = "TestBox";
    o.geometry = GeometryType::Box;
    o.transform.position = {1.0f, 2.0f, 3.0f};
    o.material = Material::from_preset(MaterialPreset::Metallic, {0.8f, 0.2f, 0.1f, 1.0f});

    uint32_t id = scene.add_object(std::move(o));
    ASSERT_GT(id, 0u);
    ASSERT_EQ(scene.objects().size(), size_t{1});

    auto* found = scene.object(id);
    ASSERT_TRUE(found != nullptr);
    if (found) {
        ASSERT_EQ(found->name, std::string("TestBox"));
        ASSERT_NEAR(found->transform.position.x, 1.0f, 1e-5f);
        ASSERT_NEAR(found->transform.position.y, 2.0f, 1e-5f);
        ASSERT_NEAR(found->transform.position.z, 3.0f, 1e-5f);
        ASSERT_NEAR(found->material.metalness, 1.0f, 1e-5f);
    }
}

TEST_CASE(scene_multiple_objects_remove) {
    Scene scene;
    SceneObject a, b, c;
    a.geometry = GeometryType::Box;
    b.geometry = GeometryType::Sphere;
    c.geometry = GeometryType::Cylinder;
    uint32_t ida = scene.add_object(a);
    uint32_t idb = scene.add_object(b);
    uint32_t idc = scene.add_object(c);
    ASSERT_EQ(scene.objects().size(), size_t{3});
    ASSERT_TRUE(ida != idb && idb != idc && ida != idc);

    scene.remove_object(idb);
    ASSERT_EQ(scene.objects().size(), size_t{2});
    ASSERT_TRUE(scene.object(idb) == nullptr);
    ASSERT_TRUE(scene.object(ida) != nullptr);
    ASSERT_TRUE(scene.object(idc) != nullptr);

    // Removing a nonexistent id is a no-op.
    scene.remove_object(9999);
    ASSERT_EQ(scene.objects().size(), size_t{2});
}

TEST_CASE(scene_apply_lighting_estimate) {
    Scene scene;
    LightingEstimate est;
    est.direction_angle = 123.4f;
    est.elevation = 0.82f;
    est.brightness = 1.2f;
    est.light_color = {0.9f, 0.8f, 0.7f, 1.0f};
    est.ambient_color = {0.3f, 0.3f, 0.4f, 1.0f};
    est.contrast = 0.5f;

    scene.apply_lighting_estimate(est);

    ASSERT_NEAR(scene.light().angle, 123.4f, 1e-4f);
    ASSERT_NEAR(scene.light().elevation, 0.82f, 1e-4f);
    ASSERT_NEAR(scene.light().intensity, 1.2f * 1.5f, 1e-4f);
    ASSERT_NEAR(scene.light().color.r, 0.9f, 1e-4f);

    ASSERT_NEAR(scene.ambient_color().r, 0.3f, 1e-4f);
    ASSERT_NEAR(scene.ambient_intensity(), 1.2f * 0.35f, 1e-4f);
    ASSERT_NEAR(scene.shadow_opacity(), 0.5f * 0.6f, 1e-4f);
}

TEST_CASE(scene_snap_objects_to_surfaces) {
    Scene scene;

    // Add a surface (floor) at y=0.
    std::array<Vec2, 4> corners = {{
        {0.2f, 0.6f}, {0.8f, 0.6f},
        {0.9f, 0.9f}, {0.1f, 0.9f},
    }};
    auto plane = surface_from_corners(corners);
    plane.transform.position.y = 0.0f;
    plane.width = 10.0f;
    plane.depth = 10.0f;
    plane.active = true;
    scene.add_surface(plane);

    // Add a floating object well above the surface.
    SceneObject o;
    o.geometry = GeometryType::Box;
    o.transform.position = {0.0f, 5.0f, 0.0f};
    o.transform.scale = 1.0f;
    uint32_t id = scene.add_object(std::move(o));

    scene.snap_objects_to_surfaces();

    auto* obj = scene.object(id);
    ASSERT_TRUE(obj != nullptr);
    if (obj) {
        // Object should have been pulled down toward the floor.
        ASSERT_LT(obj->transform.position.y, 5.0f);
    }
}

TEST_CASE(scene_point_light_lifecycle) {
    Scene scene;
    PointLight pl;
    pl.position = {2.0f, 3.0f, 1.0f};
    pl.color = {1.0f, 0.5f, 0.2f, 1.0f};
    pl.intensity = 2.5f;
    pl.range = 15.0f;

    uint32_t id = scene.add_point_light(std::move(pl));
    ASSERT_GT(id, 0u);
    ASSERT_EQ(scene.point_lights().size(), size_t{1});

    auto* got = scene.point_light(id);
    ASSERT_TRUE(got != nullptr);
    if (got) {
        ASSERT_NEAR(got->position.y, 3.0f, 1e-5f);
        ASSERT_NEAR(got->intensity, 2.5f, 1e-5f);
    }

    scene.remove_point_light(id);
    ASSERT_EQ(scene.point_lights().size(), size_t{0});
    ASSERT_TRUE(scene.point_light(id) == nullptr);
}

TEST_CASE(scene_shadow_setters) {
    Scene scene;
    scene.set_shadow_opacity(0.42f);
    scene.set_shadow_softness(0.77f);
    scene.set_shadow_color({0.1f, 0.2f, 0.3f, 1.0f});
    ASSERT_NEAR(scene.shadow_opacity(), 0.42f, 1e-5f);
    ASSERT_NEAR(scene.shadow_softness(), 0.77f, 1e-5f);
    ASSERT_NEAR(scene.shadow_color().r, 0.1f, 1e-5f);
    ASSERT_NEAR(scene.shadow_color().g, 0.2f, 1e-5f);
    ASSERT_NEAR(scene.shadow_color().b, 0.3f, 1e-5f);
}

TEST_CASE(scene_material_presets) {
    auto matte = Material::from_preset(MaterialPreset::Matte);
    ASSERT_GT(matte.roughness, 0.8f);
    ASSERT_LT(matte.metalness, 0.1f);

    auto glossy = Material::from_preset(MaterialPreset::Glossy);
    ASSERT_LT(glossy.roughness, 0.3f);

    auto metal = Material::from_preset(MaterialPreset::Metallic);
    ASSERT_GT(metal.metalness, 0.9f);

    auto glass = Material::from_preset(MaterialPreset::Glass);
    ASSERT_GT(glass.transmission, 0.9f);
    ASSERT_NEAR(glass.ior, 1.5f, 1e-3f);

    auto plastic = Material::from_preset(MaterialPreset::Plastic);
    ASSERT_GT(plastic.clearcoat, 0.0f);
}
