#include "depth/depth_c.h"
#include "depth/depth.h"

#include <cstring>
#include <vector>

using namespace depth;

struct DepthScene {
    Scene scene;
};

struct DepthRenderer {
    std::unique_ptr<Renderer> renderer;
};

extern "C" {

const char* depth_version(void) {
    return "0.1.0";
}

/* ── Scene ─────────────────────────────────────────── */

DepthScene* depth_scene_create(void) {
    return new DepthScene();
}

void depth_scene_destroy(DepthScene* scene) {
    delete scene;
}

DepthStatus depth_scene_set_background_file(DepthScene* scene, const char* path) {
    if (!scene || !path) return DEPTH_ERR_INVALID_INPUT;
    Status st;
    auto img = Image::load(path, &st);
    if (st != Status::Ok) return static_cast<DepthStatus>(st);
    scene->scene.set_background(std::move(img));
    return DEPTH_OK;
}

DepthStatus depth_scene_set_background_pixels(
    DepthScene* scene, uint32_t w, uint32_t h, const uint8_t* rgba
) {
    if (!scene || !rgba) return DEPTH_ERR_INVALID_INPUT;
    auto img = Image::from_pixels(w, h, PixelFormat::RGBA8, rgba);
    scene->scene.set_background(std::move(img));
    return DEPTH_OK;
}

DepthLightingEstimate depth_scene_auto_lighting(DepthScene* scene) {
    DepthLightingEstimate out = {};
    if (!scene || !scene->scene.has_background()) return out;

    auto est = estimate_lighting(scene->scene.background());
    scene->scene.apply_lighting_estimate(est);

    out.brightness = est.brightness;
    out.direction_angle = est.direction_angle;
    out.elevation = est.elevation;
    out.light_r = est.light_color.r;
    out.light_g = est.light_color.g;
    out.light_b = est.light_color.b;
    out.ambient_r = est.ambient_color.r;
    out.ambient_g = est.ambient_color.g;
    out.ambient_b = est.ambient_color.b;
    out.contrast = est.contrast;
    return out;
}

void depth_scene_set_light(
    DepthScene* scene, float angle, float elevation, float intensity,
    float r, float g, float b
) {
    if (!scene) return;
    auto& light = scene->scene.light();
    light.angle = angle;
    light.elevation = elevation;
    light.intensity = intensity;
    light.color = {r, g, b, 1.0f};
}

uint32_t depth_scene_add_object(
    DepthScene* scene, DepthGeometry geometry,
    float x, float y, float z
) {
    if (!scene) return 0;
    SceneObject obj;
    obj.geometry = static_cast<GeometryType>(geometry);
    obj.transform.position = {x, y, z};
    obj.material = Material::from_preset(MaterialPreset::Matte);
    return scene->scene.add_object(std::move(obj));
}

void depth_object_set_transform(
    DepthScene* scene, uint32_t id,
    float px, float py, float pz,
    float rx, float ry, float rz,
    float scale
) {
    if (!scene) return;
    auto* obj = scene->scene.object(id);
    if (!obj) return;
    obj->transform.position = {px, py, pz};
    obj->transform.rotation = {rx, ry, rz};
    obj->transform.scale = scale;
}

void depth_object_set_material(
    DepthScene* scene, uint32_t id,
    DepthMaterial preset, float r, float g, float b, float roughness
) {
    if (!scene) return;
    auto* obj = scene->scene.object(id);
    if (!obj) return;
    obj->material = Material::from_preset(static_cast<MaterialPreset>(preset), {r, g, b, 1.0f});
    obj->material.roughness = roughness;
}

void depth_scene_remove_object(DepthScene* scene, uint32_t id) {
    if (scene) scene->scene.remove_object(id);
}

uint32_t depth_scene_add_surface(
    DepthScene* scene,
    float x0, float y0, float x1, float y1,
    float x2, float y2, float x3, float y3
) {
    if (!scene) return 0;
    std::array<Vec2, 4> corners = {{{x0, y0}, {x1, y1}, {x2, y2}, {x3, y3}}};
    auto plane = surface_from_corners(corners);
    return scene->scene.add_surface(std::move(plane));
}

void depth_scene_snap_objects(DepthScene* scene) {
    if (scene) scene->scene.snap_objects_to_surfaces();
}

void depth_scene_remove_surface(DepthScene* scene, uint32_t id) {
    if (scene) scene->scene.remove_surface(id);
}

/* ── Rendering ─────────────────────────────────────── */

DepthRenderer* depth_renderer_create(uint32_t width, uint32_t height) {
    RenderConfig config;
    config.width = width;
    config.height = height;
    auto r = new DepthRenderer();
    r->renderer = Renderer::create(config);
    return r;
}

void depth_renderer_destroy(DepthRenderer* renderer) {
    delete renderer;
}

DepthStatus depth_render_to_file(
    DepthScene* scene, const char* output_path,
    DepthExportFormat format
) {
    if (!scene || !output_path) return DEPTH_ERR_INVALID_INPUT;

    RenderConfig config;
    if (scene->scene.has_background()) {
        config.width = scene->scene.background().width();
        config.height = scene->scene.background().height();
    }
    auto renderer = Renderer::create(config);
    if (!renderer) return DEPTH_ERR_GPU;

    auto result = render_composite(*renderer, scene->scene);
    return static_cast<DepthStatus>(
        result.save(output_path, static_cast<ExportFormat>(format))
    );
}

DepthStatus depth_render_to_buffer(
    DepthScene* scene,
    uint8_t** out_data, size_t* out_size,
    DepthExportFormat format
) {
    if (!scene || !out_data || !out_size) return DEPTH_ERR_INVALID_INPUT;

    RenderConfig config;
    if (scene->scene.has_background()) {
        config.width = scene->scene.background().width();
        config.height = scene->scene.background().height();
    }
    auto renderer = Renderer::create(config);
    if (!renderer) return DEPTH_ERR_GPU;

    auto result = render_composite(*renderer, scene->scene);
    auto encoded = result.encode(static_cast<ExportFormat>(format));
    if (encoded.empty()) return DEPTH_ERR_GPU;

    *out_size = encoded.size();
    *out_data = new uint8_t[encoded.size()];
    std::memcpy(*out_data, encoded.data(), encoded.size());
    return DEPTH_OK;
}

void depth_free_buffer(uint8_t* data) {
    delete[] data;
}

} // extern "C"
