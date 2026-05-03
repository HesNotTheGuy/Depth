import { describe, it, expect, beforeEach } from 'vitest';
import { useSceneStore } from './useSceneStore';

function reset() {
  useSceneStore.getState().reset();
  // Clear temporal history so undo/redo tests start clean.
  useSceneStore.temporal.getState().clear();
}

describe('useSceneStore', () => {
  beforeEach(() => {
    reset();
  });

  it('seeds with a single default Cube object selected', () => {
    const s = useSceneStore.getState();
    expect(s.objects).toHaveLength(1);
    expect(s.objects[0].type).toBe('box');
    expect(s.selectedObjectId).toBe(s.objects[0].id);
  });

  it('addObject appends, names uniquely, selects new', () => {
    const id1 = useSceneStore.getState().addObject('sphere');
    const id2 = useSceneStore.getState().addObject('sphere');
    const s = useSceneStore.getState();
    expect(s.objects).toHaveLength(3);
    expect(s.selectedObjectId).toBe(id2);
    const names = s.objects.map((o) => o.name);
    expect(new Set(names).size).toBe(names.length);
    expect(id1).not.toBe(id2);
  });

  it('removeObject removes and reselects another', () => {
    const id = useSceneStore.getState().addObject('cone');
    expect(useSceneStore.getState().objects).toHaveLength(2);
    useSceneStore.getState().removeObject(id);
    const s = useSceneStore.getState();
    expect(s.objects).toHaveLength(1);
    expect(s.selectedObjectId).toBe(s.objects[0].id);
  });

  it('duplicateObject clones with a new id and offset', () => {
    const orig = useSceneStore.getState().objects[0];
    const newId = useSceneStore.getState().duplicateObject(orig.id);
    const s = useSceneStore.getState();
    expect(newId).not.toBe(orig.id);
    expect(s.objects).toHaveLength(2);
    const copy = s.objects.find((o) => o.id === newId)!;
    expect(copy.name).toContain('(copy)');
    expect(copy.position.x).toBeCloseTo(orig.position.x + 0.3);
    // Mutating the copy should not leak into the original.
    copy.faceTextures['top'] = { url: 'x', repeat: { x: 1, y: 1 }, offset: { x: 0, y: 0 }, rotation: 0 };
    expect(orig.faceTextures['top']).toBeUndefined();
  });

  it('selectObject sets id and clears selectedFace', () => {
    useSceneStore.setState({ selectedFace: 'top' });
    const s1 = useSceneStore.getState();
    expect(s1.selectedFace).toBe('top');
    useSceneStore.getState().selectObject(s1.objects[0].id);
    expect(useSceneStore.getState().selectedFace).toBeNull();
  });

  it('updateObject merges fields and applies material defaults on material change', () => {
    const id = useSceneStore.getState().objects[0].id;
    useSceneStore.getState().updateObject(id, { material: 'glass' });
    const o = useSceneStore.getState().objects[0];
    expect(o.material).toBe('glass');
    expect(o.transmission).toBe(1.0);
    expect(o.ior).toBeCloseTo(1.5);
    expect(o.opacity).toBeCloseTo(0.2);
  });

  it('updateSelected updates only the selected object', () => {
    const a = useSceneStore.getState().objects[0].id;
    const b = useSceneStore.getState().addObject('sphere');
    useSceneStore.getState().selectObject(a);
    useSceneStore.getState().updateSelected({ color: '#ff0000' });
    const objs = useSceneStore.getState().objects;
    expect(objs.find((o) => o.id === a)!.color).toBe('#ff0000');
    expect(objs.find((o) => o.id === b)!.color).not.toBe('#ff0000');
  });

  it('setObjectVisible toggles visibility', () => {
    const id = useSceneStore.getState().objects[0].id;
    useSceneStore.getState().setObjectVisible(id, false);
    expect(useSceneStore.getState().objects[0].visible).toBe(false);
    useSceneStore.getState().setObjectVisible(id, true);
    expect(useSceneStore.getState().objects[0].visible).toBe(true);
  });

  it('setFaceTextureForSelected writes a face texture entry', () => {
    useSceneStore.getState().setFaceTextureForSelected('top', 'data:image/png;base64,abc');
    const o = useSceneStore.getState().objects[0];
    expect(o.faceTextures.top).toBeDefined();
    expect(o.faceTextures.top.url).toBe('data:image/png;base64,abc');
    expect(o.faceTextures.top.repeat).toEqual({ x: 1, y: 1 });
  });

  it('applyTemplate accepts legacy object* keys and normalizes to one object', () => {
    useSceneStore.getState().applyTemplate({
      objectType: 'sphere',
      objectColor: '#abcdef',
      objectMaterial: 'metallic',
    });
    const s = useSceneStore.getState();
    expect(s.objects).toHaveLength(1);
    expect(s.objects[0].type).toBe('sphere');
    expect(s.objects[0].color).toBe('#abcdef');
    expect(s.objects[0].material).toBe('metallic');
    expect(s.objects[0].metalness).toBeCloseTo(1.0);
  });

  it('reset returns to a fresh single-cube scene', () => {
    useSceneStore.getState().addObject('cone');
    useSceneStore.getState().addObject('sphere');
    useSceneStore.getState().reset();
    const s = useSceneStore.getState();
    expect(s.objects).toHaveLength(1);
    expect(s.objects[0].type).toBe('box');
  });

  it('temporal undo reverts a state mutation', () => {
    const startCount = useSceneStore.getState().objects.length;
    useSceneStore.getState().addObject('sphere');
    expect(useSceneStore.getState().objects.length).toBe(startCount + 1);
    useSceneStore.temporal.getState().undo();
    expect(useSceneStore.getState().objects.length).toBe(startCount);
  });

  it('temporal redo re-applies after an undo', () => {
    const startCount = useSceneStore.getState().objects.length;
    useSceneStore.getState().addObject('cone');
    useSceneStore.temporal.getState().undo();
    expect(useSceneStore.getState().objects.length).toBe(startCount);
    useSceneStore.temporal.getState().redo();
    expect(useSceneStore.getState().objects.length).toBe(startCount + 1);
  });
});
