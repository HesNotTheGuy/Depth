#include "depth/scene.h"
#include <algorithm>

namespace depth {

void Scene::set_background(const Image& image) {
    background_ = image;
}

void Scene::set_background(Image&& image) {
    background_ = std::move(image);
}

void Scene::apply_lighting_estimate(const LightingEstimate& estimate) {
    light_.angle = estimate.direction_angle;
    light_.elevation = estimate.elevation;
    light_.intensity = estimate.brightness * 1.5f;
    light_.color = estimate.light_color;
    ambient_color_ = estimate.ambient_color;
    ambient_intensity_ = estimate.brightness * 0.35f;
    shadow_opacity_ = estimate.contrast * 0.6f;
}

uint32_t Scene::add_object(SceneObject obj) {
    obj.id = next_id_++;
    objects_.push_back(std::move(obj));
    return objects_.back().id;
}

void Scene::remove_object(uint32_t id) {
    objects_.erase(
        std::remove_if(objects_.begin(), objects_.end(),
                        [id](const SceneObject& o) { return o.id == id; }),
        objects_.end());
}

SceneObject* Scene::object(uint32_t id) {
    for (auto& obj : objects_) {
        if (obj.id == id) return &obj;
    }
    return nullptr;
}

uint32_t Scene::add_surface(SurfacePlane surface) {
    surface.id = next_id_++;
    surfaces_.push_back(std::move(surface));
    return surfaces_.back().id;
}

void Scene::remove_surface(uint32_t id) {
    surfaces_.erase(
        std::remove_if(surfaces_.begin(), surfaces_.end(),
                        [id](const SurfacePlane& s) { return s.id == id; }),
        surfaces_.end());
}

SurfacePlane* Scene::surface(uint32_t id) {
    for (auto& s : surfaces_) {
        if (s.id == id) return &s;
    }
    return nullptr;
}

uint32_t Scene::add_point_light(PointLight pl) {
    pl.id = next_id_++;
    point_lights_.push_back(std::move(pl));
    return point_lights_.back().id;
}

void Scene::remove_point_light(uint32_t id) {
    point_lights_.erase(
        std::remove_if(point_lights_.begin(), point_lights_.end(),
                        [id](const PointLight& l) { return l.id == id; }),
        point_lights_.end());
}

PointLight* Scene::point_light(uint32_t id) {
    for (auto& l : point_lights_) {
        if (l.id == id) return &l;
    }
    return nullptr;
}

void Scene::snap_objects_to_surfaces() {
    for (auto& obj : objects_) {
        float half_h = obj.transform.scale * 0.5f; // approximate
        snap_to_surface(obj.transform.position, half_h, surfaces_);
    }
}

Material Material::from_preset(MaterialPreset preset, Color color) {
    Material mat;
    mat.preset = preset;
    mat.base_color = color;
    switch (preset) {
        case MaterialPreset::Matte:
            mat.roughness = 0.9f; mat.metalness = 0.0f; break;
        case MaterialPreset::Glossy:
            mat.roughness = 0.1f; mat.metalness = 0.0f; break;
        case MaterialPreset::Metallic:
            mat.roughness = 0.3f; mat.metalness = 1.0f; break;
        case MaterialPreset::Glass:
            mat.roughness = 0.05f; mat.metalness = 0.0f;
            mat.transmission = 1.0f; mat.ior = 1.5f; break;
        case MaterialPreset::Plastic:
            mat.roughness = 0.4f; mat.metalness = 0.0f;
            mat.clearcoat = 0.5f; break;
    }
    return mat;
}

} // namespace depth
