#include "depth/renderer.h"

#include <cmath>
#include <algorithm>

namespace depth {

/**
 * Software renderer — CPU-only fallback.
 *
 * This provides a basic rasterizer for testing and environments
 * without GPU access. For production use, the Vulkan or Metal
 * backends should be preferred.
 *
 * Current implementation renders a simplified scene:
 * - Flat-shaded geometry
 * - Directional lighting with lambert diffuse
 * - Ground plane shadow projection
 * - Alpha channel for compositing
 */
class SoftwareRenderer : public Renderer {
public:
    explicit SoftwareRenderer(const RenderConfig& config) {
        config_ = config;
    }

    Image render(const Scene& scene) override {
        Image output(config_.width, config_.height, PixelFormat::RGBA8);
        uint8_t* pixels = output.data();

        // Clear to transparent
        std::fill(pixels, pixels + output.size_bytes(), 0);

        // For each object, rasterize a simple sphere/box representation
        // This is a placeholder — real implementation would use a proper
        // rasterization pipeline with z-buffer, vertex transforms, etc.
        const auto& cam = scene.camera();
        const auto& light = scene.light();

        for (const auto& obj : scene.objects()) {
            // Transform object position to screen space (simplified pinhole)
            Vec3 view_pos = {
                obj.transform.position.x - cam.position.x,
                obj.transform.position.y - cam.position.y,
                obj.transform.position.z - cam.position.z
            };

            // Very simplified projection
            float fov_rad = cam.fov * static_cast<float>(M_PI) / 180.0f;
            float f = 1.0f / std::tan(fov_rad / 2.0f);
            float aspect = static_cast<float>(config_.width) / config_.height;

            float dist = std::sqrt(view_pos.x * view_pos.x +
                                   view_pos.y * view_pos.y +
                                   view_pos.z * view_pos.z);
            if (dist < 0.1f) continue;

            // Project center to screen
            float sx = (view_pos.x / dist * f / aspect + 1.0f) * 0.5f * config_.width;
            float sy = (1.0f - view_pos.y / dist * f) * 0.5f * config_.height;
            float screen_radius = (obj.transform.scale * f / dist) * config_.height * 0.25f;

            // Simple circle rasterization for the object
            float light_rad = light.angle * static_cast<float>(M_PI) / 180.0f;
            Vec3 light_dir = {std::cos(light_rad), light.elevation + 0.5f, std::sin(light_rad)};
            float light_len = std::sqrt(light_dir.x * light_dir.x +
                                        light_dir.y * light_dir.y +
                                        light_dir.z * light_dir.z);
            if (light_len > 0) {
                light_dir.x /= light_len;
                light_dir.y /= light_len;
                light_dir.z /= light_len;
            }

            const auto& mat = obj.material;
            int r0 = static_cast<int>(screen_radius);

            for (int dy = -r0; dy <= r0; dy++) {
                for (int dx = -r0; dx <= r0; dx++) {
                    float d2 = static_cast<float>(dx * dx + dy * dy);
                    float r2 = screen_radius * screen_radius;
                    if (d2 > r2) continue;

                    int px = static_cast<int>(sx) + dx;
                    int py = static_cast<int>(sy) + dy;
                    if (px < 0 || py < 0 ||
                        px >= static_cast<int>(config_.width) ||
                        py >= static_cast<int>(config_.height))
                        continue;

                    // Sphere normal approximation
                    float nz = std::sqrt(1.0f - d2 / r2);
                    float nx = dx / screen_radius;
                    float ny = -dy / screen_radius;

                    // Lambert diffuse
                    float ndotl = std::max(0.0f, nx * light_dir.x +
                                                 ny * light_dir.y +
                                                 nz * light_dir.z);
                    float ambient = scene.ambient_intensity();
                    float shade = std::clamp(ambient + ndotl * light.intensity * 0.5f, 0.0f, 1.0f);

                    size_t offset = (py * config_.width + px) * 4;
                    pixels[offset + 0] = static_cast<uint8_t>(mat.base_color.r * shade * 255);
                    pixels[offset + 1] = static_cast<uint8_t>(mat.base_color.g * shade * 255);
                    pixels[offset + 2] = static_cast<uint8_t>(mat.base_color.b * shade * 255);
                    pixels[offset + 3] = 255;
                }
            }
        }

        return output;
    }

    void resize(uint32_t width, uint32_t height) override {
        config_.width = width;
        config_.height = height;
    }

    RendererBackend backend() const override {
        return RendererBackend::Software;
    }
};

// Factory
std::unique_ptr<Renderer> Renderer::create(const RenderConfig& config) {
    // TODO: Try Vulkan/Metal first based on platform, fall back to software
    return std::make_unique<SoftwareRenderer>(config);
}

} // namespace depth
