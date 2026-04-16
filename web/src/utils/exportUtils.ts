import * as THREE from 'three';
import { downloadBlob } from './exportHelpers';
import type { ExportFormat } from '../store/useSceneStore';

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

  const blob = await captureCanvas(renderer, scene, camera, w, h, format);
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
