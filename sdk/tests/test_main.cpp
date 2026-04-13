#include <depth/depth.h>
#include <cassert>
#include <cstdio>
#include <cmath>

using namespace depth;

void test_color_from_hex() {
    auto c = Color::from_hex(0xFF8040);
    assert(std::abs(c.r - 1.0f) < 0.01f);
    assert(std::abs(c.g - 0.502f) < 0.01f);
    assert(std::abs(c.b - 0.251f) < 0.01f);
    printf("  PASS: Color::from_hex\n");
}

void test_image_creation() {
    Image img(64, 64, PixelFormat::RGBA8);
    assert(img.width() == 64);
    assert(img.height() == 64);
    assert(img.size_bytes() == 64 * 64 * 4);
    assert(!img.empty());

    auto px = img.pixel_at(0, 0);
    assert(px.r == 0.0f); // initialized to zero
    printf("  PASS: Image creation\n");
}

void test_surface_from_corners() {
    // Floor-like quad at bottom of image
    std::array<Vec2, 4> corners = {{
        {0.2f, 0.6f}, {0.8f, 0.6f},
        {0.9f, 0.9f}, {0.1f, 0.9f},
    }};
    auto plane = surface_from_corners(corners);
    assert(plane.width > 0);
    assert(plane.depth > 0);
    // Floor should have negative X rotation (tilted toward camera)
    assert(plane.transform.rotation.x < 0);
    printf("  PASS: surface_from_corners\n");
}

void test_snap_to_surface() {
    std::vector<SurfacePlane> surfaces;
    SurfacePlane floor;
    floor.transform.position = {0, 0, 0};
    floor.width = 10;
    floor.depth = 10;
    floor.active = true;
    surfaces.push_back(floor);

    Vec3 pos = {0, 5, 0};
    bool snapped = snap_to_surface(pos, 0.5f, surfaces);
    assert(snapped);
    assert(std::abs(pos.y - 0.5f) < 0.01f);
    printf("  PASS: snap_to_surface\n");
}

void test_scene_objects() {
    Scene scene;
    SceneObject obj;
    obj.name = "TestBox";
    obj.geometry = GeometryType::Box;
    uint32_t id = scene.add_object(std::move(obj));
    assert(id > 0);
    assert(scene.objects().size() == 1);

    auto* found = scene.object(id);
    assert(found != nullptr);
    assert(found->name == "TestBox");

    scene.remove_object(id);
    assert(scene.objects().empty());
    printf("  PASS: Scene object management\n");
}

void test_material_presets() {
    auto matte = Material::from_preset(MaterialPreset::Matte);
    assert(matte.roughness > 0.8f);
    assert(matte.metalness < 0.1f);

    auto metal = Material::from_preset(MaterialPreset::Metallic);
    assert(metal.metalness > 0.9f);

    auto glass = Material::from_preset(MaterialPreset::Glass);
    assert(glass.transmission > 0.9f);
    printf("  PASS: Material presets\n");
}

void test_lighting_estimate() {
    // Create a test image: brighter on the right side
    Image img(64, 64, PixelFormat::RGBA8);
    uint8_t* data = img.data();
    for (uint32_t y = 0; y < 64; y++) {
        for (uint32_t x = 0; x < 64; x++) {
            uint8_t brightness = static_cast<uint8_t>((x * 255) / 63);
            size_t off = (y * 64 + x) * 4;
            data[off + 0] = brightness;
            data[off + 1] = brightness;
            data[off + 2] = brightness;
            data[off + 3] = 255;
        }
    }

    auto est = estimate_lighting(img);
    assert(est.brightness > 0);
    // Light should be estimated roughly from the right (angle near 0 or 360)
    assert(est.direction_angle < 90 || est.direction_angle > 270);
    printf("  PASS: Lighting estimation\n");
}

void test_software_renderer() {
    Scene scene;
    SceneObject obj;
    obj.geometry = GeometryType::Sphere;
    obj.transform.position = {0, 0, 0};
    obj.material = Material::from_preset(MaterialPreset::Matte, Color::from_hex(0xFF0000));
    scene.add_object(std::move(obj));

    RenderConfig config;
    config.width = 128;
    config.height = 128;
    auto renderer = Renderer::create(config);
    assert(renderer != nullptr);
    assert(renderer->backend() == RendererBackend::Software);

    auto result = renderer->render(scene);
    assert(result.width() == 128);
    assert(result.height() == 128);
    assert(!result.empty());
    printf("  PASS: Software renderer\n");
}

void test_compositor() {
    Image bg(64, 64, PixelFormat::RGBA8);
    Image fg(64, 64, PixelFormat::RGBA8);

    // Fill bg with white
    for (size_t i = 0; i < bg.size_bytes(); i += 4) {
        bg.data()[i] = 255; bg.data()[i+1] = 255;
        bg.data()[i+2] = 255; bg.data()[i+3] = 255;
    }

    // Fill fg with semi-transparent red
    for (size_t i = 0; i < fg.size_bytes(); i += 4) {
        fg.data()[i] = 255; fg.data()[i+1] = 0;
        fg.data()[i+2] = 0; fg.data()[i+3] = 128;
    }

    auto result = composite(bg, fg);
    assert(result.width() == 64);
    auto px = result.pixel_at(32, 32);
    // Should be pinkish (red over white at ~50% alpha)
    assert(px.r > 0.9f);
    assert(px.g > 0.3f && px.g < 0.7f);
    printf("  PASS: Compositor\n");
}

int main() {
    printf("Depth SDK Tests\n");
    printf("================\n\n");

    test_color_from_hex();
    test_image_creation();
    test_surface_from_corners();
    test_snap_to_surface();
    test_scene_objects();
    test_material_presets();
    test_lighting_estimate();
    test_software_renderer();
    test_compositor();

    printf("\nAll tests passed.\n");
    return 0;
}
