import { create } from 'zustand';
import type { EstimatedLighting } from '../utils/lightingEstimator';

export type ObjectPreset = 'box' | 'cylinder' | 'sphere' | 'cone' | 'torus' | 'mug' | 'phone' | 'bottle' | 'bag' | 'card' | 'custom';

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

/** A positionable light source in the 3D scene */
export interface SceneLight {
  id: string;
  name: string;
  position: Vec3;
  color: string;
  intensity: number;
  /** Whether this was auto-detected from the image */
  autoDetected: boolean;
  visible: boolean;
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
  objectMetalness: number;
  objectTransmission: number;
  objectIor: number;
  objectClearcoat: number;
  objectOpacity: number;
  objectReflectivity: number;

  // Texture / UV mapping
  objectTexture: string | null;
  textureRepeat: { x: number; y: number };
  textureOffset: { x: number; y: number };
  textureRotation: number;

  // Scene lights (positionable point lights)
  sceneLights: SceneLight[];

  // Surface planes
  surfaces: SurfacePlane[];
  snapToSurface: boolean;

  // Lighting overrides
  brightness: number;
  lightAngle: number;
  lightElevation: number;
  lightColor: string;
  shadowOpacity: number;
  shadowSoftness: number;
  shadowColor: string;
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
  setObjectMetalness: (m: number) => void;
  setObjectTransmission: (t: number) => void;
  setObjectIor: (i: number) => void;
  setObjectClearcoat: (c: number) => void;
  setObjectOpacity: (o: number) => void;
  setObjectReflectivity: (r: number) => void;
  setObjectTexture: (dataUrl: string | null) => void;
  setTextureRepeat: (repeat: { x: number; y: number }) => void;
  setTextureOffset: (offset: { x: number; y: number }) => void;
  setTextureRotation: (rotation: number) => void;
  setBrightness: (b: number) => void;
  setLightAngle: (a: number) => void;
  setLightElevation: (e: number) => void;
  setLightColor: (c: string) => void;
  setShadowOpacity: (o: number) => void;
  setShadowSoftness: (s: number) => void;
  setShadowColor: (c: string) => void;
  setAutoLighting: (auto: boolean) => void;
  addSceneLight: (light: SceneLight) => void;
  updateSceneLight: (id: string, updates: Partial<SceneLight>) => void;
  removeSceneLight: (id: string) => void;
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
  objectMetalness: 0,
  objectTransmission: 1.0,
  objectIor: 1.5,
  objectClearcoat: 0.5,
  objectOpacity: 1.0,
  objectReflectivity: 0.5,
  objectTexture: null as string | null,
  textureRepeat: { x: 1, y: 1 },
  textureOffset: { x: 0, y: 0 },
  textureRotation: 0,
  brightness: 1.0,
  lightAngle: 45,
  lightElevation: 0.6,
  lightColor: '#ffffff',
  shadowOpacity: 0.5,
  shadowSoftness: 0.5,
  shadowColor: '#000000',
  autoLighting: true,
  sceneLights: [] as SceneLight[],
  surfaces: [] as SurfacePlane[],
  snapToSurface: true,
};

export const useSceneStore = create<SceneState>((set) => ({
  ...initialState,

  setBackgroundImage: (dataUrl) => set({ backgroundImage: dataUrl }),
  setEstimatedLighting: (lighting) => {
    if (lighting) {
      // Convert detected bright spots to 3D scene lights
      const sceneLights: SceneLight[] = (lighting.detectedLights || []).map((spot, i) => ({
        id: crypto.randomUUID(),
        name: `Light ${i + 1}`,
        // Map 2D image position to 3D: x centered, y = height, z = depth from image Y
        position: {
          x: (spot.x - 0.5) * 8,
          y: 1 + (1 - spot.y) * 5,
          z: (spot.y - 0.5) * -4,
        },
        color: spot.color,
        intensity: spot.intensity * 2,
        autoDetected: true,
        visible: true,
      }));

      set({
        estimatedLighting: lighting,
        brightness: lighting.brightness,
        lightAngle: lighting.lightAngle,
        lightElevation: lighting.lightElevation,
        lightColor: lighting.colorTemp,
        shadowOpacity: lighting.contrast * 0.6,
        sceneLights,
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
  setObjectMaterial: (mat) => {
    const defaults: Record<string, Partial<SceneState>> = {
      matte:    { objectRoughness: 0.9, objectMetalness: 0, objectOpacity: 1.0 },
      glossy:   { objectRoughness: 0.1, objectMetalness: 0, objectOpacity: 1.0 },
      metallic: { objectRoughness: 0.3, objectMetalness: 1.0, objectOpacity: 1.0 },
      glass:    { objectRoughness: 0.05, objectMetalness: 0, objectTransmission: 1.0, objectIor: 1.5, objectOpacity: 0.2, objectReflectivity: 0.5 },
      plastic:  { objectRoughness: 0.4, objectMetalness: 0, objectClearcoat: 0.5, objectOpacity: 1.0 },
    };
    set({ objectMaterial: mat, ...defaults[mat] });
  },
  setObjectRoughness: (r) => set({ objectRoughness: r }),
  setObjectMetalness: (m) => set({ objectMetalness: m }),
  setObjectTransmission: (t) => set({ objectTransmission: t }),
  setObjectIor: (i) => set({ objectIor: i }),
  setObjectClearcoat: (c) => set({ objectClearcoat: c }),
  setObjectOpacity: (o) => set({ objectOpacity: o }),
  setObjectReflectivity: (r) => set({ objectReflectivity: r }),
  setObjectTexture: (dataUrl) => set({ objectTexture: dataUrl }),
  setTextureRepeat: (repeat) => set({ textureRepeat: repeat }),
  setTextureOffset: (offset) => set({ textureOffset: offset }),
  setTextureRotation: (rotation) => set({ textureRotation: rotation }),
  setBrightness: (b) => set({ brightness: b }),
  setLightAngle: (a) => set({ lightAngle: a }),
  setLightElevation: (e) => set({ lightElevation: e }),
  setLightColor: (c) => set({ lightColor: c }),
  setShadowOpacity: (o) => set({ shadowOpacity: o }),
  setShadowSoftness: (s) => set({ shadowSoftness: s }),
  setShadowColor: (c) => set({ shadowColor: c }),
  setAutoLighting: (auto) => set({ autoLighting: auto }),
  addSceneLight: (light) => set((s) => ({ sceneLights: [...s.sceneLights, light] })),
  updateSceneLight: (id, updates) =>
    set((s) => ({
      sceneLights: s.sceneLights.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    })),
  removeSceneLight: (id) => set((s) => ({ sceneLights: s.sceneLights.filter((l) => l.id !== id) })),
  addSurface: (surface) => set((s) => ({ surfaces: [...s.surfaces, surface] })),
  updateSurface: (id, updates) =>
    set((s) => ({
      surfaces: s.surfaces.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),
  removeSurface: (id) => set((s) => ({ surfaces: s.surfaces.filter((p) => p.id !== id) })),
  setSnapToSurface: (snap) => set({ snapToSurface: snap }),
  reset: () => set(initialState),
}));
