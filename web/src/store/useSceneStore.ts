import { create } from 'zustand';
import { persist, createJSONStorage, type PersistStorage, type StorageValue } from 'zustand/middleware';
import { temporal } from 'zundo';
import type { EstimatedLighting } from '../utils/lightingEstimator';
import {
  generateWoodGrainTexture,
  generateMarbleTexture,
  generateFabricTexture,
  generateLeatherTexture,
  generateBrushedMetalTexture,
} from '../utils/proceduralTextures';
import {
  CURRENT_SCENE_KEY,
  SCENE_SCHEMA_VERSION,
  PERSIST_SIZE_WARN_BYTES,
  approxByteSize,
  migrateSceneState,
  readScenesIndex,
  readSavedScene,
  writeSavedScene,
  deleteSavedScene as deleteSavedSceneEntry,
  type PersistedSceneState,
  type SavedScene,
  type SavedSceneMeta,
} from './scenePersistence';

export type ObjectPreset = 'box' | 'cylinder' | 'sphere' | 'cone' | 'torus' | 'mug' | 'phone' | 'bottle' | 'bag' | 'card' | 'donut' | 'laptop' | 'tablet' | 'can' | 'book' | 'custom';

export type ExportFormat = 'png' | 'jpeg' | 'webp';
export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay';

/** Material library presets. The first 5 are "basic" — they only set
 *  PBR parameters. The latter 6 ("library") additionally stamp a procedural
 *  texture onto the object the first time they're applied. */
export type MaterialPreset =
  | 'matte' | 'glossy' | 'metallic' | 'glass' | 'plastic'
  | 'wood' | 'marble' | 'fabric' | 'leather' | 'brushed-metal' | 'tinted-glass';

/** Curated HDRI environment presets exposed in the lighting panel. The first
 *  10 map 1:1 to drei's built-in presets; the last 2 ('softbox', 'window-light')
 *  fall back to drei's 'studio' with different intensity/rotation defaults
 *  baked in — TODO: ship custom HDRIs for these. */
export type EnvironmentPreset =
  | 'studio' | 'sunset' | 'dawn' | 'night' | 'warehouse'
  | 'forest' | 'apartment' | 'city' | 'park' | 'lobby'
  | 'softbox' | 'window-light';

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
  autoDetected: boolean;
  visible: boolean;
}

/** Per-face texture configuration */
export interface FaceTextureConfig {
  url: string;
  repeat: { x: number; y: number };
  offset: { x: number; y: number };
  rotation: number;
}

/** A surface plane drawn by the user on the background image */
export interface SurfacePlane {
  id: string;
  name: string;
  corners: [Point2D, Point2D, Point2D, Point2D];
  position: Vec3;
  rotation: Vec3;
  size: { width: number; depth: number };
  visible: boolean;
  color: string;
}

/** A single 3D object instance in the scene. */
export interface SceneObjectInstance {
  id: string;
  name: string;
  type: ObjectPreset;
  customModelUrl: string | null;
  position: Vec3;
  rotation: Vec3;
  scale: number;
  color: string;
  material: MaterialPreset;
  roughness: number;
  metalness: number;
  transmission: number;
  ior: number;
  clearcoat: number;
  opacity: number;
  reflectivity: number;
  texture: string | null;
  textureRepeat: { x: number; y: number };
  textureOffset: { x: number; y: number };
  textureRotation: number;
  faceTextures: Record<string, FaceTextureConfig>;
  visible: boolean;
}

const PRESET_LABELS: Record<ObjectPreset, string> = {
  box: 'Cube',
  cylinder: 'Cylinder',
  sphere: 'Sphere',
  cone: 'Cone',
  torus: 'Torus',
  mug: 'Mug',
  phone: 'Phone',
  bottle: 'Bottle',
  bag: 'Bag',
  card: 'Card',
  donut: 'Donut',
  laptop: 'Laptop',
  tablet: 'Tablet',
  can: 'Can',
  book: 'Book',
  custom: 'Custom',
};

