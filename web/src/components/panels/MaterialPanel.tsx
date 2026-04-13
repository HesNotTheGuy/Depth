import { useSceneStore } from '../../store/useSceneStore';

type MatPreset = 'matte' | 'glossy' | 'metallic' | 'glass' | 'plastic';

const presets: { id: MatPreset; label: string; desc: string }[] = [
  { id: 'matte', label: 'Matte', desc: 'Flat, diffuse' },
  { id: 'glossy', label: 'Glossy', desc: 'Smooth, reflective' },
  { id: 'metallic', label: 'Metal', desc: 'Brushed steel' },
  { id: 'glass', label: 'Glass', desc: 'Transparent' },
  { id: 'plastic', label: 'Plastic', desc: 'Shiny, clearcoat' },
];

const swatches = [
  { color: '#E8E8E8', label: 'Silver' },
  { color: '#FFFFFF', label: 'White' },
  { color: '#1A1A1A', label: 'Black' },
  { color: '#C4956A', label: 'Bronze' },
  { color: '#8B5CF6', label: 'Violet' },
  { color: '#EF4444', label: 'Red' },
  { color: '#06B6D4', label: 'Cyan' },
  { color: '#F59E0B', label: 'Amber' },
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
      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2.5 block">
        Material
      </label>
      <div className="space-y-1 mb-5">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => setMaterial(p.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
              material === p.id
                ? 'bg-primary/10 ring-1 ring-primary/25'
                : 'hover:bg-white/[0.03]'
            }`}
          >
            {/* Material preview orb */}
            <div
              className={`w-7 h-7 rounded-full shrink-0 ${
                p.id === 'glass' ? 'bg-white/10 border border-white/20' : ''
              }`}
              style={{
                background: p.id === 'glass'
                  ? undefined
                  : p.id === 'metallic'
                  ? `radial-gradient(circle at 35% 35%, ${color}ee, ${color}44)`
                  : p.id === 'glossy'
                  ? `radial-gradient(circle at 30% 30%, #fff6, ${color}cc)`
                  : p.id === 'plastic'
                  ? `radial-gradient(circle at 35% 35%, #fff3, ${color}dd)`
                  : color,
              }}
            />
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-medium ${material === p.id ? 'text-primary' : 'text-text-primary'}`}>
                {p.label}
              </div>
              <div className="text-[10px] text-text-muted">{p.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2 block">
        Color
      </label>
      <div className="flex items-center gap-2.5 mb-3">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-8 h-8 rounded-lg cursor-pointer"
        />
        <input
          type="text"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="flex-1 bg-white/[0.04] border border-white/8 rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-primary/40 transition-colors"
        />
      </div>

      <div className="flex gap-1.5 mb-5 flex-wrap">
        {swatches.map((s) => (
          <button
            key={s.color}
            onClick={() => setColor(s.color)}
            className={`w-7 h-7 rounded-lg transition-all hover:scale-110 ${
              color.toLowerCase() === s.color.toLowerCase()
                ? 'ring-2 ring-primary ring-offset-1 ring-offset-surface-raised'
                : 'ring-1 ring-white/10 hover:ring-white/25'
            }`}
            style={{ backgroundColor: s.color }}
            title={s.label}
          />
        ))}
      </div>

      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2 block">
        Roughness
      </label>
      <div className="flex items-center gap-2.5">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={roughness}
          onChange={(e) => setRoughness(parseFloat(e.target.value))}
          className="flex-1"
        />
        <span className="text-[11px] text-text-muted w-8 text-right tabular-nums font-mono">
          {roughness.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
