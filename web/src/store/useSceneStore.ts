import { create } from 'zustand';
import type { EstimatedLighting } from '../utils/lightingEstimator';

export type ObjectPreset = 'box' | 'cylinder' | 'sphere' | 'cone' | 'torus' | 'custom';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A 2D point on the image (0–1 normalized coordinates) */
export interface Point2D {
  x: number;
  y: number;
}

/** A surface plane drawn by the user on the background image */
export interface SurfacePlane {
  id: string;
  name: string;
  /** 4 corner points in normalized image coordinates (0-1) */
  corners: [Point2D, Point2D, Point2D, Point2D];
  /** 3D plane properties derived from corners + user adjustments */
  position: Vec3;
  rotation: Vec3;
  size: { width: number; depth: number };
  visible: boolean;
  color: string;
}

interface SceneState {
  // Background plate
  backgroundImage: string | null;
  estimatedLighting: EstimatedLighting | null;

  // 3D object
  objectType: ObjectPreset;
  customModelUrl: string | null;
  objectPosition: Vec3;
  objectRotation: Vec3;
  objectScale: number;
  objectColor: string;
  objectMaterial: 'matte' | 'glossy' | 'metallic' | 'glass' | 'plastic';
  objectRoughness: number;

  // Surface planes
  surfaces: SurfacePlane[];
  snapToSurface: boolean;

  // Lighting overrides
  brightness: number;
  lightAngle: number;
  lightElevation: number;
  lightColor: string;
  shadowOpacity: number;
  autoLighting: boolean;

  // Actions
  setBackgroundImage: (dataUrl: string | null) => void;
  setEstimatedLighting: (lighting: EstimatedLighting | null) => void;
  setObjectType: (type: ObjectPreset) => void;
  setCustomModelUrl: (url: string | null) => void;
  setObjectPosition: (pos: Vec3) => void;
  setObjectRotation: (rot: Vec3) => void;
  setObjectScale: (scale: number) => void;
  setObjectColor: (color: string) => void;
  setObjectMaterial: (mat: SceneState['objectMaterial']) => void;
  setObjectRoughness: (r: number) => void;
  setBrightness: (b: number) => void;
  setLightAngle: (a: number) => void;
  setLightElevation: (e: number) => void;
  setLightColor: (c: string) => void;
  setShadowOpacity: (o: number) => void;
  setAutoLighting: (auto: boolean) => void;
  addSurface: (surface: SurfacePlane) => void;
  updateSurface: (id: string, updates: Partial<SurfacePlane>) => void;
  removeSurface: (id: string) => void;
  setSnapToSurface: (snap: boolean) => void;
  reset: () => void;
}

const initialState = {
  backgroundImage: null as string | null,
  estimatedLighting: null as EstimatedLighting | null,
  objectType: 'box' as ObjectPreset,
  customModelUrl: null as string | null,
  objectPosition: { x: 0, y: 0.5, z: 0 },
  objectRotation: { x: 0, y: 0, z: 0 },
  objectScale: 1,
  objectColor: '#cccccc',
  objectMaterial: 'matte' as SceneState['objectMaterial'],
  objectRoughness: 0.7,
  brightness: 1.0,
  lightAngle: 45,
  lightElevation: 0.6,
  lightColor: '#ffffff',
  shadowOpacity: 0.5,
  autoLighting: true,
  surfaces: [] as SurfacePlane[],
  snapToSurface: true,
};

export const useSceneStore = create<SceneState>((set) => ({
  ...initialState,

  setBackgroundImage: (dataUrl) => set({ backgroundImage: dataUrl }),
  setEstimatedLighting: (lighting) => {
    if (lighting) {
      set({
        estimatedLighting: lighting,
        brightness: lighting.brightness,
        lightAngle: lighting.lightAngle,
        lightElevation: lighting.lightElevation,
        lightColor: lighting.colorTemp,
        shadowOpacity: lighting.contrast * 0.6,
      });
    } else {
      set({ estimatedLighting: null });
    }
  },
  setObjectType: (type) => set({ objectType: type }),
  setCustomModelUrl: (url) => set({ customModelUrl: url }),
  setObjectPosition: (pos) => set({ objectPosition: pos }),
  setObjectRotation: (rot) => set({ objectRotation: rot }),
  setObjectScale: (scale) => set({ objectScale: scale }),
  setObjectColor: (color) => set({ objectColor: color }),
  setObjectMaterial: (mat) => set({ objectMaterial: mat }),
  setObjectRoughness: (r) => set({ objectRoughness: r }),
  setBrightness: (b) => set({ brightness: b }),
  setLightAngle: (a) => set({ lightAngle: a }),
  setLightElevation: (e) => set({ lightElevation: e }),
  setLightColor: (c) => set({ lightColor: c }),
  setShadowOpacity: (o) => set({ shadowOpacity: o }),
  setAutoLighting: (auto) => set({ autoLighting: auto }),
  addSurface: (surface) => set((s) => ({ surfaces: [...s.surfaces, surface] })),
  updateSurface: (id, updates) =>
    set((s) => ({
      surfaces: s.surfaces.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  removeSurface: (id) => set((s) => ({ surfaces: s.surfaces.filter((p) => p.id !== id) })),
  setSnapToSurface: (snap) => set({ snapToSurface: snap }),
  reset: () => set(initialState),
}));