const MATERIAL_DEFAULTS: Record<MaterialPreset, Partial<SceneObjectInstance>> = {
  matte:           { roughness: 0.9, metalness: 0, opacity: 1.0 },
  glossy:          { roughness: 0.1, metalness: 0, opacity: 1.0 },
  metallic:        { roughness: 0.3, metalness: 1.0, opacity: 1.0 },
  glass:           { roughness: 0.05, metalness: 0, transmission: 1.0, ior: 1.5, opacity: 0.2, reflectivity: 0.5 },
  plastic:         { roughness: 0.4, metalness: 0, clearcoat: 0.5, opacity: 1.0 },
  // Library presets — pair with a procedural texture applied below.
  wood:            { roughness: 0.7, metalness: 0,   clearcoat: 0.1, opacity: 1.0, reflectivity: 0.3 },
  marble:          { roughness: 0.15, metalness: 0,  clearcoat: 0.4, opacity: 1.0, reflectivity: 0.5 },
  fabric:          { roughness: 0.95, metalness: 0,  clearcoat: 0,   opacity: 1.0, reflectivity: 0.2 },
  leather:         { roughness: 0.65, metalness: 0,  clearcoat: 0.15, opacity: 1.0, reflectivity: 0.3 },
  'brushed-metal': { roughness: 0.45, metalness: 1.0, clearcoat: 0.1, opacity: 1.0, reflectivity: 0.6 },
  'tinted-glass':  { roughness: 0.08, metalness: 0,  transmission: 0.85, ior: 1.5, opacity: 0.35, reflectivity: 0.4, clearcoat: 0.2 },
};

/** Materials in the "library" group that auto-apply a procedural texture. */
const LIBRARY_MATERIAL_TEXTURES: Partial<Record<MaterialPreset, () => string>> = {
  wood: () => generateWoodGrainTexture(256, 256),
  marble: () => generateMarbleTexture(256, 256),
  fabric: () => generateFabricTexture(256, 256),
  leather: () => generateLeatherTexture(256, 256),
  'brushed-metal': () => generateBrushedMetalTexture(256, 256),
};

