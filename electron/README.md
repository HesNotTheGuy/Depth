# Depth Electron

Desktop shell for Depth. Wraps the web UI (`web/dist`) and spawns a native
C++ sidecar (`depth_sidecar`, built from `sdk/`) for high-quality offline
renders.

## Architecture

```
main process (Node)
  ├── spawns: depth_sidecar (C++ binary, JSON-line protocol over stdin/stdout)
  ├── exposes: window.depth via contextBridge (preload.ts)
  └── loads: web/dist/index.html as the renderer
```

The interactive Three.js viewport stays in the renderer. The sidecar only
kicks in for export-quality renders and layered exports.

## Dev workflow

From the **repo root**:

```bash
# 1. Build the web app once (or run `npm --workspace web run dev` in another shell)
npm --workspace web run build

# 2. Build the sidecar
cmake -S sdk -B sdk/build -DDEPTH_BUILD_EXAMPLES=OFF -DDEPTH_BUILD_TESTS=OFF
cmake --build sdk/build --target depth_sidecar --config Release

# 3. Launch Electron
npm --workspace electron run dev
```

Or use the convenience script: `npm run dev` (parallel web + electron).

## Build a distributable

```bash
npm run build       # builds web + sidecar + electron
npm run package     # runs electron-builder for the current platform
```

Outputs land in `electron/release/`.

## IPC surface

`window.depth` (defined in `src/preload.ts`):

- `getStatus(): Promise<{ ready, version }>`
- `render(scene): Promise<{ png: base64 }>`
- `exportLayered(scene): Promise<{ composite, foreground, shadow }>`

The web app should feature-detect via `typeof window.depth !== 'undefined'`
and fall back to the in-browser canvas pipeline when running in a regular
browser tab.

## Files

- `src/main.ts` — Electron main process; window + IPC + sidecar lifecycle.
- `src/preload.ts` — contextBridge surface (`window.depth`).
- `src/sidecar.ts` — child process manager, newline-delimited JSON protocol.
- `electron-builder.yml` — packaging config for win/mac/linux.
