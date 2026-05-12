import { describe, it, expect } from 'vitest';
import {
  cartesianIndices,
  totalVariations,
  dimensionCount,
  buildVariationSuffix,
  comboFromIndices,
  type VariationDimension,
} from './bulkExport';

describe('cartesianIndices', () => {
  it('yields nothing for empty dimensions', () => {
    const out = Array.from(cartesianIndices([]));
    expect(out).toEqual([]);
  });

  it('yields nothing when any dimension is empty', () => {
    const dims: VariationDimension[] = [
      { kind: 'color', values: ['#000'] },
      { kind: 'material', values: [] },
    ];
    expect(Array.from(cartesianIndices(dims))).toEqual([]);
  });

  it('enumerates single dimension', () => {
    const dims: VariationDimension[] = [{ kind: 'color', values: ['#a', '#b', '#c'] }];
    const out = Array.from(cartesianIndices(dims));
    expect(out).toEqual([[0], [1], [2]]);
  });

  it('enumerates the cartesian product of two dimensions (rightmost fastest)', () => {
    const dims: VariationDimension[] = [
      { kind: 'color', values: ['#a', '#b'] },
      { kind: 'material', values: ['matte', 'glossy', 'metallic'] },
    ];
    const out = Array.from(cartesianIndices(dims));
    expect(out).toHaveLength(6);
    expect(out[0]).toEqual([0, 0]);
    expect(out[1]).toEqual([0, 1]);
    expect(out[2]).toEqual([0, 2]);
    expect(out[3]).toEqual([1, 0]);
    expect(out[5]).toEqual([1, 2]);
  });
});

describe('totalVariations / dimensionCount', () => {
  it('returns 0 for no dimensions', () => {
    expect(totalVariations([])).toBe(0);
  });

  it('multiplies counts', () => {
    const dims: VariationDimension[] = [
      { kind: 'color', values: ['#1', '#2', '#3'] },
      { kind: 'material', values: ['matte', 'glossy'] },
    ];
    expect(totalVariations(dims)).toBe(6);
    expect(dimensionCount(dims[0])).toBe(3);
  });
});

describe('buildVariationSuffix', () => {
  it('joins parts with dash and sanitizes hex colors', () => {
    const dims: VariationDimension[] = [
      { kind: 'color', values: ['#3b82f6'] },
      { kind: 'material', values: ['glossy'] },
    ];
    const combo = comboFromIndices(dims, [0, 0]);
    expect(buildVariationSuffix(combo)).toBe('color-3b82f6-material-glossy');
  });

  it('sanitizes background labels with unsafe characters', () => {
    const dims: VariationDimension[] = [
      {
        kind: 'background',
        values: [{ label: 'my bg/photo.jpg', dataUrl: 'data:image/png;base64,xx' }],
      },
    ];
    const combo = comboFromIndices(dims, [0]);
    const suffix = buildVariationSuffix(combo);
    expect(suffix).not.toContain('/');
    expect(suffix).not.toContain(' ');
    expect(suffix.startsWith('background-')).toBe(true);
  });
});

describe('comboFromIndices', () => {
  it('extracts the rawValue from each dimension', () => {
    const dims: VariationDimension[] = [
      { kind: 'color', values: ['#a', '#b'] },
      { kind: 'object', values: ['box', 'sphere'] },
    ];
    const combo = comboFromIndices(dims, [1, 0]);
    expect(combo.parts[0]).toEqual({ kind: 'color', rawValue: '#b', label: '#b' });
    expect(combo.parts[1]).toEqual({ kind: 'object', rawValue: 'box', label: 'box' });
  });
});
