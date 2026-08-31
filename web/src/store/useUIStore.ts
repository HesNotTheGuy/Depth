import { create } from 'zustand';
import type { Point2D } from './useSceneStore';

export type AppStep = 'upload' | 'editor';
export type SidebarTab = 'templates' | 'object' | 'lighting' | 'material' | 'surfaces' | 'scenes' | 'export';
export type GizmoMode = 'translate' | 'rotate' | 'scale';

interface UIState {
  step: AppStep;
  sidebarTab: SidebarTab;
  isAnalyzing: boolean;

  // Surface drawing mode
  isDrawing: boolean;
  drawingPoints: Point2D[];

  // Canvas zoom/pan
  canvasZoom: number;      // 1 = 100%, 0.5 = 50%, 2 = 200%
  canvasPan: { x: number; y: number }; // offset in pixels
  /** Bumped by fitToScreen(); CompositeViewport listens and computes aspect-fit. */
  fitRequestId: number;

  // Transform gizmo
  gizmoMode: GizmoMode;

  // Shortcuts overlay
  showShortcuts: boolean;

  // Color picker / eyedropper (fallback for browsers without EyeDropper API)
  isPickingColor: boolean;
  recentColors: string[];

  setStep: (step: AppStep) => void;
  setSidebarTab: (tab: SidebarTab) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  startDrawing: () => void;
  addDrawingPoint: (point: Point2D) => void;
  cancelDrawing: () => void;
  finishDrawing: () => void;
  setCanvasZoom: (zoom: number) => void;
  setCanvasPan: (pan: { x: number; y: number }) => void;
  fitToScreen: () => void;
  setGizmoMode: (mode: GizmoMode) => void;
  setShowShortcuts: (show: boolean) => void;
  setPickingColor: (v: boolean) => void;
  addRecentColor: (color: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  step: 'upload',
  sidebarTab: 'object',
  isAnalyzing: false,
  isDrawing: false,
  drawingPoints: [],
  canvasZoom: 1,
  canvasPan: { x: 0, y: 0 },
  fitRequestId: 0,
  gizmoMode: 'translate',
  showShortcuts: false,
  isPickingColor: false,
  recentColors: [],

  setStep: (step) => set({ step }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
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
  // Viewport owns the real aspect-fit math; this just signals a request.
  // Fallback reset keeps Ctrl+0 useful before the image has loaded.
  fitToScreen: () =>
    set((s) => ({
      fitRequestId: s.fitRequestId + 1,
      canvasZoom: 1,
      canvasPan: { x: 0, y: 0 },
    })),
  setGizmoMode: (mode) => set({ gizmoMode: mode }),
  setShowShortcuts: (show) => set({ showShortcuts: show }),
  setPickingColor: (v) => set({ isPickingColor: v }),
  addRecentColor: (color) =>
    set((s) => {
      const c = color.toLowerCase();
      const filtered = s.recentColors.filter((rc) => rc.toLowerCase() !== c);
      return { recentColors: [color, ...filtered].slice(0, 8) };
    }),
}));
