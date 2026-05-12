import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useSceneStore, type FaceTextureConfig, type SceneObjectInstance } from '../../store/useSceneStore';
import { useUIStore } from '../../store/useUIStore';
import { useHoverStore } from '../../store/useHoverStore';
import { findSurfaceBelow } from '../../utils/surfaceUtils';
import { BOX_FACE_NAMES, detectFace } from './faceDetection';

function ensureBoxGroups(geometry: THREE.BufferGeometry): void {
  if (geometry.groups.length === 6) return;
  geometry.clearGroups();
  for (let i = 0; i < 6; i++) {
    geometry.addGroup(i * 6, 6, i);
  }
}

function loadTextureFromUrl(url: string, config: FaceTextureConfig): Promise<THREE.Texture> {
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(url, (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.repeat.set(config.repeat.x, config.repeat.y);
      tex.offset.set(config.offset.x, config.offset.y);
      tex.rotation = config.rotation;
      resolve(tex);
    });
  });
}

function useObjModel(url: string | null) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!url) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing state when input becomes null is the correct synchronization here
      setGeometry(null);
      return;
    }
    setError(false);
    const loader = new OBJLoader();
    loader.load(
      url,
      (group) => {
        let geo: THREE.BufferGeometry | null = null;
        group.traverse((child) => {
          if (!geo && (child as THREE.Mesh).isMesh) {
            geo = (child as THREE.Mesh).geometry as THREE.BufferGeometry;
          }
        });
        if (geo !== null) {
          const g = geo as THREE.BufferGeometry;
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

function buildPrimitiveGeometry(objectType: string): THREE.BufferGeometry | null {
  switch (objectType) {
    case 'box': return new THREE.BoxGeometry(1, 1, 1);
    case 'cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
    case 'sphere': return new THREE.SphereGeometry(0.5, 32, 32);
    case 'cone': return new THREE.ConeGeometry(0.5, 1, 32);
    case 'torus': return new THREE.TorusGeometry(0.4, 0.15, 16, 32);
    case 'mug': {
      const body = new THREE.CylinderGeometry(0.35, 0.35, 0.8, 32);
      const handle = new THREE.TorusGeometry(0.18, 0.04, 12, 24, Math.PI);
      handle.rotateZ(Math.PI / 2);
      handle.translate(0.35, 0, 0);
      return mergeGeometries([body, handle], false) ?? body;
    }
    case 'phone': {
      const w = 0.38, h = 0.75, r = 0.06;
      const shape = new THREE.Shape();
      shape.moveTo(-w + r, -h);
      shape.lineTo(w - r, -h);
      shape.quadraticCurveTo(w, -h, w, -h + r);
      shape.lineTo(w, h - r);
      shape.quadraticCurveTo(w, h, w - r, h);
      shape.lineTo(-w + r, h);
      shape.quadraticCurveTo(-w, h, -w, h - r);
      shape.lineTo(-w, -h + r);
      shape.quadraticCurveTo(-w, -h, -w + r, -h);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3 });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, 0.75, 0);
      geo.computeBoundingBox();
      const center = new THREE.Vector3();
      geo.boundingBox!.getCenter(center);
      geo.translate(-center.x, -center.y, -center.z);
      return geo;
    }
    case 'bottle': {
      const pts: THREE.Vector2[] = [];
      pts.push(new THREE.Vector2(0, 0));
      pts.push(new THREE.Vector2(0.25, 0));
      pts.push(new THREE.Vector2(0.25, 0.6));
      pts.push(new THREE.Vector2(0.22, 0.65));
      pts.push(new THREE.Vector2(0.1, 0.8));
      pts.push(new THREE.Vector2(0.08, 0.8));
      pts.push(new THREE.Vector2(0.08, 1.0));
      pts.push(new THREE.Vector2(0.1, 1.0));
      pts.push(new THREE.Vector2(0.1, 1.05));
      pts.push(new THREE.Vector2(0, 1.05));
      const geo = new THREE.LatheGeometry(pts, 32);
      geo.translate(0, -0.525, 0);
      return geo;
    }
    case 'bag': {
      const bw = 0.4, tw = 0.45, depth = 0.25, bagH = 0.9;
      const bagShape = new THREE.Shape();
      bagShape.moveTo(-bw, 0);
      bagShape.lineTo(bw, 0);
      bagShape.lineTo(tw, bagH);
      bagShape.lineTo(-tw, bagH);
      bagShape.closePath();
      const bagGeo = new THREE.ExtrudeGeometry(bagShape, { depth, bevelEnabled: false });
      bagGeo.translate(0, 0, -depth / 2);
      const handleL = new THREE.TorusGeometry(0.1, 0.015, 8, 16, Math.PI);
      handleL.translate(-0.2, bagH, 0);
      const handleR = new THREE.TorusGeometry(0.1, 0.015, 8, 16, Math.PI);
      handleR.translate(0.2, bagH, 0);
      const merged = mergeGeometries([bagGeo, handleL, handleR], false);
      if (merged) {
        merged.computeBoundingBox();
        const c = new THREE.Vector3();
        merged.boundingBox!.getCenter(c);
        merged.translate(-c.x, -c.y, -c.z);
        return merged;
      }
      return bagGeo;
    }
    case 'card':
      return new THREE.BoxGeometry(0.875, 0.5, 0.01);
    case 'laptop': {
      const base = new THREE.BoxGeometry(1.0, 0.05, 0.7);
      base.translate(0, -0.025, 0);
      const screen = new THREE.BoxGeometry(1.0, 0.6, 0.03);
      screen.translate(0, 0.3, -0.015);
      const tilt = (100 * Math.PI) / 180;
      screen.rotateX(-tilt);
      screen.translate(0, 0, -0.35);
      const merged = mergeGeometries([base, screen], false);
      if (merged) {
        merged.computeBoundingBox();
        const c = new THREE.Vector3();
        merged.boundingBox!.getCenter(c);
        merged.translate(-c.x, -c.y, -c.z);
        return merged;
      }
      return base;
    }
    case 'tablet': {
      const w = 0.6, h = 0.85, r = 0.03;
      const shape = new THREE.Shape();
      shape.moveTo(-w + r, -h);
      shape.lineTo(w - r, -h);
      shape.quadraticCurveTo(w, -h, w, -h + r);
      shape.lineTo(w, h - r);
      shape.quadraticCurveTo(w, h, w - r, h);
      shape.lineTo(-w + r, h);
      shape.quadraticCurveTo(-w, h, -w, h - r);
      shape.lineTo(-w, -h + r);
      shape.quadraticCurveTo(-w, -h, -w + r, -h);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
      geo.rotateX(-Math.PI / 2);
      geo.computeBoundingBox();
      const c = new THREE.Vector3();
      geo.boundingBox!.getCenter(c);
      geo.translate(-c.x, -c.y, -c.z);
      return geo;
    }
    case 'can': {
      const body = new THREE.CylinderGeometry(0.3, 0.3, 0.8, 32);
      const seam = new THREE.TorusGeometry(0.3, 0.012, 8, 32);
      seam.rotateX(Math.PI / 2);
      seam.translate(0, 0.4, 0);
      const top = new THREE.CylinderGeometry(0.28, 0.28, 0.02, 32);
      top.translate(0, 0.4 - 0.015, 0);
      const botSeam = new THREE.TorusGeometry(0.3, 0.012, 8, 32);
      botSeam.rotateX(Math.PI / 2);
      botSeam.translate(0, -0.4, 0);
      const merged = mergeGeometries([body, seam, top, botSeam], false);
      return merged ?? body;
    }
    case 'book':
      return new THREE.BoxGeometry(0.7, 1.0, 0.15);
    case 'donut': {
      const R = 0.35, r = 0.15;
      const body = new THREE.TorusGeometry(R, r, 16, 32);
      body.rotateX(Math.PI / 2);
      const icingR = r + 0.02;
      const icing = new THREE.TorusGeometry(R, icingR, 16, 32, Math.PI * 2);
      const icingPos = icing.attributes.position;
      for (let i = 0; i < icingPos.count; i++) {
        const y = icingPos.getY(i);
        if (y < -0.01) icingPos.setY(i, -0.01);
      }
      icingPos.needsUpdate = true;
      icing.computeVertexNormals();
      icing.rotateX(Math.PI / 2);
      const sprinkles: THREE.BufferGeometry[] = [];
      const sprinkleCount = 24;
      for (let i = 0; i < sprinkleCount; i++) {
        const angle = (i / sprinkleCount) * Math.PI * 2 + Math.random() * 0.3;
        const radialOffset = R + (Math.random() - 0.5) * r * 1.2;
        const sprinkle = new THREE.CylinderGeometry(0.008, 0.008, 0.04, 4);
        sprinkle.rotateZ(Math.random() * Math.PI);
        sprinkle.rotateX(Math.random() * 0.5);
        const x = Math.cos(angle) * radialOffset;
        const z = Math.sin(angle) * radialOffset;
        const y = r * 0.7 + Math.random() * 0.03;
        sprinkle.translate(x, y, z);
        sprinkles.push(sprinkle);
      }
      const parts = [body, icing, ...sprinkles];
      const merged = mergeGeometries(parts, false);
      return merged ?? body;
    }
    default:
      return null;
  }
}

