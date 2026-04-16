import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { useSceneStore, type FaceTextureConfig } from '../../store/useSceneStore';
import { findSurfaceBelow } from '../../utils/surfaceUtils';

// Material configs are now driven by store values

/**
 * Map a BoxGeometry faceIndex (triangle index) to a named face.
 * BoxGeometry generates 6 faces of 2 triangles each, in order:
 * group 0: +X (right), group 1: -X (left), group 2: +Y (top),
 * group 3: -Y (bottom), group 4: +Z (front), group 5: -Z (back)
 */
const BOX_FACE_NAMES = ['right', 'left', 'top', 'bottom', 'front', 'back'] as const;

function faceIndexToBoxFace(faceIndex: number): string {
  const groupIndex = Math.floor(faceIndex / 2);
  return BOX_FACE_NAMES[groupIndex] ?? 'front';
}

/** For cylindrical shapes, determine body vs cap from faceIndex and geometry */
function faceIndexToCylindricalPart(faceIndex: number, geometry: THREE.BufferGeometry): string {
  // CylinderGeometry: side triangles come first, then top cap, then bottom cap
  const groups = geometry.groups;
  if (groups.length > 0) {
    for (const group of groups) {
      const startTri = group.start / 3;
      const endTri = startTri + group.count / 3;
      if (faceIndex >= startTri && faceIndex < endTri) {
        return `group_${group.materialIndex}`;
      }
    }
  }
  // Fallback for standard CylinderGeometry: segments * 2 side triangles, then caps
  // radialSegments defaults to 32 => 64 side triangles
  const index = geometry.index;
  const totalTriangles = index ? index.count / 3 : 0;
  // Heuristic: caps are last ~32 triangles each for 32 segments
  if (totalTriangles > 0 && faceIndex >= totalTriangles - 64) {
    return faceIndex >= totalTriangles - 32 ? 'bottom' : 'top';
  }
  return 'body';
}

/** Determine which face was clicked based on object type and intersection */
function detectFace(
  objectType: string,
  faceIndex: number,
  geometry: THREE.BufferGeometry,
): string {
  switch (objectType) {
    case 'box':
    case 'card':
      return faceIndexToBoxFace(faceIndex);
    case 'phone':
      // Phone is an ExtrudeGeometry — use faceIndex heuristic:
      // front face (extruded face), back face, and sides
      // For simplicity, map large groups to front/back/sides
      return faceIndex < 2 ? 'front' : faceIndex < 4 ? 'back' : 'sides';
    case 'mug':
    case 'bottle':
    case 'cylinder':
      return faceIndexToCylindricalPart(faceIndex, geometry);
    default:
      return 'all';
  }
}

/**
 * For box-based geometries, ensure they have 6 material groups
 * (one per face pair of triangles) so we can assign per-face materials.
 */
function ensureBoxGroups(geometry: THREE.BufferGeometry): void {
  if (geometry.groups.length === 6) return; // already set up
  geometry.clearGroups();
  for (let i = 0; i < 6; i++) {
    geometry.addGroup(i * 6, 6, i);
  }
}

