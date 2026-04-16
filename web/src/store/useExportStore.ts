import { create } from 'zustand';
import type * as THREE from 'three';

/**
 * Holds references to the Three.js renderer, scene, and camera
 * so export utilities outside the Canvas can access them.
 */
interface ExportStore {
  renderer: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.Camera | null;
  setThreeRefs: (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ) => void;
}

export const useExportStore = create<ExportStore>((set) => ({
  renderer: null,
  scene: null,
  camera: null,
  setThreeRefs: (renderer, scene, camera) => set({ renderer, scene, camera }),
}));
