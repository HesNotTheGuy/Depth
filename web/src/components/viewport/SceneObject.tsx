import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { TransformControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useSceneStore, type FaceTextureConfig, type SceneObjectInstance, type Vec3 } from '../../store/useSceneStore';
import { useUIStore } from '../../store/useUIStore';
import { useHoverStore } from '../../store/useHoverStore';
import { useAlignmentStore } from '../../store/useAlignmentStore';
import { snapPoseToSurfaces } from '../../utils/surfaceUtils';
import { computeAlignment, thresholdForZoom, type AlignmentInput } from '../../utils/alignmentUtils';
import { BOX_FACE_NAMES, detectFace } from './faceDetection';

/**
 * Build a world-space AABB for an object by combining its geometry's local
 * bounding box with its world transform. Returns null if the geometry has
 * no bounding box yet.
 */
function computeWorldBounds(
  obj: { position: Vec3; rotation: Vec3; scale: number },
  geometry: THREE.BufferGeometry | null,
): { min: Vec3; max: Vec3 } | null {
  if (!geometry) return null;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const local = geometry.boundingBox;
  if (!local) return null;
  const m = new THREE.Matrix4();
  const euler = new THREE.Euler(obj.rotation.x, obj.rotation.y, obj.rotation.z);
  const q = new THREE.Quaternion().setFromEuler(euler);
  m.compose(
    new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z),
    q,
    new THREE.Vector3(obj.scale, obj.scale, obj.scale),
  );
  const worldBox = local.clone().applyMatrix4(m);
  return {
    min: { x: worldBox.min.x, y: worldBox.min.y, z: worldBox.min.z },
    max: { x: worldBox.max.x, y: worldBox.max.y, z: worldBox.max.z },
  };
}

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
    // Only blob: (current runtime path via URL.createObjectURL) and data:
    // (future inline payloads) are trusted. Persisted scenes could otherwise
    // smuggle in http(s) URLs and turn import into SSRF / tracking pixel.
    if (!url.startsWith('blob:') && !url.startsWith('data:')) {
      console.warn('[depth] Refusing to load OBJ from non-blob URL:', url.slice(0, 80));
      setError(true);
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
      // Half-torus C-handle on +X. rotateZ stands the C vertically in XY
      // (opens toward -X into the cylinder). Translate so the tube intersects
      // the cylinder wall — too far out and the handle floats detached.
      const handle = new THREE.TorusGeometry(0.18, 0.055, 12, 24, Math.PI);
      handle.rotateZ(Math.PI / 2);
      handle.translate(0.48, 0, 0);
      const merged = mergeGeometries([body, handle], false);
      body.dispose();
      handle.dispose();
      return merged ?? new THREE.CylinderGeometry(0.35, 0.35, 0.8, 32);
    }
    case 'phone': {
      // Body only — the screen is a separate mesh in SceneObject so a PNG
      // can map onto it without multi-material group hacks.
      const w = 0.38;
      const h = 0.78;
      const r = 0.06;
      const depth = 0.07;
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
      const body = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.012,
        bevelSegments: 3,
      });
      body.translate(0, 0, -depth / 2);
      body.computeBoundingBox();
      const center = new THREE.Vector3();
      body.boundingBox!.getCenter(center);
      body.translate(-center.x, -center.y, -center.z);
      return body;
    }
    case 'image': {
      // Unit plane; aspect is corrected at render time from the texture.
      return new THREE.PlaneGeometry(1, 1);
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
      // ExtrudeGeometry is non-indexed but TorusGeometry is indexed.
      // mergeGeometries requires all parts to share index-ness, so convert
      // the torus handles to non-indexed to match the bag body.
      const bagGeo = new THREE.ExtrudeGeometry(bagShape, { depth, bevelEnabled: false });
      bagGeo.translate(0, 0, -depth / 2);
      const torusL = new THREE.TorusGeometry(0.1, 0.015, 8, 16, Math.PI);
      const handleL = torusL.toNonIndexed();
      torusL.dispose();
      handleL.translate(-0.2, bagH, 0);
      const torusR = new THREE.TorusGeometry(0.1, 0.015, 8, 16, Math.PI);
      const handleR = torusR.toNonIndexed();
      torusR.dispose();
      handleR.translate(0.2, bagH, 0);
      const merged = mergeGeometries([bagGeo, handleL, handleR], false);
      if (merged) {
        bagGeo.dispose();
        handleL.dispose();
        handleR.dispose();
        merged.computeBoundingBox();
        const c = new THREE.Vector3();
        merged.boundingBox!.getCenter(c);
        merged.translate(-c.x, -c.y, -c.z);
        return merged;
      }
      // Merge failed — dispose the unused intermediates and return the
      // main bag geometry as a fallback.
      handleL.dispose();
      handleR.dispose();
      return bagGeo;
    }
    case 'card':
      return new THREE.BoxGeometry(0.875, 0.5, 0.01);
    case 'laptop': {
      // Keyboard deck only — the display is a separate mesh so a PNG can
      // map onto the screen without multi-material group hacks.
      const base = new THREE.BoxGeometry(1.0, 0.05, 0.7);
      base.translate(0, -0.025, 0);
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
      if (merged) {
        body.dispose();
        seam.dispose();
        top.dispose();
        botSeam.dispose();
        return merged;
      }
      // Merge failed — keep body, dispose unused intermediates.
      seam.dispose();
      top.dispose();
      botSeam.dispose();
      return body;
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
      if (merged) {
        for (const p of parts) p.dispose();
        return merged;
      }
      // Merge failed — keep body, dispose the rest.
      icing.dispose();
      for (const s of sprinkles) s.dispose();
      return body;
    }
    default:
      return null;
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

  // Global texture. Each time the URL changes, dispose the previously-loaded
  // GPU texture before swapping in the next one. On unmount, dispose whatever
  // is still loaded. Without this, every texture swap (e.g. switching
  // material presets) leaks VRAM until GC eventually reclaims the JS wrapper.
  const [loadedTexture, setLoadedTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!objectTexture) {
      setLoadedTexture((prev) => { prev?.dispose(); return null; });
      return;
    }
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load(
      objectTexture,
      (tex) => {
        if (cancelled) { tex.dispose(); return; }
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        setLoadedTexture((prev) => { prev?.dispose(); return tex; });
        invalidate();
      },
      undefined,
      (err) => {
        console.warn('[depth] failed to load object texture', err);
      },
    );
    return () => { cancelled = true; };
  }, [objectTexture, invalidate]);

  // Final unmount cleanup — covers the case where the component goes away
  // without `objectTexture` flipping to null first. We track the latest
  // texture in a ref so the unmount cleanup disposes whatever is actually
  // loaded (not the stale closure-captured initial null).
  const loadedTextureRef = useRef<THREE.Texture | null>(null);
  useEffect(() => { loadedTextureRef.current = loadedTexture; }, [loadedTexture]);
  useEffect(() => {
    return () => { loadedTextureRef.current?.dispose(); };
  }, []);

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

  // Face textures. Same disposal discipline as the global texture: previous
  // textures must be released before swapping in fresh ones, otherwise every
  // edit to a faceTextures entry leaks a GPU texture.
  const [loadedFaceTextures, setLoadedFaceTextures] = useState<Record<string, THREE.Texture>>({});
  useEffect(() => {
    const entries = Object.entries(faceTextures);
    if (entries.length === 0) {
      setLoadedFaceTextures((prev) => {
        for (const t of Object.values(prev)) t.dispose();
        return {};
      });
      return;
    }
    let cancelled = false;
    const loadAll = async () => {
      const result: Record<string, THREE.Texture> = {};
      for (const [face, config] of entries) {
        const tex = await loadTextureFromUrl(config.url, config);
        if (cancelled) { tex.dispose(); return; }
        result[face] = tex;
      }
      if (!cancelled) {
        setLoadedFaceTextures((prev) => {
          for (const t of Object.values(prev)) t.dispose();
          return result;
        });
        invalidate();
      } else {
        for (const t of Object.values(result)) t.dispose();
      }
    };
    loadAll();
    return () => { cancelled = true; };
  }, [faceTextures, invalidate]);

  // Unmount cleanup for face textures, tracked via ref to escape the
  // closure-captured initial state.
  const loadedFaceTexturesRef = useRef<Record<string, THREE.Texture>>({});
  useEffect(() => { loadedFaceTexturesRef.current = loadedFaceTextures; }, [loadedFaceTextures]);
  useEffect(() => {
    return () => {
      for (const t of Object.values(loadedFaceTexturesRef.current)) t.dispose();
    };
  }, []);

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

  // Snap to surface — height from plane normal at object XZ, optional tilt align.
  useEffect(() => {
    if (!snapToSurface || surfaces.length === 0) return;
    const snapped = snapPoseToSurfaces(
      position,
      rotation,
      objectType,
      scale,
      surfaces,
      true,
      { alignToNormal: true },
    );
    const posDelta = Math.abs(snapped.position.y - position.y);
    const rot = snapped.rotation;
    const rotDelta = rot
      ? Math.abs(rot.x - rotation.x) + Math.abs(rot.z - rotation.z)
      : 0;
    if (posDelta > 0.01 || rotDelta > 0.01) {
      updateObject(id, {
        position: snapped.position,
        ...(rot ? { rotation: rot } : {}),
      });
    }
  }, [position.x, position.z, surfaces, snapToSurface, objectType, scale]); // eslint-disable-line react-hooks/exhaustive-deps

  const primitiveGeometry = useMemo(() => buildPrimitiveGeometry(objectType), [objectType]);
  // Dispose the previous primitive geometry when objectType changes (and on
  // unmount). Without this, every type change leaks a BufferGeometry — the
  // useMemo just drops its reference and GC eventually collects the JS
  // wrapper, but the GPU buffer stays allocated until then.
  const prevPrimitiveRef = useRef<THREE.BufferGeometry | null>(null);
  useEffect(() => {
    const prev = prevPrimitiveRef.current;
    if (prev && prev !== primitiveGeometry) prev.dispose();
    prevPrimitiveRef.current = primitiveGeometry;
  }, [primitiveGeometry]);
  useEffect(() => {
    return () => { prevPrimitiveRef.current?.dispose(); };
  }, []);
  const geometry = objectType === 'custom' ? customGeometry : primitiveGeometry;

  // Image plates: resize the unit plane to match the PNG's aspect ratio.
  // Must run after `geometry` is declared — referencing it earlier hits TDZ.
  useEffect(() => {
    if (objectType !== 'image' || !geometry || !loadedTexture?.image) return;
    const img = loadedTexture.image as { width?: number; height?: number };
    const w = img.width ?? 1;
    const h = img.height ?? 1;
    const aspect = w / Math.max(1, h);
    const planeW = aspect >= 1 ? 1 : aspect;
    const planeH = aspect >= 1 ? 1 / aspect : 1;
    const next = new THREE.PlaneGeometry(planeW, planeH);
    geometry.copy(next);
    next.dispose();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    invalidate();
  }, [objectType, geometry, loadedTexture, invalidate]);

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
    // Phone/tablet/laptop keep the PNG on the dedicated screen plate — don't
    // also wrap it across the body UVs (looks like a broken sticker).
    const screenDevice = objectType === 'phone' || objectType === 'tablet' || objectType === 'laptop';
    if (loadedTexture && !screenDevice) {
      base.map = loadedTexture;
    }
    return base;
  }, [color, roughness, metalness, material, transmission, ior, opacity, clearcoat, reflectivity, loadedTexture, objectType]);

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
      return;
    }

    // Translation drags: optionally apply smart alignment / snapping.
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const dist = camera.position.distanceTo(new THREE.Vector3(position.x, position.y, position.z));
    const vFov = (fov * Math.PI) / 180;
    const worldPerPixel = (2 * Math.tan(vFov / 2) * dist) / size.height;

    let candidatePos: Vec3;
    if (dragButton.current === 1) {
      candidatePos = {
        x: dragStart.current.pos.x,
        y: dragStart.current.pos.y,
        z: dragStart.current.pos.z + dy * worldPerPixel,
      };
    } else {
      candidatePos = {
        x: dragStart.current.pos.x + dx * worldPerPixel,
        y: dragStart.current.pos.y - dy * worldPerPixel,
        z: dragStart.current.pos.z,
      };
    }

    // Alt bypasses alignment entirely so the user can place freely.
    const native = e.nativeEvent as PointerEvent | undefined;
    const altPressed = native?.altKey === true;

    let finalPos = candidatePos;
    if (!altPressed && geometry) {
      const draggedWorldBounds = computeWorldBounds(
        { position: candidatePos, rotation, scale },
        geometry,
      );
      if (draggedWorldBounds) {
        const sceneState = useSceneStore.getState();
        const otherObjects: AlignmentInput['otherObjects'] = [];
        for (const o of sceneState.objects) {
          if (o.id === id || !o.visible) continue;
          // Use the primitive shape's geometry for AABB. For 'custom' types
          // we don't have the loaded OBJ here; fall back to a unit box which
          // still gives reasonable edge/center alignment behavior. Dispose
          // immediately after reading the bounds — without this, every drag
          // pointer-move leaks one geometry per other-object in the scene.
          const otherGeo = buildPrimitiveGeometry(o.type) ?? new THREE.BoxGeometry(1, 1, 1);
          const bounds = computeWorldBounds(
            { position: o.position, rotation: o.rotation, scale: o.scale },
            otherGeo,
          );
          otherGeo.dispose();
          if (!bounds) continue;
          otherObjects.push({
            id: o.id,
            bounds,
            centerWorld: {
              x: (bounds.min.x + bounds.max.x) / 2,
              y: (bounds.min.y + bounds.max.y) / 2,
              z: (bounds.min.z + bounds.max.z) / 2,
            },
          });
        }

        const threshold = thresholdForZoom(useUIStore.getState().canvasZoom);
        const { snappedPos, snaps } = computeAlignment({
          draggedId: id,
          draggedBounds: draggedWorldBounds,
          candidatePos,
          otherObjects,
          threshold,
        });
        finalPos = snappedPos;
        useAlignmentStore.getState().setActiveGuides(snaps);
      }
    } else {
      // Alt held or no geometry: ensure stale guides clear immediately.
      useAlignmentStore.getState().setActiveGuides([]);
    }

    updateObject(id, { position: finalPos });
  }, [camera, size, position, rotation, scale, id, geometry, updateObject, onPointerHover]);

  const onPointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (gizmoDragging.current) return;
    dragging.current = false;
    useAlignmentStore.getState().clearGuides();
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

  if (!geometry || !visible) return null;

  return (
    <>
      <group ref={(el) => { groupRef.current = el; if (el && !groupReady) setGroupReady(true); }}>
        <mesh
          ref={meshRef}
          castShadow={objectType !== 'image'}
          receiveShadow
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerOut}
        >
          <primitive object={geometry} attach="geometry" />
          {!useMultiMaterial && (needsPhysical ? (
            <meshPhysicalMaterial
              {...singleMaterial}
              {...(objectType === 'image'
                ? { transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: true }
                : {})}
            />
          ) : (
            <meshStandardMaterial
              {...singleMaterial}
              {...(objectType === 'image'
                ? { transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: true }
                : {})}
            />
          ))}
        </mesh>

        {/* Device screen plates — faceTextures.front (or global texture) shows here.
            Use MeshBasicMaterial so artwork stays readable regardless of scene lighting.
            Sit the plate clearly in front of the beveled phone body. */}
        {objectType === 'phone' && (
          <mesh
            position={[0, 0.02, 0.055]}
            castShadow={false}
            receiveShadow={false}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerOut}
          >
            <planeGeometry args={[0.58, 1.2]} />
            <meshBasicMaterial
              key={loadedFaceTextures.front?.uuid ?? loadedTexture?.uuid ?? 'phone-screen-empty'}
              map={loadedFaceTextures.front ?? loadedTexture ?? null}
              color={loadedFaceTextures.front || loadedTexture ? '#ffffff' : '#0a0a0a'}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {objectType === 'tablet' && (
          <mesh
            position={[0, 0.035, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            castShadow={false}
            receiveShadow={false}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerOut}
          >
            <planeGeometry args={[1.05, 1.5]} />
            <meshBasicMaterial
              key={loadedFaceTextures.front?.uuid ?? loadedTexture?.uuid ?? 'tablet-screen-empty'}
              map={loadedFaceTextures.front ?? loadedTexture ?? null}
              color={loadedFaceTextures.front || loadedTexture ? '#ffffff' : '#0a0a0a'}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {objectType === 'laptop' && (
          <>
            {/* Display bezel */}
            <mesh
              position={[0, 0.28, -0.32]}
              rotation={[(-100 * Math.PI) / 180, 0, 0]}
              castShadow
              receiveShadow
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerOut}
            >
              <boxGeometry args={[1.0, 0.62, 0.02]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.45} metalness={0.2} />
            </mesh>
            {/* Display content — slightly in front of the bezel */}
            <mesh
              position={[0, 0.28, -0.295]}
              rotation={[(-100 * Math.PI) / 180, 0, 0]}
              castShadow={false}
              receiveShadow={false}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerOut}
            >
              <planeGeometry args={[0.9, 0.52]} />
              <meshBasicMaterial
                key={loadedFaceTextures.front?.uuid ?? loadedTexture?.uuid ?? 'laptop-screen-empty'}
                map={loadedFaceTextures.front ?? loadedTexture ?? null}
                color={loadedFaceTextures.front || loadedTexture ? '#ffffff' : '#0a0a0a'}
                toneMapped={false}
              />
            </mesh>
          </>
        )}

        {isSelected && geometry && objectType !== 'image' && (
          <lineSegments raycast={() => null} renderOrder={2}>
            <edgesGeometry args={[geometry, 55]} />
            <lineBasicMaterial color="#a78bfa" transparent opacity={0.75} />
          </lineSegments>
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

/** Per-object drop shadow: a small ContactShadows directly under the object,
 *  separate from the scene-wide contact shadow in CompositeViewport. The
 *  shadow plane sits at `groundY` (lowest visible surface) and is centered
 *  under the object plus the user's offset. Blur is mapped from the
 *  0–20 px UI range to drei's blur units. */
function ObjectDropShadow({ object, groundY }: { object: SceneObjectInstance; groundY: number }) {
  const ds = object.dropShadow;
  if (!ds || !ds.enabled || !object.visible) return null;
  const { position } = object;
  return (
    <ContactShadows
      position={[position.x + ds.offsetX, groundY + 0.001, position.z + ds.offsetZ]}
      opacity={ds.opacity}
      blur={Math.max(0.1, ds.blur / 4)}
      color={ds.color}
      scale={Math.max(1.5, object.scale * 2.5)}
      far={Math.max(1, object.scale * 2)}
      resolution={256}
      frames={1}
    />
  );
}

export function SceneObjects() {
  const objects = useSceneStore((s) => s.objects);
  const selectedObjectId = useSceneStore((s) => s.selectedObjectId);
  const surfaces = useSceneStore((s) => s.surfaces);
  const groundY = surfaces.length > 0
    ? Math.min(...surfaces.filter((s) => s.visible).map((s) => s.position.y), 0) - 0.01
    : -0.01;
  return (
    <>
      {objects.map((obj) => (
        <SceneObjectInstanceMesh key={obj.id} object={obj} isSelected={obj.id === selectedObjectId} />
      ))}
      {objects.map((obj) => (
        <ObjectDropShadow key={`ds-${obj.id}`} object={obj} groundY={groundY} />
      ))}
    </>
  );
}
