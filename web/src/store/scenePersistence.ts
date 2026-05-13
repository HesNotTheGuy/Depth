/**
 * localStorage helpers for scene persistence and named save slots.
 *
 * Two storage concerns live here:
 * 1. The "current scene" persisted via Zustand's `persist` middleware
 *    under the key `depth-current-scene` (handled by useSceneStore).
 * 2. Named save slots — each saved scene is one localStorage entry
 *    `depth-scene-<id>`, with a small index at `depth-scenes-index`
 *    for quick listing without loading heavy state.
 */
import type { SceneObjectInstance, SurfacePlane, SceneLight, BlendMode, EnvironmentPreset } from './useSceneStore';

/** Schema version 2 added HDRI environment fields:
 *  environmentPreset, environmentIntensity, environmentRotation, useEnvironment.
 *  Older saves (v1) get sensible defaults via `migrateSceneState`. */
export const SCENE_SCHEMA_VERSION = 2;
export const MAX_SAVED_SCENES = 10;
export const CURRENT_SCENE_KEY = 'depth-current-scene';
export const SCENES_INDEX_KEY = 'depth-scenes-index';
export const SCENE_KEY_PREFIX = 'depth-scene-';
export const PERSIST_SIZE_WARN_BYTES = 4 * 1024 * 1024; // 4 MB

/** State fields included in saved snapshots — must match persist partialize. */
export interface PersistedSceneState {
  backgroundImage: string | null;
  objects: SceneObjectInstance[];
  selectedObjectId: string | null;
  sceneLights: SceneLight[];
  surfaces: SurfacePlane[];
  snapToSurface: boolean;
  blendMode: BlendMode;
  brightness: number;
  lightAngle: number;
  lightElevation: number;
  lightColor: string;
  shadowOpacity: number;
  shadowSoftness: number;
  shadowColor: string;
  autoLighting: boolean;
  environmentPreset: EnvironmentPreset;
  environmentIntensity: number;
  environmentRotation: number;
  useEnvironment: boolean;
}

export interface SavedSceneMeta {
  id: string;
  name: string;
  thumbnail: string;
  savedAt: number;
}

export interface SavedScene extends SavedSceneMeta {
  version: number;
  state: PersistedSceneState;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** Migrate older persisted state shapes to the current schema. */
export function migrateSceneState(
  version: number,
  state: unknown,
  defaults: PersistedSceneState,
): PersistedSceneState {
  if (state && typeof state === 'object') {
    // v1 -> v2: HDRI environment fields didn't exist. Spreading defaults first
    // backfills them; older saves load cleanly with environment turned on.
    if (version === 1 || version === SCENE_SCHEMA_VERSION) {
      return { ...defaults, ...(state as Partial<PersistedSceneState>) };
    }
  }
  // Unknown / older versions: fall back to defaults.
  return defaults;
}

export function readScenesIndex(): SavedSceneMeta[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(SCENES_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is SavedSceneMeta =>
        !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.name === 'string',
    );
  } catch {
    return [];
  }
}

function writeScenesIndex(index: SavedSceneMeta[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(SCENES_INDEX_KEY, JSON.stringify(index));
}

export function readSavedScene(id: string): SavedScene | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(SCENE_KEY_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as SavedScene;
  } catch {
    return null;
  }
}

/**
 * Persist a scene snapshot to a slot. Updates the index. Throws if the
 * 10-slot cap would be exceeded (callers should check first).
 */
export function writeSavedScene(scene: SavedScene): void {
  if (!isBrowser()) return;
  const index = readScenesIndex();
  const existing = index.findIndex((s) => s.id === scene.id);
  if (existing === -1 && index.length >= MAX_SAVED_SCENES) {
    throw new Error(`Cannot save more than ${MAX_SAVED_SCENES} scenes.`);
  }
  const meta: SavedSceneMeta = {
    id: scene.id,
    name: scene.name,
    thumbnail: scene.thumbnail,
    savedAt: scene.savedAt,
  };
  const nextIndex = existing === -1 ? [...index, meta] : index.map((s) => (s.id === scene.id ? meta : s));
  window.localStorage.setItem(SCENE_KEY_PREFIX + scene.id, JSON.stringify(scene));
  writeScenesIndex(nextIndex);
}

export function deleteSavedScene(id: string): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(SCENE_KEY_PREFIX + id);
  writeScenesIndex(readScenesIndex().filter((s) => s.id !== id));
}

/** Approximate JSON byte size (UTF-8) used for quota-pressure warnings. */
export function approxByteSize(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}
