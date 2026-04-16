/**
 * @file depth_c_api.h
 * @brief Flat C API for WebAssembly / Emscripten builds.
 *
 * This is a minimal, WASM-friendly API designed for direct use
 * from JavaScript via cwrap/ccall. All functions are prefixed
 * with depth_wasm_ to avoid collisions with the full C API.
 *
 * Usage from JS (after loading the WASM module):
 *
 *   const scene = Module._depth_wasm_scene_create();
 *   const bg = Module._malloc(w * h * 4);
 *   Module.HEAPU8.set(rgbaBytes, bg);
 *   Module._depth_wasm_scene_set_background(scene, bg, w, h);
 *   Module._free(bg);
 *
 *   const objId = Module._depth_wasm_scene_add_object(scene, 7); // Mug
 *   Module._depth_wasm_scene_set_object_transform(scene, objId,
 *       0, 0, 0,  0, 0, 0,  1.0);
 *
 *   const pixels = Module._depth_wasm_render(scene, 800, 600);
 *   // pixels is a pointer into WASM heap — read w*h*4 bytes
 *   Module._depth_wasm_free_pixels(pixels);
 *   Module._depth_wasm_scene_destroy(scene);
 */

#pragma once

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>

/* ── Scene lifecycle ──────────────────────────────────── */

/**
 * Create a new empty scene.
 * @return Opaque scene handle (never null).
 */
void* depth_wasm_scene_create(void);

/**
 * Destroy a scene and free all associated resources.
 */
void depth_wasm_scene_destroy(void* scene);

/* ── Background ───────────────────────────────────────── */

/**
 * Set the background image from raw RGBA pixel data.
 *
 * @param scene   Scene handle.
 * @param pixels  Pointer to width*height*4 bytes of RGBA data.
 * @param width   Image width in pixels.
 * @param height  Image height in pixels.
 */
void depth_wasm_scene_set_background(
    void* scene, const uint8_t* pixels,
    uint32_t width, uint32_t height);

/* ── Objects ──────────────────────────────────────────── */

/**
 * Add a 3D object to the scene.
 *
 * @param scene          Scene handle.
 * @param geometry_type  Geometry enum (0=Box, 1=Cylinder, 2=Sphere,
 *                       3=Cone, 4=Torus, 5=Plane, 7=Mug, 8=Phone,
 *                       9=Bottle, 10=Bag, 11=Card).
 * @return               Object ID (non-zero on success).
 */
uint32_t depth_wasm_scene_add_object(void* scene, int geometry_type);

/**
 * Set an object's position, rotation, and scale.
 *
 * @param scene  Scene handle.
 * @param id     Object ID returned by add_object.
 * @param px,py,pz  Position.
 * @param rx,ry,rz  Rotation (euler angles in radians).
 * @param scale     Uniform scale.
 */
void depth_wasm_scene_set_object_transform(
    void* scene, uint32_t id,
    float px, float py, float pz,
    float rx, float ry, float rz,
    float scale);

/**
 * Set an object's material.
 *
 * @param scene     Scene handle.
 * @param id        Object ID.
 * @param preset    Material preset (0=Matte, 1=Glossy, 2=Metallic,
 *                  3=Glass, 4=Plastic).
 * @param r,g,b     Base color (0-1).
 * @param roughness Roughness (0-1).
 * @param metalness Metalness (0-1).
 */
void depth_wasm_scene_set_object_material(
    void* scene, uint32_t id,
    int preset,
    float r, float g, float b,
    float roughness, float metalness);

/* ── Rendering ────────────────────────────────────────── */

/**
 * Render the scene to an RGBA pixel buffer.
 *
 * @param scene   Scene handle.
 * @param width   Output width in pixels.
 * @param height  Output height in pixels.
 * @return        Pointer to width*height*4 bytes of RGBA data,
 *                allocated on the WASM heap. Caller must free
 *                with depth_wasm_free_pixels().
 *                Returns NULL on failure.
 */
uint8_t* depth_wasm_render(void* scene, uint32_t width, uint32_t height);

/**
 * Free a pixel buffer returned by depth_wasm_render().
 */
void depth_wasm_free_pixels(uint8_t* pixels);

/* ── Utility ──────────────────────────────────────────── */

/**
 * Get the SDK version string.
 */
const char* depth_wasm_version(void);

#ifdef __cplusplus
}
#endif