export function makeDefaultObject(type: ObjectPreset, nameSuffix = 1): SceneObjectInstance {
  const base: SceneObjectInstance = {
    id: crypto.randomUUID(),
    name: `${PRESET_LABELS[type]} ${nameSuffix}`,
    type,
    customModelUrl: null,
    position: { x: 0, y: 0.5, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1,
    color: '#cccccc',
    material: 'matte',
    roughness: 0.7,
    metalness: 0,
    transmission: 1.0,
    ior: 1.5,
    clearcoat: 0.5,
    opacity: 1.0,
    reflectivity: 0.5,
    texture: null,
    textureRepeat: { x: 1, y: 1 },
    textureOffset: { x: 0, y: 0 },
    textureRotation: 0,
    faceTextures: {},
    visible: true,
  };
  if (type === 'donut') {
    // 🍩 Easter egg: pink icing
    base.color = '#F472B6';
    base.material = 'glossy';
    base.roughness = 0.3;
    base.metalness = 0;
  }
  return base;
}

interface SceneState {
  // Background plate
  backgroundImage: string | null;
  estimatedLighting: EstimatedLighting | null;

  // Objects
  objects: SceneObjectInstance[];
  selectedObjectId: string | null;
  /** Face selection is transient / per-session — kept at top level. */
  selectedFace: string | null;

  // Scene lights
  sceneLights: SceneLight[];

  // Surfaces
  surfaces: SurfacePlane[];
  snapToSurface: boolean;

  // Export
  exportScale: number;
  exportFilename: string;
  exportFormat: ExportFormat;

  // Blend
  blendMode: BlendMode;

  // Lighting
  brightness: number;
  lightAngle: number;
  lightElevation: number;
  lightColor: string;
  shadowOpacity: number;
  shadowSoftness: number;
  shadowColor: string;
  autoLighting: boolean;

  // HDRI environment
  environmentPreset: EnvironmentPreset;
  environmentIntensity: number;
  environmentRotation: number;
  useEnvironment: boolean;

  // Actions — global
  setBackgroundImage: (dataUrl: string | null) => void;
  setEstimatedLighting: (lighting: EstimatedLighting | null) => void;

  // Actions — objects
  addObject: (preset: ObjectPreset) => string;
  removeObject: (id: string) => void;
  duplicateObject: (id: string) => string;
  selectObject: (id: string | null) => void;
  updateObject: (id: string, updates: Partial<SceneObjectInstance>) => void;
  updateSelected: (updates: Partial<SceneObjectInstance>) => void;
  setObjectVisible: (id: string, visible: boolean) => void;
  setSelectedFace: (face: string | null) => void;
  setFaceTextureForSelected: (face: string, url: string) => void;
  removeFaceTextureForSelected: (face: string) => void;
  setFaceTextureTransformForSelected: (face: string, transform: Partial<Pick<FaceTextureConfig, 'repeat' | 'offset' | 'rotation'>>) => void;

  // Lighting
  setBrightness: (b: number) => void;
  setLightAngle: (a: number) => void;
  setLightElevation: (e: number) => void;
  setLightColor: (c: string) => void;
  setShadowOpacity: (o: number) => void;
  setShadowSoftness: (s: number) => void;
  setShadowColor: (c: string) => void;
  setAutoLighting: (auto: boolean) => void;

  // HDRI environment actions
  setEnvironmentPreset: (p: EnvironmentPreset) => void;
  setEnvironmentIntensity: (v: number) => void;
  setEnvironmentRotation: (v: number) => void;
  setUseEnvironment: (v: boolean) => void;

  // Scene lights
  addSceneLight: (light: SceneLight) => void;
  updateSceneLight: (id: string, updates: Partial<SceneLight>) => void;
  removeSceneLight: (id: string) => void;

  // Surfaces
  addSurface: (surface: SurfacePlane) => void;
  updateSurface: (id: string, updates: Partial<SurfacePlane>) => void;
  removeSurface: (id: string) => void;
  setSnapToSurface: (snap: boolean) => void;

  // Export / blend
  setExportScale: (scale: number) => void;
  setExportFilename: (filename: string) => void;
  setExportFormat: (format: ExportFormat) => void;
  setBlendMode: (mode: BlendMode) => void;

  applyTemplate: (state: Partial<SceneState> & Record<string, unknown>) => void;
  reset: () => void;

  // Persistence / saved-scene slots
  isDirty: boolean;
  markSaved: () => void;
  saveCurrentScene: (name: string, thumbnail: string) => SavedSceneMeta;
  loadScene: (id: string) => boolean;
  deleteScene: (id: string) => void;
  listSavedScenes: () => SavedSceneMeta[];
}

const firstDefault = makeDefaultObject('box');

const initialState = {
  backgroundImage: null as string | null,
  estimatedLighting: null as EstimatedLighting | null,
  objects: [firstDefault] as SceneObjectInstance[],
  selectedObjectId: firstDefault.id as string | null,
  selectedFace: null as string | null,
  brightness: 1.0,
  lightAngle: 45,
  lightElevation: 0.6,
  lightColor: '#ffffff',
  shadowOpacity: 0.5,
  shadowSoftness: 0.5,
  shadowColor: '#000000',
  autoLighting: true,
  environmentPreset: 'studio' as EnvironmentPreset,
  environmentIntensity: 0.3,
  environmentRotation: 0,
  useEnvironment: true,
  sceneLights: [] as SceneLight[],
  surfaces: [] as SurfacePlane[],
  snapToSurface: true,
  exportScale: 1,
  exportFilename: 'depth-export',
  exportFormat: 'png' as ExportFormat,
  blendMode: 'normal' as BlendMode,
  isDirty: false,
};

/** Extract the subset of state that gets persisted (matches PersistedSceneState). */
function extractPersistedState(s: SceneState): PersistedSceneState {
  return {
    backgroundImage: s.backgroundImage,
    objects: s.objects,
    selectedObjectId: s.selectedObjectId,
    sceneLights: s.sceneLights,
    surfaces: s.surfaces,
    snapToSurface: s.snapToSurface,
    blendMode: s.blendMode,
    brightness: s.brightness,
    lightAngle: s.lightAngle,
    lightElevation: s.lightElevation,
    lightColor: s.lightColor,
    shadowOpacity: s.shadowOpacity,
    shadowSoftness: s.shadowSoftness,
    shadowColor: s.shadowColor,
    autoLighting: s.autoLighting,
    environmentPreset: s.environmentPreset,
    environmentIntensity: s.environmentIntensity,
    environmentRotation: s.environmentRotation,
    useEnvironment: s.useEnvironment,
  };
}

function defaultPersistedState(): PersistedSceneState {
  const fresh = makeDefaultObject('box');
  return {
    backgroundImage: null,
    objects: [fresh],
    selectedObjectId: fresh.id,
    sceneLights: [],
    surfaces: [],
    snapToSurface: true,
    blendMode: 'normal',
    brightness: 1.0,
    lightAngle: 45,
    lightElevation: 0.6,
    lightColor: '#ffffff',
    shadowOpacity: 0.5,
    shadowSoftness: 0.5,
    shadowColor: '#000000',
    autoLighting: true,
    environmentPreset: 'studio',
    environmentIntensity: 0.3,
    environmentRotation: 0,
    useEnvironment: true,
  };
}

/**
 * Custom persist storage. Wraps localStorage so we can:
 *  - Detect quota errors and retry without the (heavy) backgroundImage.
 *  - Warn when the serialized size grows past ~4 MB.
 */
function makeSceneStorage(): PersistStorage<PersistedSceneState> | undefined {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return undefined;
  }
  const jsonStorage = createJSONStorage<PersistedSceneState>(() => window.localStorage);
  if (!jsonStorage) return undefined;

  return {
    getItem: (name) => jsonStorage.getItem(name),
    removeItem: (name) => jsonStorage.removeItem(name),
    setItem: (name, value: StorageValue<PersistedSceneState>) => {
      const size = approxByteSize(value);
      if (size > PERSIST_SIZE_WARN_BYTES) {
        console.warn(
          `[depth] Persisted scene is ${(size / 1024 / 1024).toFixed(2)} MB — close to localStorage quota.`,
        );
      }
      try {
        return jsonStorage.setItem(name, value);
      } catch (err) {
        // Quota exceeded — retry without the heavy backgroundImage.
        if (value && value.state && value.state.backgroundImage) {
          console.warn('[depth] localStorage quota exceeded; persisting without background image.', err);
          const fallback: StorageValue<PersistedSceneState> = {
            ...value,
            state: { ...value.state, backgroundImage: null },
          };
          try {
            return jsonStorage.setItem(name, fallback);
          } catch (err2) {
            console.warn('[depth] localStorage persistence failed even without background image.', err2);
            return;
          }
        }
        console.warn('[depth] localStorage persistence failed.', err);
      }
    },
  };
}

