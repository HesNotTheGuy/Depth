# Depth SDK

C++ library for compositing 3D objects onto 2D images with automatic lighting matching.

## Features

- **Lighting Estimation** — Analyze a background image to estimate light direction, color temperature, brightness, and shadow characteristics
- **Surface Detection** — Define collision planes from 2D image coordinates for realistic object placement
- **3D Rendering** — Software renderer (CPU) with Vulkan/Metal GPU backends planned
- **Compositing** — Alpha-over blending with Normal, Multiply, Screen, and Overlay modes
- **C & C++ APIs** — Clean C++ interface with a flat C API (`depth_c.h`) for FFI/embedding

## Quick Start

### C++ API

```cpp
#include <depth/depth.h>

using namespace depth;

Scene scene;

// Load background and estimate lighting
auto bg = Image::load("photo.jpg");
scene.set_background(bg);
scene.apply_lighting_estimate(estimate_lighting(bg));

// Add a 3D object
SceneObject obj;
obj.geometry = GeometryType::Box;
obj.transform.position = {0, 0.5f, 0};
obj.material = Material::from_preset(MaterialPreset::Metallic, Color::from_hex(0x6C63FF));
scene.add_object(obj);

// Define a ground surface and snap the object to it
auto ground = surface_from_corners({{{0.1f,0.6f}, {0.9f,0.6f}, {0.9f,0.9f}, {0.1f,0.9f}}});
scene.add_surface(ground);
scene.snap_objects_to_surfaces();

// Render composite
auto renderer = Renderer::create({1920, 1080});
auto result = render_composite(*renderer, scene);
result.save("output.png");
```

### C API

```c
#include <depth/depth_c.h>

DepthScene* scene = depth_scene_create();
depth_scene_set_background_file(scene, "photo.jpg");
depth_scene_auto_lighting(scene);
depth_scene_add_object(scene, DEPTH_GEOMETRY_BOX, 0, 0.5f, 0);
depth_render_to_file(scene, "output.png", DEPTH_FORMAT_PNG);
depth_scene_destroy(scene);
```

## Building

```bash
cd sdk
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build
```

### Options

| CMake Option | Default | Description |
|---|---|---|
| `DEPTH_BUILD_EXAMPLES` | `ON` | Build example applications |
| `DEPTH_BUILD_TESTS` | `ON` | Build test suite |
| `DEPTH_SHARED_LIBS` | `OFF` | Build as shared library (.dll/.so/.dylib) |

### Run tests

```bash
./build/tests/depth_tests
```

### Run demo

```bash
./build/examples/depth_demo [background.jpg]
```

## Architecture

```
include/depth/
  depth.h          — Main include (pulls in everything)
  depth_c.h        — C API for FFI/embedding
  types.h          — Core types (Vec3, Color, Transform, enums)
  image.h          — Image buffer (load, save, pixel access)
  lighting.h       — Lighting estimation from images
  surface.h        — Surface plane detection and collision
  scene.h          — Scene graph (objects, camera, lights)
  renderer.h       — Abstract renderer (Software, Vulkan, Metal)
  compositor.h     — Layer compositing (3D over background)

src/
  lighting/        — Lighting estimator implementation
  surface/         — Surface math and collision
  renderer/        — Renderer backends
  compositor/      — Image compositing
  io/              — Image I/O
```

## Integration

The SDK is designed for embedding into existing applications:

1. **Static linking** — `#include <depth/depth.h>`, link against `libdepth.a`
2. **Dynamic linking** — Build with `-DDEPTH_SHARED_LIBS=ON`, link against `depth.dll`/`libdepth.so`
3. **C FFI** — Use `depth_c.h` from any language (Python, C#, Swift, etc.)

## Dependencies

**Current:** None (zero external dependencies). The SDK uses only the C++ standard library.

**Planned:** `stb_image` / `stb_image_write` for file I/O (header-only, vendored).

## Roadmap

- [ ] stb_image integration for PNG/JPEG/WebP file I/O
- [ ] Vulkan renderer backend
- [ ] Metal renderer backend
- [ ] Custom mesh loading (OBJ/glTF)
- [ ] Shadow mapping
- [ ] Environment map / IBL support
