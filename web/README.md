# Depth — Web App

Interactive browser app for the Depth compositing workflow. Built with React, Three.js, and Tailwind CSS.

## Quick Start

From the repo root (npm workspaces):

```bash
npm install
npm run dev:web
```

Or from this folder:

```bash
npm install
npm run dev
```

- Landing page: `http://localhost:5173/`
- Editor: `http://localhost:5173/app`

## Stack

- React 19 + TypeScript
- Three.js via React Three Fiber
- Tailwind CSS v4
- Zustand (state management)
- Lucide React (icons)

## Features

- Upload background photo with automatic lighting analysis
- Primitives + mockups (mug, phone, bottle, bag, card, laptop, tablet, can, book, donut)
- Material library (matte, glossy, metallic, glass, plastic, wood, marble, fabric, leather…)
- Draw surface planes for object collision/snapping
- HDRI environments + lighting controls with auto-estimate
- Named scene saves, templates, bulk variation export
- Export composite as PNG/WebP/JPEG with clipboard support