/** Count existing objects of a preset type to build a fresh unique name. */
function nextName(objects: SceneObjectInstance[], type: ObjectPreset): string {
  const base = PRESET_LABELS[type];
  let n = 1;
  const names = new Set(objects.map((o) => o.name));
  while (names.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** Convert any old flat template state with objectX fields into a SceneObjectInstance partial. */
function extractLegacyObjectFields(state: Record<string, unknown>): Partial<SceneObjectInstance> | null {
  const mapping: Record<string, keyof SceneObjectInstance> = {
    objectType: 'type',
    objectColor: 'color',
    objectMaterial: 'material',
    objectRoughness: 'roughness',
    objectMetalness: 'metalness',
    objectTransmission: 'transmission',
    objectIor: 'ior',
    objectClearcoat: 'clearcoat',
    objectOpacity: 'opacity',
    objectReflectivity: 'reflectivity',
    objectPosition: 'position',
    objectRotation: 'rotation',
    objectScale: 'scale',
    objectTexture: 'texture',
    textureRepeat: 'textureRepeat',
    textureOffset: 'textureOffset',
    textureRotation: 'textureRotation',
    customModelUrl: 'customModelUrl',
    faceTextures: 'faceTextures',
  };
  const out: Partial<SceneObjectInstance> = {};
  let hit = false;
  for (const [k, v] of Object.entries(state)) {
    const target = mapping[k];
    if (target !== undefined && v !== undefined) {
      (out as Record<string, unknown>)[target] = v;
      hit = true;
    }
  }
  return hit ? out : null;
}

export const useSceneStore = create<SceneState>()(
  temporal(
    persist(
    (set, get) => ({
      ...initialState,

      setBackgroundImage: (dataUrl) => set({ backgroundImage: dataUrl }),
      setEstimatedLighting: (lighting) => {
        if (lighting) {
          const sceneLights: SceneLight[] = (lighting.detectedLights || []).map((spot, i) => ({
            id: crypto.randomUUID(),
            name: `Light ${i + 1}`,
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

      addObject: (preset) => {
        const existing = get().objects;
        const obj = makeDefaultObject(preset);
        obj.name = nextName(existing, preset);
        // Offset so new objects don't fully stack
        obj.position = {
          x: existing.length * 0.3,
          y: 0.5,
          z: 0,
        };
        set({ objects: [...existing, obj], selectedObjectId: obj.id });
        return obj.id;
      },

      removeObject: (id) =>
        set((s) => {
          const next = s.objects.filter((o) => o.id !== id);
          const wasSelected = s.selectedObjectId === id;
          return {
            objects: next,
            selectedObjectId: wasSelected ? (next[0]?.id ?? null) : s.selectedObjectId,
            selectedFace: wasSelected ? null : s.selectedFace,
          };
        }),

      duplicateObject: (id) => {
        const src = get().objects.find((o) => o.id === id);
        if (!src) return id;
        const copy: SceneObjectInstance = {
          ...src,
          id: crypto.randomUUID(),
          name: `${src.name} (copy)`,
          position: { x: src.position.x + 0.3, y: src.position.y, z: src.position.z + 0.3 },
          // Shallow-copy nested records so mutation doesn't leak between instances
          faceTextures: { ...src.faceTextures },
          textureRepeat: { ...src.textureRepeat },
          textureOffset: { ...src.textureOffset },
          rotation: { ...src.rotation },
        };
        set((s) => ({ objects: [...s.objects, copy], selectedObjectId: copy.id }));
        return copy.id;
      },

      selectObject: (id) => set({ selectedObjectId: id, selectedFace: null }),

      updateObject: (id, updates) =>
        set((s) => ({
          objects: s.objects.map((o) => {
            if (o.id !== id) return o;
            // When material changes, apply material preset defaults. Library
            // materials (wood/marble/...) also stamp a procedural texture
            // on the object — but only if the object doesn't already have a
            // user-uploaded texture (we don't want to clobber custom uploads).
            if (updates.material && updates.material !== o.material) {
              const textureGen = LIBRARY_MATERIAL_TEXTURES[updates.material];
              const stampTexture = textureGen && !o.texture
                ? { texture: textureGen() }
                : {};
              return { ...o, ...MATERIAL_DEFAULTS[updates.material], ...stampTexture, ...updates };
            }
            // Donut easter-egg: when switching type to donut, apply pink-icing look
            if (updates.type && updates.type !== o.type && updates.type === 'donut') {
              return {
                ...o,
                ...updates,
                color: '#F472B6',
                material: 'glossy',
                roughness: 0.3,
                metalness: 0,
              };
            }
            return { ...o, ...updates };
          }),
        })),

      updateSelected: (updates) => {
        const id = get().selectedObjectId;
        if (!id) return;
        get().updateObject(id, updates);
      },

      setObjectVisible: (id, visible) => get().updateObject(id, { visible }),

      setSelectedFace: (face) => set({ selectedFace: face }),

      setFaceTextureForSelected: (face, url) => {
        const id = get().selectedObjectId;
        if (!id) return;
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === id
              ? {
                  ...o,
                  faceTextures: {
                    ...o.faceTextures,
                    [face]: { url, repeat: { x: 1, y: 1 }, offset: { x: 0, y: 0 }, rotation: 0 },
                  },
                }
              : o
          ),
        }));
      },

      removeFaceTextureForSelected: (face) => {
        const id = get().selectedObjectId;
        if (!id) return;
        set((s) => ({
          objects: s.objects.map((o) => {
            if (o.id !== id) return o;
            const next = { ...o.faceTextures };
            delete next[face];
            return { ...o, faceTextures: next };
          }),
        }));
      },

      setFaceTextureTransformForSelected: (face, transform) => {
        const id = get().selectedObjectId;
        if (!id) return;
        set((s) => ({
          objects: s.objects.map((o) => {
            if (o.id !== id) return o;
            const existing = o.faceTextures[face];
            if (!existing) return o;
            return {
              ...o,
              faceTextures: {
                ...o.faceTextures,
                [face]: {
                  ...existing,
                  ...(transform.repeat !== undefined ? { repeat: transform.repeat } : {}),
                  ...(transform.offset !== undefined ? { offset: transform.offset } : {}),
                  ...(transform.rotation !== undefined ? { rotation: transform.rotation } : {}),
                },
              },
            };
          }),
        }));
      },

      setBrightness: (b) => set({ brightness: b }),
      setLightAngle: (a) => set({ lightAngle: a }),
      setLightElevation: (e) => set({ lightElevation: e }),
      setLightColor: (c) => set({ lightColor: c }),
      setShadowOpacity: (o) => set({ shadowOpacity: o }),
      setShadowSoftness: (s) => set({ shadowSoftness: s }),
      setShadowColor: (c) => set({ shadowColor: c }),
      setAutoLighting: (auto) => set({ autoLighting: auto }),

      setEnvironmentPreset: (p) => {
        // 'softbox' and 'window-light' don't ship as drei HDRIs — we keep the
        // selection in the store and let the viewport map them to 'studio'
        // with tuned defaults. Bake those defaults here so the user sees the
        // intensity change immediately.
        const partial: Partial<SceneState> = { environmentPreset: p };
        if (p === 'softbox') {
          partial.environmentIntensity = 1.0;
        } else if (p === 'window-light') {
          partial.environmentIntensity = 0.6;
          partial.environmentRotation = 45;
        }
        set(partial);
      },
      setEnvironmentIntensity: (v) => set({ environmentIntensity: v }),
      setEnvironmentRotation: (v) => set({ environmentRotation: v }),
      setUseEnvironment: (v) => set({ useEnvironment: v }),

      addSceneLight: (light) => set((s) => ({ sceneLights: [...s.sceneLights, light] })),
      updateSceneLight: (id, updates) =>
        set((s) => ({ sceneLights: s.sceneLights.map((l) => (l.id === id ? { ...l, ...updates } : l)) })),
      removeSceneLight: (id) => set((s) => ({ sceneLights: s.sceneLights.filter((l) => l.id !== id) })),

      addSurface: (surface) => set((s) => ({ surfaces: [...s.surfaces, surface] })),
      updateSurface: (id, updates) =>
        set((s) => ({ surfaces: s.surfaces.map((p) => (p.id === id ? { ...p, ...updates } : p)) })),
      removeSurface: (id) => set((s) => ({ surfaces: s.surfaces.filter((p) => p.id !== id) })),
      setSnapToSurface: (snap) => set({ snapToSurface: snap }),

      setExportScale: (scale) => set({ exportScale: scale }),
      setExportFilename: (filename) => set({ exportFilename: filename }),
      setExportFormat: (format) => set({ exportFormat: format }),
      setBlendMode: (mode) => set({ blendMode: mode }),

      applyTemplate: (templateState) => {
        const legacy = extractLegacyObjectFields(templateState as Record<string, unknown>);
        const partial: Partial<SceneState> = { ...(templateState as Partial<SceneState>) };
        if (legacy) {
          // Build a single-object array, merging legacy fields with preset defaults
          const type = (legacy.type ?? 'box') as ObjectPreset;
          const obj = makeDefaultObject(type);
          Object.assign(obj, legacy);
          // Re-apply material defaults if material was set, then re-overlay legacy
          // to honor explicit roughness/metalness etc. in the template.
          if (legacy.material) {
            Object.assign(obj, MATERIAL_DEFAULTS[legacy.material], legacy);
          }
          partial.objects = [obj];
          partial.selectedObjectId = obj.id;
          // Strip legacy flat fields from partial so zustand doesn't write unknown keys.
          const legacyKeys = [
            'objectType', 'objectColor', 'objectMaterial', 'objectRoughness', 'objectMetalness',
            'objectTransmission', 'objectIor', 'objectClearcoat', 'objectOpacity', 'objectReflectivity',
            'objectPosition', 'objectRotation', 'objectScale', 'objectTexture',
            'textureRepeat', 'textureOffset', 'textureRotation', 'customModelUrl', 'faceTextures',
          ];
          for (const k of legacyKeys) {
            delete (partial as Record<string, unknown>)[k];
          }
        }
        set(partial);
      },

      reset: () => {
        const fresh = makeDefaultObject('box');
        set({
          ...initialState,
          objects: [fresh],
          selectedObjectId: fresh.id,
          isDirty: false,
        });
      },

      // ── Persistence / saved-scene slots ────────────────────────────────

      markSaved: () => {
        resyncCleanBaseline();
        set({ isDirty: false });
      },

      saveCurrentScene: (name, thumbnail) => {
        const id = crypto.randomUUID();
        const meta: SavedSceneMeta = { id, name, thumbnail, savedAt: Date.now() };
        const snapshot: SavedScene = {
          ...meta,
          version: SCENE_SCHEMA_VERSION,
          state: extractPersistedState(get()),
        };
        writeSavedScene(snapshot);
        resyncCleanBaseline();
        set({ isDirty: false });
        return meta;
      },

      loadScene: (id) => {
        const saved = readSavedScene(id);
        if (!saved) return false;
        const defaults = defaultPersistedState();
        const migrated = migrateSceneState(saved.version, saved.state, defaults);
        // Replace current scene state. Clears transient fields.
        set({
          ...migrated,
          selectedFace: null,
          estimatedLighting: null,
          isDirty: false,
        });
        // The subscribe handler may have re-flipped isDirty above; reset baseline
        // to the just-loaded state and clear the flag again.
        resyncCleanBaseline();
        set({ isDirty: false });
        // Loading a scene shouldn't be part of undo history — clear temporal.
        try {
          useSceneStore.temporal.getState().clear();
        } catch {
          // Temporal may not be initialized in some test contexts; safe to ignore.
        }
        return true;
      },

      deleteScene: (id) => {
        deleteSavedSceneEntry(id);
      },

      listSavedScenes: () => readScenesIndex(),
    }),
    {
      name: CURRENT_SCENE_KEY,
      version: SCENE_SCHEMA_VERSION,
      storage: makeSceneStorage(),
      partialize: (state): PersistedSceneState => extractPersistedState(state as SceneState),
      migrate: (persistedState, version) => {
        const defaults = defaultPersistedState();
        return migrateSceneState(version, persistedState, defaults) as unknown as SceneState;
      },
    },
    ),
    {
      limit: 50,
      partialize: (state) => {
        const { selectedFace, estimatedLighting, isDirty, ...rest } = state;
        void selectedFace;
        void estimatedLighting;
        void isDirty;
        return rest;
      },
      equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
    }
  )
);

// Mark scene as dirty on any state change that affects persisted fields.
// Subscribing here keeps the isDirty flag accurate without sprinkling
// `isDirty: true` into every action.
let lastPersistedSnapshot: string = JSON.stringify(
  extractPersistedState(useSceneStore.getState()),
);
/** Resync the dirty-tracking baseline. Called when state is intentionally
 *  marked clean (save / load), so the immediately-following subscribe fire
 *  does not re-flip isDirty back to true. */
function resyncCleanBaseline() {
  lastPersistedSnapshot = JSON.stringify(extractPersistedState(useSceneStore.getState()));
}
useSceneStore.subscribe((state) => {
  const serialized = JSON.stringify(extractPersistedState(state));
  if (serialized === lastPersistedSnapshot) return;
  lastPersistedSnapshot = serialized;
  if (!state.isDirty) {
    useSceneStore.setState({ isDirty: true });
  }
});


// Expose store on window in dev / E2E builds so Playwright tests can inspect
// and drive scene state without scraping the DOM. No-op in production builds.
if (import.meta.env.DEV) {
  (window as unknown as { __depthStore?: typeof useSceneStore }).__depthStore = useSceneStore;
}
