import { useStore } from 'zustand';
import { useSceneStore } from '../store/useSceneStore';

/**
 * Reactive access to the scene store's temporal (undo/redo) state.
 * Powered by the `zundo` temporal middleware wrapping `useSceneStore`.
 */
export function useHistory() {
  const { pastStates, futureStates, undo, redo, clear } = useStore(
    useSceneStore.temporal,
    (s) => s,
  );
  return {
    undo,
    redo,
    clear,
    canUndo: pastStates.length > 0,
    canRedo: futureStates.length > 0,
  };
}
