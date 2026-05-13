import { useSceneStore, type SceneLight, type EnvironmentPreset } from '../../store/useSceneStore';
import { Sparkles, RotateCcw, Plus, X, Eye, EyeOff } from 'lucide-react';
import { SliderInput } from '../ui/SliderInput';

interface EnvOption {
  id: EnvironmentPreset;
  label: string;
  /** CSS gradient used as the thumbnail. Hand-picked to evoke the HDRI mood. */
  gradient: string;
}

const ENV_OPTIONS: EnvOption[] = [
  { id: 'studio',       label: 'Studio',    gradient: 'linear-gradient(135deg,#f5f5f5,#cfcfcf)' },
  { id: 'sunset',       label: 'Sunset',    gradient: 'linear-gradient(135deg,#ffb37a,#ff6e9c)' },
  { id: 'dawn',         label: 'Dawn',      gradient: 'linear-gradient(135deg,#9ec5ff,#5a7bc1)' },
  { id: 'night',        label: 'Night',     gradient: 'linear-gradient(135deg,#16213e,#0a0f1e)' },
  { id: 'warehouse',    label: 'Warehouse', gradient: 'linear-gradient(135deg,#8c9098,#4a4d52)' },
  { id: 'forest',       label: 'Forest',    gradient: 'linear-gradient(135deg,#3f8d5b,#1f4a2c)' },
  { id: 'apartment',    label: 'Apartment', gradient: 'linear-gradient(135deg,#e8d4ad,#a8865c)' },
  { id: 'city',         label: 'City',      gradient: 'linear-gradient(135deg,#7b8c9e,#3d4a5a)' },
  { id: 'park',         label: 'Park',      gradient: 'linear-gradient(135deg,#bce2a3,#7cb86f)' },
  { id: 'lobby',        label: 'Lobby',     gradient: 'linear-gradient(135deg,#f5d98a,#b88a3a)' },
  { id: 'softbox',      label: 'Softbox',   gradient: 'linear-gradient(135deg,#ffffff,#e0e0e0)' },
  { id: 'window-light', label: 'Window',    gradient: 'linear-gradient(135deg,#fff3d6,#d8c098)' },
];

