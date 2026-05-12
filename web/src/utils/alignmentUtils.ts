import type { Vec3 } from '../store/useSceneStore';

/**
 * Smart alignment / snapping utilities.
 *
 * Given a dragged object's world-space AABB and a set of other objects'
 * AABBs, compute the snapped position along each axis independently and
 * return the active snap guides so the viewport can render visual hints.
 *
 * Each axis is considered independently. On any given axis we compare the
 * dragged AABB's three reference values (min / center / max) against each
 * other object's three reference values. The smallest delta wins; ties are
 * broken in favor of center-to-center over edge-to-edge.
 *
 * World-zero snapping (centering on the origin) is also evaluated per axis.
 */

export interface AlignmentSnap {
  axis: 'x' | 'y' | 'z';
  to: 'edge' | 'center' | 'world-zero';
  otherObjectId?: string;
  /** The new world-space value on the snap axis. */
  snappedValue: number;
  /** Axis the guide line should run along (perpendicular to the snap axis). */
  guideAxis: 'x' | 'y' | 'z';
  /** Where on `guideAxis` the guide sits (world value at the snap point). */
  guideValue: number;
}

export interface AlignmentInput {
  draggedId: string;
  draggedBounds: { min: Vec3; max: Vec3 };
  candidatePos: Vec3;
  otherObjects: Array<{
    id: string;
    bounds: { min: Vec3; max: Vec3 };
    centerWorld: Vec3;
  }>;
  threshold: number;
}

type Axis = 'x' | 'y' | 'z';
const AXES: Axis[] = ['x', 'y', 'z'];

interface RefPoints {
  min: number;
  center: number;
  max: number;
}

function refsForAxis(bounds: { min: Vec3; max: Vec3 }, axis: Axis): RefPoints {
  const lo = bounds.min[axis];
  const hi = bounds.max[axis];
  return { min: lo, center: (lo + hi) / 2, max: hi };
}

interface SnapCandidate {
  delta: number;       // how much we move the dragged value (signed)
  snappedValue: number; // the new value of dragged center on this axis
  to: 'edge' | 'center' | 'world-zero';
  otherObjectId?: string;
  guideValue: number;  // where the guide sits on the snap axis (matched value)
}

/**
 * Pick the guide axis: an axis perpendicular to the snap axis. We pick the
 * axis on which the dragged object spans the most overlap with the matched
 * other object — visually that's where the alignment is most relevant.
 *
 * For world-zero (no other object) we fall back to `y` for x/z snaps and
 * `x` for y snaps so the guide is clearly visible across the scene.
 */
function pickGuideAxis(snapAxis: Axis, otherId?: string): Axis {
  if (!otherId) {
    // world-zero
    return snapAxis === 'y' ? 'x' : 'y';
  }
  // Otherwise default to the world-up axis when snapping on x/z, and x when snapping on y.
  return snapAxis === 'y' ? 'x' : 'y';
}

export function computeAlignment(input: AlignmentInput): {
  snappedPos: Vec3;
  snaps: AlignmentSnap[];
} {
  const { draggedBounds, candidatePos, otherObjects, threshold } = input;
  const snaps: AlignmentSnap[] = [];
  const snappedPos: Vec3 = { ...candidatePos };

  if (threshold <= 0) {
    return { snappedPos, snaps };
  }

  for (const axis of AXES) {
    const draggedRefs = refsForAxis(draggedBounds, axis);

    let best: SnapCandidate | null = null;

    const consider = (cand: SnapCandidate) => {
      if (Math.abs(cand.delta) > threshold) return;
      if (!best) { best = cand; return; }
      // Prefer center-to-center > edge-to-edge / world-zero when equally close.
      const bestIsCenter = best.to === 'center';
      const candIsCenter = cand.to === 'center';
      if (candIsCenter && !bestIsCenter && Math.abs(cand.delta) <= threshold) {
        best = cand;
        return;
      }
      if (bestIsCenter && !candIsCenter) return;
      // Otherwise smaller absolute delta wins.
      if (Math.abs(cand.delta) < Math.abs(best.delta)) best = cand;
    };

    // World-zero snap: dragged center -> 0
    {
      const delta = 0 - draggedRefs.center;
      consider({
        delta,
        snappedValue: candidatePos[axis] + delta,
        to: 'world-zero',
        guideValue: 0,
      });
    }

    // Compare against every other object.
    for (const other of otherObjects) {
      const otherRefs = refsForAxis(other.bounds, axis);

      // Edge pairs: min-min, max-max, min-max, max-min
      const edgePairs: Array<[number, number]> = [
        [draggedRefs.min, otherRefs.min],
        [draggedRefs.max, otherRefs.max],
        [draggedRefs.min, otherRefs.max],
        [draggedRefs.max, otherRefs.min],
      ];
      for (const [dv, ov] of edgePairs) {
        const delta = ov - dv;
        consider({
          delta,
          snappedValue: candidatePos[axis] + delta,
          to: 'edge',
          otherObjectId: other.id,
          guideValue: ov,
        });
      }

      // Center-center
      {
        const delta = otherRefs.center - draggedRefs.center;
        consider({
          delta,
          snappedValue: candidatePos[axis] + delta,
          to: 'center',
          otherObjectId: other.id,
          guideValue: otherRefs.center,
        });
      }
    }

    if (best) {
      const winner = best as SnapCandidate;
      snappedPos[axis] = winner.snappedValue;
      snaps.push({
        axis,
        to: winner.to,
        otherObjectId: winner.otherObjectId,
        snappedValue: winner.snappedValue,
        guideAxis: pickGuideAxis(axis, winner.otherObjectId),
        guideValue: winner.guideValue,
      });
    }
  }

  return { snappedPos, snaps };
}

/**
 * Scale snap threshold with canvas zoom so snapping feels consistent at
 * any zoom level. Higher zoom -> tighter threshold in world units.
 */
export function thresholdForZoom(canvasZoom: number): number {
  if (!Number.isFinite(canvasZoom) || canvasZoom <= 0) return 0.05;
  const raw = 0.05 / canvasZoom;
  return Math.max(0.02, Math.min(0.2, raw));
}
