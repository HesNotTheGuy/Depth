/**
 * Procedural texture generators for the material library.
 *
 * Each function draws a tiling pattern onto an offscreen canvas and returns
 * a PNG data URL suitable for use as the global `texture` field on a scene
 * object. The patterns are deterministic per-call (seeded RNG) so that the
 * same material preset always produces the same texture.
 *
 * These are not photorealistic — they're hint-textures that pair with the
 * matching material parameters (roughness/metalness/etc.) to suggest the
 * surface type. Real HDRI / PBR maps are a future enhancement.
 */

/** Create a 2D canvas + context, falling back to a no-op shim under tests. */
function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

/** Mulberry32 — small deterministic PRNG so textures are stable across calls. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Clamp helper. */
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Empty 1x1 transparent PNG used as SSR-safe fallback. */
const FALLBACK_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';

export function generateWoodGrainTexture(width = 256, height = 256): string {
  const made = makeCanvas(width, height);
  if (!made) return FALLBACK_DATA_URL;
  const { canvas, ctx } = made;
  const rng = makeRng(0xC0FFEE);

  // Base warm-brown vertical gradient.
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#6b4322');
  grad.addColorStop(0.5, '#825632');
  grad.addColorStop(1, '#5a3818');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Stacked sine-wave "grain" rings with jitter for organic look.
  const rings = 32;
  for (let i = 0; i < rings; i++) {
    const yBase = (i / rings) * height;
    const amp = 4 + rng() * 8;
    const freq = 0.015 + rng() * 0.01;
    const phase = rng() * Math.PI * 2;
    const darkness = 0.15 + rng() * 0.25;
    ctx.strokeStyle = `rgba(40, 22, 8, ${darkness})`;
    ctx.lineWidth = 0.8 + rng() * 1.4;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 2) {
      const y = yBase + Math.sin(x * freq + phase) * amp + (rng() - 0.5) * 1.5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Sprinkle dark "pores" for grain detail.
  const pores = 600;
  for (let i = 0; i < pores; i++) {
    ctx.fillStyle = `rgba(30, 16, 6, ${0.15 + rng() * 0.35})`;
    ctx.fillRect(rng() * width, rng() * height, 1, 1 + rng() * 1.5);
  }
  return canvas.toDataURL('image/png');
}

export function generateMarbleTexture(width = 256, height = 256): string {
  const made = makeCanvas(width, height);
  if (!made) return FALLBACK_DATA_URL;
  const { canvas, ctx } = made;
  const rng = makeRng(0x3ABBA);

  // Cool off-white base.
  ctx.fillStyle = '#eef0f3';
  ctx.fillRect(0, 0, width, height);

  // Pixel-level turbulence noise -> faint mottling.
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() - 0.5) * 18;
    data[i] = clamp(data[i] + n, 0, 255);
    data[i + 1] = clamp(data[i + 1] + n, 0, 255);
    data[i + 2] = clamp(data[i + 2] + n + 1, 0, 255);
  }
  ctx.putImageData(img, 0, 0);

  // Veins: turbulent diagonal poly-lines with feathered stroke.
  const veins = 18;
  for (let v = 0; v < veins; v++) {
    const startX = rng() * width;
    const startY = rng() * height;
    const angle = (rng() - 0.5) * Math.PI * 1.5 + Math.PI / 4;
    const segs = 40;
    ctx.strokeStyle = `rgba(80, 90, 105, ${0.18 + rng() * 0.25})`;
    ctx.lineWidth = 0.6 + rng() * 1.6;
    ctx.beginPath();
    let x = startX;
    let y = startY;
    ctx.moveTo(x, y);
    for (let s = 0; s < segs; s++) {
      x += Math.cos(angle) * (width / segs) + (rng() - 0.5) * 6;
      y += Math.sin(angle) * (width / segs) + (rng() - 0.5) * 6;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return canvas.toDataURL('image/png');
}

export function generateFabricTexture(width = 256, height = 256): string {
  const made = makeCanvas(width, height);
  if (!made) return FALLBACK_DATA_URL;
  const { canvas, ctx } = made;
  const rng = makeRng(0xFAB21C);

  // Warm cotton base.
  ctx.fillStyle = '#d8cfbf';
  ctx.fillRect(0, 0, width, height);

  // Cross-hatched weave: horizontal + vertical thin lines with random gaps.
  const spacing = 4;
  ctx.lineWidth = 1;
  for (let y = 0; y < height; y += spacing) {
    ctx.strokeStyle = `rgba(120, 105, 85, ${0.22 + rng() * 0.1})`;
    ctx.beginPath();
    ctx.moveTo(0, y + (rng() - 0.5));
    ctx.lineTo(width, y + (rng() - 0.5));
    ctx.stroke();
  }
  for (let x = 0; x < width; x += spacing) {
    ctx.strokeStyle = `rgba(120, 105, 85, ${0.18 + rng() * 0.1})`;
    ctx.beginPath();
    ctx.moveTo(x + (rng() - 0.5), 0);
    ctx.lineTo(x + (rng() - 0.5), height);
    ctx.stroke();
  }

  // Fine pixel-level noise to break up uniformity.
  const img = ctx.getImageData(0, 0, width, height);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (rng() - 0.5) * 14;
    data[i] = clamp(data[i] + n, 0, 255);
    data[i + 1] = clamp(data[i + 1] + n, 0, 255);
    data[i + 2] = clamp(data[i + 2] + n, 0, 255);
  }
  ctx.putImageData(img, 0, 0);

  return canvas.toDataURL('image/png');
}