export function LightingPanel() {
  const brightness = useSceneStore((s) => s.brightness);
  const lightAngle = useSceneStore((s) => s.lightAngle);
  const lightElevation = useSceneStore((s) => s.lightElevation);
  const lightColor = useSceneStore((s) => s.lightColor);
  const shadowOpacity = useSceneStore((s) => s.shadowOpacity);
  const shadowSoftness = useSceneStore((s) => s.shadowSoftness);
  const shadowColor = useSceneStore((s) => s.shadowColor);
  const autoLighting = useSceneStore((s) => s.autoLighting);
  const estimatedLighting = useSceneStore((s) => s.estimatedLighting);
  const sceneLights = useSceneStore((s) => s.sceneLights);

  const setBrightness = useSceneStore((s) => s.setBrightness);
  const setLightAngle = useSceneStore((s) => s.setLightAngle);
  const setLightElevation = useSceneStore((s) => s.setLightElevation);
  const setLightColor = useSceneStore((s) => s.setLightColor);
  const setShadowOpacity = useSceneStore((s) => s.setShadowOpacity);
  const setShadowSoftness = useSceneStore((s) => s.setShadowSoftness);
  const setShadowColor = useSceneStore((s) => s.setShadowColor);
  const setAutoLighting = useSceneStore((s) => s.setAutoLighting);
  const setEstimatedLighting = useSceneStore((s) => s.setEstimatedLighting);

  // HDRI environment
  const useEnvironment = useSceneStore((s) => s.useEnvironment);
  const environmentPreset = useSceneStore((s) => s.environmentPreset);
  const environmentIntensity = useSceneStore((s) => s.environmentIntensity);
  const environmentRotation = useSceneStore((s) => s.environmentRotation);
  const setUseEnvironment = useSceneStore((s) => s.setUseEnvironment);
  const setEnvironmentPreset = useSceneStore((s) => s.setEnvironmentPreset);
  const setEnvironmentIntensity = useSceneStore((s) => s.setEnvironmentIntensity);
  const setEnvironmentRotation = useSceneStore((s) => s.setEnvironmentRotation);

  const addSceneLight = useSceneStore((s) => s.addSceneLight);
  const updateSceneLight = useSceneStore((s) => s.updateSceneLight);
  const removeSceneLight = useSceneStore((s) => s.removeSceneLight);

  const resetToEstimate = () => {
    if (estimatedLighting) {
      setEstimatedLighting(estimatedLighting);
      setAutoLighting(true);
    }
  };

  const handleAddLight = () => {
    const light: SceneLight = {
      id: crypto.randomUUID(),
      name: `Light ${sceneLights.length + 1}`,
      position: { x: 2, y: 3, z: 2 },
      color: '#ffffff',
      intensity: 1.5,
      autoDetected: false,
      visible: true,
    };
    addSceneLight(light);
  };

  return (
    <div>
      {estimatedLighting && (
        <div className="mb-5 p-3 bg-primary/5 border border-primary/15 rounded-xl">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-primary" />
              <span className="text-[11px] font-semibold text-primary">
                {autoLighting ? 'Auto-matched' : 'Manually adjusted'}
              </span>
            </div>
            {!autoLighting && (
              <button
                onClick={resetToEstimate}
                className="flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary transition-colors"
              >
                <RotateCcw size={10} />
                Reset
              </button>
            )}
          </div>
          <p className="text-[10px] text-text-muted leading-relaxed">
            Lighting estimated from your photo. Adjust below to fine-tune.
          </p>
        </div>
      )}

      {/* HDRI Environment library */}
      <div className="flex items-center justify-between mb-2.5">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">
          Environment
        </label>
        <label className="flex items-center gap-1.5 text-[10px] text-text-muted cursor-pointer select-none">
          <input
            type="checkbox"
            checked={useEnvironment}
            onChange={(e) => setUseEnvironment(e.target.checked)}
            className="accent-primary"
          />
          Use HDRI
        </label>
      </div>

      {useEnvironment && (
        <>
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            {ENV_OPTIONS.map((opt) => {
              const active = environmentPreset === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setEnvironmentPreset(opt.id)}
                  title={opt.label}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-all ${
                    active
                      ? 'bg-primary/10 ring-1 ring-primary'
                      : 'hover:bg-white/[0.03] ring-1 ring-transparent'
                  }`}
                >
                  <div
                    className="w-full aspect-square rounded-md border border-white/10"
                    style={{ background: opt.gradient }}
                    aria-hidden
                  />
                  <span className={`text-[9px] leading-tight text-center ${active ? 'text-primary' : 'text-text-muted'}`}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
          <SliderInput
            label="Intensity"
            value={environmentIntensity}
            min={0}
            max={2}
            step={0.05}
            onChange={(v) => setEnvironmentIntensity(v)}
          />
          <SliderInput
            label="Rotation"
            value={environmentRotation}
            min={0}
            max={360}
            step={1}
            onChange={(v) => setEnvironmentRotation(v)}
            unit="°"
          />
        </>
      )}

      {/* Global ambient/directional controls */}
      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mt-5 mb-2.5 block">
        Global Lighting
      </label>
      <SliderInput
        label="Brightness"
        value={brightness}
        min={0}
        max={2}
        step={0.05}
        onChange={(v) => { setBrightness(v); setAutoLighting(false); }}
      />
      <SliderInput
        label="Direction"
        value={lightAngle}
        min={0}
        max={360}
        step={1}
        onChange={(v) => { setLightAngle(v); setAutoLighting(false); }}
        unit="°"
      />
      <SliderInput
        label="Height"
        value={lightElevation}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => { setLightElevation(v); setAutoLighting(false); }}
      />
      {/* Shadows subsection */}
      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mt-5 mb-2.5 block">
        Shadows
      </label>
      <SliderInput
        label="Opacity"
        value={shadowOpacity}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => { setShadowOpacity(v); setAutoLighting(false); }}
      />
      <SliderInput
        label="Softness"
        value={shadowSoftness}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => { setShadowSoftness(v); setAutoLighting(false); }}
      />
      <div className="mb-3">
        <label className="text-[11px] text-text-muted font-medium mb-2 block">Shadow Color</label>
        <div className="flex items-center gap-2.5">
          <input
            type="color"
            value={shadowColor}
            onChange={(e) => { setShadowColor(e.target.value); setAutoLighting(false); }}
            className="w-8 h-8 rounded-lg cursor-pointer"
          />
          <input
            type="text"
            value={shadowColor}
            onChange={(e) => { setShadowColor(e.target.value); setAutoLighting(false); }}
            className="flex-1 bg-white/[0.04] border border-white/8 rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-primary/40 transition-colors"
          />
        </div>
      </div>

      <div className="mt-3 mb-5">
        <label className="text-[11px] text-text-muted font-medium mb-2 block">Light Color</label>
        <div className="flex items-center gap-2.5">
          <input
            type="color"
            value={lightColor}
            onChange={(e) => { setLightColor(e.target.value); setAutoLighting(false); }}
            className="w-8 h-8 rounded-lg cursor-pointer"
          />
          <input
            type="text"
            value={lightColor}
            onChange={(e) => { setLightColor(e.target.value); setAutoLighting(false); }}
            className="flex-1 bg-white/[0.04] border border-white/8 rounded-lg px-2.5 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-primary/40 transition-colors"
          />
        </div>
      </div>

      {/* Point lights */}
      <div className="flex items-center justify-between mb-2.5">
        <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest">
          Point Lights
        </label>
        <button
          onClick={handleAddLight}
          className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {sceneLights.length === 0 && (
        <p className="text-[10px] text-text-muted/60 italic mb-3">
          No point lights. Bright spots in your image are auto-detected as lights when you upload.
        </p>
      )}

      <div className="space-y-3">
        {sceneLights.map((light) => (
          <LightCard
            key={light.id}
            light={light}
            onUpdate={(updates) => updateSceneLight(light.id, updates)}
            onRemove={() => removeSceneLight(light.id)}
          />
        ))}
      </div>
    </div>
  );
}

function LightCard({
  light,
  onUpdate,
  onRemove,
}: {
  light: SceneLight;
  onUpdate: (updates: Partial<SceneLight>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: light.color, boxShadow: `0 0 6px ${light.color}80` }}
          />
          <span className="text-[11px] font-medium text-text-primary">{light.name}</span>
          {light.autoDetected && (
            <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">auto</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdate({ visible: !light.visible })}
            className="p-1 rounded hover:bg-white/5 transition-colors"
          >
            {light.visible ? (
              <Eye size={12} className="text-text-muted" />
            ) : (
              <EyeOff size={12} className="text-text-muted/40" />
            )}
          </button>
          <button
            onClick={onRemove}
            className="p-1 rounded hover:bg-danger/20 transition-colors"
          >
            <X size={12} className="text-text-muted hover:text-danger" />
          </button>
        </div>
      </div>

      {/* Color + Intensity */}
      <div className="flex items-center gap-2 mb-2">
        <input
          type="color"
          value={light.color}
          onChange={(e) => onUpdate({ color: e.target.value })}
          className="w-6 h-6 rounded cursor-pointer"
        />
        <div className="flex-1">
          <SliderInput
            layout="inline"
            label="Intensity"
            labelWidth="w-12"
            value={light.intensity}
            onChange={(v) => onUpdate({ intensity: v })}
            min={0}
            max={5}
            step={0.1}
            decimals={1}
          />
        </div>
      </div>

      {/* XYZ Position */}
      <div className="space-y-1">
        {(['x', 'y', 'z'] as const).map((axis) => (
          <SliderInput
            key={axis}
            layout="inline"
            axis={axis}
            color={axis === 'x' ? 'red' : axis === 'y' ? 'green' : 'blue'}
            value={light.position[axis]}
            onChange={(v) =>
              onUpdate({ position: { ...light.position, [axis]: v } })
            }
            min={-10}
            max={10}
            step={0.1}
            decimals={1}
          />
        ))}
      </div>
    </div>
  );
}

