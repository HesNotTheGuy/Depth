import { describe, it, expect } from 'vitest';
import { computeAlignment, thresholdForZoom, type AlignmentInput } from './alignmentUtils';

function box(cx: number, cy: number, cz: number, size = 1) {
  const h = size / 2;
  return {
    min: { x: cx - h, y: cy - h, z: cz - h },
    max: { x: cx + h, y: cy + h, z: cz + h },
    center: { x: cx, y: cy, z: cz },
  };
}

describe('computeAlignment', () => {
  it('snaps right edges when within threshold on X', () => {
    // Other box: center at x=2, size 1 -> right edge at x=2.5.
    // Dragged is size 2 with candidate center at 1.47 -> right edge at 2.47.
    // Right-edge delta = 2.5 - 2.47 = 0.03 (within 0.05).
    // Center delta = 2 - 1.47 = 0.53 (well out of threshold), so center cannot win.
    const other = box(2, 0, 0, 1);
    const draggedCandidate = { x: 1.47, y: 0, z: 0 };
    const draggedBounds = {
      min: { x: 0.47, y: -1, z: -1 },
      max: { x: 2.47, y: 1, z: 1 },
    };

    const input: AlignmentInput = {
      draggedId: 'a',
      draggedBounds,
      candidatePos: draggedCandidate,
      otherObjects: [{ id: 'b', bounds: { min: other.min, max: other.max }, centerWorld: other.center }],
      threshold: 0.05,
    };
    const { snappedPos, snaps } = computeAlignment(input);

    // X snapped so right edges align: dragged center becomes 1.47 + 0.03 = 1.5
    expect(snappedPos.x).toBeCloseTo(1.5, 5);
    const xSnap = snaps.find((s) => s.axis === 'x');
    expect(xSnap).toBeDefined();
    expect(xSnap!.to).toBe('edge');
    expect(xSnap!.otherObjectId).toBe('b');
  });

  it('prefers center-to-center over edge alignment when both are in range', () => {
    // Other at x=2 size 1 -> min=1.5, center=2, max=2.5
    // Dragged size 1, candidate center 2.02 -> min=1.52 (delta to other.min=1.5 is -0.02 edge),
    // center delta = 2 - 2.02 = -0.02. Both equally close; prefer center.
    const other = box(2, 0, 0, 1);
    const draggedBounds = {
      min: { x: 1.52, y: -0.5, z: -0.5 },
      max: { x: 2.52, y: 0.5, z: 0.5 },
    };
    const input: AlignmentInput = {
      draggedId: 'a',
      draggedBounds,
      candidatePos: { x: 2.02, y: 0, z: 0 },
      otherObjects: [{ id: 'b', bounds: { min: other.min, max: other.max }, centerWorld: other.center }],
      threshold: 0.05,
    };
    const { snappedPos, snaps } = computeAlignment(input);
    const xSnap = snaps.find((s) => s.axis === 'x');
    expect(xSnap?.to).toBe('center');
    expect(snappedPos.x).toBeCloseTo(2.0, 5);
  });

  it('snaps to world zero when dragged center is near 0', () => {
    const draggedBounds = {
      min: { x: -0.51, y: -0.5, z: -0.5 },
      max: { x: 0.49, y: 0.5, z: 0.5 },
    };
    // No other objects on X near 0; center is -0.01 -> snap to 0
    const input: AlignmentInput = {
      draggedId: 'a',
      draggedBounds,
      candidatePos: { x: -0.01, y: 0, z: 0 },
      otherObjects: [],
      threshold: 0.05,
    };
    const { snappedPos, snaps } = computeAlignment(input);
    expect(snappedPos.x).toBeCloseTo(0, 5);
    const xSnap = snaps.find((s) => s.axis === 'x');
    expect(xSnap?.to).toBe('world-zero');
    expect(xSnap?.guideValue).toBe(0);
  });

  it('returns no snap when everything is outside threshold', () => {
    // Dragged center far from 0 (x=5) and far from other (x=0), exceeds 0.05 on every comparison.
    const other = box(0, 0, 0, 1);
    const draggedBounds = {
      min: { x: 4.5, y: 4.5, z: 4.5 },
      max: { x: 5.5, y: 5.5, z: 5.5 },
    };
    const input: AlignmentInput = {
      draggedId: 'a',
      draggedBounds,
      candidatePos: { x: 5, y: 5, z: 5 },
      otherObjects: [{ id: 'b', bounds: { min: other.min, max: other.max }, centerWorld: other.center }],
      threshold: 0.05,
    };
    const { snappedPos, snaps } = computeAlignment(input);
    expect(snaps).toHaveLength(0);
    expect(snappedPos).toEqual({ x: 5, y: 5, z: 5 });
  });

  it('threshold of 0 disables all snapping (alt-bypass)', () => {
    const other = box(0, 0, 0, 1);
    const draggedBounds = {
      min: { x: -0.5, y: -0.5, z: -0.5 },
      max: { x: 0.5, y: 0.5, z: 0.5 },
    };
    const input: AlignmentInput = {
      draggedId: 'a',
      draggedBounds,
      candidatePos: { x: 0, y: 0, z: 0 },
      otherObjects: [{ id: 'b', bounds: { min: other.min, max: other.max }, centerWorld: other.center }],
      threshold: 0,
    };
    const { snappedPos, snaps } = computeAlignment(input);
    expect(snaps).toHaveLength(0);
    expect(snappedPos).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('reports independent snaps on multiple axes', () => {
    const other = box(2, 3, 0, 1);
    const draggedBounds = {
      min: { x: 1.51, y: 2.51, z: -0.5 },
      max: { x: 2.51, y: 3.51, z: 0.5 },
    };
    const input: AlignmentInput = {
      draggedId: 'a',
      draggedBounds,
      candidatePos: { x: 2.01, y: 3.01, z: 0 },
      otherObjects: [{ id: 'b', bounds: { min: other.min, max: other.max }, centerWorld: other.center }],
      threshold: 0.05,
    };
    const { snappedPos, snaps } = computeAlignment(input);
    expect(snappedPos.x).toBeCloseTo(2.0, 5);
    expect(snappedPos.y).toBeCloseTo(3.0, 5);
    expect(snaps.filter((s) => s.axis === 'x')).toHaveLength(1);
    expect(snaps.filter((s) => s.axis === 'y')).toHaveLength(1);
  });
});

describe('thresholdForZoom', () => {
  it('returns base threshold at zoom 1', () => {
    expect(thresholdForZoom(1)).toBeCloseTo(0.05, 5);
  });
  it('clamps tight at very high zoom', () => {
    expect(thresholdForZoom(100)).toBe(0.02);
  });
  it('clamps loose at very low zoom', () => {
    expect(thresholdForZoom(0.01)).toBe(0.2);
  });
  it('handles invalid input by returning base', () => {
    expect(thresholdForZoom(0)).toBe(0.05);
    expect(thresholdForZoom(NaN)).toBe(0.05);
  });
});
