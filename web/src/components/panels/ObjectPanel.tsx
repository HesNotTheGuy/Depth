import { useSceneStore, type ObjectPreset, type Vec3 } from '../../store/useSceneStore';
import { Box, Circle, Triangle, Cylinder as CylinderIcon, Hexagon } from 'lucide-react';

const shapes: { id: ObjectPreset; label: string; icon: React.ReactNode }[] = [
  { id: 'box', label: 'Cube', icon: <Box size={18} /> },
  { id: 'cylinder', label: 'Cylinder', icon: <CylinderIcon size={18} /> },
  { id: 'sphere', label: 'Sphere', icon: <Circle size={18} /> },
  { id: 'cone', label: 'Cone', icon: <Triangle size={18} /> },
  { id: 'torus', label: 'Torus', icon: <Hexagon size={18} /> },
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
  const position = useSceneStore((s) => s.objectPosition);
  const setPosition = useSceneStore((s) => s.setObjectPosition);
  const rotation = useSceneStore((s) => s.objectRotation);
  const setRotation = useSceneStore((s) => s.setObjectRotation);
  const scale = useSceneStore((s) => s.objectScale);
  const setScale = useSceneStore((s) => s.setObjectScale);

  return (
    <div>
      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2.5 block">
        Shape
      </label>
      <div className="grid grid-cols-5 gap-1.5 mb-5">
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
