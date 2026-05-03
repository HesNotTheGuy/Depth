import { describe, it, expect, beforeAll, vi } from 'vitest';
import { estimateLighting } from './lightingEstimator';

/**
 * jsdom does not implement canvas pixel readback. We stub HTMLCanvasElement and
 * the Image constructor so estimateLighting receives a synthetic ImageData
 * payload representing a known scene, then verify the analytic outputs
 * (luminance, color temperature, bright-spot detection).
 */

interface FakeImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

let nextImageData: FakeImageData | null = null;

function makeGradient(size: number, dir: 'left' | 'right' | 'top' | 'bottom'): FakeImageData {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let v = 0;
      if (dir === 'right') v = Math.round((x / (size - 1)) * 255);
      else if (dir === 'left') v = Math.round((1 - x / (size - 1)) * 255);
      else if (dir === 'bottom') v = Math.round((y / (size - 1)) * 255);
      else v = Math.round((1 - y / (size - 1)) * 255);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: size, height: size };
}

function makeBrightSpot(size: number, cx: number, cy: number, radius: number): FakeImageData {
  const data = new Uint8ClampedArray(size * size * 4);
  // Dark base
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 20; data[i + 1] = 20; data[i + 2] = 20; data[i + 3] = 255;
  }
  // Bright disc
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= radius * radius) {
        const i = (y * size + x) * 4;
        data[i] = 255; data[i + 1] = 240; data[i + 2] = 220; data[i + 3] = 255;
      }
    }
  }
  return { data, width: size, height: size };
}

beforeAll(() => {
  // Stub the Image constructor so onload fires synchronously.
  // @ts-expect-error - jsdom Image stub
  globalThis.Image = class {
    onload: (() => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    set src(_v: string) {
      // schedule onload in a microtask so the .onload assignment lands first
      queueMicrotask(() => this.onload?.());
    }
  };

  // Stub canvas.getContext('2d') to return our captured ImageData.
  HTMLCanvasElement.prototype.getContext = vi.fn(function (
    this: HTMLCanvasElement,
    type: string,
  ) {
    if (type !== '2d') return null;
    return {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => {
        if (!nextImageData) {
          // Default: midgray
          const size = 128;
          const data = new Uint8ClampedArray(size * size * 4);
          for (let i = 0; i < data.length; i += 4) {
            data[i] = 128; data[i + 1] = 128; data[i + 2] = 128; data[i + 3] = 255;
          }
          return { data, width: size, height: size };
        }
        return nextImageData;
      }),
    } as unknown as CanvasRenderingContext2D;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

describe('estimateLighting', () => {
  it('detects light coming from the right when the right side is brighter', async () => {
    nextImageData = makeGradient(128, 'right');
    const lighting = await estimateLighting('data:dummy');
    // Angle 0 = right; allow tolerance.
    expect(lighting.lightAngle).toBeGreaterThanOrEqual(0);
    expect(lighting.lightAngle).toBeLessThanOrEqual(45);
    expect(lighting.brightness).toBeGreaterThan(0);
    expect(lighting.brightness).toBeLessThanOrEqual(2);
  });

  it('detects high elevation when the top is brighter', async () => {
    nextImageData = makeGradient(128, 'top');
    const lighting = await estimateLighting('data:dummy');
    expect(lighting.lightElevation).toBeGreaterThan(0.6);
  });

  it('reports a bright spot near its true center', async () => {
    nextImageData = makeBrightSpot(128, 96, 32, 12); // upper-right area
    const lighting = await estimateLighting('data:dummy');
    expect(lighting.detectedLights.length).toBeGreaterThanOrEqual(1);
    const top = lighting.detectedLights[0];
    expect(top.x).toBeGreaterThan(0.55);
    expect(top.y).toBeLessThan(0.45);
    expect(top.intensity).toBeGreaterThan(0.5);
  });

  it('returns an empty bright-spot list for a very dark image', async () => {
    const size = 128;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 5; data[i + 1] = 5; data[i + 2] = 5; data[i + 3] = 255;
    }
    nextImageData = { data, width: size, height: size };
    const lighting = await estimateLighting('data:dummy');
    expect(lighting.detectedLights).toEqual([]);
  });

  it('produces a hex colorTemp string', async () => {
    nextImageData = makeGradient(128, 'top');
    const lighting = await estimateLighting('data:dummy');
    expect(lighting.colorTemp).toMatch(/^#[0-9a-f]{6}$/);
    expect(lighting.ambientColor).toMatch(/^#[0-9a-f]{6}$/);
  });
});
