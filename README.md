# Depth

**Drop in a photo. Place a 3D object. The lighting just matches.**

Most designers don't need to learn Blender. They need a phone mockup on a desk, a product shot with the right shadow, a mug with their logo on it. Depth lets you do that in seconds. Upload a photo, pick an object, drag it into place. The lighting and shadows match your scene automatically. -- Work in progress!

<p align="center">
  <img src="docs/screenshots/upload.png" alt="Upload Screen" width="720" />
</p>

<p align="center">
  <img src="docs/screenshots/editor.png" alt="Editor with phone mockup on studio backdrop" width="720" />
</p>

---

## Repository Structure

```
depth/
├── sdk/          C++ SDK (embeddable compositing engine)
└── web/          Web prototype (React + Three.js demo app)
```

### [`sdk/`](./sdk) - C++ SDK (the engine)

The core technology: a zero-dependency C++ library for compositing 3D objects onto background images with automatic lighting estimation.

- **Lighting estimation** - analyzes a photo to estimate light direction, color temp, brightness
- **Surface detection** - define collision planes from drawn quads for realistic object placement
- **3D rendering** - software rasterizer with z-buffer, per-pixel shading, and triangle mesh support
- **OBJ mesh loading** - import Wavefront OBJ files with automatic normal computation
- **Compositing** - alpha-over blending with Normal, Multiply, Screen, and Overlay modes
- **C + C++ APIs** - clean C++ interface with a flat C API for FFI/embedding in any language

```cpp
// 5 lines to composite a 3D object onto a photo
Scene scene;
scene.set_background(Image::load("photo.jpg"));
scene.apply_lighting_estimate(estimate_lighting(scene.background()));
scene.add_object({.geometry = GeometryType::Box, .transform = {.position = {0, 0.5f, 0}}});
render_composite(*Renderer::create(), scene).save("output.png");
```

### [`web/`](./web) - Web Prototype

Interactive browser demo built with React 19, Three.js (React Three Fiber), Zustand, and Tailwind CSS v4.

- Upload a background photo → auto-analyze lighting
- Pick from 5 primitive shapes + 6 mockup objects (mug, phone, bottle, bag, card, donut)
- Choose material presets (matte, glossy, metal, glass, plastic) with color swatches
- Per-face texture placement - click a face, upload a label/logo, adjust UV
- Draw surface planes on the image for object collision/snapping
- Fine-tune lighting direction, height, shadow softness/color, and point lights
- Scene templates - one-click presets for common product shot setups
- Export composite as PNG at 1x/2x/4x resolution, or export layered passes

```bash
cd web && npm install && npm run dev
```

---

## Screenshots

| Upload | Editor | Materials |
|--------|--------|-----------|
| ![Upload](docs/screenshots/upload.png) | ![Editor](docs/screenshots/editor.png) | ![Materials](docs/screenshots/materials.png) |

| Lighting | Surfaces |
|----------|----------|
| ![Lighting](docs/screenshots/lighting.png) | ![Surfaces](docs/screenshots/surfaces.png) |

---

## Why Two Versions?

| | Web Prototype | C++ SDK |
|---|---|---|
| **Purpose** | Interactive demo, UX testing | Embeddable library, native performance |
| **Stack** | React + Three.js + TypeScript | C++20, zero dependencies |
| **Performance** | WebGL (~60-70% native) | Native GPU (Vulkan/Metal planned) |
| **Distribution** | URL, zero install | Static/dynamic library, C API |
| **Target** | End users (designers) | Developers, desktop apps, plugins |

The web app is the fastest way to try the idea. The C++ SDK is the production-grade version for apps that need native performance.

---

## Building

### SDK

```bash
cd sdk
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build
./build/tests/depth_tests      # run tests
./build/examples/depth_demo    # run demo
```

### Web

```bash
cd web
npm install
npm run dev     # development server
npm run build   # production build
```

---

## License

Depth is dual-licensed.

- **[AGPL-3.0](./LICENSE)** for open-source, personal, academic, and AGPL-compatible use.
- **[Commercial license](./COMMERCIAL.md)** for proprietary embedding, closed-source distribution, or hosted services that cannot meet AGPL requirements.

Forks and contributions are welcome under the AGPL. For commercial inquiries, see [COMMERCIAL.md](./COMMERCIAL.md).
