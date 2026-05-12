import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rgbToHex, pickColorFromImage, clearColorPickerCache } from './colorPicker';

describe('rgbToHex', () => {
  it('formats basic colors', () => {
    expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
    expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
    expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
    expect(rgbToHex(0, 0, 0)).toBe('#000000');
    expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
  });

  it('pads single hex digits', () => {
    expect(rgbToHex(1, 2, 3)).toBe('#010203');
    expect(rgbToHex(15, 16, 17)).toBe('#0f1011');
  });

  it('rounds floats and clamps out-of-range values', () => {
    expect(rgbToHex(127.4, 128.4, 200.5)).toBe('#7f80c9');
    expect(rgbToHex(-10, 300, 128)).toBe('#00ff80');
  });
});

describe('pickColorFromImage', () => {
  beforeEach(() => {
    clearColorPickerCache();
  });

  it('returns hex from sampled pixel using a mocked canvas', async () => {
    // Mock Image to fire onload immediately.
    class MockImg {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = '';
      naturalWidth = 100;
      naturalHeight = 100;
      set src(_v: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    vi.stubGlobal('Image', MockImg as unknown as typeof Image);

    // Mock getContext to return a fake context returning red pixels.
    const fakeCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([200, 100, 50, 255]) })),
    };
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => fakeCtx) as never;

    try {
      const hex = await pickColorFromImage('data:image/png;base64,fake', 10, 20);
      expect(hex).toBe('#c86432');
      expect(fakeCtx.getImageData).toHaveBeenCalledWith(10, 20, 1, 1);
    } finally {
      HTMLCanvasElement.prototype.getContext = origGetContext;
      vi.unstubAllGlobals();
    }
  });

  it('clamps coordinates to image bounds', async () => {
    class MockImg {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = '';
      naturalWidth = 50;
      naturalHeight = 50;
      set src(_v: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    vi.stubGlobal('Image', MockImg as unknown as typeof Image);

    const fakeCtx = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) })),
    };
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => fakeCtx) as never;

    try {
      await pickColorFromImage('data:image/png;base64,bounds', 999, -50);
      expect(fakeCtx.getImageData).toHaveBeenCalledWith(49, 0, 1, 1);
    } finally {
      HTMLCanvasElement.prototype.getContext = origGetContext;
      vi.unstubAllGlobals();
    }
  });
});
