# Depth — Figma Plugin

Open [Depth](https://depth.app) inside Figma, build a 3D mockup, and drop the
exported PNG straight onto your canvas as an image layer.

## What it does

- Launches the Depth web editor inside a 1200x800 resizable Figma UI.
- When you hit Export inside Depth, the PNG is posted back to the plugin and
  inserted at your current viewport center as a selected image node.
- No round-trips through disk — the export never touches the user's downloads.

## Install locally

1. `npm install` in this directory.
2. `npm run build` to compile `code.ts` -> `code.js`.
3. In Figma desktop: **Plugins -> Development -> Import plugin from manifest**,
   then pick `figma-plugin/manifest.json`.
4. Run **Plugins -> Development -> Depth - 3D Mockups**.

During development the plugin loads `http://localhost:5173/app?embed=figma`, so
keep the Depth web app running (`npm run dev` in `web/`).

## Build

```sh
npm install
npm run build      # one-shot compile
npm run watch      # incremental
```

## TODO before publishing

- Swap the iframe URL in `ui.html` from `http://localhost:5173/app?embed=figma`
  to the production URL (e.g. `https://depth.app/app?embed=figma`).
- Tighten `networkAccess.allowedDomains` in `manifest.json` to the production
  host(s) only.
- Add a plugin icon + cover art.
- Fill out the Figma community listing copy.

## How the export handshake works

1. Plugin UI (`ui.html`) embeds the Depth web app with `?embed=figma`.
2. Depth detects the query param at module load and switches its export path.
3. On export, Depth calls
   `window.parent.postMessage({ type: 'depth-export', png, width, height }, '*')`
   instead of triggering a file download.
4. `ui.html` relays the payload to the plugin main thread as
   `{ type: 'insert-image', bytes, width, height }`.
5. `code.ts` creates an image fill on a rectangle and drops it at viewport center.
