import { useSceneStore } from '../../store/useSceneStore';
import { Zap } from 'lucide-react';

export function LightingPanel() {
  const brightness = useSceneStore((s) => s.brightness);
  const lightAngle = useSceneStore((s) => s.lightAngle);
  const lightElevation = useSceneStore((s) => s.lightElevation);
  const lightColor = useSceneStore((s) => s.lightColor);
  const shadowOpacity = useSceneStore((s) => s.shadowOpacity);
  const autoLighting = useSceneStore((s) => s.autoLighting);
  const estimatedLighting = useSceneStore((s) => s.estimatedLighting);

  const setBrightness = useSceneStore((s) => s.setBrightness);
  const setLightAngle = useSceneStore((s) => s.setLightAngle);
  const setLightElevation = useSceneStore((s) => s.setLightElevation);
  const setLightColor = useSceneStore((s) => s.setLightColor);
  const setShadowOpacity = useSceneStore((s) => s.setShadowOpacity);
  const setAutoLighting = useSceneStore((s) => s.setAutoLighting);
  const setEstimatedLighting = useSceneStore((s) => s.setEstimatedLighting);

  const resetToEstimate = () => {
    if (estimatedLighting) {
      setEstimatedLighting(estimatedLighting);
      setAutoLighting(true);
    }
  };

  return (
    <div>
      {estimatedLighting && (
        <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-primary" />
            <span className="text-xs font-medium text-primary">Auto-matched from image</span>
          </div>
          <p className="text-[10px] text-text-muted">
            Lighting was estimated from your background photo. Adjust below to fine-tune.
          </p>
          {!autoLighting && (
            <button
              onClick={resetToEstimate}
              className="text-[10px] text-primary hover:underline mt-1"
            >
              Reset to auto estimate
            </button>
          )}
        </div>
      )}

      <SliderControl
        label="Brightness"
        value={brightness}
        min={0}
        max={2}
        step={0.05}
        onChange={(v) => { setBrightness(v); setAutoLighting(false); }}
      />
      <SliderControl
        label="Light Direction"
        value={lightAngle}
        min={0}
        max={360}
        step={1}
        onChange={(v) => { setLightAngle(v); setAutoLighting(false); }}
        unit="°"
      />
      <SliderControl
        label="Light Height"
        value={lightElevation}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => { setLightElevation(v); setAutoLighting(false); }}
      />
      <SliderControl
        label="Shadow Strength"
        value={shadowOpacity}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => { setShadowOpacity(v); setAutoLighting(false); }}
      />

      <div className="mt-3">
        <label className="text-xs text-text-muted font-medium mb-1.5 block">Light Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={lightColor}
            onChange={(e) => { setLightColor(e.target.value); setAutoLighting(false); }}
            className="w-8 h-8 rounded border border-panel-border cursor-pointer"
          />
          <input
            type="text"
            value={lightColor}
            onChange={(e) => { setLightColor(e.target.value); setAutoLighting(false); }}
            className="flex-1 border border-panel-border rounded px-2 py-1 text-sm font-mono text-text-primary focus:outline-none focus:border-primary"
          />
        </div>
      </div>
    </div>
  );
}

function SliderControl({
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
