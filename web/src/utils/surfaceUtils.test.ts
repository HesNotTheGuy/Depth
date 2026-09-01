import { describe, it, expect } from 'vitest';
import {
  cornersTo3DPlane,
  findSurfaceBelow,
  findSurfaceHitBelow,
  createDefaultFloorSurface,
  snapPositionToSurfaces,
  snapPoseToSurfaces,
  heightOnSurfaceAt,
  surfaceNormal,
  orientationFromNormal,
} from './surfaceUtils';
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
    const bowtie: [Point2D, Point2D, Point2D, Point2D] = [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.8 },
      { x: 0.8, y: 0.2 },
      { x: 0.2, y: 0.8 },
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
    expect(flatPlane.rotation.x).toBeCloseTo(-Math.PI / 2, 5);
    expect(persp.rotation.x).toBeGreaterThan(flatPlane.rotation.x);
  });
});

describe('surfaceNormal + heightOnSurfaceAt', () => {
  it('maps floor rotation (-π/2, 0, 0) to world +Y', () => {
    const n = surfaceNormal({ x: -Math.PI / 2, y: 0, z: 0 });
    expect(n.x).toBeCloseTo(0, 5);
    expect(n.y).toBeCloseTo(1, 5);
    expect(n.z).toBeCloseTo(0, 5);
  });

  it('returns constant height across XZ for a flat floor', () => {
    const floor = {
      position: { x: 0, y: 0.25, z: 0 },
      rotation: { x: -Math.PI / 2, y: 0, z: 0 },
      size: { width: 4, depth: 4 },
      visible: true,
    };
    expect(heightOnSurfaceAt(floor, 0, 0)).toBeCloseTo(0.25, 5);
    expect(heightOnSurfaceAt(floor, 1.2, -0.8)).toBeCloseTo(0.25, 5);
  });

  it('varies height with XZ on a pitched plane', () => {
    // Pitch up from floor so the normal tips toward +Z → height rises with z.
    const pitched = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: -Math.PI / 2 + 0.3, y: 0, z: 0 },
      size: { width: 6, depth: 6 },
      visible: true,
    };
    const y0 = heightOnSurfaceAt(pitched, 0, 0)!;
    const yForward = heightOnSurfaceAt(pitched, 0, 1)!;
    expect(y0).toBeCloseTo(0, 5);
    expect(yForward).not.toBeCloseTo(y0, 2);
  });
});

describe('createDefaultFloorSurface', () => {
  it('creates a visible floor with perspective corners', () => {
    const floor = createDefaultFloorSurface();
    expect(floor.name).toBe('Floor (auto)');
    expect(floor.visible).toBe(true);
    expect(floor.corners).toHaveLength(4);
    expect(floor.size.width).toBeGreaterThan(0);
    expect(floor.position.y).toBeGreaterThan(0);
  });
});

describe('snapPositionToSurfaces (plane height at XY)', () => {
  const flatFloor = {
    id: 'flat',
    name: 'Flat',
    corners: [
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ] as [Point2D, Point2D, Point2D, Point2D],
    position: { x: 0, y: 0.1, z: 0 },
    rotation: { x: -Math.PI / 2, y: 0, z: 0 },
    size: { width: 8, depth: 8 },
    visible: true,
    color: '#fff',
  };

  it('snaps spawn Y to plane height at object XZ + half-height', () => {
    const snapped = snapPositionToSurfaces(
      { x: 0, y: 0.5, z: 0 },
      'box',
      1,
      [flatFloor],
      true,
    );
    expect(snapped.y).toBeCloseTo(0.1 + 0.5, 5);
  });

  it('uses plane height at XY on a tilted desk (not just center Y)', () => {
    const desk = {
      ...flatFloor,
      position: { x: 0, y: 0.2, z: 0 },
      rotation: { x: -Math.PI / 2 + 0.25, y: 0, z: 0 },
    };
    const atOrigin = snapPositionToSurfaces({ x: 0, y: 2, z: 0 }, 'box', 1, [desk], true);
    const atForward = snapPositionToSurfaces({ x: 0, y: 2, z: 1 }, 'box', 1, [desk], true);
    const h0 = heightOnSurfaceAt(desk, 0, 0)!;
    const h1 = heightOnSurfaceAt(desk, 0, 1)!;
    expect(atOrigin.y).toBeCloseTo(h0 + 0.5, 5);
    expect(atForward.y).toBeCloseTo(h1 + 0.5, 5);
    expect(atForward.y).not.toBeCloseTo(atOrigin.y, 2);
  });

  it('leaves position unchanged when snap is off', () => {
    const pos = { x: 0, y: 0.5, z: 0 };
    expect(snapPositionToSurfaces(pos, 'box', 1, [flatFloor], false)).toEqual(pos);
  });
});

describe('snapPoseToSurfaces alignToNormal', () => {
  it('preserves yaw while tilting object to the plane normal', () => {
    const desk = {
      id: 'desk',
      name: 'Desk',
      corners: [
        { x: 0, y: 0.5 },
        { x: 1, y: 0.5 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ] as [Point2D, Point2D, Point2D, Point2D],
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: -Math.PI / 2 + 0.3, y: 0, z: 0 },
      size: { width: 8, depth: 8 },
      visible: true,
      color: '#fff',
    };
    const pose = snapPoseToSurfaces(
      { x: 0, y: 2, z: 0 },
      { x: 0, y: 0.7, z: 0 },
      'box',
      1,
      [desk],
      true,
      { alignToNormal: true },
    );
    expect(pose.rotation).toBeDefined();
    expect(pose.rotation!.y).toBeCloseTo(0.7, 5);
    expect(Math.abs(pose.rotation!.x) + Math.abs(pose.rotation!.z)).toBeGreaterThan(0.05);
  });
});

describe('orientationFromNormal', () => {
  it('keeps identity for world +Y', () => {
    const r = orientationFromNormal({ x: 0, y: 1, z: 0 }, 0.4);
    expect(r.x).toBeCloseTo(0, 5);
    expect(r.y).toBeCloseTo(0.4, 5);
    expect(r.z).toBeCloseTo(0, 5);
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

  it('findSurfaceHitBelow includes the plane normal', () => {
    const hit = findSurfaceHitBelow({ x: 0, y: 1, z: 0 }, [surface]);
    expect(hit).not.toBeNull();
    expect(hit!.normal.y).toBeCloseTo(1, 5);
    expect(hit!.y).toBe(0);
  });
});
