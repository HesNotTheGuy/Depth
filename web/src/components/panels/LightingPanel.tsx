import { useSceneStore } from '../../store/useSceneStore';
import { Sparkles, RotateCcw } from 'lucide-react';

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

      <SliderControl
        label="Brightness"
        value={brightness}
        min={0}
        max={2}
        step={0.05}
        onChange={(v) => { setBrightness(v); setAutoLighting(false); }}
      />
      <SliderControl
        label="Direction"
        value={lightAngle}
        min={0}
        max={360}
        step={1}
        onChange={(v) => { setLightAngle(v); setAutoLighting(false); }}
        unit="°"
      />
      <SliderControl
        label="Height"
        value={lightElevation}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => { setLightElevation(v); setAutoLighting(false); }}
      />
      <SliderControl
        label="Shadow"
        value={shadowOpacity}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => { setShadowOpacity(v); setAutoLighting(false); }}
      />

      <div className="mt-4">
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
