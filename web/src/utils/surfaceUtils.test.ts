import { describe, it, expect } from 'vitest';
import { cornersTo3DPlane, findSurfaceBelow } from './surfaceUtils';
import type { Point2D } from '../store/useSceneStore';

/**
 * cornersTo3DPlane internally calls sortCorners; we exercise the sorting
 * indirectly by feeding the same shape in different input orderings and
 * verifying the resulting plane is identical (rotation/size/position).
 */
describe('cornersTo3DPlane corner sorting', () => {
  const square: [Point2D, Point2D, Point2D, Point2D] = [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.8, y: 0.8 },
    { x: 0.2, y: 0.8 },
  ];

  it('produces same plane regardless of input order for a square', () => {
    const a = cornersTo3DPlane(square);
    const shuffled: [Point2D, Point2D, Point2D, Point2D] = [
      square[2],
      square[0],
      square[3],
      square[1],
    ];
    const b = cornersTo3DPlane(shuffled);
    expect(b.position.x).toBeCloseTo(a.position.x, 5);
    expect(b.position.y).toBeCloseTo(a.position.y, 5);
    expect(b.position.z).toBeCloseTo(a.position.z, 5);
    expect(b.size.width).toBeCloseTo(a.size.width, 5);
    expect(b.size.depth).toBeCloseTo(a.size.depth, 5);
  });

  it('untangles a near-bowtie input order into a convex quad', () => {
    // Pass corners in an order that would create a self-crossing polygon if
    // we used them naively (TL, BR, TR, BL). The internal sortCorners must
    // reorder these by angle around the centroid.
    const bowtie: [Point2D, Point2D, Point2D, Point2D] = [
      { x: 0.2, y: 0.2 }, // TL
      { x: 0.8, y: 0.8 }, // BR
      { x: 0.8, y: 0.2 }, // TR
      { x: 0.2, y: 0.8 }, // BL
    ];
    const a = cornersTo3DPlane(square);
    const b = cornersTo3DPlane(bowtie);
    expect(b.size.width).toBeCloseTo(a.size.width, 5);
    expect(b.size.depth).toBeCloseTo(a.size.depth, 5);
  });

  it('perspective quad (wider bottom) tilts more toward the floor', () => {
    const perspective: [Point2D, Point2D, Point2D, Point2D] = [
      { x: 0.35, y: 0.5 },
      { x: 0.65, y: 0.5 },
      { x: 0.85, y: 0.9 },
      { x: 0.15, y: 0.9 },
    ];
    const flat: [Point2D, Point2D, Point2D, Point2D] = [
      { x: 0.2, y: 0.5 },
      { x: 0.8, y: 0.5 },
      { x: 0.8, y: 0.9 },
      { x: 0.2, y: 0.9 },
    ];
    const persp = cornersTo3DPlane(perspective);
    const flatPlane = cornersTo3DPlane(flat);
    // The heuristic: equal-width quads => -PI/2 (floor); narrower top vs
    // bottom => rotates up toward a wall. Perspective should tilt away from
    // pure floor.
    expect(flatPlane.rotation.x).toBeCloseTo(-Math.PI / 2, 5);
    expect(persp.rotation.x).toBeGreaterThan(flatPlane.rotation.x);
  });
});

describe('findSurfaceBelow', () => {
  const surface = {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -Math.PI / 2, y: 0, z: 0 },
    size: { width: 4, depth: 4 },
    visible: true,
  };

  it('returns the surface Y when the point is over it and above', () => {
    const y = findSurfaceBelow({ x: 0, y: 1, z: 0 }, [surface]);
    expect(y).toBe(0);
  });

  it('returns null when the point is outside the surface bounds', () => {
    const y = findSurfaceBelow({ x: 100, y: 1, z: 0 }, [surface]);
    expect(y).toBeNull();
  });

  it('skips invisible surfaces', () => {
    const y = findSurfaceBelow({ x: 0, y: 1, z: 0 }, [{ ...surface, visible: false }]);
    expect(y).toBeNull();
  });

  it('picks the highest surface below among multiple stacked surfaces', () => {
    const low = { ...surface, position: { x: 0, y: -1, z: 0 } };
    const mid = { ...surface, position: { x: 0, y: 0.3, z: 0 } };
    const high = { ...surface, position: { x: 0, y: 0.6, z: 0 } };
    const y = findSurfaceBelow({ x: 0, y: 1, z: 0 }, [low, high, mid]);
    expect(y).toBe(0.6);
  });

  it('does not return surfaces above the point', () => {
    const above = { ...surface, position: { x: 0, y: 5, z: 0 } };
    const y = findSurfaceBelow({ x: 0, y: 1, z: 0 }, [above]);
    expect(y).toBeNull();
  });
});