function getObjectHalfHeight(type: string, scale: number): number {
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
    case 'custom': return 0.5 * scale;
    default: return 0.5 * scale;
  }
}

interface SceneObjectInstanceProps {
  object: SceneObjectInstance;
  isSelected: boolean;
}

function SceneObjectInstanceMesh({ object, isSelected }: SceneObjectInstanceProps) {
  const {
    id,
    type: objectType,
    customModelUrl,
    position,
    rotation,
    scale,
    color,
    material,
    roughness,
    metalness,
    transmission,
    ior,
    clearcoat,
    opacity,
    reflectivity,
    texture: objectTexture,
    textureRepeat,
    textureOffset,
    textureRotation,
    faceTextures,
    visible,
  } = object;

  const surfaces = useSceneStore((s) => s.surfaces);
  const snapToSurface = useSceneStore((s) => s.snapToSurface);
  const updateObject = useSceneStore((s) => s.updateObject);
  const selectObject = useSceneStore((s) => s.selectObject);
  const selectedFace = useSceneStore((s) => s.selectedFace);
  const setSelectedFace = useSceneStore((s) => s.setSelectedFace);
  const gizmoMode = useUIStore((s) => s.gizmoMode);
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const dragging = useRef(false);
  const gizmoDragging = useRef(false);
  const dragButton = useRef(0);
  const dragStart = useRef<{ x: number; y: number; pos: typeof position; rot: typeof rotation }>({
    x: 0, y: 0, pos: position, rot: rotation,
  });
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const { geometry: customGeometry } = useObjModel(objectType === 'custom' ? customModelUrl : null);

  // Global texture
  const [loadedTexture, setLoadedTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!objectTexture) { setLoadedTexture(null); return; }
    const loader = new THREE.TextureLoader();
    loader.load(objectTexture, (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      setLoadedTexture(tex);
    });
  }, [objectTexture]);

  useEffect(() => {
    if (!loadedTexture) return;
    loadedTexture.repeat.set(textureRepeat.x, textureRepeat.y);
    loadedTexture.offset.set(textureOffset.x, textureOffset.y);
    // Three.js textures are external mutable resources, not React state values.
    // We hold them in useState only to trigger re-renders when (re)loaded.
    // eslint-disable-next-line react-hooks/immutability
    loadedTexture.rotation = textureRotation;
    loadedTexture.needsUpdate = true;
    invalidate();
  }, [loadedTexture, textureRepeat, textureOffset, textureRotation, invalidate]);

  // Face textures
  const [loadedFaceTextures, setLoadedFaceTextures] = useState<Record<string, THREE.Texture>>({});
  useEffect(() => {
    const entries = Object.entries(faceTextures);
    if (entries.length === 0) { setLoadedFaceTextures({}); return; }
    let cancelled = false;
    const loadAll = async () => {
      const result: Record<string, THREE.Texture> = {};
      for (const [face, config] of entries) {
        const tex = await loadTextureFromUrl(config.url, config);
        if (cancelled) return;
        result[face] = tex;
      }
      if (!cancelled) {
        setLoadedFaceTextures(result);
        invalidate();
      }
    };
    loadAll();
    return () => { cancelled = true; };
  }, [faceTextures, invalidate]);

  useEffect(() => {
    for (const [face, config] of Object.entries(faceTextures)) {
      const tex = loadedFaceTextures[face];
      if (!tex) continue;
      tex.repeat.set(config.repeat.x, config.repeat.y);
      tex.offset.set(config.offset.x, config.offset.y);
      // Three.js textures are external mutable resources; held in state only
      // to drive re-renders. Mutating per-face transform fields is by design.
      // eslint-disable-next-line react-hooks/immutability
      tex.rotation = config.rotation;
      tex.needsUpdate = true;
    }
    invalidate();
  }, [faceTextures, loadedFaceTextures, invalidate]);

  useEffect(() => {
    invalidate();
  }, [objectType, customModelUrl, position, rotation, scale, color, material, roughness, metalness, transmission, ior, clearcoat, opacity, reflectivity, loadedTexture, loadedFaceTextures, selectedFace, isSelected, invalidate]);

  // Snap to surface
  useEffect(() => {
    if (!snapToSurface || surfaces.length === 0) return;
    const surfaceY = findSurfaceBelow(position, surfaces);
    if (surfaceY !== null) {
      const halfH = getObjectHalfHeight(objectType, scale);
      const targetY = surfaceY + halfH;
      if (Math.abs(position.y - targetY) > 0.01) {
        updateObject(id, { position: { ...position, y: targetY } });
      }
    }
  }, [position.x, position.z, surfaces, snapToSurface, objectType, scale]); // eslint-disable-line react-hooks/exhaustive-deps

  const primitiveGeometry = useMemo(() => buildPrimitiveGeometry(objectType), [objectType]);
  const geometry = objectType === 'custom' ? customGeometry : primitiveGeometry;

  const needsPhysical = material === 'glass' || material === 'plastic';

  const matProps = useMemo(() => {
    const base: Record<string, unknown> = { color, roughness, metalness };
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
      base.transmission = transmission;
      base.ior = ior;
      base.thickness = 0.5 + (1 - opacity) * 2.0;
      base.reflectivity = reflectivity;
      base.envMapIntensity = 1.0 + reflectivity * 2.0;
      base.attenuationDistance = 0.5 + opacity * 4.0;
      base.attenuationColor = color;
      base.transparent = false;
      base.opacity = 1;
      base.color = '#ffffff';
    }
    if (material === 'plastic') {
      base.clearcoat = clearcoat;
    }
    if (loadedTexture) {
      base.map = loadedTexture;
    }
    return base;
  }, [color, roughness, metalness, material, transmission, ior, opacity, clearcoat, reflectivity, loadedTexture]);

  // Drag handlers
  const onPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (gizmoDragging.current) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = true;
    dragButton.current = e.button;
    dragStart.current = { x: e.clientX, y: e.clientY, pos: { ...position }, rot: { ...rotation } };
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    selectObject(id);
  }, [position, rotation, id, selectObject]);

  const setHover = useHoverStore((s) => s.setLatest);

  // Track latest hover hit for drag-and-drop targeting. Runs on every pointer
  // move regardless of dragging state so the drop handler can read the most
  // recent face/object under the cursor.
  const onPointerHover = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (geometry && e.faceIndex != null) {
      const face = detectFace(objectType, e.faceIndex as number, geometry);
      setHover({ objectId: id, face });
    }
  }, [id, objectType, geometry, setHover]);

  const onPointerOut = useCallback(() => {
    dragging.current = false;
    // Only clear if we were the latest. Race-free enough — the next mesh's
    // onPointerHover will overwrite immediately if applicable.
    const latest = useHoverStore.getState().latest;
    if (latest?.objectId === id) setHover(null);
  }, [id, setHover]);

  const onPointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    onPointerHover(e);
    if (gizmoDragging.current) return;
    if (!dragging.current) return;
    e.stopPropagation();
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    if (dragButton.current === 2) {
      updateObject(id, {
        rotation: {
          x: dragStart.current.rot.x + dy * 0.01,
          y: dragStart.current.rot.y + dx * 0.01,
          z: dragStart.current.rot.z,
        },
      });
    } else if (dragButton.current === 1) {
      const fov = (camera as THREE.PerspectiveCamera).fov;
      const dist = camera.position.distanceTo(new THREE.Vector3(position.x, position.y, position.z));
      const vFov = (fov * Math.PI) / 180;
      const worldPerPixel = (2 * Math.tan(vFov / 2) * dist) / size.height;
      updateObject(id, {
        position: {
          x: dragStart.current.pos.x,
          y: dragStart.current.pos.y,
          z: dragStart.current.pos.z + dy * worldPerPixel,
        },
      });
    } else {
      const fov = (camera as THREE.PerspectiveCamera).fov;
      const dist = camera.position.distanceTo(new THREE.Vector3(position.x, position.y, position.z));
      const vFov = (fov * Math.PI) / 180;
      const worldPerPixelY = (2 * Math.tan(vFov / 2) * dist) / size.height;
      const worldPerPixelX = worldPerPixelY;
      updateObject(id, {
        position: {
          x: dragStart.current.pos.x + dx * worldPerPixelX,
          y: dragStart.current.pos.y - dy * worldPerPixelY,
          z: dragStart.current.pos.z,
        },
      });
    }
  }, [camera, size, position, id, updateObject, onPointerHover]);

  const onPointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (gizmoDragging.current) return;
    dragging.current = false;
    if (dragButton.current === 0 && pointerDownPos.current && geometry) {
      const dx = e.clientX - pointerDownPos.current.x;
      const dy = e.clientY - pointerDownPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 5 && e.faceIndex != null) {
        const faceName = detectFace(objectType, e.faceIndex as number, geometry);
        setSelectedFace(faceName === selectedFace ? null : faceName);
      }
    }
    pointerDownPos.current = null;
  }, [objectType, geometry, selectedFace, setSelectedFace]);

  const isBoxType = objectType === 'box' || objectType === 'card';
  const hasFaceTextures = Object.keys(loadedFaceTextures).length > 0;
  const useMultiMaterial = isBoxType && hasFaceTextures;

  useEffect(() => {
    if (useMultiMaterial && geometry) {
      ensureBoxGroups(geometry);
      invalidate();
    }
  }, [useMultiMaterial, geometry, invalidate]);

  const materials = useMemo(() => {
    if (!useMultiMaterial) return null;
    const MaterialClass = needsPhysical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    return BOX_FACE_NAMES.map((faceName) => {
      const props: Record<string, unknown> = { ...matProps };
      const faceTex = loadedFaceTextures[faceName];
      if (faceTex) props.map = faceTex;
      if (isSelected && faceName === selectedFace) {
        props.emissive = new THREE.Color(0x3b82f6);
        props.emissiveIntensity = 0.25;
      }
      return new MaterialClass(props);
    });
  }, [useMultiMaterial, needsPhysical, matProps, loadedFaceTextures, selectedFace, isSelected]);

  const singleMaterial = useMemo(() => {
    if (useMultiMaterial) return null;
    const props: Record<string, unknown> = { ...matProps };
    if (isSelected && selectedFace) {
      props.emissive = new THREE.Color(0x3b82f6);
      props.emissiveIntensity = 0.15;
    }
    return props;
  }, [useMultiMaterial, matProps, selectedFace, isSelected]);

  useEffect(() => {
    return () => {
      materials?.forEach((m) => m.dispose());
    };
  }, [materials]);

  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [groupReady, setGroupReady] = useState(false);

  useEffect(() => {
    if (!meshRef.current) return;
    if (useMultiMaterial && materials) {
      meshRef.current.material = materials;
    }
    invalidate();
  }, [useMultiMaterial, materials, invalidate]);

  // Sync the group transform from the store when the gizmo isn't actively dragging.
  useEffect(() => {
    if (gizmoDragging.current) return;
    const g = groupRef.current;
    if (!g) return;
    g.position.set(position.x, position.y, position.z);
    g.rotation.set(rotation.x, rotation.y, rotation.z);
    g.scale.setScalar(scale);
    invalidate();
  }, [position.x, position.y, position.z, rotation.x, rotation.y, rotation.z, scale, invalidate]);

  const onGizmoChange = useCallback(() => {
    const g = groupRef.current;
    if (!g) return;
    updateObject(id, {
      position: { x: g.position.x, y: g.position.y, z: g.position.z },
      rotation: { x: g.rotation.x, y: g.rotation.y, z: g.rotation.z },
      scale: g.scale.x,
    });
  }, [id, updateObject]);

  // Size of selection outline — uses geometry bounding sphere for a simple cue.
  // Must be called unconditionally before any early return.
  const selectionRadius = useMemo(() => {
    if (!geometry) return 0.7;
    geometry.computeBoundingSphere();
    return (geometry.boundingSphere?.radius ?? 0.7) * 1.08;
  }, [geometry]);

  if (!geometry || !visible) return null;

  return (
    <>
      <group ref={(el) => { groupRef.current = el; if (el && !groupReady) setGroupReady(true); }}>
        <mesh
          ref={meshRef}
          castShadow
          receiveShadow
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerOut}
        >
          <primitive object={geometry} attach="geometry" />
          {!useMultiMaterial && (needsPhysical ? (
            <meshPhysicalMaterial {...singleMaterial} />
          ) : (
            <meshStandardMaterial {...singleMaterial} />
          ))}
        </mesh>
        {isSelected && (
          <mesh raycast={() => null}>
            <sphereGeometry args={[selectionRadius, 24, 16]} />
            <meshBasicMaterial color="#3b82f6" wireframe transparent opacity={0.35} depthTest={false} />
          </mesh>
        )}
      </group>
      {isSelected && groupReady && groupRef.current && (
        <TransformControls
          object={groupRef.current}
          mode={gizmoMode}
          onObjectChange={onGizmoChange}
          onMouseDown={() => { gizmoDragging.current = true; }}
          onMouseUp={() => { gizmoDragging.current = false; onGizmoChange(); }}
        />
      )}
    </>
  );
}

export function SceneObjects() {
  const objects = useSceneStore((s) => s.objects);
  const selectedObjectId = useSceneStore((s) => s.selectedObjectId);
  return (
    <>
      {objects.map((obj) => (
        <SceneObjectInstanceMesh key={obj.id} object={obj} isSelected={obj.id === selectedObjectId} />
      ))}
    </>
  );
}
