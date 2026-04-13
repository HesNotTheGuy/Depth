# Depth — Web Prototype

Interactive browser demo for the Depth compositing engine. Built with React, Three.js, and Tailwind CSS.

## Quick Start

```bash
npm install
npm run dev
```

## Stack

- React 19 + TypeScript
- Three.js via React Three Fiber
- Tailwind CSS v4
- Zustand (state management)
- Lucide React (icons)

## Features

- Upload background photo with automatic lighting analysis
- 5 primitive shapes (box, cylinder, sphere, cone, torus)
- 5 material presets (matte, glossy, metallic, glass, plastic)
- Draw surface planes on images for object collision/snapping
- Lighting controls with auto-estimate from background
- Export composite as PNG/WebP/JPEG with clipboard support
