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
        <p className="text-xs text-text-muted mb-3">
          Draw surfaces on your photo to define where objects can sit. Click 4 corners to create a
          plane.
        </p>
        <button
          onClick={startDrawing}
          disabled={isDrawing}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary-hover disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <PenTool size={16} />
          {isDrawing ? 'Drawing...' : 'Draw Surface'}
        </button>
      </div>

      <label className="flex items-center gap-2 cursor-pointer mb-4">
        <input
          type="checkbox"
          checked={snapToSurface}
          onChange={(e) => setSnapToSurface(e.target.checked)}
          className="accent-primary"
        />
        <Magnet size={14} className="text-text-muted" />
        <span className="text-sm text-text-secondary">Snap object to surfaces</span>
      </label>

      {surfaces.length === 0 ? (
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-2">
            <PenTool size={20} className="text-text-muted" />
          </div>
          <p className="text-xs text-text-muted">
            No surfaces yet. Draw one to define where your object can rest.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="text-xs font-medium text-text-muted uppercase tracking-wider block">
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
    <div className="border border-panel-border rounded-lg p-2.5">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: surface.color }}
        />
        <input
          type="text"
          value={surface.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 text-sm text-text-primary bg-transparent focus:outline-none"
        />
        <button
          onClick={onToggle}
          className="p-1 hover:bg-gray-100 rounded text-text-muted"
          title={surface.visible ? 'Hide' : 'Show'}
        >
          {surface.visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          onClick={onDelete}
          className="p-1 hover:bg-red-50 hover:text-red-500 rounded text-text-muted"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Height adjustment — most useful control for fine-tuning */}
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
          className="flex-1 accent-primary"
        />
        <span className="text-[10px] text-text-muted tabular-nums w-8 text-right">
          {surface.position.y.toFixed(2)}
        </span>
      </div>

      {/* Tilt adjustment */}
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
          className="flex-1 accent-primary"
        />
        <span className="text-[10px] text-text-muted tabular-nums w-8 text-right">
          {((surface.rotation.x * 180) / Math.PI).toFixed(0)}°
        </span>
      </div>
    </div>
  );
}
