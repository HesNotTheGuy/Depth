import { useSceneStore } from '../../store/useSceneStore';

type MatPreset = 'matte' | 'glossy' | 'metallic' | 'glass' | 'plastic';

const presets: { id: MatPreset; label: string }[] = [
  { id: 'matte', label: 'Matte' },
  { id: 'glossy', label: 'Glossy' },
  { id: 'metallic', label: 'Metallic' },
  { id: 'glass', label: 'Glass' },
  { id: 'plastic', label: 'Plastic' },
];

export function MaterialPanel() {
  const material = useSceneStore((s) => s.objectMaterial);
  const color = useSceneStore((s) => s.objectColor);
  const roughness = useSceneStore((s) => s.objectRoughness);
  const setMaterial = useSceneStore((s) => s.setObjectMaterial);
  const setColor = useSceneStore((s) => s.setObjectColor);
  const setRoughness = useSceneStore((s) => s.setObjectRoughness);

  return (
    <div>
      <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">
        Material
      </label>
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => setMaterial(p.id)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              material === p.id
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5 block">
        Color
      </label>
      <div className="flex items-center gap-2 mb-4">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-8 h-8 rounded border border-panel-border cursor-pointer"
        />
        <input
          type="text"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="flex-1 border border-panel-border rounded px-2 py-1 text-sm font-mono text-text-primary focus:outline-none focus:border-primary"
        />
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {['#cccccc', '#ffffff', '#2d2d2d', '#c0a060', '#6C63FF', '#FF6B6B', '#4ECDC4', '#FFE66D'].map(
          (c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-6 h-6 rounded border border-panel-border hover:ring-2 hover:ring-primary/30 transition-shadow"
              style={{ backgroundColor: c }}
              title={c}
            />
          )
        )}
      </div>

      <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5 block">
        Roughness
      </label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={roughness}
          onChange={(e) => setRoughness(parseFloat(e.target.value))}
          className="flex-1 accent-primary"
        />
        <span className="text-xs text-text-muted w-8 text-right tabular-nums">
          {roughness.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
