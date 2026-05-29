import * as THREE from 'three';
import { downloadBlob } from './exportHelpers';
import { useSceneStore, type ExportFormat } from '../store/useSceneStore';
import { buildSidecarScene, type SerializableSceneState } from './sceneSerializer';

/**
 * Detect once at module load whether the Depth app is running inside an
 * embedding host (e.g. the Figma plugin) that wants export bytes via
 * postMessage instead of a browser download.
 */
const isEmbedded =
  typeof window !== 'undefined' &&
  window.parent !== window &&
  new URLSearchParams(window.location.search).get('embed') === 'figma';

/**
 * Bridge surface exposed by the Electron preload script. When present, the
 * desktop build can offload heavy renders to the native C++ sidecar instead
 * of canvas.toBlob.
 */
interface DepthElectronBridge {
  isElectron: true;
  getStatus: () => Promise<{ ready: boolean; version: string | null }>;
  render: (scene: unknown) => Promise<{ png: string; width?: number; height?: number }>;
  exportLayered: (
    scene: unknown
  ) => Promise<{ composite: string; foreground: string; shadow: string }>;
}

/** True when running inside the Electron desktop shell. */
export const isElectron: boolean =
  typeof window !== 'undefined' &&
  typeof (window as unknown as { depth?: DepthElectronBridge }).depth !== 'undefined';

/** Access the Electron bridge (only call when isElectron is true). */
function depthBridge(): DepthElectronBridge {
  return (window as unknown as { depth: DepthElectronBridge }).depth;
}

/** Material presets the native sidecar renderer fully supports. Anything
 *  else (the procedural "library" presets) is mapped to Matte and would
 *  render incorrectly, so we route those scenes through the canvas path. */
const SIDECAR_MATERIALS = new Set(['matte', 'glossy', 'metallic', 'glass', 'plastic']);

/** True when every object in the scene uses only features the native
 *  sidecar can render faithfully. Returns false for per-face textures,
 *  custom OBJ meshes, non-normal blend modes, or library materials. */
function sidecarCanRender(): boolean {
  const s = useSceneStore.getState();
  if (s.blendMode !== 'normal') return false;
  return s.objects.every(
    (o) =>
      o.type !== 'custom' &&
      !o.customModelUrl &&
      Object.keys(o.faceTextures).length === 0 &&
      SIDECAR_MATERIALS.has(o.material)
  );
}

