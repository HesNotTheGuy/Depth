import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './useUIStore';

const initial = useUIStore.getState();

beforeEach(() => {
  useUIStore.setState({
    step: 'upload',
    sidebarTab: 'object',
    isAnalyzing: false,
    isDrawing: false,
    drawingPoints: [],
    canvasZoom: 1,
    canvasPan: { x: 0, y: 0 },
    gizmoMode: 'translate',
    showShortcuts: false,
  }, false);
  // re-attach actions which got wiped by partial replace=false; the methods stay on the store.
  void initial;
});

describe('useUIStore canvas zoom/pan', () => {
  it('clamps zoom to [0.1, 5]', () => {
    useUIStore.getState().setCanvasZoom(10);
    expect(useUIStore.getState().canvasZoom).toBe(5);
    useUIStore.getState().setCanvasZoom(0);
    expect(useUIStore.getState().canvasZoom).toBe(0.1);
    useUIStore.getState().setCanvasZoom(2);
    expect(useUIStore.getState().canvasZoom).toBe(2);
  });

  it('setCanvasPan stores pan offset', () => {
    useUIStore.getState().setCanvasPan({ x: 50, y: -20 });
    expect(useUIStore.getState().canvasPan).toEqual({ x: 50, y: -20 });
  });

  it('fitToScreen resets zoom and pan', () => {
    useUIStore.getState().setCanvasZoom(3);
    useUIStore.getState().setCanvasPan({ x: 100, y: 100 });
    useUIStore.getState().fitToScreen();
    const s = useUIStore.getState();
    expect(s.canvasZoom).toBe(1);
    expect(s.canvasPan).toEqual({ x: 0, y: 0 });
  });
});

describe('useUIStore gizmo mode', () => {
  it('cycles through translate/rotate/scale', () => {
    useUIStore.getState().setGizmoMode('rotate');
    expect(useUIStore.getState().gizmoMode).toBe('rotate');
    useUIStore.getState().setGizmoMode('scale');
    expect(useUIStore.getState().gizmoMode).toBe('scale');
    useUIStore.getState().setGizmoMode('translate');
    expect(useUIStore.getState().gizmoMode).toBe('translate');
  });
});

describe('useUIStore drawing lifecycle', () => {
  it('startDrawing clears points and switches sidebar to surfaces', () => {
    useUIStore.getState().startDrawing();
    const s = useUIStore.getState();
    expect(s.isDrawing).toBe(true);
    expect(s.drawingPoints).toEqual([]);
    expect(s.sidebarTab).toBe('surfaces');
  });

  it('addDrawingPoint accumulates up to 4 points', () => {
    useUIStore.getState().startDrawing();
    for (let i = 0; i < 6; i++) {
      useUIStore.getState().addDrawingPoint({ x: i * 0.1, y: i * 0.2 });
    }
    expect(useUIStore.getState().drawingPoints).toHaveLength(4);
  });

  it('cancelDrawing resets', () => {
    useUIStore.getState().startDrawing();
    useUIStore.getState().addDrawingPoint({ x: 0.1, y: 0.1 });
    useUIStore.getState().cancelDrawing();
    const s = useUIStore.getState();
    expect(s.isDrawing).toBe(false);
    expect(s.drawingPoints).toEqual([]);
  });

  it('finishDrawing resets', () => {
    useUIStore.getState().startDrawing();
    useUIStore.getState().addDrawingPoint({ x: 0.5, y: 0.5 });
    useUIStore.getState().finishDrawing();
    const s = useUIStore.getState();
    expect(s.isDrawing).toBe(false);
    expect(s.drawingPoints).toEqual([]);
  });
});
