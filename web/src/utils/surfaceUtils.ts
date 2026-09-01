import type { Point2D, Vec3, SurfacePlane, ObjectPreset } from '../store/useSceneStore';

/** Perspective floor quad in normalized image space (desk / ground band). */
export const DEFAULT_FLOOR_CORNERS: [Point2D, Point2D, Point2D, Point2D] = [
  { x: 0.12, y: 0.52 },
  { x: 0.88, y: 0.52 },
  { x: 0.98, y: 0.98 },
  { x: 0.02, y: 0.98 },
];

/** Minimal surface fields needed for snap math. */
export type SurfacePlaneLike = {
  position: Vec3;
  rotation: Vec3;
  size: { width: number; depth: number };
  visible: boolean;
};

/** Hit result when sampling a surface under an object XY. */
export interface SurfaceHit {
  /** World-space Y of the plane at the object's XZ. */
  y: number;
  /** Unit normal pointing "out" of the surface (up for floors). */
  normal: Vec3;
  /** Surface that produced the hit. */
  surface: SurfacePlaneLike;
}

export interface SnapPose {
  position: Vec3;
  rotation?: Vec3;
}

/** Auto-created floor when a photo is uploaded — objects snap here out of the box. */
export function createDefaultFloorSurface(name = 'Floor (auto)'): SurfacePlane {
  const { position, rotation, size } = cornersTo3DPlane(DEFAULT_FLOOR_CORNERS);
  return {
    id: crypto.randomUUID(),
    name,
    corners: DEFAULT_FLOOR_CORNERS,
    position,
    rotation,
    size,
    visible: true,
    color: '#6C63FF',
  };
}

/** Approximate half-height for snap placement (matches SceneObject presets). */
export function objectHalfHeight(type: ObjectPreset | string, scale: number): number {
  switch (type) {
    case 'box': return 0.5 * scale;
    case 'cylinder': return 0.5 * scale;
    case 'sphere': return 0.5 * scale;
    case 'cone': return 0.5 * scale;
    case 'torus': return 0.15 * scale;
    case 'mug': return 0.4 * scale;
    case 'phone': return 0.75 * scale;
    case 'bottle': return 0.525 * scale;
    case 'bag': return 0.5 * scale;
    case 'card': return 0.25 * scale;
    case 'donut': return 0.15 * scale;
    case 'laptop': return 0.35 * scale;
    case 'tablet': return 0.85 * scale;
    case 'can': return 0.4 * scale;
    case 'book': return 0.5 * scale;
    case 'image': return 0.5 * scale;
    case 'custom': return 0.5 * scale;
    default: return 0.5 * scale;
  }
}

/**
 * World-space unit normal for a surface.
 *
 * Surfaces use the same convention as THREE.PlaneGeometry: local +Z is the
 * face normal. Euler XYZ (Three.js default) maps floor rotation (-π/2, 0, 0)
 * to world +Y.
 */
