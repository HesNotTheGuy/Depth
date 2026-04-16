/**
 * @file depth_embind.cpp
 * @brief Emscripten Embind bindings for a clean JS OOP API.
 *
 * Provides a JavaScript-friendly API:
 *
 *   const scene = new depth.Scene();
 *   scene.setBackground(rgbaUint8Array, 800, 600);
 *   const objId = scene.addObject(depth.GeometryType.Mug);
 *   scene.setObjectTransform(objId, 0, 0, 0, 0, 0, 0, 1.0);
 *   scene.setObjectMaterial(objId, depth.MaterialPreset.Glossy,
 *                           0.8, 0.2, 0.2, 0.3, 0.0);
 *   const pixels = scene.render(800, 600);
 *   // pixels is a Uint8Array of width*height*4 RGBA bytes
 */

#ifdef __EMSCRIPTEN__

#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "depth/depth.h"

#include <cstring>
#include <vector>

using namespace emscripten;
using namespace depth;

/**
 * JS-facing Scene wrapper. Keeps a C++ Scene internally and
 * translates between JS types and the C++ API.
 */
class DepthSceneJS {
public:
    DepthSceneJS() = default;

    void setBackground(const std::string& rgba_data, uint32_t width, uint32_t height) {
        auto img = Image::from_pixels(
            width, height, PixelFormat::RGBA8,
            reinterpret_cast<const uint8_t*>(rgba_data.data()));
        scene_.set_background(std::move(img));
    }

    uint32_t addObject(int geometry_type) {
        SceneObject obj;
        obj.geometry = static_cast<GeometryType>(geometry_type);
        obj.material = Material::from_preset(MaterialPreset::Matte);
        return scene_.add_object(std::move(obj));
    }

    void setObjectTransform(uint32_t id,
                            float px, float py, float pz,
                            float rx, float ry, float rz,
                            float scale) {
        auto* obj = scene_.object(id);
        if (!obj) return;
        obj->transform.position = {px, py, pz};
        obj->transform.rotation = {rx, ry, rz};
        obj->transform.scale = scale;
    }

    void setObjectMaterial(uint32_t id, int preset,
                           float r, float g, float b,
                           float roughness, float metalness) {
        auto* obj = scene_.object(id);
        if (!obj) return;
        obj->material = Material::from_preset(
            static_cast<MaterialPreset>(preset), {r, g, b, 1.0f});
        obj->material.roughness = roughness;
        obj->material.metalness = metalness;
    }

    void removeObject(uint32_t id) {
        scene_.remove_object(id);
    }

    void setLight(float angle, float elevation, float intensity,
                  float r, float g, float b) {
        auto& light = scene_.light();
        light.angle = angle;
        light.elevation = elevation;
        light.intensity = intensity;
        light.color = {r, g, b, 1.0f};
    }

    void setAmbient(float r, float g, float b, float intensity) {
        scene_.set_ambient_color({r, g, b, 1.0f});
        scene_.set_ambient_intensity(intensity);
    }

    void setShadow(float opacity, float softness) {
        scene_.set_shadow_opacity(opacity);
        scene_.set_shadow_softness(softness);
    }

    /**
     * Render to RGBA pixels and return as a JS Uint8Array.
     */
    val render(uint32_t width, uint32_t height) {
        RenderConfig config;
        config.width = width;
        config.height = height;
        config.backend = RendererBackend::Software;
        config.transparent_bg = false;

        auto renderer = Renderer::create(config);
        if (!renderer) {
            return val::null();
        }

        Image result;
        if (scene_.has_background()) {
            result = render_composite(*renderer, scene_);
        } else {
            result = renderer->render(scene_);
        }

        if (result.empty()) {
            return val::null();
        }

        size_t bytes = static_cast<size_t>(width) * height * 4;
        return val(typed_memory_view(bytes, result.data())).call<val>("slice");
    }

private:
    Scene scene_;
};

EMSCRIPTEN_BINDINGS(depth_module) {

    /* Geometry type enum */
    enum_<GeometryType>("GeometryType")
        .value("Box",      GeometryType::Box)
        .value("Cylinder", GeometryType::Cylinder)
        .value("Sphere",   GeometryType::Sphere)
        .value("Cone",     GeometryType::Cone)
        .value("Torus",    GeometryType::Torus)
        .value("Plane",    GeometryType::Plane)
        .value("Custom",   GeometryType::Custom)
        .value("Mug",      GeometryType::Mug)
        .value("Phone",    GeometryType::Phone)
        .value("Bottle",   GeometryType::Bottle)
        .value("Bag",      GeometryType::Bag)
        .value("Card",     GeometryType::Card)
        .value("Donut",    GeometryType::Donut)
        ;

    /* Material preset enum */
    enum_<MaterialPreset>("MaterialPreset")
        .value("Matte",    MaterialPreset::Matte)
        .value("Glossy",   MaterialPreset::Glossy)
        .value("Metallic", MaterialPreset::Metallic)
        .value("Glass",    MaterialPreset::Glass)
        .value("Plastic",  MaterialPreset::Plastic)
        ;

    /* Scene class */
    class_<DepthSceneJS>("Scene")
        .constructor<>()
        .function("setBackground",         &DepthSceneJS::setBackground)
        .function("addObject",             &DepthSceneJS::addObject)
        .function("setObjectTransform",    &DepthSceneJS::setObjectTransform)
        .function("setObjectMaterial",     &DepthSceneJS::setObjectMaterial)
        .function("removeObject",          &DepthSceneJS::removeObject)
        .function("setLight",              &DepthSceneJS::setLight)
        .function("setAmbient",            &DepthSceneJS::setAmbient)
        .function("setShadow",             &DepthSceneJS::setShadow)
        .function("render",                &DepthSceneJS::render)
        ;
}

#endif /* __EMSCRIPTEN__ */
