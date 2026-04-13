/**
 * Depth SDK — Minimal usage example
 *
 * Demonstrates the core workflow:
 * 1. Load a background image
 * 2. Auto-estimate lighting
 * 3. Add a 3D object
 * 4. Define a surface for placement
 * 5. Render the composite
 */

#include <depth/depth.h>
#include <cstdio>

int main(int argc, char* argv[]) {
    using namespace depth;

    printf("Depth SDK v%s\n\n", "0.1.0");

    // 1. Create a scene
    Scene scene;

    // 2. Load background (if provided)
    if (argc > 1) {
        Status st;
        auto bg = Image::load(argv[1], &st);
        if (st == Status::Ok) {
            scene.set_background(std::move(bg));
            printf("Loaded background: %s\n", argv[1]);

            // 3. Auto-estimate lighting from the image
            auto lighting = estimate_lighting(scene.background());
            scene.apply_lighting_estimate(lighting);
            printf("Lighting estimated:\n");
            printf("  Brightness:  %.2f\n", lighting.brightness);
            printf("  Direction:   %.0f degrees\n", lighting.direction_angle);
            printf("  Elevation:   %.2f\n", lighting.elevation);
            printf("  Contrast:    %.2f\n", lighting.contrast);
        } else {
            printf("Could not load background (image I/O not yet implemented)\n");
        }
    }

    // 4. Add a 3D object
    SceneObject obj;
    obj.name = "Box";
    obj.geometry = GeometryType::Box;
    obj.transform.position = {0.0f, 0.5f, 0.0f};
    obj.transform.scale = 1.0f;
    obj.material = Material::from_preset(MaterialPreset::Metallic, Color::from_hex(0x6C63FF));
    uint32_t obj_id = scene.add_object(std::move(obj));
    printf("\nAdded object: id=%u\n", obj_id);

    // 5. Define a ground surface
    std::array<Vec2, 4> ground_corners = {{
        {0.1f, 0.6f},  // top-left
        {0.9f, 0.6f},  // top-right
        {0.95f, 0.95f}, // bottom-right
        {0.05f, 0.95f}, // bottom-left
    }};
    auto ground = surface_from_corners(ground_corners);
    uint32_t surface_id = scene.add_surface(std::move(ground));
    printf("Added surface: id=%u\n", surface_id);

    // 6. Snap object to the surface
    scene.snap_objects_to_surfaces();
    auto* placed_obj = scene.object(obj_id);
    if (placed_obj) {
        printf("Object snapped to Y=%.2f\n", placed_obj->transform.position.y);
    }

    // 7. Render
    RenderConfig config;
    config.width = 800;
    config.height = 600;
    auto renderer = Renderer::create(config);
    printf("\nRenderer backend: Software\n");

    Image result = render_composite(*renderer, scene);
    printf("Rendered: %ux%u (%zu bytes)\n", result.width(), result.height(), result.size_bytes());

    // 8. Save (once stb_image_write is integrated)
    // result.save("output.png");

    printf("\nDone. (File I/O requires stb_image integration — see TODO in image.cpp)\n");
    return 0;
}
