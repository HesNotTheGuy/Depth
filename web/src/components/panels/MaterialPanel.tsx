import { useRef } from 'react';
import { Image, Upload, X, RotateCcw } from 'lucide-react';
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

function SliderRow({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  displayValue,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  displayValue?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[10px] text-text-muted w-20 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
      />
      <span className="text-[10px] text-text-muted w-8 text-right tabular-nums font-mono">
        {displayValue ?? value.toFixed(2)}
      </span>
    </div>
  );
}

export function MaterialPanel() {
  const material = useSceneStore((s) => s.objectMaterial);
  const color = useSceneStore((s) => s.objectColor);
  const roughness = useSceneStore((s) => s.objectRoughness);
  const metalness = useSceneStore((s) => s.objectMetalness);
  const transmission = useSceneStore((s) => s.objectTransmission);
  const ior = useSceneStore((s) => s.objectIor);
  const clearcoat = useSceneStore((s) => s.objectClearcoat);
  const opacity = useSceneStore((s) => s.objectOpacity);
  const reflectivity = useSceneStore((s) => s.objectReflectivity);
  const setMaterial = useSceneStore((s) => s.setObjectMaterial);
  const setColor = useSceneStore((s) => s.setObjectColor);
  const setRoughness = useSceneStore((s) => s.setObjectRoughness);
  const setMetalness = useSceneStore((s) => s.setObjectMetalness);
  const setTransmission = useSceneStore((s) => s.setObjectTransmission);
  const setIor = useSceneStore((s) => s.setObjectIor);
  const setClearcoat = useSceneStore((s) => s.setObjectClearcoat);
  const setOpacity = useSceneStore((s) => s.setObjectOpacity);
  const setReflectivity = useSceneStore((s) => s.setObjectReflectivity);
  const objectTexture = useSceneStore((s) => s.objectTexture);
  const textureRepeat = useSceneStore((s) => s.textureRepeat);
  const textureOffset = useSceneStore((s) => s.textureOffset);
  const textureRotation = useSceneStore((s) => s.textureRotation);
  const setObjectTexture = useSceneStore((s) => s.setObjectTexture);
  const setTextureRepeat = useSceneStore((s) => s.setTextureRepeat);
  const setTextureOffset = useSceneStore((s) => s.setTextureOffset);
  const setTextureRotation = useSceneStore((s) => s.setTextureRotation);
  const textureInputRef = useRef<HTMLInputElement>(null);

  const handleTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setObjectTexture(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const resetTextureTransform = () => {
    setTextureRepeat({ x: 1, y: 1 });
    setTextureOffset({ x: 0, y: 0 });
    setTextureRotation(0);
  };

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

      {/* Texture / Label */}
      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2 block">
        Texture
      </label>
      {objectTexture ? (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-white/[0.04]">
              <img src={objectTexture} alt="Texture" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-text-primary font-medium flex items-center gap-1.5">
                <Image size={12} className="text-primary shrink-0" />
                Texture loaded
              </div>
            </div>
            <button
              onClick={resetTextureTransform}
              className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-primary transition-colors"
              title="Reset transform"
            >
              <RotateCcw size={12} />
            </button>
            <button
              onClick={() => setObjectTexture(null)}
              className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-red-400 transition-colors"
              title="Remove texture"
            >
              <X size={12} />
            </button>
          </div>
          <div className="space-y-2">
            <SliderRow label="Repeat X" value={textureRepeat.x} onChange={(v) => setTextureRepeat({ ...textureRepeat, x: v })} min={0.1} max={10} step={0.1} displayValue={textureRepeat.x.toFixed(1)} />
            <SliderRow label="Repeat Y" value={textureRepeat.y} onChange={(v) => setTextureRepeat({ ...textureRepeat, y: v })} min={0.1} max={10} step={0.1} displayValue={textureRepeat.y.toFixed(1)} />
            <SliderRow label="Offset X" value={textureOffset.x} onChange={(v) => setTextureOffset({ ...textureOffset, x: v })} min={0} max={1} step={0.01} />
            <SliderRow label="Offset Y" value={textureOffset.y} onChange={(v) => setTextureOffset({ ...textureOffset, y: v })} min={0} max={1} step={0.01} />
            <SliderRow label="Rotation" value={textureRotation} onChange={setTextureRotation} min={0} max={6.283} step={0.01} displayValue={`${Math.round(textureRotation * 180 / Math.PI)}°`} />
          </div>
        </div>
      ) : (
        <button
          onClick={() => textureInputRef.current?.click()}
          className="w-full mb-5 flex items-center justify-center gap-2 py-2 border border-dashed border-white/10 hover:border-primary/30 rounded-lg text-[11px] text-text-muted hover:text-primary transition-all"
        >
          <Upload size={13} />
          Upload texture / label
        </button>
      )}
      <input
        ref={textureInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleTextureUpload}
      />

      {/* Common controls */}
      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2.5 block">
        Properties
      </label>
      <div className="space-y-2.5">
        <SliderRow label="Roughness" value={roughness} onChange={setRoughness} />

        {/* Glass-specific */}
        {material === 'glass' && (
          <>
            <SliderRow label="Thickness" value={opacity} onChange={setOpacity} />
            <SliderRow label="Transmission" value={transmission} onChange={setTransmission} />
            <SliderRow label="IOR" value={ior} onChange={setIor} min={1.0} max={2.5} step={0.05} />
            <SliderRow label="Reflectivity" value={reflectivity} onChange={setReflectivity} />
          </>
        )}

        {/* Metal-specific */}
        {material === 'metallic' && (
          <SliderRow label="Metalness" value={metalness} onChange={setMetalness} />
        )}

        {/* Plastic-specific */}
        {material === 'plastic' && (
          <>
            <SliderRow label="Clearcoat" value={clearcoat} onChange={setClearcoat} />
            <SliderRow label="Metalness" value={metalness} onChange={setMetalness} />
          </>
        )}

        {/* Glossy-specific */}
        {material === 'glossy' && (
          <SliderRow label="Metalness" value={metalness} onChange={setMetalness} />
        )}
      </div>
    </div>
  );
}
