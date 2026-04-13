import { PenTool, Eye, EyeOff, Trash2, Magnet } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { useSceneStore, type SurfacePlane } from '../../store/useSceneStore';

export function SurfacesPanel() {
  const startDrawing = useUIStore((s) => s.startDrawing);
  const isDrawing = useUIStore((s) => s.isDrawing);
  const surfaces = useSceneStore((s) => s.surfaces);
  const updateSurface = useSceneStore((s) => s.updateSurface);
  const removeSurface = useSceneStore((s) => s.removeSurface);
  const snapToSurface = useSceneStore((s) => s.snapToSurface);
  const setSnapToSurface = useSceneStore((s) => s.setSnapToSurface);

  return (
    <div>
      <div className="mb-4">
        <p className="text-[11px] text-text-muted mb-3 leading-relaxed">
          Draw surfaces on your photo to define where 3D objects can rest. Click 4 corners to create a plane.
        </p>
        <button
          onClick={startDrawing}
          disabled={isDrawing}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            isDrawing
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'bg-gradient-to-r from-primary to-primary-hover hover:brightness-110 text-white shadow-lg shadow-primary/15'
          }`}
        >
          <PenTool size={15} />
          {isDrawing ? 'Drawing...' : 'Draw Surface'}
        </button>
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer mb-4 group">
        <input
          type="checkbox"
          checked={snapToSurface}
          onChange={(e) => setSnapToSurface(e.target.checked)}
        />
        <Magnet size={13} className="text-text-muted group-hover:text-primary transition-colors" />
        <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
          Snap to surfaces
        </span>
      </label>

      {surfaces.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-xl bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
            <PenTool size={18} className="text-text-muted" />
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed max-w-[180px] mx-auto">
            No surfaces yet. Draw one so your object has a place to land.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest block">
            Surfaces ({surfaces.length})
          </label>
          {surfaces.map((surface) => (
            <SurfaceItem
              key={surface.id}
              surface={surface}
              onToggle={() => updateSurface(surface.id, { visible: !surface.visible })}
              onDelete={() => removeSurface(surface.id)}
              onUpdate={(updates) => updateSurface(surface.id, updates)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SurfaceItem({
  surface,
  onToggle,
  onDelete,
  onUpdate,
}: {
  surface: SurfacePlane;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<SurfacePlane>) => void;
}) {
  return (
    <div className="border border-white/6 bg-white/[0.02] rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white/10"
          style={{ backgroundColor: surface.color }}
        />
        <input
          type="text"
          value={surface.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 text-xs text-text-primary bg-transparent focus:outline-none"
        />
        <button
          onClick={onToggle}
          className="p-1 hover:bg-white/5 rounded-md text-text-muted hover:text-text-secondary transition-colors"
          title={surface.visible ? 'Hide' : 'Show'}
        >
          {surface.visible ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
        <button
          onClick={onDelete}
          className="p-1 hover:bg-danger/10 hover:text-danger rounded-md text-text-muted transition-colors"
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-muted w-10">Height</span>
        <input
          type="range"
          min={-1}
          max={3}
          step={0.02}
          value={surface.position.y}
          onChange={(e) =>
            onUpdate({ position: { ...surface.position, y: parseFloat(e.target.value) } })
          }
          className="flex-1"
        />
        <span className="text-[10px] text-text-muted tabular-nums font-mono w-8 text-right">
          {surface.position.y.toFixed(2)}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-text-muted w-10">Tilt</span>
        <input
          type="range"
          min={-Math.PI / 2}
          max={0}
          step={0.02}
          value={surface.rotation.x}
          onChange={(e) =>
            onUpdate({ rotation: { ...surface.rotation, x: parseFloat(e.target.value) } })
          }
          className="flex-1"
        />
        <span className="text-[10px] text-text-muted tabular-nums font-mono w-8 text-right">
          {((surface.rotation.x * 180) / Math.PI).toFixed(0)}°
        </span>
      </div>
    </div>
  );
}
