import { useSceneStore, type SceneObjectInstance } from '../store/useSceneStore';

/** Returns the currently-selected scene object, or null if none is selected. */
export function useSelectedObject(): SceneObjectInstance | null {
  return useSceneStore((s) => s.objects.find((o) => o.id === s.selectedObjectId) ?? null);
}
