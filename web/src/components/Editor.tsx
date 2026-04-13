import { Download, ArrowLeft, Box, Sun, Palette, Layers, Sparkles } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { useSceneStore } from '../store/useSceneStore';
import { CompositeViewport } from './viewport/CompositeViewport';
import { ObjectPanel } from './panels/ObjectPanel';
import { LightingPanel } from './panels/LightingPanel';
import { MaterialPanel } from './panels/MaterialPanel';
import { SurfacesPanel } from './panels/SurfacesPanel';
import type { SidebarTab } from '../store/useUIStore';

const tabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: 'object', label: 'Object', icon: <Box size={14} /> },
  { id: 'surfaces', label: 'Surfaces', icon: <Layers size={14} /> },
  { id: 'lighting', label: 'Light', icon: <Sun size={14} /> },
  { id: 'material', label: 'Material', icon: <Palette size={14} /> },
];

export function Editor() {
  const setStep = useUIStore((s) => s.setStep);
  const sidebarTab = useUIStore((s) => s.sidebarTab);
  const setSidebarTab = useUIStore((s) => s.setSidebarTab);
  const setShowExportModal = useUIStore((s) => s.setShowExportModal);
  const reset = useSceneStore((s) => s.reset);
  const surfaceCount = useSceneStore((s) => s.surfaces.length);

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

        <button
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary-hover hover:brightness-110 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-lg shadow-primary/15"
        >
          <Download size={13} />
          Export
        </button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Viewport */}
        <CompositeViewport />

        {/* Right sidebar */}
        <div className="w-72 border-l border-panel-border bg-surface-raised flex flex-col shrink-0">
          {/* Tabs */}
          <div className="flex border-b border-panel-border px-1 pt-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSidebarTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-all rounded-t-lg relative ${
                  sidebarTab === tab.id
                    ? 'text-primary bg-white/[0.03]'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'surfaces' && surfaceCount > 0 && (
                  <span className="w-4 h-4 bg-primary/20 text-primary text-[9px] rounded-full flex items-center justify-center font-bold">
                    {surfaceCount}
                  </span>
                )}
                {sidebarTab === tab.id && (
                  <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full" />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {sidebarTab === 'object' && <ObjectPanel />}
            {sidebarTab === 'surfaces' && <SurfacesPanel />}
            {sidebarTab === 'lighting' && <LightingPanel />}
            {sidebarTab === 'material' && <MaterialPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}
