import { Download, ArrowLeft } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';
import { useSceneStore } from '../store/useSceneStore';
import { CompositeViewport } from './viewport/CompositeViewport';
import { ObjectPanel } from './panels/ObjectPanel';
import { LightingPanel } from './panels/LightingPanel';
import { MaterialPanel } from './panels/MaterialPanel';
import { SurfacesPanel } from './panels/SurfacesPanel';
import type { SidebarTab } from '../store/useUIStore';

const tabs: { id: SidebarTab; label: string }[] = [
  { id: 'object', label: 'Object' },
  { id: 'surfaces', label: 'Surfaces' },
  { id: 'lighting', label: 'Lighting' },
  { id: 'material', label: 'Material' },
];

export function Editor() {
  const setStep = useUIStore((s) => s.setStep);
  const sidebarTab = useUIStore((s) => s.sidebarTab);
  const setSidebarTab = useUIStore((s) => s.setSidebarTab);
  const setShowExportModal = useUIStore((s) => s.setShowExportModal);
  const reset = useSceneStore((s) => s.reset);
  const surfaceCount = useSceneStore((s) => s.surfaces.length);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="h-14 border-b border-panel-border bg-white flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              reset();
              setStep('upload');
            }}
            className="p-2 rounded-lg hover:bg-gray-100 text-text-secondary"
            title="Start over"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="font-bold text-lg text-primary tracking-tight">DEPTH</span>
        </div>

        <button
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Download size={16} />
          Export
        </button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Viewport */}
        <CompositeViewport />

        {/* Right sidebar */}
        <div className="w-72 border-l border-panel-border bg-white flex flex-col shrink-0">
          <div className="flex border-b border-panel-border">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSidebarTab(tab.id)}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
                  sidebarTab === tab.id
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {tab.label}
                {tab.id === 'surfaces' && surfaceCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                    {surfaceCount}
                  </span>
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