/** Load a texture from a data URL and configure it */
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
  const objectTexture = useSceneStore((s) => s.objectTexture);
  const textureRepeat = useSceneStore((s) => s.textureRepeat);
  const textureOffset = useSceneStore((s) => s.textureOffset);
  const textureRotation = useSceneStore((s) => s.textureRotation);
  const faceTextures = useSceneStore((s) => s.faceTextures);
  const selectedFace = useSceneStore((s) => s.selectedFace);
  const setSelectedFace = useSceneStore((s) => s.setSelectedFace);
  const invalidate = useThree((s) => s.invalidate);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dragging = useRef(false);
  const dragStart = useRef<{ x: number; y: number; pos: typeof position }>({ x: 0, y: 0, pos: position });

  const { geometry: customGeometry } = useObjModel(
    objectType === 'custom' ? customModelUrl : null
  );

  // Load texture from data URL
  const [loadedTexture, setLoadedTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    if (!objectTexture) {
      setLoadedTexture(null);
      return;
    }
    const loader = new THREE.TextureLoader();
    loader.load(objectTexture, (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      setLoadedTexture(tex);
    });
  }, [objectTexture]);

  // Update texture transform parameters
  useEffect(() => {
    if (!loadedTexture) return;
    loadedTexture.repeat.set(textureRepeat.x, textureRepeat.y);
    loadedTexture.offset.set(textureOffset.x, textureOffset.y);
    loadedTexture.rotation = textureRotation;
    loadedTexture.needsUpdate = true;
    invalidate();
  }, [loadedTexture, textureRepeat, textureOffset, textureRotation, invalidate]);

  // Load per-face textures
  const [loadedFaceTextures, setLoadedFaceTextures] = useState<Record<string, THREE.Texture>>({});

  useEffect(() => {
    const entries = Object.entries(faceTextures);
    if (entries.length === 0) {
      setLoadedFaceTextures({});
      return;
    }
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

  // Update face texture transforms when they change
  useEffect(() => {
    for (const [face, config] of Object.entries(faceTextures)) {
      const tex = loadedFaceTextures[face];
      if (!tex) continue;
      tex.repeat.set(config.repeat.x, config.repeat.y);
      tex.offset.set(config.offset.x, config.offset.y);
      tex.rotation = config.rotation;
      tex.needsUpdate = true;
    }
    invalidate();
  }, [faceTextures, loadedFaceTextures, invalidate]);

  // Track pointer movement to distinguish click from drag
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  // Invalidate on any prop change so demand-mode canvas re-renders
  useEffect(() => {
    invalidate();
  }, [objectType, customModelUrl, position, rotation, scale, color, material, roughness, metalness, transmission, ior, clearcoat, opacity, reflectivity, loadedTexture, loadedFaceTextures, selectedFace, invalidate]);

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

      // --- Mockup presets ---

      case 'mug': {
        const body = new THREE.CylinderGeometry(0.35, 0.35, 0.8, 32);
        const handle = new THREE.TorusGeometry(0.18, 0.04, 12, 24, Math.PI);
        handle.rotateZ(Math.PI / 2);
        handle.translate(0.35, 0, 0);
        return mergeGeometries([body, handle], false) ?? body;
      }

      case 'phone': {
        const w = 0.38;
        const h = 0.75;
        const r = 0.06;
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

      case 'card': {
        return new THREE.BoxGeometry(0.875, 0.5, 0.01);
      }

      case 'donut': {
        // 🍩 The classic Blender donut — an easter egg for 3D beginners
        const R = 0.35, r = 0.15; // torus major/minor radius

        // Donut body
        const body = new THREE.TorusGeometry(R, r, 16, 32);
        body.rotateX(Math.PI / 2); // lay flat

        // Icing — slightly larger half-torus on top
        const icingR = r + 0.02;
        const icing = new THREE.TorusGeometry(R, icingR, 16, 32, Math.PI * 2);
        // Keep only upper half by clipping: scale Y of vertices below center to 0
        const icingPos = icing.attributes.position;
        for (let i = 0; i < icingPos.count; i++) {
          const y = icingPos.getY(i);
          if (y < -0.01) {
            icingPos.setY(i, -0.01);
          }
        }
        icingPos.needsUpdate = true;
        icing.computeVertexNormals();
        icing.rotateX(Math.PI / 2);

        // Sprinkles — small capsule-like cylinders scattered on top
        const sprinkles: THREE.BufferGeometry[] = [];
        const sprinkleCount = 24;
        for (let i = 0; i < sprinkleCount; i++) {
          const angle = (i / sprinkleCount) * Math.PI * 2 + Math.random() * 0.3;
          const radialOffset = R + (Math.random() - 0.5) * r * 1.2;
          const sprinkle = new THREE.CylinderGeometry(0.008, 0.008, 0.04, 4);
          // Random tilt
          sprinkle.rotateZ(Math.random() * Math.PI);
          sprinkle.rotateX(Math.random() * 0.5);
          // Position on top of the donut
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
    // Apply texture map — multiplies with base color
    if (loadedTexture) {
      base.map = loadedTexture;
    }
    return base;
  }, [color, roughness, metalness, material, transmission, ior, opacity, clearcoat, reflectivity, loadedTexture]);

  // Drag to reposition object in screen-space XY
  const onPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, pos: { ...position } };
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
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

  const onPointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    dragging.current = false;

    // Detect click (not drag) for face selection
    if (pointerDownPos.current && geometry) {
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

  // Determine if we should use multi-material (box/card with face textures)
  const isBoxType = objectType === 'box' || objectType === 'card';
  const hasFaceTextures = Object.keys(loadedFaceTextures).length > 0;
  const useMultiMaterial = isBoxType && hasFaceTextures;

  // Ensure box geometry has groups for multi-material
  useEffect(() => {
    if (useMultiMaterial && geometry) {
      ensureBoxGroups(geometry);
      invalidate();
    }
  }, [useMultiMaterial, geometry, invalidate]);

  // Build material array for box multi-material rendering
  const materials = useMemo(() => {
    if (!useMultiMaterial) return null;

    const MaterialClass = needsPhysical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    return BOX_FACE_NAMES.map((faceName) => {
      const props: Record<string, unknown> = { ...matProps };
      const faceTex = loadedFaceTextures[faceName];
      if (faceTex) {
        props.map = faceTex;
      }
      // Highlight selected face
      if (faceName === selectedFace) {
        props.emissive = new THREE.Color(0x3b82f6);
        props.emissiveIntensity = 0.25;
      }
      return new MaterialClass(props);
    });
  }, [useMultiMaterial, needsPhysical, matProps, loadedFaceTextures, selectedFace]);

  // Build single material with optional face highlight (for non-box types)
  const singleMaterial = useMemo(() => {
    if (useMultiMaterial) return null;
    const props: Record<string, unknown> = { ...matProps };
    if (selectedFace) {
      props.emissive = new THREE.Color(0x3b82f6);
      props.emissiveIntensity = 0.15;
    }
    return props;
  }, [useMultiMaterial, matProps, selectedFace]);

  // Clean up materials on unmount or change
  useEffect(() => {
    return () => {
      materials?.forEach((m) => m.dispose());
    };
  }, [materials]);

  // Ref to imperatively assign material array
  const meshRef = useRef<THREE.Mesh>(null);

  // Apply multi-material array imperatively (R3F doesn't support material arrays declaratively)
  useEffect(() => {
    if (!meshRef.current) return;
    if (useMultiMaterial && materials) {
      meshRef.current.material = materials;
    }
    invalidate();
  }, [useMultiMaterial, materials, invalidate]);

  if (!geometry) return null;

  return (
    <mesh
      ref={meshRef}
      position={[position.x, position.y, position.z]}
      rotation={[rotation.x, rotation.y, rotation.z]}
      scale={scale}
      castShadow
      receiveShadow
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => { dragging.current = false; }}
    >
      <primitive object={geometry} attach="geometry" />
      {!useMultiMaterial && (needsPhysical ? (
        <meshPhysicalMaterial {...singleMaterial} />
      ) : (
        <meshStandardMaterial {...singleMaterial} />
      ))}
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
    case 'mug': return 0.4 * scale;
    case 'phone': return 0.75 * scale;
    case 'bottle': return 0.525 * scale;
    case 'bag': return 0.5 * scale;
    case 'card': return 0.25 * scale;
    case 'donut': return 0.15 * scale;
    case 'custom': return 0.5 * scale;
    default: return 0.5 * scale;
  }
}
