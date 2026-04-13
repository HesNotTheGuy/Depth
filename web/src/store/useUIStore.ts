import { create } from 'zustand';
import type { Point2D } from './useSceneStore';

export type AppStep = 'upload' | 'editor';
export type SidebarTab = 'object' | 'lighting' | 'material' | 'surfaces';

interface UIState {
  step: AppStep;
  sidebarTab: SidebarTab;
  showExportModal: boolean;
  isAnalyzing: boolean;

  // Surface drawing mode
  isDrawing: boolean;
  drawingPoints: Point2D[];

  setStep: (step: AppStep) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setShowExportModal: (show: boolean) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  startDrawing: () => void;
  addDrawingPoint: (point: Point2D) => void;
  cancelDrawing: () => void;
  finishDrawing: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  step: 'upload',
  sidebarTab: 'object',
  showExportModal: false,
  isAnalyzing: false,
  isDrawing: false,
  drawingPoints: [],

  setStep: (step) => set({ step }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
  setShowExportModal: (show) => set({ showExportModal: show }),
  setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
  startDrawing: () => set({ isDrawing: true, drawingPoints: [], sidebarTab: 'surfaces' }),
  addDrawingPoint: (point) =>
    set((s) => {
      if (s.drawingPoints.length >= 4) return s;
      return { drawingPoints: [...s.drawingPoints, point] };
    }),
  cancelDrawing: () => set({ isDrawing: false, drawingPoints: [] }),
  finishDrawing: () => set({ isDrawing: false, drawingPoints: [] }),
}));
