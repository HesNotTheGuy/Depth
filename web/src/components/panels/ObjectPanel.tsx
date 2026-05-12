import { useCallback, useRef } from 'react';
import { useSceneStore, type ObjectPreset } from '../../store/useSceneStore';
import { useSelectedObject } from '../../hooks/useSelectedObject';
import { Box, Circle, Triangle, Cylinder as CylinderIcon, Hexagon, Upload, X, Coffee, Smartphone, Wine, ShoppingBag, CreditCard, Laptop, Tablet, CupSoda, BookOpen, Plus, Eye, EyeOff, Trash2, Copy } from 'lucide-react';
import { SliderInput, Vec3SliderInput } from '../ui/SliderInput';

const shapes: { id: ObjectPreset; label: string; icon: React.ReactNode }[] = [
  { id: 'box', label: 'Cube', icon: <Box size={18} /> },
  { id: 'cylinder', label: 'Cylinder', icon: <CylinderIcon size={18} /> },
  { id: 'sphere', label: 'Sphere', icon: <Circle size={18} /> },
  { id: 'cone', label: 'Cone', icon: <Triangle size={18} /> },
  { id: 'torus', label: 'Torus', icon: <Hexagon size={18} /> },
];

const mockups: { id: ObjectPreset; label: string; icon: React.ReactNode }[] = [
  { id: 'mug', label: 'Mug', icon: <Coffee size={18} /> },
  { id: 'phone', label: 'Phone', icon: <Smartphone size={18} /> },
  { id: 'bottle', label: 'Bottle', icon: <Wine size={18} /> },
  { id: 'bag', label: 'Bag', icon: <ShoppingBag size={18} /> },
  { id: 'card', label: 'Card', icon: <CreditCard size={18} /> },
  { id: 'donut', label: 'Donut', icon: <span className="text-base leading-none">🍩</span> },
  { id: 'laptop', label: 'Laptop', icon: <Laptop size={18} /> },
  { id: 'tablet', label: 'Tablet', icon: <Tablet size={18} /> },
  { id: 'can', label: 'Can', icon: <CupSoda size={18} /> },
  { id: 'book', label: 'Book', icon: <BookOpen size={18} /> },
];

const ALL_PRESETS = [...shapes, ...mockups];

function iconForType(type: ObjectPreset): React.ReactNode {
  const found = ALL_PRESETS.find((p) => p.id === type);
  return found?.icon ?? <Box size={14} />;
}

