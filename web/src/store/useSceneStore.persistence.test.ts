import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from './useSceneStore';
import {
  CURRENT_SCENE_KEY,
  SCENES_INDEX_KEY,
  SCENE_KEY_PREFIX,
  SCENE_SCHEMA_VERSION,
  MAX_SAVED_SCENES,
  migrateSceneState,
  readScenesIndex,
  readSavedScene,
  type PersistedSceneState,
} from './scenePersistence';

function defaults(): PersistedSceneState {
  return {
    backgroundImage: null,
    objects: [],
    selectedObjectId: null,
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
  };
}

function clearStorage() {
  // Clear current scene + every saved scene slot + index.
  window.localStorage.clear();
}

function resetStore() {
  useSceneStore.getState().reset();
  useSceneStore.temporal.getState().clear();
  useSceneStore.getState().markSaved();
}

describe('useSceneStore persistence + saved slots', () => {
  beforeEach(() => {
    clearStorage();
    resetStore();
  });

  it('writes current scene to localStorage on state change', () => {
    useSceneStore.getState().addObject('sphere');
    const raw = window.localStorage.getItem(CURRENT_SCENE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(SCENE_SCHEMA_VERSION);
    expect(Array.isArray(parsed.state.objects)).toBe(true);
    expect(parsed.state.objects.length).toBeGreaterThanOrEqual(2);
  });

  it('saveCurrentScene writes a slot and updates the index', () => {
    useSceneStore.getState().addObject('sphere');
    const meta = useSceneStore.getState().saveCurrentScene('My Scene', 'data:image/jpeg;base64,xxx');

    expect(meta.id).toBeTruthy();
    expect(meta.name).toBe('My Scene');
    const index = readScenesIndex();
    expect(index).toHaveLength(1);
    expect(index[0].id).toBe(meta.id);
    expect(index[0].name).toBe('My Scene');

    const stored = readSavedScene(meta.id);
    expect(stored).not.toBeNull();
    expect(stored!.version).toBe(SCENE_SCHEMA_VERSION);
    expect(stored!.state.objects.length).toBeGreaterThanOrEqual(2);

    // markSaved was applied
    expect(useSceneStore.getState().isDirty).toBe(false);
  });

  it('listSavedScenes returns the index', () => {
    useSceneStore.getState().saveCurrentScene('A', 'tn-a');
    useSceneStore.getState().saveCurrentScene('B', 'tn-b');
    const list = useSceneStore.getState().listSavedScenes();
    expect(list.map((s) => s.name).sort()).toEqual(['A', 'B']);
  });

  it('loadScene restores state and returns true', () => {
    const sphereId = useSceneStore.getState().addObject('sphere');
    expect(useSceneStore.getState().objects.find((o) => o.id === sphereId)).toBeDefined();
    const meta = useSceneStore.getState().saveCurrentScene('Snap', 'tn');

    // Mutate after saving.
    useSceneStore.getState().reset();
    expect(useSceneStore.getState().objects).toHaveLength(1);
    expect(useSceneStore.getState().objects[0].type).toBe('box');

    const ok = useSceneStore.getState().loadScene(meta.id);
    expect(ok).toBe(true);
    const loaded = useSceneStore.getState();
    expect(loaded.objects.some((o) => o.type === 'sphere')).toBe(true);
    expect(loaded.isDirty).toBe(false);
  });

  it('loadScene returns false for unknown id', () => {
    const ok = useSceneStore.getState().loadScene('no-such-id');
    expect(ok).toBe(false);
  });

  it('deleteScene removes the slot and index entry', () => {
    const a = useSceneStore.getState().saveCurrentScene('A', 'tn-a');
    const b = useSceneStore.getState().saveCurrentScene('B', 'tn-b');

    useSceneStore.getState().deleteScene(a.id);
    const remaining = readScenesIndex();
    expect(remaining.map((s) => s.id)).toEqual([b.id]);
    expect(readSavedScene(a.id)).toBeNull();
    expect(window.localStorage.getItem(SCENE_KEY_PREFIX + a.id)).toBeNull();
  });

  it('saveCurrentScene throws when slot cap is reached', () => {
    for (let i = 0; i < MAX_SAVED_SCENES; i++) {
      useSceneStore.getState().saveCurrentScene(`S${i}`, 'tn');
    }
    expect(() => useSceneStore.getState().saveCurrentScene('overflow', 'tn')).toThrow();
  });

  it('migrateSceneState returns defaults for older versions', () => {
    const d = defaults();
    const migrated = migrateSceneState(0, { objects: [{ foo: 'bar' }] }, d);
    expect(migrated).toEqual(d);
  });

  it('migrateSceneState passes through current version', () => {
    const d = defaults();
    const partial = { ...d, brightness: 2.5 };
    const migrated = migrateSceneState(SCENE_SCHEMA_VERSION, partial, d);
    expect(migrated.brightness).toBe(2.5);
  });

  it('isDirty flips true on edits and false on save/load', () => {
    expect(useSceneStore.getState().isDirty).toBe(false);
    useSceneStore.getState().addObject('cone');
    expect(useSceneStore.getState().isDirty).toBe(true);

    const meta = useSceneStore.getState().saveCurrentScene('X', 'tn');
    expect(useSceneStore.getState().isDirty).toBe(false);

    useSceneStore.getState().addObject('sphere');
    expect(useSceneStore.getState().isDirty).toBe(true);

    useSceneStore.getState().loadScene(meta.id);
    expect(useSceneStore.getState().isDirty).toBe(false);
  });

  it('undo still works after loading a saved scene', () => {
    const meta = useSceneStore.getState().saveCurrentScene('Base', 'tn');
    useSceneStore.getState().loadScene(meta.id);
    const before = useSceneStore.getState().objects.length;
    useSceneStore.getState().addObject('sphere');
    expect(useSceneStore.getState().objects.length).toBe(before + 1);
    useSceneStore.temporal.getState().undo();
    expect(useSceneStore.getState().objects.length).toBe(before);
  });

  it('saved scene index uses correct localStorage keys', () => {
    const meta = useSceneStore.getState().saveCurrentScene('Keyed', 'tn');
    expect(window.localStorage.getItem(SCENES_INDEX_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(SCENE_KEY_PREFIX + meta.id)).not.toBeNull();
  });
});
