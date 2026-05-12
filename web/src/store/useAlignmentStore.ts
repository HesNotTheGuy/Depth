import { create } from 'zustand';
import type { AlignmentSnap } from '../utils/alignmentUtils';

/**
 * Transient, in-memory store for the currently-active alignment guides.
 * Populated while dragging an object; cleared on pointer-up. Lives outside
 * the scene store because it is never persisted and changes at pointer-move
 * frequency.
 */
interface AlignmentState {
  activeGuides: AlignmentSnap[];
  setActiveGuides: (guides: AlignmentSnap[]) => void;
  clearGuides: () => void;
}

export const useAlignmentStore = create<AlignmentState>((set) => ({
  activeGuides: [],
  setActiveGuides: (guides) => set({ activeGuides: guides }),
  clearGuides: () => set({ activeGuides: [] }),
}));
