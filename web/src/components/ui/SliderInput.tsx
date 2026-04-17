import { useEffect, useState } from 'react';

type AxisColor = 'red' | 'green' | 'blue';

export interface SliderInputProps {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  /** Decimal places in the numeric display. Defaults based on step (<1 => 2, else 0). */
  decimals?: number;
  /** Optional suffix (e.g. "°", "x"). Shown after value in number input placeholder only; not in the edited value. */
  unit?: string;
  /** Axis tint for XYZ rows. */
  color?: AxisColor;
  /** Optional short axis letter shown to the left (e.g. "x"). */
  axis?: string;
  /** Visual density: "row" = label on top full-width slider, "inline" = compact single-row with label on left. */
  layout?: 'row' | 'inline';
  /** Width of the label column when layout === "inline". Tailwind class string. */
  labelWidth?: string;
  /** Override displayed value text (e.g. degrees conversion); does not affect edit input value. */
  displayValue?: string;
}

const axisTextColor: Record<AxisColor, string> = {
  red: 'text-red-400',
  green: 'text-green-400',
  blue: 'text-blue-400',
};

function clamp(v: number, min: number, max: number) {
  if (Number.isNaN(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function resolveDecimals(step: number, decimals?: number) {
  if (typeof decimals === 'number') return decimals;
  return step < 1 ? 2 : 0;
}

/**
 * Slider + editable number input. The number input commits on blur or Enter
 * (Enter does NOT submit any enclosing form). Escape reverts to the current value.
 */
export function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  decimals,
  unit,
  color,
  axis,
  layout = 'row',
  labelWidth,
  displayValue,
}: SliderInputProps) {
  const d = resolveDecimals(step, decimals);
  const formatted = value.toFixed(d);
  const [text, setText] = useState(formatted);
  const [editing, setEditing] = useState(false);

  // Keep local input text in sync with external value when not actively editing.
  useEffect(() => {
    if (!editing) setText(formatted);
  }, [formatted, editing]);

  const commit = () => {
    const parsed = parseFloat(text);
    if (Number.isNaN(parsed)) {
      setText(formatted);
      return;
    }
    const next = clamp(parsed, min, max);
    if (next !== value) onChange(next);
    setText(next.toFixed(d));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // don't submit enclosing forms
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setText(formatted);
      (e.target as HTMLInputElement).blur();
    }
  };

  const numberInput = (
    <input
      type="text"
      inputMode="decimal"
      value={editing ? text : (displayValue ?? `${formatted}${unit ?? ''}`)}
      onFocus={(e) => {
        setEditing(true);
        setText(formatted);
        e.target.select();
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        commit();
        setEditing(false);
      }}
      onKeyDown={handleKeyDown}
      className="w-[52px] shrink-0 bg-white/[0.04] border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-text-primary text-right focus:outline-none focus:border-primary/40 focus:bg-white/[0.06] transition-colors"
    />
  );

  const rangeInput = (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="flex-1 min-w-0"
    />
  );

  if (layout === 'inline') {
    return (
      <div className="flex items-center gap-2">
        {axis ? (
          <span
            className={`text-[10px] font-bold uppercase w-3 text-center ${
              color ? axisTextColor[color] : 'text-text-muted'
            }`}
          >
            {axis}
          </span>
        ) : label ? (
          <span className={`text-[10px] text-text-muted shrink-0 ${labelWidth ?? 'w-20'}`}>{label}</span>
        ) : null}
        {rangeInput}
        {numberInput}
      </div>
    );
  }

  return (
    <div className="mb-3">
      {label && (
        <div className="text-[11px] text-text-muted font-medium mb-1.5">{label}</div>
      )}
      <div className="flex items-center gap-2">
        {rangeInput}
        {numberInput}
      </div>
    </div>
  );
}

export interface Vec3InputProps {
  label: string;
  value: { x: number; y: number; z: number };
  onChange: (v: { x: number; y: number; z: number }) => void;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  unit?: string;
}

/** XYZ group of SliderInput rows with red/green/blue axis tints. */
export function Vec3SliderInput({
  label,
  value,
  onChange,
  min = -3,
  max = 3,
  step = 0.05,
  decimals,
  unit,
}: Vec3InputProps) {
  const axes = ['x', 'y', 'z'] as const;
  const colors: AxisColor[] = ['red', 'green', 'blue'];
  return (
    <div className="mb-3">
      <div className="text-[11px] text-text-muted font-medium mb-1.5">{label}</div>
      <div className="space-y-1">
        {axes.map((a, i) => (
          <SliderInput
            key={a}
            layout="inline"
            axis={a}
            color={colors[i]}
            value={value[a]}
            onChange={(v) => onChange({ ...value, [a]: v })}
            min={min}
            max={max}
            step={step}
            decimals={decimals}
            unit={unit}
          />
        ))}
      </div>
    </div>
  );
}
