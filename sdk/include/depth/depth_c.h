/**
 * @file depth_c.h
 * @brief C API for the Depth SDK.
 *
 * Plain C interface for embedding in any host application,
 * regardless of language or ABI. All C++ types are hidden
 * behind opaque handles.
 *
 * Usage:
 *   DepthScene* scene = depth_scene_create();
 *   depth_scene_set_background_file(scene, "photo.jpg");
 *   depth_scene_auto_lighting(scene);
 *   depth_scene_add_object(scene, DEPTH_GEOMETRY_BOX, 0, 0.5f, 0);
 *   depth_render_to_file(scene, "output.png", DEPTH_FORMAT_PNG);
 *   depth_scene_destroy(scene);
 */

#pragma once

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stddef.h>

/* Export macro */
#ifdef _WIN32
    #ifdef DEPTH_BUILDING_DLL
        #define DEPTH_API __declspec(dllexport)
    #else
        #define DEPTH_API __declspec(dllimport)
    #endif
#else
    #define DEPTH_API __attribute__((visibility("default")))
#endif

/* Opaque handles */
typedef struct DepthScene DepthScene;
typedef struct DepthRenderer DepthRenderer;
typedef struct DepthImage DepthImage;

/* Enums */
typedef enum {
    DEPTH_GEOMETRY_BOX = 0,
    DEPTH_GEOMETRY_CYLINDER,
    DEPTH_GEOMETRY_SPHERE,
    DEPTH_GEOMETRY_CONE,
    DEPTH_GEOMETRY_TORUS,
    DEPTH_GEOMETRY_PLANE,
    DEPTH_GEOMETRY_CUSTOM,
    DEPTH_GEOMETRY_MUG,
    DEPTH_GEOMETRY_PHONE,
    DEPTH_GEOMETRY_BOTTLE,
    DEPTH_GEOMETRY_BAG,
    DEPTH_GEOMETRY_CARD,
    DEPTH_GEOMETRY_DONUT,
} DepthGeometry;

typedef enum {
    DEPTH_MATERIAL_MATTE = 0,
    DEPTH_MATERIAL_GLOSSY,
    DEPTH_MATERIAL_METALLIC,
    DEPTH_MATERIAL_GLASS,
    DEPTH_MATERIAL_PLASTIC,
} DepthMaterial;

typedef enum {
    DEPTH_FORMAT_PNG = 0,
    DEPTH_FORMAT_JPEG,
    DEPTH_FORMAT_WEBP,
} DepthExportFormat;

typedef enum {
    DEPTH_OK = 0,
    DEPTH_ERR_INVALID_INPUT,
    DEPTH_ERR_FILE_NOT_FOUND,
    DEPTH_ERR_UNSUPPORTED_FORMAT,
    DEPTH_ERR_GPU,
    DEPTH_ERR_OUT_OF_MEMORY,
} DepthStatus;

/* Lighting estimate (returned by auto-lighting) */
typedef struct {
    float brightness;
    float direction_angle;
    float elevation;
    float light_r, light_g, light_b;
    float ambient_r, ambient_g, ambient_b;
    float contrast;
} DepthLightingEstimate;

/* ── Scene ─────────────────────────────────────────────── */

DEPTH_API DepthScene* depth_scene_create(void);
DEPTH_API void depth_scene_destroy(DepthScene* scene);

/* Background */
DEPTH_API DepthStatus depth_scene_set_background_file(DepthScene* scene, const char* path);
DEPTH_API DepthStatus depth_scene_set_background_pixels(
    DepthScene* scene, uint32_t w, uint32_t h, const uint8_t* rgba);

/* Auto-lighting from background */
DEPTH_API DepthLightingEstimate depth_scene_auto_lighting(DepthScene* scene);

/* Manual lighting */
DEPTH_API void depth_scene_set_light(
    DepthScene* scene, float angle, float elevation, float intensity,
    float r, float g, float b);

/* Objects */
DEPTH_API uint32_t depth_scene_add_object(
    DepthScene* scene, DepthGeometry geometry,
    float x, float y, float z);

DEPTH_API void depth_object_set_transform(
    DepthScene* scene, uint32_t id,
    float px, float py, float pz,
    float rx, float ry, float rz,
    float scale);

DEPTH_API void depth_object_set_material(
    DepthScene* scene, uint32_t id,
    DepthMaterial preset, float r, float g, float b, float roughness);

DEPTH_API void depth_object_set_metalness(
    DepthScene* scene, uint32_t id, float metalness);

DEPTH_API void depth_scene_remove_object(DepthScene* scene, uint32_t id);

/* Surfaces */
DEPTH_API uint32_t depth_scene_add_surface(
    DepthScene* scene,
    float x0, float y0, float x1, float y1,
    float x2, float y2, float x3, float y3);

DEPTH_API void depth_scene_snap_objects(DepthScene* scene);
DEPTH_API void depth_scene_remove_surface(DepthScene* scene, uint32_t id);

/* Shadow controls */
DEPTH_API void depth_set_shadow_opacity(DepthScene* scene, float opacity);
DEPTH_API void depth_set_shadow_softness(DepthScene* scene, float softness);
DEPTH_API void depth_set_shadow_color(DepthScene* scene, float r, float g, float b);

/* Point lights */
DEPTH_API uint32_t depth_add_point_light(
    DepthScene* scene,
    float x, float y, float z,
    float r, float g, float b, float intensity);

/* ── Rendering ─────────────────────────────────────────── */

DEPTH_API DepthRenderer* depth_renderer_create(uint32_t width, uint32_t height);
DEPTH_API void depth_renderer_destroy(DepthRenderer* renderer);

/* Render and export */
DEPTH_API DepthStatus depth_render_to_file(
    DepthScene* scene, const char* output_path,
    DepthExportFormat format);

DEPTH_API DepthStatus depth_render_to_buffer(
    DepthScene* scene,
    uint8_t** out_data, size_t* out_size,
    DepthExportFormat format);

/* Free buffer allocated by depth_render_to_buffer */
DEPTH_API void depth_free_buffer(uint8_t* data);

/* ── Version ───────────────────────────────────────────── */

DEPTH_API const char* depth_version(void);

#ifdef __cplusplus
}
#endif