/** Decode a base64 PNG into a Blob for download/postMessage. */
function base64ToBlob(b64: string, mime = 'image/png'): Blob {
  const bin = atob(b64);
  const len = bin.length;
  const buf = new Uint8Array(len);
  for (let i = 0; i < len; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

/**
 * Snapshot the current store state and the live Three.js camera into a
 * sidecar-ready JSON payload. Pure-ish: reads the Zustand store and the
 * camera, but performs no IO.
 */
function captureSidecarScene(
  camera: THREE.Camera,
  width: number,
  height: number
): Record<string, unknown> {
  const s = useSceneStore.getState();
  const state: SerializableSceneState = {
    backgroundImage: s.backgroundImage,
    estimatedLighting: s.estimatedLighting,
    objects: s.objects,
    sceneLights: s.sceneLights,
    surfaces: s.surfaces,
    blendMode: s.blendMode,
    brightness: s.brightness,
    lightAngle: s.lightAngle,
    lightElevation: s.lightElevation,
    lightColor: s.lightColor,
    shadowOpacity: s.shadowOpacity,
    shadowSoftness: s.shadowSoftness,
    shadowColor: s.shadowColor,
  };

  const camPos = new THREE.Vector3();
  camera.getWorldPosition(camPos);
  const camTarget = new THREE.Vector3(0, 0, 0);
  // OrbitControls keeps target separate; the camera's forward gives us a
  // reasonable fallback even when controls aren't in scope here.
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  camTarget.copy(camPos).add(dir.multiplyScalar(camPos.length() || 1));

  const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 45;

  return buildSidecarScene(state, {
    width,
    height,
    camera: {
      position: [camPos.x, camPos.y, camPos.z],
      target: [camTarget.x, camTarget.y, camTarget.z],
      fov,
    },
  });
}

/** Post a blob's bytes to the parent window instead of downloading. */
async function postBlobToParent(
  blob: Blob,
  width: number,
  height: number
): Promise<void> {
  const arrayBuffer = await blob.arrayBuffer();
  window.parent.postMessage(
    {
      type: 'depth-export',
      png: arrayBuffer,
      width,
      height,
    },
    '*'
  );
}

/** Map export format to MIME type */
function formatToMime(format: ExportFormat): string {
  switch (format) {
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    default: return 'image/png';
  }
}

/** JPEG quality (0-1). Only used for lossy formats. */
const JPEG_QUALITY = 0.92;
const WEBP_QUALITY = 0.90;

/**
 * Render the Three.js scene to a PNG blob at the given resolution.
 * Works with frameloop="demand" by manually calling gl.render().
 */
export async function captureCanvas(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
  format: ExportFormat = 'png'
): Promise<Blob> {
  // Save original state
  const originalSize = renderer.getSize(new THREE.Vector2());
  const originalPixelRatio = renderer.getPixelRatio();

  // Resize for capture
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);

  // Update camera aspect if perspective
  if (camera instanceof THREE.PerspectiveCamera) {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  // Render one frame
  renderer.render(scene, camera);

  // Grab the pixels
  const mime = formatToMime(format);
  const quality = format === 'jpeg' ? JPEG_QUALITY : format === 'webp' ? WEBP_QUALITY : undefined;
  const blob = await new Promise<Blob>((resolve, reject) => {
    renderer.domElement.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to create blob'))),
      mime,
      quality
    );
  });

  // Restore original state
  renderer.setPixelRatio(originalPixelRatio);
  renderer.setSize(originalSize.x, originalSize.y, false);

  if (camera instanceof THREE.PerspectiveCamera) {
    camera.aspect = originalSize.x / originalSize.y;
    camera.updateProjectionMatrix();
  }

  // Re-render at original size so the viewport isn't left blank
  renderer.render(scene, camera);

  return blob;
}

/**
 * Capture the full composite: background + objects + shadows.
 */
export async function captureComposite(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  scale: number,
  filename: string,
  format: ExportFormat = 'png'
): Promise<void> {
  const baseW = renderer.domElement.clientWidth;
  const baseH = renderer.domElement.clientHeight;
  const w = Math.round(baseW * scale);
  const h = Math.round(baseH * scale);

  // Desktop fast-path: hand the scene to the native sidecar for a
  // high-quality offline render. Falls through to the canvas pipeline
  // if the bridge errors so the export still succeeds.
  //
  // The sidecar renderer doesn't yet honor per-face textures, custom OBJ
  // meshes, non-normal blend modes, or the library material presets (it
  // maps unknown presets to Matte). When the scene uses any of those, the
  // native render would be visibly wrong, so we skip it and let the
  // accurate Three.js canvas path handle the export instead.
  if (isElectron && format === 'png' && sidecarCanRender()) {
    try {
      const result = await depthBridge().render(captureSidecarScene(camera, w, h));
      const nativeBlob = base64ToBlob(result.png, 'image/png');
      downloadBlob(nativeBlob, `${filename}.png`);
      return;
    } catch (err) {
      console.warn('[depth] sidecar render failed, falling back to canvas:', err);
    }
  }

  const blob = await captureCanvas(renderer, scene, camera, w, h, format);

  if (isEmbedded) {
    // Running inside the Figma plugin (or similar host). Hand the PNG bytes
    // back to the parent frame instead of triggering a download.
    await postBlobToParent(blob, w, h);
    return;
  }

  downloadBlob(blob, `${filename}.${format === 'jpeg' ? 'jpg' : format}`);
}

/** Visibility state snapshot for scene objects */
interface VisibilitySnapshot {
  map: Map<THREE.Object3D, boolean>;
}

function saveVisibility(scene: THREE.Scene): VisibilitySnapshot {
  const map = new Map<THREE.Object3D, boolean>();
  scene.traverse((obj) => {
    map.set(obj, obj.visible);
  });
  return { map };
}

function restoreVisibility(snapshot: VisibilitySnapshot) {
  for (const [obj, vis] of snapshot.map) {
    obj.visible = vis;
  }
}

/**
 * Check if an object is the background plane (BackgroundPlane component).
 * The background plane uses a basic or shader material with a large plane geometry
 * positioned behind the scene.
 */
function isBackgroundPlane(obj: THREE.Object3D): boolean {
  if (!(obj as THREE.Mesh).isMesh) return false;
  const mesh = obj as THREE.Mesh;
  // BackgroundPlane renders a large plane with BasicMaterial facing the camera
  // Its geometry scale is typically very large (10+) and it sits far from the origin
  if (mesh.material instanceof THREE.MeshBasicMaterial && mesh.geometry) {
    const geo = mesh.geometry;
    if (geo.type === 'PlaneGeometry') {
      const params = (geo as THREE.PlaneGeometry).parameters;
      if (params && params.width >= 5 && params.height >= 5) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if an object is a contact shadow (drei ContactShadows renders to a mesh).
 */
function isContactShadow(obj: THREE.Object3D): boolean {
  if (!(obj as THREE.Mesh).isMesh) return false;
  const mesh = obj as THREE.Mesh;
  // ContactShadows from drei uses a PlaneGeometry with a custom shadow material
  // and is typically positioned at y near 0 with name containing "shadow" or
  // having a depthWrite=false material
  if (mesh.geometry?.type === 'PlaneGeometry' && mesh.material) {
    const mat = mesh.material as THREE.Material;
    if (
      mat.type === 'MeshBasicMaterial' &&
      (mat as THREE.MeshBasicMaterial).depthWrite === false
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Check if an object is a scene "content" object (not background, not shadow, not light).
 */
function isSceneObject(obj: THREE.Object3D): boolean {
  if (!(obj as THREE.Mesh).isMesh) return false;
  return !isBackgroundPlane(obj) && !isContactShadow(obj);
}

/**
 * Export separate layers: object-only, shadow-only, and composite.
 */
export async function captureLayered(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  scale: number,
  filename: string,
  format: ExportFormat = 'png'
): Promise<void> {
  const baseW = renderer.domElement.clientWidth;
  const baseH = renderer.domElement.clientHeight;
  const w = Math.round(baseW * scale);
  const h = Math.round(baseH * scale);
  const ext = format === 'jpeg' ? 'jpg' : format;

  const snapshot = saveVisibility(scene);

  // 1. Object-only layer: hide background plane, hide contact shadows
  scene.traverse((obj) => {
    if (isBackgroundPlane(obj)) obj.visible = false;
    if (isContactShadow(obj)) obj.visible = false;
  });
  const objectBlob = await captureCanvas(renderer, scene, camera, w, h, format);
  restoreVisibility(snapshot);

  // 2. Shadow-only layer: hide all scene objects, keep background off, keep shadows
  scene.traverse((obj) => {
    if (isBackgroundPlane(obj)) obj.visible = false;
    if (isSceneObject(obj)) obj.visible = false;
  });
  const shadowBlob = await captureCanvas(renderer, scene, camera, w, h, format);
  restoreVisibility(snapshot);

  // 3. Full composite — already visible
  const compositeBlob = await captureCanvas(renderer, scene, camera, w, h, format);
  restoreVisibility(snapshot);

  // Re-render to restore viewport
  renderer.render(scene, camera);

  // Download all three
  downloadBlob(objectBlob, `${filename}-object.${ext}`);
  downloadBlob(shadowBlob, `${filename}-shadow.${ext}`);
  downloadBlob(compositeBlob, `${filename}-composite.${ext}`);
}
