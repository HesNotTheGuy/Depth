import { useMemo } from 'react';
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
  const geometry = useMemo(() => {
    const [a, b] = endpointsForGuide(snap);
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z], 3),
    );
    return g;
  }, [snap]);

  return (
    <line raycast={() => null}>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color={GUIDE_COLOR} transparent opacity={0.85} depthTest={false} />
    </line>
  );
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
