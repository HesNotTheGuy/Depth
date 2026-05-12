/**
 * Color sampling utilities for the eyedropper feature.
 */

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Cache of (imageUrl -> { canvas, width, height }) so we don't redraw on every pick.
 */
const imageCache = new Map<
  string,
  { canvas: HTMLCanvasElement; width: number; height: number }
>();

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for color sampling'));
    img.src = url;
  });
}

async function getCachedCanvas(imageUrl: string) {
  const cached = imageCache.get(imageUrl);
  if (cached) return cached;
  const img = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.drawImage(img, 0, 0);
  const entry = { canvas, width: img.naturalWidth, height: img.naturalHeight };
  imageCache.set(imageUrl, entry);
  return entry;
}

/**
 * Sample a single pixel from `imageUrl` at integer image coords (x, y).
 * Returns a `#rrggbb` hex string. Out-of-bounds coords are clamped.
 */
export async function pickColorFromImage(
  imageUrl: string,
  x: number,
  y: number,
): Promise<string> {
  const { canvas, width, height } = await getCachedCanvas(imageUrl);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  const cx = Math.max(0, Math.min(width - 1, Math.round(x)));
  const cy = Math.max(0, Math.min(height - 1, Math.round(y)));
  const data = ctx.getImageData(cx, cy, 1, 1).data;
  return rgbToHex(data[0], data[1], data[2]);
}

/** Clear cached canvases — useful when the background image changes. */
export function clearColorPickerCache(): void {
  imageCache.clear();
}
