import { useRef } from 'react';
import { Image, Upload, X, RotateCcw, MousePointerClick, Layers, Pipette } from 'lucide-react';
import { useSceneStore, type FaceTextureConfig } from '../../store/useSceneStore';
import { useUIStore } from '../../store/useUIStore';
import { useSelectedObject } from '../../hooks/useSelectedObject';
import { SliderInput } from '../ui/SliderInput';

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
  label, value, onChange, min = 0, max = 1, step = 0.01, displayValue,
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
    <SliderInput
      layout="inline"
      label={label}
      labelWidth="w-20"
      value={value}
      onChange={onChange}
      min={min}
      max={max}
      step={step}
      displayValue={displayValue}
    />
  );
}

export function MaterialPanel() {
  const selected = useSelectedObject();
  const updateSelected = useSceneStore((s) => s.updateSelected);
  const backgroundImage = useSceneStore((s) => s.backgroundImage);
  const isPickingColor = useUIStore((s) => s.isPickingColor);
  const setPickingColor = useUIStore((s) => s.setPickingColor);
  const recentColors = useUIStore((s) => s.recentColors);
  const addRecentColor = useUIStore((s) => s.addRecentColor);
  const selectedFace = useSceneStore((s) => s.selectedFace);
  const setSelectedFace = useSceneStore((s) => s.setSelectedFace);
  const setFaceTextureForSelected = useSceneStore((s) => s.setFaceTextureForSelected);
  const removeFaceTextureForSelected = useSceneStore((s) => s.removeFaceTextureForSelected);
  const setFaceTextureTransformForSelected = useSceneStore((s) => s.setFaceTextureTransformForSelected);
  const textureInputRef = useRef<HTMLInputElement>(null);
  const faceTextureInputRef = useRef<HTMLInputElement>(null);

  if (!selected) {
    return (
      <div className="py-6">
        <p className="text-[11px] text-text-muted text-center">
          Select an object to edit its material.
        </p>
      </div>
    );
  }

  const {
    material, color, roughness, metalness, transmission, ior, clearcoat, opacity, reflectivity,
    texture: objectTexture, textureRepeat, textureOffset, textureRotation, faceTextures,
  } = selected;

  const activeFaceConfig: FaceTextureConfig | null =
    selectedFace ? faceTextures[selectedFace] ?? null : null;

  const handleTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateSelected({ texture: reader.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFaceTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedFace) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFaceTextureForSelected(selectedFace, reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const applyPickedColor = (hex: string) => {
    updateSelected({ color: hex });
    addRecentColor(hex);
  };

  const handleEyedropper = async () => {
    if (!backgroundImage) return;
    // Prefer native EyeDropper API (Chrome/Edge 95+).
    const w = window as unknown as {
      EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
    };
    if (w.EyeDropper) {
      try {
        const dropper = new w.EyeDropper();
        const result = await dropper.open();
        applyPickedColor(result.sRGBHex);
      } catch {
        // user cancelled — silently exit
      }
      return;
    }
    // Fallback: viewport overlay picker
    setPickingColor(true);
  };

  const resetTextureTransform = () => {
    updateSelected({
      textureRepeat: { x: 1, y: 1 },
      textureOffset: { x: 0, y: 0 },
      textureRotation: 0,
    });
  };

  const resetFaceTextureTransform = () => {
    if (!selectedFace) return;
    setFaceTextureTransformForSelected(selectedFace, {
      repeat: { x: 1, y: 1 },
      offset: { x: 0, y: 0 },
      rotation: 0,
    });
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
            onClick={() => updateSelected({ material: p.id })}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${
              material === p.id
                ? 'bg-primary/10 ring-1 ring-primary/25'
                : 'hover:bg-white/[0.03]'
            }`}
          >
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
          onChange={(e) => updateSelected({ color: e.target.value })}
          className="w-8 h-8 rounded-lg cursor-pointer"
        />
        <input
          type="text"
          value={color}
          onChange={(e) => updateSelected({ color: e.target.value })}
          className="flex-1 bg-white/[0.04] border border-white/8 rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-primary/40 transition-colors"
        />
        <button
          onClick={handleEyedropper}
          disabled={!backgroundImage || isPickingColor}
          title={
            backgroundImage
              ? 'Pick color from background image'
              : 'Upload a background image first'
          }
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 ${
            isPickingColor
              ? 'bg-primary text-white'
              : 'bg-white/[0.04] border border-white/8 text-text-muted hover:text-primary hover:border-primary/40'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <Pipette size={14} />
        </button>
      </div>

      {recentColors.length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] text-text-muted block mb-1.5">Recently picked</span>
          <div className="flex gap-1.5 flex-wrap">
            {recentColors.map((rc) => (
              <button
                key={rc}
                onClick={() => updateSelected({ color: rc })}
                className={`w-6 h-6 rounded-md transition-all hover:scale-110 ${
                  color.toLowerCase() === rc.toLowerCase()
                    ? 'ring-2 ring-primary ring-offset-1 ring-offset-surface-raised'
                    : 'ring-1 ring-white/10 hover:ring-white/25'
                }`}
                style={{ backgroundColor: rc }}
                title={rc}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1.5 mb-5 flex-wrap">
        {swatches.map((s) => (
          <button
            key={s.color}
            onClick={() => updateSelected({ color: s.color })}
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
        Face Placement
      </label>
      {selectedFace ? (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2.5 px-3 py-2 rounded-lg bg-primary/10 ring-1 ring-primary/25">
            <MousePointerClick size={14} className="text-primary shrink-0" />
            <span className="text-xs text-primary font-medium capitalize flex-1">
              Selected: {selectedFace}
            </span>
            <button
              onClick={() => setSelectedFace(null)}
              className="p-1 hover:bg-white/10 rounded text-primary/60 hover:text-primary transition-colors"
              title="Clear selection"
            >
              <X size={12} />
            </button>
          </div>

          {activeFaceConfig ? (
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-white/[0.04]">
                  <img src={activeFaceConfig.url} alt={`${selectedFace} texture`} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-text-primary font-medium flex items-center gap-1.5">
                    <Layers size={12} className="text-primary shrink-0" />
                    <span className="capitalize">{selectedFace} texture</span>
                  </div>
                </div>
                <button
                  onClick={resetFaceTextureTransform}
                  className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-primary transition-colors"
                  title="Reset transform"
                >
                  <RotateCcw size={12} />
                </button>
                <button
                  onClick={() => removeFaceTextureForSelected(selectedFace)}
                  className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-red-400 transition-colors"
                  title="Remove face texture"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="space-y-2">
                <SliderRow label="Repeat X" value={activeFaceConfig.repeat.x} onChange={(v) => setFaceTextureTransformForSelected(selectedFace, { repeat: { x: v, y: activeFaceConfig.repeat.y } })} min={0.1} max={10} step={0.1} displayValue={activeFaceConfig.repeat.x.toFixed(1)} />
                <SliderRow label="Repeat Y" value={activeFaceConfig.repeat.y} onChange={(v) => setFaceTextureTransformForSelected(selectedFace, { repeat: { x: activeFaceConfig.repeat.x, y: v } })} min={0.1} max={10} step={0.1} displayValue={activeFaceConfig.repeat.y.toFixed(1)} />
                <SliderRow label="Offset X" value={activeFaceConfig.offset.x} onChange={(v) => setFaceTextureTransformForSelected(selectedFace, { offset: { x: v, y: activeFaceConfig.offset.y } })} min={0} max={1} step={0.01} />
                <SliderRow label="Offset Y" value={activeFaceConfig.offset.y} onChange={(v) => setFaceTextureTransformForSelected(selectedFace, { offset: { x: activeFaceConfig.offset.x, y: v } })} min={0} max={1} step={0.01} />
                <SliderRow label="Rotation" value={activeFaceConfig.rotation} onChange={(v) => setFaceTextureTransformForSelected(selectedFace, { rotation: v })} min={0} max={6.283} step={0.01} displayValue={`${Math.round(activeFaceConfig.rotation * 180 / Math.PI)}°`} />
              </div>
            </div>
          ) : (
            <button
              onClick={() => faceTextureInputRef.current?.click()}
              className="w-full mb-3 flex items-center justify-center gap-2 py-2 border border-dashed border-primary/20 hover:border-primary/40 rounded-lg text-[11px] text-primary/70 hover:text-primary transition-all bg-primary/5"
            >
              <Upload size={13} />
              Upload texture for {selectedFace}
            </button>
          )}
          <input
            ref={faceTextureInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFaceTextureUpload}
          />
        </div>
      ) : (
        <p className="text-[10px] text-text-muted mb-3">
          Click a face on the 3D object to select it and apply a texture to that specific face.
        </p>
      )}

      {Object.keys(faceTextures).length > 0 && (
        <div className="mb-3">
          <span className="text-[10px] text-text-muted block mb-1.5">Applied face textures:</span>
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(faceTextures).map(([face, config]) => (
              <button
                key={face}
                onClick={() => setSelectedFace(face)}
                className={`relative group w-10 h-10 rounded-lg overflow-hidden border shrink-0 transition-all ${
                  face === selectedFace
                    ? 'ring-2 ring-primary border-primary/30'
                    : 'border-white/10 hover:border-white/25'
                }`}
                title={face}
              >
                <img src={config.url} alt={face} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[8px] text-white text-center py-0.5 capitalize leading-none">
                  {face}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2 block">
        Global Texture
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
                All faces
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
              onClick={() => updateSelected({ texture: null })}
              className="p-1 hover:bg-white/10 rounded text-text-muted hover:text-red-400 transition-colors"
              title="Remove texture"
            >
              <X size={12} />
            </button>
          </div>
          <div className="space-y-2">
            <SliderRow label="Repeat X" value={textureRepeat.x} onChange={(v) => updateSelected({ textureRepeat: { ...textureRepeat, x: v } })} min={0.1} max={10} step={0.1} displayValue={textureRepeat.x.toFixed(1)} />
            <SliderRow label="Repeat Y" value={textureRepeat.y} onChange={(v) => updateSelected({ textureRepeat: { ...textureRepeat, y: v } })} min={0.1} max={10} step={0.1} displayValue={textureRepeat.y.toFixed(1)} />
            <SliderRow label="Offset X" value={textureOffset.x} onChange={(v) => updateSelected({ textureOffset: { ...textureOffset, x: v } })} min={0} max={1} step={0.01} />
            <SliderRow label="Offset Y" value={textureOffset.y} onChange={(v) => updateSelected({ textureOffset: { ...textureOffset, y: v } })} min={0} max={1} step={0.01} />
            <SliderRow label="Rotation" value={textureRotation} onChange={(v) => updateSelected({ textureRotation: v })} min={0} max={6.283} step={0.01} displayValue={`${Math.round(textureRotation * 180 / Math.PI)}°`} />
          </div>
        </div>
      ) : (
        <button
          onClick={() => textureInputRef.current?.click()}
          className="w-full mb-5 flex items-center justify-center gap-2 py-2 border border-dashed border-white/10 hover:border-primary/30 rounded-lg text-[11px] text-text-muted hover:text-primary transition-all"
        >
          <Upload size={13} />
          Upload global texture
        </button>
      )}
      <input
        ref={textureInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleTextureUpload}
      />

      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2.5 block">
        Properties
      </label>
      <div className="space-y-2.5">
        <SliderRow label="Roughness" value={roughness} onChange={(v) => updateSelected({ roughness: v })} />

        {material === 'glass' && (
          <>
            <SliderRow label="Thickness" value={opacity} onChange={(v) => updateSelected({ opacity: v })} />
            <SliderRow label="Transmission" value={transmission} onChange={(v) => updateSelected({ transmission: v })} />
            <SliderRow label="IOR" value={ior} onChange={(v) => updateSelected({ ior: v })} min={1.0} max={2.5} step={0.05} />
            <SliderRow label="Reflectivity" value={reflectivity} onChange={(v) => updateSelected({ reflectivity: v })} />
          </>
        )}

        {material === 'metallic' && (
          <SliderRow label="Metalness" value={metalness} onChange={(v) => updateSelected({ metalness: v })} />
        )}

        {material === 'plastic' && (
          <>
            <SliderRow label="Clearcoat" value={clearcoat} onChange={(v) => updateSelected({ clearcoat: v })} />
            <SliderRow label="Metalness" value={metalness} onChange={(v) => updateSelected({ metalness: v })} />
          </>
        )}

        {material === 'glossy' && (
          <SliderRow label="Metalness" value={metalness} onChange={(v) => updateSelected({ metalness: v })} />
        )}
      </div>
    </div>
  );
}
