import { useEffect } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { useUIStore } from '../store/useUIStore';
import { useHistory } from './useHistory';

/**
 * Global keyboard shortcut dispatcher.
 *
 * Registers a single keydown listener on window and routes keys to the
 * appropriate scene / UI store actions. Shortcuts are suppressed while the
 * user is typing in a form field or contentEditable element.
 */
export function useKeyboardShortcuts() {
  const { undo, redo, canUndo, canRedo } = useHistory();

  const selectedId = useSceneStore((s) => s.selectedObjectId);
  const removeObject = useSceneStore((s) => s.removeObject);
  const duplicateObject = useSceneStore((s) => s.duplicateObject);
  const selectObject = useSceneStore((s) => s.selectObject);
  const updateSelected = useSceneStore((s) => s.updateSelected);

  const canvasZoom = useUIStore((s) => s.canvasZoom);
  const setCanvasZoom = useUIStore((s) => s.setCanvasZoom);
  const fitToScreen = useUIStore((s) => s.fitToScreen);
  const showShortcuts = useUIStore((s) => s.showShortcuts);
  const setShowShortcuts = useUIStore((s) => s.setShowShortcuts);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const mod = e.ctrlKey || e.metaKey;
      const key = e.key;
      const lowerKey = key.toLowerCase();

      // "?" — toggle shortcuts overlay. Shift+/ on US layouts.
      if (!mod && !e.altKey && (key === '?' || (e.shiftKey && key === '/'))) {
        e.preventDefault();
        setShowShortcuts(!showShortcuts);
        return;
      }

      // Escape — close shortcuts overlay or deselect
      if (key === 'Escape' && !mod && !e.shiftKey && !e.altKey) {
        if (showShortcuts) {
          e.preventDefault();
          setShowShortcuts(false);
          return;
        }
        e.preventDefault();
        selectObject(null);
        return;
      }

      // Modifier shortcuts (Ctrl/Cmd)
      if (mod && !e.altKey) {
        // Undo: Ctrl+Z (no shift)
        if (lowerKey === 'z' && !e.shiftKey) {
          e.preventDefault();
          if (canUndo) undo();
          return;
        }
        // Redo: Ctrl+Shift+Z or Ctrl+Y
        if ((lowerKey === 'z' && e.shiftKey) || (lowerKey === 'y' && !e.shiftKey)) {
          e.preventDefault();
          if (canRedo) redo();
          return;
        }
        // Duplicate: Ctrl+D (no shift)
        if (lowerKey === 'd' && !e.shiftKey) {
          e.preventDefault();
          if (selectedId) duplicateObject(selectedId);
          return;
        }
        // Fit to screen: Ctrl+0
        if (key === '0' && !e.shiftKey) {
          e.preventDefault();
          fitToScreen();
          return;
        }
        // Zoom to 100%: Ctrl+1
        if (key === '1' && !e.shiftKey) {
          e.preventDefault();
          setCanvasZoom(1);
          return;
        }
        // Zoom in: Ctrl++ or Ctrl+=
        if ((key === '+' || key === '=') && !e.shiftKey) {
          e.preventDefault();
          setCanvasZoom(canvasZoom + 0.1);
          return;
        }
        // Ctrl+Shift+= is typically Ctrl++ on many layouts — accept it too.
        if (key === '+' && e.shiftKey) {
          e.preventDefault();
          setCanvasZoom(canvasZoom + 0.1);
          return;
        }
        // Zoom out: Ctrl+-
        if (key === '-' && !e.shiftKey) {
          e.preventDefault();
          setCanvasZoom(canvasZoom - 0.1);
          return;
        }
        return; // other modifier combos — leave alone
      }

      // No modifier from here on (Shift may still be active for nudges)
      if (mod || e.altKey) return;

      // Delete / Backspace — remove selected
      if ((key === 'Delete' || key === 'Backspace') && selectedId) {
        e.preventDefault();
        removeObject(selectedId);
        return;
      }

      // Arrow keys — nudge position
      if (
        key === 'ArrowLeft' ||
        key === 'ArrowRight' ||
        key === 'ArrowUp' ||
        key === 'ArrowDown'
      ) {
        if (!selectedId) return;
        const step = e.shiftKey ? 0.5 : 0.05;
        const current = useSceneStore
          .getState()
          .objects.find((o) => o.id === selectedId)?.position;
        if (!current) return;
        let dx = 0;
        let dy = 0;
        if (key === 'ArrowLeft') dx = -step;
        else if (key === 'ArrowRight') dx = step;
        else if (key === 'ArrowUp') dy = step;
        else if (key === 'ArrowDown') dy = -step;
        e.preventDefault();
        updateSelected({
          position: {
            x: current.x + dx,
            y: current.y + dy,
            z: current.z,
          },
        });
        return;
      }

      // R — reset rotation
      if (lowerKey === 'r' && !e.shiftKey) {
        if (!selectedId) return;
        e.preventDefault();
        updateSelected({ rotation: { x: 0, y: 0, z: 0 } });
        return;
      }

      // 0 — reset position
      if (key === '0' && !e.shiftKey) {
        if (!selectedId) return;
        e.preventDefault();
        updateSelected({ position: { x: 0, y: 0.5, z: 0 } });
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    undo,
    redo,
    canUndo,
    canRedo,
    selectedId,
    removeObject,
    duplicateObject,
    selectObject,
    updateSelected,
    canvasZoom,
    setCanvasZoom,
    fitToScreen,
    showShortcuts,
    setShowShortcuts,
  ]);
}
