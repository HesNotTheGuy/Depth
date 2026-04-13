import type { Point2D, Vec3 } from '../store/useSceneStore';

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
 * Sort 4 points into top-left, top-right, bottom-right, bottom-left order.
 */
function sortCorners(pts: Point2D[]): [Point2D, Point2D, Point2D, Point2D] {
  const sorted = [...pts];
  // Sort by Y first to split into top pair and bottom pair
  sorted.sort((a, b) => a.y - b.y);
  const topPair = sorted.slice(0, 2).sort((a, b) => a.x - b.x); // left, right
  const bottomPair = sorted.slice(2, 4).sort((a, b) => a.x - b.x); // left, right
  return [topPair[0], topPair[1], bottomPair[1], bottomPair[0]]; // TL, TR, BR, BL
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
