/**
 * @file renderer.h
 * @brief 3D renderer — renders scene objects to an image buffer.
 *
 * The Renderer produces an RGBA image of the 3D objects only
 * (with transparent background). The Compositor then layers
 * this over the background plate.
 *
 * The renderer abstraction supports multiple backends:
 * - Vulkan (Windows, Linux)
 * - Metal (macOS, iOS)
 * - Software (fallback, CPU-only)
 */

#pragma once

#include "depth/types.h"
#include "depth/image.h"
#include "depth/scene.h"
#include <memory>

namespace depth {

/**
 * Renderer backend selection.
 */
enum class RendererBackend : uint8_t {
    Auto,       // Pick best available
    Vulkan,
    Metal,
    Software,   // CPU fallback — always available
};

/**
 * Render output configuration.
 */
struct RenderConfig {
    uint32_t width = 1920;
    uint32_t height = 1080;
    uint32_t samples = 4;          // MSAA sample count
    bool transparent_bg = true;    // Render with alpha for compositing
    RendererBackend backend = RendererBackend::Auto;
};

/**
 * Abstract renderer interface.
 *
 * Use Renderer::create() to get a backend-appropriate instance.
 */
class Renderer {
public:
    virtual ~Renderer() = default;

    /**
     * Create a renderer with the best available backend.
     *
     * @param config  Render configuration.
     * @return        Renderer instance, or nullptr on failure.
     */
    static std::unique_ptr<Renderer> create(const RenderConfig& config = {});

    /**
     * Render the 3D objects in the scene to an RGBA image.
     *
     * The output image has a transparent background — it contains
     * only the rendered 3D objects, shadows, and reflections.
     * Use Compositor to layer this over the background plate.
     *
     * @param scene   The scene to render.
     * @return        Rendered RGBA image.
     */
    virtual Image render(const Scene& scene) = 0;

    /**
     * Resize the render target.
     */
    virtual void resize(uint32_t width, uint32_t height) = 0;

    /**
     * Get the active backend.
     */
    virtual RendererBackend backend() const = 0;

protected:
    Renderer() = default;
    RenderConfig config_;
};

} // namespace depth
