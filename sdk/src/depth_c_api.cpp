/**
 * @file depth_c_api.cpp
 * @brief Flat C API implementation for WebAssembly builds.
 *
 * Wraps the C++ SDK into simple C functions that Emscripten
 * can export to JavaScript. Uses void* handles to hide C++
 * types from the C boundary.
 */

#include "depth/depth_c_api.h"
#include "depth/depth.h"

#include <cstring>
#include <vector>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define WASM_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define WASM_EXPORT
#endif

using namespace depth;

/* Internal scene wrapper */
struct WasmScene {
    Scene scene;
};

extern "C" {

/* ── Scene lifecycle ──────────────────────────────── */

WASM_EXPORT
void* depth_wasm_scene_create(void) {
    return new WasmScene();
}

WASM_EXPORT
void depth_wasm_scene_destroy(void* scene) {
    delete static_cast<WasmScene*>(scene);
}

/* ── Background ───────────────────────────────────── */

WASM_EXPORT
void depth_wasm_scene_set_background(
    void* scene, const uint8_t* pixels,
    uint32_t width, uint32_t height
) {
    if (!scene || !pixels) return;
    auto* s = static_cast<WasmScene*>(scene);
    auto img = Image::from_pixels(width, height, PixelFormat::RGBA8, pixels);
    s->scene.set_background(std::move(img));
}

/* ── Objects ──────────────────────────────────────── */

WASM_EXPORT
uint32_t depth_wasm_scene_add_object(void* scene, int geometry_type) {
    if (!scene) return 0;
    auto* s = static_cast<WasmScene*>(scene);
    SceneObject obj;
    obj.geometry = static_cast<GeometryType>(geometry_type);
    obj.material = Material::from_preset(MaterialPreset::Matte);
    return s->scene.add_object(std::move(obj));
}

WASM_EXPORT
void depth_wasm_scene_set_object_transform(
    void* scene, uint32_t id,
    float px, float py, float pz,
    float rx, float ry, float rz,
    float scale
) {
    if (!scene) return;
    auto* s = static_cast<WasmScene*>(scene);
    auto* obj = s->scene.object(id);
    if (!obj) return;
    obj->transform.position = {px, py, pz};
    obj->transform.rotation = {rx, ry, rz};
    obj->transform.scale = scale;
}

WASM_EXPORT
void depth_wasm_scene_set_object_material(
    void* scene, uint32_t id,
    int preset,
    float r, float g, float b,
    float roughness, float metalness
) {
    if (!scene) return;
    auto* s = static_cast<WasmScene*>(scene);
    auto* obj = s->scene.object(id);
    if (!obj) return;
    obj->material = Material::from_preset(
        static_cast<MaterialPreset>(preset), {r, g, b, 1.0f});
    obj->material.roughness = roughness;
    obj->material.metalness = metalness;
}

/* ── Rendering ────────────────────────────────────── */

WASM_EXPORT
uint8_t* depth_wasm_render(void* scene, uint32_t width, uint32_t height) {
    if (!scene || width == 0 || height == 0) return nullptr;
    auto* s = static_cast<WasmScene*>(scene);

    RenderConfig config;
    config.width = width;
    config.height = height;
    config.backend = RendererBackend::Software;
    config.transparent_bg = false;

    auto renderer = Renderer::create(config);
    if (!renderer) return nullptr;

    Image result;
    if (s->scene.has_background()) {
        result = render_composite(*renderer, s->scene);
    } else {
        result = renderer->render(s->scene);
    }

    if (result.empty()) return nullptr;

    /* The composite is sized to the background, which may differ from the
       requested dimensions. The contract is a width*height*4 buffer, so a
       mismatch must fail rather than read past the smaller allocation. */
    if (result.width() != width || result.height() != height) return nullptr;

    /* Copy pixel data to a new heap allocation the caller owns */
    size_t bytes = static_cast<size_t>(width) * height * 4;
    auto* out = new uint8_t[bytes];
    std::memcpy(out, result.data(), bytes);
    return out;
}

WASM_EXPORT
void depth_wasm_free_pixels(uint8_t* pixels) {
    delete[] pixels;
}

/* ── Utility ──────────────────────────────────────── */

WASM_EXPORT
const char* depth_wasm_version(void) {
    return "0.1.0-wasm";
}

} /* extern "C" */
