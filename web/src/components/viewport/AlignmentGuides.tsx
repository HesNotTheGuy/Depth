import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useAlignmentStore } from '../../store/useAlignmentStore';
import type { AlignmentSnap } from '../../utils/alignmentUtils';

const GUIDE_LENGTH = 50;
const GUIDE_COLOR = '#a78bfa';

/**
 * Build the two endpoints of a guide line in world space.
 *
 * The guide passes through the snap point and extends along `guideAxis`.
 * `snappedValue` fixes the coordinate on the snap axis. The third axis is
 * pinned to 0 (a stable, visible plane).
 */
function endpointsForGuide(snap: AlignmentSnap): [THREE.Vector3, THREE.Vector3] {
  const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
  const thirdAxis = axes.find((a) => a !== snap.axis && a !== snap.guideAxis) ?? 'z';

  const make = (along: number): THREE.Vector3 => {
    const v = new THREE.Vector3(0, 0, 0);
    v[snap.axis] = snap.snappedValue;
    v[snap.guideAxis] = along;
    v[thirdAxis] = 0;
    return v;
  };

  return [make(-GUIDE_LENGTH / 2), make(GUIDE_LENGTH / 2)];
}

function GuideLine({ snap }: { snap: AlignmentSnap }) {
  // Build the THREE.Line imperatively and render via <primitive>. The
  // intrinsic <line> JSX element collides with SVG's <line> in the build's
  // tsconfig (R3F's type augmentation doesn't extend the SVG tag), so the
  // raycast prop fails to typecheck. A primitive sidesteps that entirely.
  const line = useMemo(() => {
    const [a, b] = endpointsForGuide(snap);
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const m = new THREE.LineBasicMaterial({
      color: GUIDE_COLOR,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    });
    const ln = new THREE.Line(g, m);
    ln.raycast = () => {}; // guides must never intercept pointer picks
    return ln;
  }, [snap]);

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );

  return <primitive object={line} />;
}

export function AlignmentGuides() {
  const guides = useAlignmentStore((s) => s.activeGuides);
  if (guides.length === 0) return null;
  return (
    <>
      {guides.map((g, i) => (
        <GuideLine key={`${g.axis}-${g.to}-${g.otherObjectId ?? 'world'}-${i}`} snap={g} />
      ))}
    </>
  );
}