export function surfaceNormal(rotation: Vec3): Vec3 {
  const cx = Math.cos(rotation.x);
  const sx = Math.sin(rotation.x);
  const cy = Math.cos(rotation.y);
  const sy = Math.sin(rotation.y);
  const cz = Math.cos(rotation.z);
  const sz = Math.sin(rotation.z);

  // R = Rz * Ry * Rx applied to local +Z (0, 0, 1)
  const x1 = 0;
  const y1 = -sx;
  const z1 = cx;

  const x2 = sy * z1 + cy * x1;
  const y2 = y1;
  const z2 = cy * z1 - sy * x1;

  const x3 = cz * x2 - sz * y2;
  const y3 = sz * x2 + cz * y2;
  const z3 = z2;

  const len = Math.hypot(x3, y3, z3) || 1;
  let nx = x3 / len;
  let ny = y3 / len;
  let nz = z3 / len;

  // Prefer the upward-facing side so objects sit on top of floors/desks.
  if (ny < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  return { x: nx, y: ny, z: nz };
}

/**
 * Height of the surface plane at world (x, z), using the plane normal.
 * Returns null if the plane is vertical (no unique Y).
 */
export function heightOnSurfaceAt(
  surface: Pick<SurfacePlaneLike, 'position' | 'rotation'>,
  x: number,
  z: number,
): number | null {
  const n = surfaceNormal(surface.rotation);
  if (Math.abs(n.y) < 1e-5) return null;
  const o = surface.position;
  // n · (P - O) = 0  →  y = oy - (nx*(x-ox) + nz*(z-oz)) / ny
  return o.y - (n.x * (x - o.x) + n.z * (z - o.z)) / n.y;
}

/**
 * Transform a world-space offset into the surface's local plane frame.
 * Local X = width axis, local Y = depth axis (PlaneGeometry convention).
 */
function worldOffsetToLocal(offset: Vec3, rotation: Vec3): Vec3 {
  // Inverse of Euler XYZ = Rx(-x) * Ry(-y) * Rz(-z)
  const cx = Math.cos(-rotation.x);
  const sx = Math.sin(-rotation.x);
  const cy = Math.cos(-rotation.y);
  const sy = Math.sin(-rotation.y);
  const cz = Math.cos(-rotation.z);
  const sz = Math.sin(-rotation.z);

  // Rz(-z)
  const x = cz * offset.x - sz * offset.y;
  const y = sz * offset.x + cz * offset.y;
  const z = offset.z;

  // Ry(-y)
  const x2 = cy * x + sy * z;
  const y2 = y;
  const z2 = -sy * x + cy * z;

  // Rx(-x)
  return {
    x: x2,
    y: cx * y2 - sx * z2,
    z: sx * y2 + cx * z2,
  };
}

/**
 * True when world (x,z) projects inside the surface rectangle (rotation-aware).
 */
export function isOverSurface(surface: SurfacePlaneLike, x: number, z: number): boolean {
  if (!surface.visible) return false;

  const y = heightOnSurfaceAt(surface, x, z);
  if (y === null) {
    const dx = x - surface.position.x;
    const dz = z - surface.position.z;
    return Math.abs(dx) <= surface.size.width / 2 && Math.abs(dz) <= surface.size.depth / 2;
  }

  const local = worldOffsetToLocal(
    { x: x - surface.position.x, y: y - surface.position.y, z: z - surface.position.z },
    surface.rotation,
  );
  return (
    Math.abs(local.x) <= surface.size.width / 2 + 1e-6 &&
    Math.abs(local.y) <= surface.size.depth / 2 + 1e-6
  );
}

/**
 * Highest surface under (x,z) whose plane height is at or below the probe Y.
 * Uses plane normal so tilted desks return the correct height at that XY.
 */
export function findSurfaceHitBelow(
  pos: Vec3,
  surfaces: SurfacePlaneLike[],
): SurfaceHit | null {
  let best: SurfaceHit | null = null;

  for (const surface of surfaces) {
    if (!surface.visible) continue;
    if (!isOverSurface(surface, pos.x, pos.z)) continue;

    const y = heightOnSurfaceAt(surface, pos.x, pos.z);
    if (y === null) continue;
    if (y > pos.y + 1e-4) continue;

    if (!best || y > best.y) {
      best = { y, normal: surfaceNormal(surface.rotation), surface };
    }
  }

  return best;
}

/**
 * Find the highest surface plane directly below a given 3D position.
 * Returns plane height Y at the object's XZ, or null if none.
 */
export function findSurfaceBelow(
  pos: Vec3,
  surfaces: SurfacePlaneLike[],
): number | null {
  return findSurfaceHitBelow(pos, surfaces)?.y ?? null;
}

/**
 * Pitch/roll that aligns object local +Y with a world-space surface normal.
 * Preserves the object's existing yaw (rotation.y).
 */
export function orientationFromNormal(normal: Vec3, yaw = 0): Vec3 {
  const n = { ...normal };
  const len = Math.hypot(n.x, n.y, n.z) || 1;
  n.x /= len;
  n.y /= len;
  n.z /= len;
  if (n.y < 0) {
    n.x = -n.x;
    n.y = -n.y;
    n.z = -n.z;
  }

  const pitch = Math.atan2(-n.z, Math.hypot(n.x, n.y));
  const roll = Math.atan2(n.x, n.y);
  return { x: pitch, y: yaw, z: roll };
}

/**
 * Snap an object pose onto the highest surface below it.
 * Position Y uses plane height at the object's XZ; optional rotation aligns
 * to the plane normal while preserving yaw.
 */
export function snapPoseToSurfaces(
  position: Vec3,
  rotation: Vec3 | undefined,
  objectType: ObjectPreset | string,
  scale: number,
  surfaces: SurfacePlaneLike[],
  snapEnabled: boolean,
  options: { alignToNormal?: boolean } = {},
): SnapPose {
  if (!snapEnabled || surfaces.length === 0) {
    return { position, rotation };
  }

  // Raised probe so we still find the plane when the object is currently
  // intersecting/below it (spawn at y=0.5, floor near 0).
  const probe: Vec3 = {
    x: position.x,
    y: Math.max(position.y, 50),
    z: position.z,
  };
  const hit = findSurfaceHitBelow(probe, surfaces);
  if (!hit) return { position, rotation };

  const nextPos: Vec3 = {
    ...position,
    y: hit.y + objectHalfHeight(objectType, scale),
  };

  if (!options.alignToNormal || !rotation) {
    return { position: nextPos, rotation };
  }

  return {
    position: nextPos,
    rotation: orientationFromNormal(hit.normal, rotation.y),
  };
}

/** Snap an object position onto the highest surface below it (if enabled). */
export function snapPositionToSurfaces(
  position: Vec3,
  objectType: ObjectPreset | string,
  scale: number,
  surfaces: SurfacePlaneLike[],
  snapEnabled: boolean,
): Vec3 {
  return snapPoseToSurfaces(position, undefined, objectType, scale, surfaces, snapEnabled).position;
}

/**
 * Convert 4 corner points drawn on the image (normalized 0-1) into 3D plane properties.
 *
 * Heuristic: perspective cues estimate a 3D plane's position, rotation, and size.
 * - Lower on the image = closer to camera = lower Y in 3D
 * - Wider bottom than top = floor-like plane tilted away
 */
export function cornersTo3DPlane(corners: [Point2D, Point2D, Point2D, Point2D]): {
  position: Vec3;
  rotation: Vec3;
  size: { width: number; depth: number };
} {
  const sorted = sortCorners(corners);
  const [tl, tr, br, bl] = sorted;

  const cx = (tl.x + tr.x + br.x + bl.x) / 4;
  const cy = (tl.y + tr.y + br.y + bl.y) / 4;

  const height = (1 - cy) * 0.5;
  const posX = (cx - 0.5) * 4;
  const posZ = (cy - 0.3) * 3;

  const topWidth = Math.abs(tr.x - tl.x);
  const bottomWidth = Math.abs(br.x - bl.x);
  const leftHeight = Math.abs(bl.y - tl.y);
  const rightHeight = Math.abs(br.y - tr.y);

  const widthRatio = topWidth / Math.max(bottomWidth, 0.001);
  const tiltX = -Math.PI / 2 + (1 - widthRatio) * 0.8;
  const tiltY = (rightHeight - leftHeight) * 1.5;

  const avgWidth = (topWidth + bottomWidth) / 2;
  const avgHeight = (leftHeight + rightHeight) / 2;

  return {
    position: { x: posX, y: height, z: posZ },
    rotation: { x: tiltX, y: tiltY, z: 0 },
    size: {
      width: Math.max(0.5, avgWidth * 6),
      depth: Math.max(0.5, avgHeight * 6),
    },
  };
}

/**
 * Sort 4 points into a proper convex polygon winding order (CCW).
 * Uses centroid + angle sorting to avoid bowtie/crossed edges.
 */
function sortCorners(pts: Point2D[]): [Point2D, Point2D, Point2D, Point2D] {
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;

  const sorted = [...pts].sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });

  let bestIdx = 0;
  let bestSum = Infinity;
  for (let i = 0; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < bestSum) {
      bestSum = sum;
      bestIdx = i;
    }
  }

  return [
    sorted[bestIdx],
    sorted[(bestIdx + 1) % 4],
    sorted[(bestIdx + 2) % 4],
    sorted[(bestIdx + 3) % 4],
  ] as [Point2D, Point2D, Point2D, Point2D];
}
