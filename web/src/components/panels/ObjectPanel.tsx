import { useSceneStore, type ObjectPreset, type Vec3 } from '../../store/useSceneStore';
import { Box, Circle, Triangle, Cylinder as CylinderIcon } from 'lucide-react';

const shapes: { id: ObjectPreset; label: string; icon: React.ReactNode }[] = [
  { id: 'box', label: 'Box', icon: <Box size={18} /> },
  { id: 'cylinder', label: 'Cylinder', icon: <CylinderIcon size={18} /> },
  { id: 'sphere', label: 'Sphere', icon: <Circle size={18} /> },
  { id: 'cone', label: 'Cone', icon: <Triangle size={18} /> },
  { id: 'torus', label: 'Torus', icon: <Circle size={18} /> },
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
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-muted font-medium">{label}</span>
        <span className="text-text-muted tabular-nums">
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
        className="w-full accent-primary"
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
  return (
    <div className="mb-3">
      <label className="text-xs text-text-muted font-medium mb-1 block">{label}</label>
      {(['x', 'y', 'z'] as const).map((axis) => (
        <div key={axis} className="flex items-center gap-2 mb-1">
          <span className="text-[10px] text-text-muted uppercase w-3">{axis}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value[axis]}
            onChange={(e) => onChange({ ...value, [axis]: parseFloat(e.target.value) })}
            className="flex-1 accent-primary"
          />
          <span className="text-[10px] text-text-muted tabular-nums w-8 text-right">
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
      <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">
        Shape
      </label>
      <div className="grid grid-cols-5 gap-1.5 mb-5">
        {shapes.map((shape) => (
          <button
            key={shape.id}
            onClick={() => setObjectType(shape.id)}
            className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium transition-colors ${
              objectType === shape.id
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
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
