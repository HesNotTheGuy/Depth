/**
 * @file scene.h
 * @brief Scene graph — objects, camera, and lights.
 *
 * A Scene holds everything needed to render a composite:
 * background plate, 3D objects, surface planes, camera, and lights.
 * The Renderer consumes a Scene to produce output.
 */

#pragma once

#include "depth/types.h"
#include "depth/image.h"
#include "depth/lighting.h"
#include "depth/surface.h"
#include <memory>
#include <string>
#include <vector>

namespace depth {

/**
 * Material definition for a 3D object.
 */
struct Material {
    MaterialPreset preset = MaterialPreset::Matte;
    Color base_color = Color::white();
    float roughness = 0.7f;
    float metalness = 0.0f;

    // Physical material extras (glass, plastic)
    float transmission = 0.0f;  // 0 = opaque, 1 = fully transparent
    float clearcoat = 0.0f;
    float ior = 1.5f;           // index of refraction

    /// Optional texture map (albedo). Null = use base_color.
    std::shared_ptr<Image> texture;

    /// Create from a preset with sensible defaults.
    static Material from_preset(MaterialPreset preset, Color color = Color::white());
};

/**
 * A 3D object in the scene.
 */
struct SceneObject {
    uint32_t id = 0;
    std::string name;
    GeometryType geometry = GeometryType::Box;
    Transform transform;
    Material material;

    /// Custom mesh data path (only used when geometry == Custom)
    std::string mesh_path;
};

/**
 * Camera definition.
 */
struct Camera {
    Vec3 position = {2.0f, 1.5f, 2.0f};
    Vec3 target = {0, 0, 0};
    float fov = 45.0f;        // vertical field of view in degrees
    float near_clip = 0.1f;
    float far_clip = 50.0f;
};

/**
 * A directional light in the scene.
 */
struct DirectionalLight {
    float angle = 45.0f;       // horizontal angle in degrees
    float elevation = 0.6f;    // [0, 1]
    float intensity = 1.5f;
    Color color = Color::white();
    bool cast_shadows = true;
};

/**
 * The complete scene description.
 *
 * This is the primary input to the Renderer. Build a Scene,
 * pass it to Renderer::render(), get a composited image back.
 */
class Scene {
public:
    Scene() = default;

    /// Set the background plate image.
    void set_background(const Image& image);
    void set_background(Image&& image);
    const Image& background() const { return background_; }
    bool has_background() const { return !background_.empty(); }

    /// Apply auto-estimated lighting from the background.
    void apply_lighting_estimate(const LightingEstimate& estimate);

    // Objects
    uint32_t add_object(SceneObject obj);
    void remove_object(uint32_t id);
    SceneObject* object(uint32_t id);
    const std::vector<SceneObject>& objects() const { return objects_; }

    // Surfaces
    uint32_t add_surface(SurfacePlane surface);
    void remove_surface(uint32_t id);
    SurfacePlane* surface(uint32_t id);
    const std::vector<SurfacePlane>& surfaces() const { return surfaces_; }

    /// Snap all objects to their nearest surface below.
    void snap_objects_to_surfaces();

    // Camera
    Camera& camera() { return camera_; }
    const Camera& camera() const { return camera_; }

    // Lights
    DirectionalLight& light() { return light_; }
    const DirectionalLight& light() const { return light_; }

    // Ambient
    Color ambient_color() const { return ambient_color_; }
    void set_ambient_color(Color c) { ambient_color_ = c; }
    float ambient_intensity() const { return ambient_intensity_; }
    void set_ambient_intensity(float i) { ambient_intensity_ = i; }

    // Shadow
    float shadow_opacity() const { return shadow_opacity_; }
    void set_shadow_opacity(float o) { shadow_opacity_ = o; }

private:
    Image background_;
    std::vector<SceneObject> objects_;
    std::vector<SurfacePlane> surfaces_;
    Camera camera_;
    DirectionalLight light_;
    Color ambient_color_ = {0.4f, 0.4f, 0.4f, 1.0f};
    float ambient_intensity_ = 0.35f;
    float shadow_opacity_ = 0.5f;
    uint32_t next_id_ = 1;
};

} // namespace depth
