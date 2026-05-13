import { describe, it, expect } from 'vitest';
import {
  generateWoodGrainTexture,
  generateMarbleTexture,
  generateFabricTexture,
  generateLeatherTexture,
  generateBrushedMetalTexture,
} from './proceduralTextures';

/**
 * jsdom doesn't implement canvas pixel ops by default, so each generator
 * either returns a valid data URL (real canvas) or the SSR-safe fallback.
 * Either is acceptable — we only assert "non-empty data URL" and "no throw".
 */
function expectDataUrl(value: string) {
  expect(typeof value).toBe('string');
  expect(value.startsWith('data:image/')).toBe(true);
  expect(value.length).toBeGreaterThan(50);
}

describe('proceduralTextures', () => {
  it('generateWoodGrainTexture returns a data URL', () => {
    expectDataUrl(generateWoodGrainTexture(64, 64));
  });

  it('generateMarbleTexture returns a data URL', () => {
    expectDataUrl(generateMarbleTexture(64, 64));
  });

  it('generateFabricTexture returns a data URL', () => {
    expectDataUrl(generateFabricTexture(64, 64));
  });

  it('generateLeatherTexture returns a data URL', () => {
    expectDataUrl(generateLeatherTexture(64, 64));
  });

  it('generateBrushedMetalTexture returns a data URL', () => {
    expectDataUrl(generateBrushedMetalTexture(64, 64));
  });
});