export function ObjectPanel() {
  const objects = useSceneStore((s) => s.objects);
  const selectedObjectId = useSceneStore((s) => s.selectedObjectId);
  const selected = useSelectedObject();
  const addObject = useSceneStore((s) => s.addObject);
  const removeObject = useSceneStore((s) => s.removeObject);
  const duplicateObject = useSceneStore((s) => s.duplicateObject);
  const selectObject = useSceneStore((s) => s.selectObject);
  const setObjectVisible = useSceneStore((s) => s.setObjectVisible);
  const updateSelected = useSceneStore((s) => s.updateSelected);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleObjUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      if (selected) {
        updateSelected({ type: 'custom', customModelUrl: url });
      } else {
        const id = addObject('custom');
        useSceneStore.getState().updateObject(id, { customModelUrl: url });
      }
    },
    [selected, updateSelected, addObject]
  );

  const clearCustomModel = useCallback(() => {
    if (!selected) return;
    if (selected.customModelUrl) URL.revokeObjectURL(selected.customModelUrl);
    updateSelected({ customModelUrl: null, type: 'box' });
  }, [selected, updateSelected]);

  const addPresetButton = (preset: ObjectPreset) => {
    if (selected) {
      updateSelected({ type: preset });
    } else {
      addObject(preset);
    }
  };

  return (
    <div>
      {/* Objects list */}
      <div className="flex items-center justify-between mb-2.5">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest block">
          Objects
        </label>
        <button
          onClick={() => addObject(selected?.type ?? 'box')}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/15 hover:bg-primary/25 text-primary text-[10px] font-medium transition-colors"
          title="Add a new object"
        >
          <Plus size={11} />
          Add
        </button>
      </div>
      <div className="space-y-1 mb-5">
        {objects.length === 0 && (
          <p className="text-[10px] text-text-muted">No objects in scene. Click Add.</p>
        )}
        {objects.map((o) => {
          const isSel = o.id === selectedObjectId;
          return (
            <div
              key={o.id}
              onClick={() => selectObject(o.id)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all ${
                isSel
                  ? 'bg-primary/15 ring-1 ring-primary/30'
                  : 'bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              <span className={`shrink-0 ${isSel ? 'text-primary' : 'text-text-muted'}`}>
                {iconForType(o.type)}
              </span>
              <span className={`flex-1 min-w-0 truncate text-[11px] ${isSel ? 'text-primary font-medium' : 'text-text-primary'}`}>
                {o.name}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setObjectVisible(o.id, !o.visible); }}
                className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
                title={o.visible ? 'Hide' : 'Show'}
                aria-label={`${o.visible ? 'Hide' : 'Show'} ${o.name}`}
              >
                {o.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); duplicateObject(o.id); }}
                className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
                title="Duplicate"
                aria-label={`Duplicate ${o.name}`}
              >
                <Copy size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); removeObject(o.id); }}
                className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-red-400 transition-colors"
                title="Delete"
                aria-label={`Delete ${o.name}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {!selected ? (
        <p className="text-[11px] text-text-muted text-center py-6">
          Select an object above to edit it, or add a new one.
        </p>
      ) : (
        <>
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2.5 block">
            Shape
          </label>
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {shapes.map((shape) => (
              <button
                key={shape.id}
                onClick={() => updateSelected({ type: shape.id })}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-lg text-[10px] font-medium transition-all ${
                  selected.type === shape.id
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                    : 'bg-white/[0.03] text-text-muted hover:bg-white/[0.06] hover:text-text-secondary'
                }`}
                title={shape.label}
              >
                {shape.icon}
                <span>{shape.label}</span>
              </button>
            ))}
          </div>

          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2.5 block mt-4">
            Mockups
          </label>
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {mockups.map((shape) => (
              <button
                key={shape.id}
                onClick={() => addPresetButton(shape.id)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-lg text-[10px] font-medium transition-all ${
                  selected.type === shape.id
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                    : 'bg-white/[0.03] text-text-muted hover:bg-white/[0.06] hover:text-text-secondary'
                }`}
                title={shape.label}
              >
                {shape.icon}
                <span>{shape.label}</span>
              </button>
            ))}
          </div>

          {/* Custom OBJ upload */}
          {selected.type === 'custom' && selected.customModelUrl ? (
            <div className="mb-5 flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
              <Upload size={13} className="text-primary shrink-0" />
              <span className="text-[11px] text-primary font-medium truncate flex-1">Custom model loaded</span>
              <button
                onClick={clearCustomModel}
                className="p-0.5 hover:bg-white/10 rounded text-primary/60 hover:text-primary transition-colors"
                title="Remove custom model"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full mb-5 flex items-center justify-center gap-2 py-2 border border-dashed border-white/10 hover:border-primary/30 rounded-lg text-[11px] text-text-muted hover:text-primary transition-all"
            >
              <Upload size={13} />
              Upload OBJ model
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".obj"
            className="hidden"
            onChange={handleObjUpload}
          />

          <SliderInput
            label="Scale"
            value={selected.scale}
            min={0.1}
            max={3}
            step={0.05}
            onChange={(v) => updateSelected({ scale: v })}
            unit="x"
          />

          <Vec3SliderInput
            label="Position"
            value={selected.position}
            onChange={(v) => updateSelected({ position: v })}
          />
          <Vec3SliderInput
            label="Rotation"
            value={selected.rotation}
            onChange={(v) => updateSelected({ rotation: v })}
            min={-Math.PI}
            max={Math.PI}
            step={0.05}
          />
        </>
      )}
    </div>
  );
}
