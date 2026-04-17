import { Download, ArrowLeft, Box, Sun, Palette, Layers, Sparkles, LayoutGrid, Image, Undo2, Redo2, Keyboard } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { useSceneStore } from '../store/useSceneStore';
import { useHistory } from '../hooks/useHistory';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { CompositeViewport } from './viewport/CompositeViewport';
import { ObjectPanel } from './panels/ObjectPanel';
import { LightingPanel } from './panels/LightingPanel';
import { MaterialPanel } from './panels/MaterialPanel';
import { SurfacesPanel } from './panels/SurfacesPanel';
import { TemplatePanel } from './panels/TemplatePanel';
import { ExportPanel } from './panels/ExportPanel';
import { ShortcutsOverlay } from './ShortcutsOverlay';
import type { SidebarTab } from '../store/useUIStore';

const tabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: 'templates', label: 'Presets', icon: <LayoutGrid size={15} /> },
  { id: 'object', label: 'Object', icon: <Box size={15} /> },
  { id: 'surfaces', label: 'Surfaces', icon: <Layers size={15} /> },
  { id: 'lighting', label: 'Light', icon: <Sun size={15} /> },
  { id: 'material', label: 'Material', icon: <Palette size={15} /> },
  { id: 'export', label: 'Export', icon: <Image size={15} /> },
];

export function Editor() {
  const setStep = useUIStore((s) => s.setStep);
  const sidebarTab = useUIStore((s) => s.sidebarTab);
  const setSidebarTab = useUIStore((s) => s.setSidebarTab);
  const reset = useSceneStore((s) => s.reset);
  const surfaceCount = useSceneStore((s) => s.surfaces.length);
  const { undo, redo, canUndo, canRedo } = useHistory();
  const setShowShortcuts = useUIStore((s) => s.setShowShortcuts);

  useKeyboardShortcuts();

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Toolbar */}
      <div className="h-12 border-b border-panel-border bg-surface-raised flex items-center px-3 justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              reset();
              setStep('upload');
            }}
            className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors"
            title="Start over"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-primary" />
            <span className="font-bold text-sm bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent tracking-tight">
              DEPTH
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => undo()}
            disabled={!canUndo}
            className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-muted"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 size={15} />
          </button>
          <button
            onClick={() => redo()}
            disabled={!canRedo}
            className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-muted"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={15} />
          </button>
          <button
            onClick={() => setShowShortcuts(true)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard size={15} />
          </button>
          <button
            onClick={() => setSidebarTab('export')}
            className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-hover hover:brightness-110 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-lg shadow-primary/15 ml-1"
          >
            <Download size={13} />
            Export
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Viewport */}
        <CompositeViewport />

        {/* Right sidebar */}
        <div className="w-80 border-l border-panel-border bg-surface-raised flex flex-col shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-panel-border px-2 pt-1.5 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSidebarTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 text-[9px] font-medium transition-all rounded-t-lg relative ${
                  sidebarTab === tab.id
                    ? 'text-primary bg-white/[0.03]'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
                title={tab.label}
              >
                <span className="relative">
                  {tab.icon}
                  {tab.id === 'surfaces' && surfaceCount > 0 && (
                    <span className="absolute -top-1 -right-2.5 w-3.5 h-3.5 bg-primary/20 text-primary text-[8px] rounded-full flex items-center justify-center font-bold">
                      {surfaceCount}
                    </span>
                  )}
                </span>
                {tab.label}
                {sidebarTab === tab.id && (
                  <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full" />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {sidebarTab === 'templates' && <TemplatePanel />}
            {sidebarTab === 'object' && <ObjectPanel />}
            {sidebarTab === 'surfaces' && <SurfacesPanel />}
            {sidebarTab === 'lighting' && <LightingPanel />}
            {sidebarTab === 'material' && <MaterialPanel />}
            {sidebarTab === 'export' && <ExportPanel />}
          </div>
        </div>
      </div>

      {/* Floating help hint */}
      <button
        onClick={() => setShowShortcuts(true)}
        className="fixed bottom-4 right-[336px] z-40 w-8 h-8 rounded-full bg-surface-raised border border-panel-border text-text-muted hover:text-text-primary hover:bg-white/5 shadow-lg text-xs font-semibold transition-colors"
        title="Keyboard shortcuts (?)"
        aria-label="Show keyboard shortcuts"
      >
        ?
      </button>

      <ShortcutsOverlay />
    </div>
  );
}
