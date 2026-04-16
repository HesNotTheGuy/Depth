import { create } from 'zustand';
import type { Point2D } from './useSceneStore';

export type AppStep = 'upload' | 'editor';
export type SidebarTab = 'templates' | 'object' | 'lighting' | 'material' | 'surfaces' | 'export';

interface UIState {
  step: AppStep;
  sidebarTab: SidebarTab;
  showExportModal: boolean;
  isAnalyzing: boolean;

  // Surface drawing mode
  isDrawing: boolean;
  drawingPoints: Point2D[];

  // Canvas zoom/pan
  canvasZoom: number;      // 1 = 100%, 0.5 = 50%, 2 = 200%
  canvasPan: { x: number; y: number }; // offset in pixels

  setStep: (step: AppStep) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setShowExportModal: (show: boolean) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  startDrawing: () => void;
  addDrawingPoint: (point: Point2D) => void;
  cancelDrawing: () => void;
  finishDrawing: () => void;
  setCanvasZoom: (zoom: number) => void;
  setCanvasPan: (pan: { x: number; y: number }) => void;
  fitToScreen: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  step: 'upload',
  sidebarTab: 'object',
  showExportModal: false,
  isAnalyzing: false,
  isDrawing: false,
  drawingPoints: [],
  canvasZoom: 1,
  canvasPan: { x: 0, y: 0 },

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
  setCanvasZoom: (zoom) => set({ canvasZoom: Math.max(0.1, Math.min(5, zoom)) }),
  setCanvasPan: (pan) => set({ canvasPan: pan }),
  fitToScreen: () => set({ canvasZoom: 1, canvasPan: { x: 0, y: 0 } }),
}));
