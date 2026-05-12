import { create } from 'zustand';

/**
 * Tracks the most recent raycast hit from R3F pointer events.
 *
 * This is a lightweight side-channel for non-3D code (e.g. HTML drag-and-drop
 * handlers on the viewport container) to read what 3D object/face the cursor
 * is currently over without doing its own raycast. SceneObjectInstanceMesh
 * writes here on every pointer move; the viewport reads it on drop.
 */
export interface HoverHit {
  objectId: string;
  /** Named face from `detectFace` ('front', 'top', 'all', etc.) */
  face: string;
}

interface HoverState {
  latest: HoverHit | null;
  setLatest: (hit: HoverHit | null) => void;
}

export const useHoverStore = create<HoverState>((set) => ({
  latest: null,
  setLatest: (hit) => set({ latest: hit }),
}));
