import { useCallback, useRef } from 'react';
import { useSceneStore, type ObjectPreset, type Vec3 } from '../../store/useSceneStore';
import { Box, Circle, Triangle, Cylinder as CylinderIcon, Hexagon, Upload, X, Coffee, Smartphone, Wine, ShoppingBag, CreditCard } from 'lucide-react';

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
];

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-[11px] mb-1.5">
        <span className="text-text-muted font-medium">{label}</span>
        <span className="text-text-muted tabular-nums font-mono">
          {value.toFixed(step < 1 ? 2 : 0)}{unit || ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function Vec3Sliders({
  label,
  value,
  onChange,
  min = -3,
  max = 3,
  step = 0.05,
}: {
  label: string;
  value: Vec3;
  onChange: (v: Vec3) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const axes = ['x', 'y', 'z'] as const;
  const axisColors = ['text-red-400', 'text-green-400', 'text-blue-400'];

  return (
    <div className="mb-3">
      <label className="text-[11px] text-text-muted font-medium mb-1.5 block">{label}</label>
      {axes.map((axis, i) => (
        <div key={axis} className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-bold uppercase w-3 ${axisColors[i]}`}>{axis}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value[axis]}
            onChange={(e) => onChange({ ...value, [axis]: parseFloat(e.target.value) })}
            className="flex-1"
          />
          <span className="text-[10px] text-text-muted tabular-nums font-mono w-10 text-right">
            {value[axis].toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ObjectPanel() {
  const objectType = useSceneStore((s) => s.objectType);
  const setObjectType = useSceneStore((s) => s.setObjectType);
  const customModelUrl = useSceneStore((s) => s.customModelUrl);
  const setCustomModelUrl = useSceneStore((s) => s.setCustomModelUrl);
  const position = useSceneStore((s) => s.objectPosition);
  const setPosition = useSceneStore((s) => s.setObjectPosition);
  const rotation = useSceneStore((s) => s.objectRotation);
  const setRotation = useSceneStore((s) => s.setObjectRotation);
  const scale = useSceneStore((s) => s.objectScale);
  const setScale = useSceneStore((s) => s.setObjectScale);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleObjUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setCustomModelUrl(url);
      setObjectType('custom');
    },
    [setCustomModelUrl, setObjectType]
  );

  const clearCustomModel = useCallback(() => {
    if (customModelUrl) URL.revokeObjectURL(customModelUrl);
    setCustomModelUrl(null);
    setObjectType('box');
  }, [customModelUrl, setCustomModelUrl, setObjectType]);

  return (
    <div>
      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2.5 block">
        Shape
      </label>
      <div className="grid grid-cols-5 gap-1.5 mb-2">
        {shapes.map((shape) => (
          <button
            key={shape.id}
            onClick={() => setObjectType(shape.id)}
            className={`flex flex-col items-center gap-1 py-2.5 rounded-lg text-[10px] font-medium transition-all ${
              objectType === shape.id
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
            onClick={() => setObjectType(shape.id)}
            className={`flex flex-col items-center gap-1 py-2.5 rounded-lg text-[10px] font-medium transition-all ${
              objectType === shape.id
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
      {objectType === 'custom' && customModelUrl ? (
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

      <Slider
        label="Scale"
        value={scale}
        min={0.1}
        max={3}
        step={0.05}
        onChange={setScale}
        unit="x"
      />

      <Vec3Sliders label="Position" value={position} onChange={setPosition} />
      <Vec3Sliders
        label="Rotation"
        value={rotation}
        onChange={setRotation}
        min={-Math.PI}
        max={Math.PI}
        step={0.05}
      />
    </div>
  );
}
