import { useMemo, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { findSurfaceBelow } from '../../utils/surfaceUtils';

const materialConfigs = {
  matte: { roughness: 0.9, metalness: 0 },
  glossy: { roughness: 0.1, metalness: 0 },
  metallic: { roughness: 0.3, metalness: 1.0 },
  glass: { roughness: 0.05, metalness: 0, transmission: 1.0, ior: 1.5 },
  plastic: { roughness: 0.4, metalness: 0, clearcoat: 0.5 },
} as const;

export function SceneObject() {
  const objectType = useSceneStore((s) => s.objectType);
  const position = useSceneStore((s) => s.objectPosition);
  const rotation = useSceneStore((s) => s.objectRotation);
  const scale = useSceneStore((s) => s.objectScale);
  const color = useSceneStore((s) => s.objectColor);
  const material = useSceneStore((s) => s.objectMaterial);
  const roughness = useSceneStore((s) => s.objectRoughness);
  const surfaces = useSceneStore((s) => s.surfaces);
  const snapToSurface = useSceneStore((s) => s.snapToSurface);
  const setObjectPosition = useSceneStore((s) => s.setObjectPosition);
  const invalidate = useThree((s) => s.invalidate);

  // Invalidate on any prop change so demand-mode canvas re-renders
  useEffect(() => {
    invalidate();
  });

  // Snap to surface when position/surfaces change
  useEffect(() => {
    if (!snapToSurface || surfaces.length === 0) return;
    const surfaceY = findSurfaceBelow(position, surfaces);
    if (surfaceY !== null) {
      // Place object so its bottom sits on the surface
      const objectHalfHeight = getObjectHalfHeight(objectType, scale);
      const targetY = surfaceY + objectHalfHeight;
      if (Math.abs(position.y - targetY) > 0.01) {
        setObjectPosition({ ...position, y: targetY });
      }
    }
  }, [position.x, position.z, surfaces, snapToSurface, objectType, scale]);

  const geometry = useMemo(() => {
    switch (objectType) {
      case 'box': return new THREE.BoxGeometry(1, 1, 1);
      case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
      case 'sphere': return new THREE.SphereGeometry(0.5, 32, 32);
      case 'cone': return new THREE.ConeGeometry(0.5, 1, 32);
      case 'torus': return new THREE.TorusGeometry(0.4, 0.15, 16, 32);
      default: return new THREE.BoxGeometry(1, 1, 1);
    }
  }, [objectType]);

  const matConfig = materialConfigs[material];
  const needsPhysical = material === 'glass' || material === 'plastic';

  const matProps = useMemo(() => {
    const base: Record<string, unknown> = {
      color,
      roughness,
      metalness: matConfig.metalness,
    };
    if ('transmission' in matConfig) base.transmission = matConfig.transmission;
    if ('clearcoat' in matConfig) base.clearcoat = matConfig.clearcoat;
    if ('ior' in matConfig) base.ior = matConfig.ior;
    return base;
  }, [color, roughness, matConfig]);

  if (objectType === 'custom') return null;

  return (
    <mesh
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      scale={scale}
      castShadow
      receiveShadow
    >
      <primitive object={geometry} attach="geometry" />
      {needsPhysical ? (
        <meshPhysicalMaterial {...matProps} />
      ) : (
        <meshStandardMaterial {...matProps} />
      )}
    </mesh>
  );
}

function getObjectHalfHeight(type: string, scale: number): number {
  switch (type) {
    case 'box': return 0.5 * scale;
    case 'cylinder': return 0.5 * scale;
    case 'sphere': return 0.5 * scale;
    case 'cone': return 0.5 * scale;
    case 'torus': return 0.15 * scale;
    default: return 0.5 * scale;
  }
}
