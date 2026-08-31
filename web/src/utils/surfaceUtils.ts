import type { Point2D, Vec3, SurfacePlane, ObjectPreset } from '../store/useSceneStore';

/** Perspective floor quad in normalized image space (desk / ground band). */
export const DEFAULT_FLOOR_CORNERS: [Point2D, Point2D, Point2D, Point2D] = [
  { x: 0.12, y: 0.52 },
  { x: 0.88, y: 0.52 },
  { x: 0.98, y: 0.98 },
  { x: 0.02, y: 0.98 },
];

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

/** Snap an object position onto the highest surface below it (if enabled). */
export function snapPositionToSurfaces(
  position: Vec3,
  objectType: ObjectPreset | string,
  scale: number,
  surfaces: SurfacePlane[],
  snapEnabled: boolean,
): Vec3 {
  if (!snapEnabled || surfaces.length === 0) return position;
  const surfaceY = findSurfaceBelow(position, surfaces);
  if (surfaceY === null) return position;
  return { ...position, y: surfaceY + objectHalfHeight(objectType, scale) };
}

/**
 * Convert 4 corner points drawn on the image (normalized 0-1) into 3D plane properties.
 *
 * Heuristic approach: we use the quad's perspective cues to estimate
 * a 3D plane's position, rotation, and size.
 *
 * - Lower on the image = closer to camera = lower Y in 3D (closer to ground)
 * - Wider bottom than top = floor-like plane tilted away
 * - Narrower bottom than top = ceiling/wall plane
 */
export function cornersTo3DPlane(corners: [Point2D, Point2D, Point2D, Point2D]): {
  position: Vec3;
  rotation: Vec3;
  size: { width: number; depth: number };
} {
  // Sort corners: top-left, top-right, bottom-right, bottom-left
  const sorted = sortCorners(corners);
  const [tl, tr, br, bl] = sorted;

  // Center of the quad in image space
  const cx = (tl.x + tr.x + br.x + bl.x) / 4;
  const cy = (tl.y + tr.y + br.y + bl.y) / 4;

  // Map image Y to 3D height: bottom of image (y=1) = ground (3D y=0),
  // top of image (y=0) = higher up
  const height = (1 - cy) * 0.5; // surfaces near bottom sit near ground

  // Map image X to 3D X: center of image = 0
  const posX = (cx - 0.5) * 4;
  const posZ = (cy - 0.3) * 3; // depth: higher on image = further away

  // Estimate tilt from perspective: compare top edge width to bottom edge width
  const topWidth = Math.abs(tr.x - tl.x);
  const bottomWidth = Math.abs(br.x - bl.x);
  const leftHeight = Math.abs(bl.y - tl.y);
  const rightHeight = Math.abs(br.y - tr.y);

  // X rotation (tilt forward/back): if bottom is wider, plane tilts away from camera
  const widthRatio = topWidth / Math.max(bottomWidth, 0.001);
  const tiltX = -Math.PI / 2 + (1 - widthRatio) * 0.8; // floor = -PI/2, wall = 0

  // Y rotation (yaw): if left side is taller, plane is angled right
  const heightDiff = rightHeight - leftHeight;
  const tiltY = heightDiff * 1.5;

  // Size estimate from quad area in image space
  const avgWidth = (topWidth + bottomWidth) / 2;
  const avgHeight = (leftHeight + rightHeight) / 2;
  const planeWidth = avgWidth * 6;
  const planeDepth = avgHeight * 6;

  return {
    position: { x: posX, y: height, z: posZ },
    rotation: { x: tiltX, y: tiltY, z: 0 },
    size: { width: Math.max(0.5, planeWidth), depth: Math.max(0.5, planeDepth) },
  };
}

/**
 * Sort 4 points into a proper convex polygon winding order (CCW).
 * Uses centroid + angle sorting to avoid bowtie/crossed edges
 * that occur with naive Y-then-X sorting on perspective quads.
 */
function sortCorners(pts: Point2D[]): [Point2D, Point2D, Point2D, Point2D] {
  // Compute centroid
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;

  // Sort by angle from centroid (CCW winding)
  const sorted = [...pts].sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });

  // Rotate so the top-left-most point is first
  // (smallest x+y sum = closest to top-left corner)
  let bestIdx = 0;
  let bestSum = Infinity;
  for (let i = 0; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < bestSum) {
      bestSum = sum;
      bestIdx = i;
    }
  }
  const rotated = [
    sorted[bestIdx],
    sorted[(bestIdx + 1) % 4],
    sorted[(bestIdx + 2) % 4],
    sorted[(bestIdx + 3) % 4],
  ];

  return rotated as [Point2D, Point2D, Point2D, Point2D];
}

/**
 * Find the highest surface plane directly below a given 3D position.
 * Returns the Y value the object should snap to, or null if no surface below.
 */
export function findSurfaceBelow(
  pos: Vec3,
  surfaces: { position: Vec3; rotation: Vec3; size: { width: number; depth: number }; visible: boolean }[]
): number | null {
  let bestY: number | null = null;

  for (const surface of surfaces) {
    if (!surface.visible) continue;

    // Simplified: check if pos.xz is within the plane's bounds
    // (rough bounding box check given the plane's position and size)
    const dx = pos.x - surface.position.x;
    const dz = pos.z - surface.position.z;
    const halfW = surface.size.width / 2;
    const halfD = surface.size.depth / 2;

    if (Math.abs(dx) <= halfW && Math.abs(dz) <= halfD) {
      // This surface is roughly below the object
      // The surface Y is its position.y (top of the plane)
      const surfaceY = surface.position.y;
      if (surfaceY <= pos.y) {
        if (bestY === null || surfaceY > bestY) {
          bestY = surfaceY;
        }
      }
    }
  }

  return bestY;
}
