import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { useSceneStore } from '../../store/useSceneStore';
import { findSurfaceBelow } from '../../utils/surfaceUtils';

// Material configs are now driven by store values

function useObjModel(url: string | null) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) { setGeometry(null); return; }

    setError(false);
    const loader = new OBJLoader();
    loader.load(
      url,
      (group) => {
        // Extract the first mesh geometry from the OBJ
        let geo: THREE.BufferGeometry | null = null;
        group.traverse((child) => {
          if (!geo && (child as THREE.Mesh).isMesh) {
            geo = (child as THREE.Mesh).geometry as THREE.BufferGeometry;
          }
        });
        if (geo !== null) {
          const g = geo as THREE.BufferGeometry;
          // Center and normalize to unit size
          g.computeBoundingBox();
          const box = g.boundingBox!;
          const center = new THREE.Vector3();
          box.getCenter(center);
          g.translate(-center.x, -center.y, -center.z);

          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0) {
            const s = 1.0 / maxDim;
            g.scale(s, s, s);
          }

          g.computeVertexNormals();
          setGeometry(g);
        } else {
          setError(true);
        }
      },
      undefined,
      () => setError(true)
    );
  }, [url]);

  return { geometry, error };
}

export function SceneObject() {
  const objectType = useSceneStore((s) => s.objectType);
  const customModelUrl = useSceneStore((s) => s.customModelUrl);
  const position = useSceneStore((s) => s.objectPosition);
  const rotation = useSceneStore((s) => s.objectRotation);
  const scale = useSceneStore((s) => s.objectScale);
  const color = useSceneStore((s) => s.objectColor);
  const material = useSceneStore((s) => s.objectMaterial);
  const roughness = useSceneStore((s) => s.objectRoughness);
  const metalness = useSceneStore((s) => s.objectMetalness);
  const transmission = useSceneStore((s) => s.objectTransmission);
  const ior = useSceneStore((s) => s.objectIor);
  const clearcoat = useSceneStore((s) => s.objectClearcoat);
  const opacity = useSceneStore((s) => s.objectOpacity);
  const reflectivity = useSceneStore((s) => s.objectReflectivity);
  const surfaces = useSceneStore((s) => s.surfaces);
  const snapToSurface = useSceneStore((s) => s.snapToSurface);
  const setObjectPosition = useSceneStore((s) => s.setObjectPosition);
  const setObjectScale = useSceneStore((s) => s.setObjectScale);
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dragging = useRef(false);
  const dragStart = useRef<{ x: number; y: number; pos: typeof position }>({ x: 0, y: 0, pos: position });

  const { geometry: customGeometry } = useObjModel(
    objectType === 'custom' ? customModelUrl : null
  );

  // Invalidate on any prop change so demand-mode canvas re-renders
  useEffect(() => {
    invalidate();
  }, [objectType, customModelUrl, position, rotation, scale, color, material, roughness, metalness, transmission, ior, clearcoat, opacity, reflectivity, invalidate]);

  // Snap to surface when position/surfaces change
  useEffect(() => {
    if (!snapToSurface || surfaces.length === 0) return;
    const surfaceY = findSurfaceBelow(position, surfaces);
    if (surfaceY !== null) {
      const objectHalfHeight = getObjectHalfHeight(objectType, scale);
      const targetY = surfaceY + objectHalfHeight;
      if (Math.abs(position.y - targetY) > 0.01) {
        setObjectPosition({ ...position, y: targetY });
      }
    }
  }, [position.x, position.z, surfaces, snapToSurface, objectType, scale]);

  const primitiveGeometry = useMemo(() => {
    switch (objectType) {
      case 'box': return new THREE.BoxGeometry(1, 1, 1);
      case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
      case 'sphere': return new THREE.SphereGeometry(0.5, 32, 32);
      case 'cone': return new THREE.ConeGeometry(0.5, 1, 32);
      case 'torus': return new THREE.TorusGeometry(0.4, 0.15, 16, 32);
      default: return null;
    }
  }, [objectType]);

  const geometry = objectType === 'custom' ? customGeometry : primitiveGeometry;

  const needsPhysical = material === 'glass' || material === 'plastic';

  const matProps = useMemo(() => {
    const base: Record<string, unknown> = {
      color,
      roughness,
      metalness,
    };
    // Always set physical props so they reset when switching materials
    base.transmission = 0;
    base.transparent = false;
    base.opacity = 1;
    base.clearcoat = 0;
    base.ior = 1.5;
    base.thickness = 0;
    base.reflectivity = 0.5;
    base.envMapIntensity = 1.0;
    base.attenuationDistance = Infinity;
    base.attenuationColor = color;

    if (material === 'glass') {
      // transmission handles transparency — don't mix with opacity/transparent
      base.transmission = transmission;
      base.ior = ior;
      base.thickness = 0.5 + (1 - opacity) * 2.0; // opacity slider controls glass thickness
      base.reflectivity = reflectivity;
      base.envMapIntensity = 1.0 + reflectivity * 2.0;
      base.attenuationDistance = 0.5 + opacity * 4.0; // thinner = more colored
      base.attenuationColor = color;
      base.transparent = false;
      base.opacity = 1;
      base.color = '#ffffff'; // glass tint via attenuation, not base color
    }
    if (material === 'plastic') {
      base.clearcoat = clearcoat;
    }
    return base;
  }, [color, roughness, metalness, material, transmission, ior, opacity, clearcoat, reflectivity]);

  // Drag to reposition object in screen-space XY
  const onPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, pos: { ...position } };
  }, [position]);

  const onPointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    e.stopPropagation();
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    // Convert screen pixels to world units at the object's depth
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const dist = camera.position.distanceTo(new THREE.Vector3(position.x, position.y, position.z));
    const vFov = (fov * Math.PI) / 180;
    const worldPerPixelY = (2 * Math.tan(vFov / 2) * dist) / size.height;
    const worldPerPixelX = worldPerPixelY;

    setObjectPosition({
      x: dragStart.current.pos.x + dx * worldPerPixelX,
      y: dragStart.current.pos.y - dy * worldPerPixelY,
      z: dragStart.current.pos.z,
    });
  }, [camera, size, position, setObjectPosition]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  if (!geometry) return null;

  return (
    <mesh
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      scale={scale}
      castShadow
      receiveShadow
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
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
    case 'custom': return 0.5 * scale;
    default: return 0.5 * scale;
  }
}