export function generateLeatherTexture(width = 256, height = 256): string {
  const made = makeCanvas(width, height);
  if (!made) return FALLBACK_DATA_URL;
  const { canvas, ctx } = made;
  const rng = makeRng(0x1EA73E);

  // Dark brown base.
  ctx.fillStyle = '#3a2418';
  ctx.fillRect(0, 0, width, height);

  // Voronoi-ish bumps: scatter slightly-overlapping radial gradients to fake
  // pebbled leather grain.
  const cells = 220;
  for (let i = 0; i < cells; i++) {
    const cx = rng() * width;
    const cy = rng() * height;
    const r = 4 + rng() * 8;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const light = 60 + rng() * 35;
    grad.addColorStop(0, `rgba(${light + 30}, ${light + 5}, ${light - 10}, 0.55)`);
    grad.addColorStop(1, 'rgba(40, 24, 16, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dark crease lines for realism.
  for (let i = 0; i < 80; i++) {
    ctx.strokeStyle = `rgba(15, 8, 4, ${0.25 + rng() * 0.2})`;
    ctx.lineWidth = 0.4 + rng() * 0.6;
    ctx.beginPath();
    const x0 = rng() * width;
    const y0 = rng() * height;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + (rng() - 0.5) * 30, y0 + (rng() - 0.5) * 30);
    ctx.stroke();
  }
  return canvas.toDataURL('image/png');
}

export function generateBrushedMetalTexture(width = 256, height = 256): string {
  const made = makeCanvas(width, height);
  if (!made) return FALLBACK_DATA_URL;
  const { canvas, ctx } = made;
  const rng = makeRng(0xBA1551);

  // Neutral silver gradient (slight vertical falloff to suggest curvature).
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#c8cad0');
  grad.addColorStop(0.5, '#d8dade');
  grad.addColorStop(1, '#a8aab0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Horizontal brush streaks via per-row noise lines.
  for (let y = 0; y < height; y++) {
    const alpha = 0.04 + rng() * 0.16;
    const shade = rng() < 0.5 ? 0 : 255;
    ctx.strokeStyle = `rgba(${shade},${shade},${shade}, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(width, y + 0.5);
    ctx.stroke();
  }

  // Longer horizontal scratches.
  for (let i = 0; i < 60; i++) {
    const y = rng() * height;
    const x0 = rng() * width;
    const len = 20 + rng() * 80;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 + rng() * 0.1})`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + len, y + (rng() - 0.5) * 0.5);
    ctx.stroke();
  }
  return canvas.toDataURL('image/png');
}
