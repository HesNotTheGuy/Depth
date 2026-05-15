import { useState, useCallback, useMemo, useRef } from 'react';
import { Layers, Image, Check, Loader, ChevronDown, ChevronRight, Plus, X, Package } from 'lucide-react';
import { useSceneStore, type ObjectPreset } from '../../store/useSceneStore';
import type { ExportFormat, BlendMode } from '../../store/useSceneStore';
import { useExportStore } from '../../store/useExportStore';
import { captureComposite, captureLayered } from '../../utils/exportUtils';
import {
  runBulkExport,
  totalVariations,
  MAX_BULK_VARIATIONS,
  type VariationDimension,
  type VariationDimensionKind,
  type MaterialPreset,
  type BulkExportHandle,
} from '../../utils/bulkExport';
import { confirmModal } from '../../store/useModalStore';
import { validateImageWithModal } from '../../utils/uploadLimits';

const BULK_WARN_THRESHOLD = 50;

const scales = [
  { label: '1x', value: 1 },
  { label: '2x', value: 2 },
  { label: '4x', value: 4 },
];

const formats: { label: string; value: ExportFormat }[] = [
  { label: 'PNG', value: 'png' },
  { label: 'JPEG', value: 'jpeg' },
  { label: 'WebP', value: 'webp' },
];

const blendModes: { label: string; value: BlendMode }[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'Multiply', value: 'multiply' },
  { label: 'Screen', value: 'screen' },
  { label: 'Overlay', value: 'overlay' },
];

const DEFAULT_COLORS = ['#000000', '#ffffff', '#3b82f6', '#ef4444', '#10b981'];
const MATERIAL_PRESETS: MaterialPreset[] = ['matte', 'glossy', 'metallic', 'glass', 'plastic'];
const OBJECT_PRESETS: ObjectPreset[] = [
  'box', 'cylinder', 'sphere', 'cone', 'torus',
  'phone', 'tablet', 'laptop', 'mug', 'bottle', 'can', 'card', 'book', 'bag', 'donut',
];

type DimensionSlot = VariationDimensionKind | 'none';

/** Build an empty dimension of the requested kind. */
function makeDimension(kind: VariationDimensionKind): VariationDimension {
  switch (kind) {
    case 'color': return { kind: 'color', values: [...DEFAULT_COLORS] };
    case 'material': return { kind: 'material', values: ['matte', 'glossy'] };
    case 'object': return { kind: 'object', values: ['box', 'sphere'] };
    case 'background': return { kind: 'background', values: [] };
  }
}

interface DimensionConfigProps {
  dimension: VariationDimension;
  onChange: (next: VariationDimension) => void;
}

function ColorConfig({ dimension, onChange }: { dimension: Extract<VariationDimension, { kind: 'color' }>, onChange: (n: VariationDimension) => void }) {
  const [draft, setDraft] = useState('#000000');
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {dimension.values.map((c, i) => (
          <button
            key={`${c}-${i}`}
            onClick={() => onChange({ ...dimension, values: dimension.values.filter((_, j) => j !== i) })}
            title="Click to remove"
            className="w-7 h-7 rounded-md border border-white/15 hover:ring-2 hover:ring-danger/50 transition-all"
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="color"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-8 h-8 rounded-md bg-transparent border border-white/10 cursor-pointer"
        />
        <button
          onClick={() => onChange({ ...dimension, values: [...dimension.values, draft] })}
          className="flex items-center gap-1 px-2 py-1 bg-white/[0.05] hover:bg-white/[0.08] rounded-md text-[11px] font-medium text-text-secondary"
        >
          <Plus size={11} /> Add color
        </button>
      </div>
    </div>
  );
}

function MaterialConfig({ dimension, onChange }: { dimension: Extract<VariationDimension, { kind: 'material' }>, onChange: (n: VariationDimension) => void }) {
  const selected = new Set(dimension.values);
  return (
    <div className="flex flex-wrap gap-1">
      {MATERIAL_PRESETS.map((m) => {
        const on = selected.has(m);
        return (
          <button
            key={m}
            onClick={() => {
              const next = on ? dimension.values.filter((v) => v !== m) : [...dimension.values, m];
              onChange({ ...dimension, values: next });
            }}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
              on ? 'bg-primary/20 text-primary ring-1 ring-primary/40' : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
            }`}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}

function ObjectConfig({ dimension, onChange }: { dimension: Extract<VariationDimension, { kind: 'object' }>, onChange: (n: VariationDimension) => void }) {
  const selected = new Set(dimension.values);
  return (
    <div className="flex flex-wrap gap-1">
      {OBJECT_PRESETS.map((t) => {
        const on = selected.has(t);
        return (
          <button
            key={t}
            onClick={() => {
              const next = on ? dimension.values.filter((v) => v !== t) : [...dimension.values, t];
              onChange({ ...dimension, values: next });
            }}
            className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
              on ? 'bg-primary/20 text-primary ring-1 ring-primary/40' : 'bg-white/[0.04] text-text-muted hover:bg-white/[0.08]'
            }`}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

function BackgroundConfig({ dimension, onChange }: { dimension: Extract<VariationDimension, { kind: 'background' }>, onChange: (n: VariationDimension) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const added: { label: string; dataUrl: string | null }[] = [];
    for (const file of Array.from(files)) {
      if (!(await validateImageWithModal(file))) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      added.push({ label: file.name.replace(/\.[^.]+$/, ''), dataUrl });
    }
    onChange({ ...dimension, values: [...dimension.values, ...added] });
  }, [dimension, onChange]);

  return (
    <div>
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full py-2 border border-dashed border-white/15 hover:border-white/30 rounded-md text-[11px] text-text-muted transition-all"
      >
        Drop or click to add backgrounds
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {dimension.values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {dimension.values.map((bg, i) => (
            <div key={i} className="relative group">
              {bg.dataUrl && (
                <img
                  src={bg.dataUrl}
                  alt={bg.label}
                  className="w-12 h-12 rounded-md object-cover border border-white/10"
                />
              )}
              <button
                onClick={() => onChange({ ...dimension, values: dimension.values.filter((_, j) => j !== i) })}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DimensionConfig({ dimension, onChange }: DimensionConfigProps) {
  switch (dimension.kind) {
    case 'color': return <ColorConfig dimension={dimension} onChange={onChange} />;
    case 'material': return <MaterialConfig dimension={dimension} onChange={onChange} />;
    case 'object': return <ObjectConfig dimension={dimension} onChange={onChange} />;
    case 'background': return <BackgroundConfig dimension={dimension} onChange={onChange} />;
  }
}

const dimensionLabel = (k: DimensionSlot): string => {
  switch (k) {
    case 'none': return 'None';
    case 'color': return 'Color';
    case 'material': return 'Material';
    case 'object': return 'Object';
    case 'background': return 'Background';
  }
};

export function ExportPanel() {
  const exportScale = useSceneStore((s) => s.exportScale);
  const setExportScale = useSceneStore((s) => s.setExportScale);
  const exportFilename = useSceneStore((s) => s.exportFilename);
  const setExportFilename = useSceneStore((s) => s.setExportFilename);
  const exportFormat = useSceneStore((s) => s.exportFormat);
  const setExportFormat = useSceneStore((s) => s.setExportFormat);
  const blendMode = useSceneStore((s) => s.blendMode);
  const setBlendMode = useSceneStore((s) => s.setBlendMode);
  const objectCount = useSceneStore((s) => s.objects.length);

  const renderer = useExportStore((s) => s.renderer);
  const scene = useExportStore((s) => s.scene);
  const camera = useExportStore((s) => s.camera);

  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // Bulk variations state — component-local; not persisted.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkEnabled, setBulkEnabled] = useState(false);
  const [slot1Kind, setSlot1Kind] = useState<DimensionSlot>('none');
  const [slot2Kind, setSlot2Kind] = useState<DimensionSlot>('none');
  const [dim1, setDim1] = useState<VariationDimension | null>(null);
  const [dim2, setDim2] = useState<VariationDimension | null>(null);

  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const bulkHandleRef = useRef<BulkExportHandle | null>(null);

  const activeDimensions: VariationDimension[] = useMemo(() => {
    const out: VariationDimension[] = [];
    if (dim1) out.push(dim1);
    if (dim2) out.push(dim2);
    return out;
  }, [dim1, dim2]);

  const bulkTotal = useMemo(() => totalVariations(activeDimensions), [activeDimensions]);
  const canExport = renderer && scene && camera && !busy;
  const noObjects = objectCount === 0;

  const handleSlotKindChange = (slot: 1 | 2, kind: DimensionSlot) => {
    if (slot === 1) {
      setSlot1Kind(kind);
      setDim1(kind === 'none' ? null : makeDimension(kind));
    } else {
      setSlot2Kind(kind);
      setDim2(kind === 'none' ? null : makeDimension(kind));
    }
  };

  const handleExport = useCallback(async () => {
    if (!renderer || !scene || !camera) return;
    setBusy(true);
    setStatus('Rendering...');
    try {
      await captureComposite(renderer, scene, camera, exportScale, exportFilename, exportFormat);
      setStatus('Downloaded!');
    } catch {
      setStatus('Export failed');
    }
    setBusy(false);
    setTimeout(() => setStatus(''), 2000);
  }, [renderer, scene, camera, exportScale, exportFilename, exportFormat]);

  const handleExportLayers = useCallback(async () => {
    if (!renderer || !scene || !camera) return;
    setBusy(true);
    setStatus('Rendering layers...');
    try {
      await captureLayered(renderer, scene, camera, exportScale, exportFilename, exportFormat);
      setStatus('Downloaded 3 files!');
    } catch {
      setStatus('Layer export failed');
    }
    setBusy(false);
    setTimeout(() => setStatus(''), 2500);
  }, [renderer, scene, camera, exportScale, exportFilename, exportFormat]);

  const handleBulkExport = useCallback(async () => {
    if (!renderer || !scene || !camera) return;
    if (activeDimensions.length === 0 || bulkTotal === 0) return;
    if (bulkTotal > MAX_BULK_VARIATIONS) return;
    if (bulkTotal > BULK_WARN_THRESHOLD) {
      const ok = await confirmModal({
        title: 'Confirm bulk export',
        description: `This will render ${bulkTotal} variations and may take several minutes. The browser tab will be busy until rendering completes.`,
        destructive: false,
        confirmLabel: `Render ${bulkTotal} variations`,
        cancelLabel: 'Cancel',
      });
      if (!ok) return;
    }
    setBusy(true);
    setStatus(`Exporting 0/${bulkTotal}...`);
    setBulkProgress({ current: 0, total: bulkTotal });

    const handle = runBulkExport(
      { renderer, scene, camera },
      { dimensions: activeDimensions, filename: exportFilename, scale: exportScale },
      (p) => {
        setBulkProgress({ current: p.current, total: p.total });
        setStatus(`Exporting ${p.current}/${p.total}...`);
      }
    );
    bulkHandleRef.current = handle;

    try {
      const result = await handle.promise;
      if (result.canceled) {
        setStatus(`Canceled at ${result.exported}/${result.total}`);
      } else {
        setStatus(`Downloaded ZIP (${result.exported} variations)!`);
      }
    } catch {
      setStatus('Bulk export failed');
    }

    bulkHandleRef.current = null;
    setBulkProgress(null);
    setBusy(false);
    setTimeout(() => setStatus(''), 3000);
  }, [renderer, scene, camera, activeDimensions, bulkTotal, exportFilename, exportScale]);

  const handleCancelBulk = () => {
    bulkHandleRef.current?.cancel();
  };

  const isSuccess = status.includes('Downloaded');

  return (
    <div>
      {/* Filename */}
      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2 block">
        Filename
      </label>
      <input
        type="text"
        value={exportFilename}
        onChange={(e) => setExportFilename(e.target.value)}
        placeholder="depth-export"
        className="w-full mb-4 px-3 py-2 bg-white/[0.03] border border-white/8 rounded-lg text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
      />

      {/* Format */}
      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2 block">
        Format
      </label>
      <div className="flex gap-1.5 mb-4">
        {formats.map((f) => (
          <button
            key={f.value}
            onClick={() => setExportFormat(f.value)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              exportFormat === f.value
                ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                : 'bg-white/[0.03] text-text-muted hover:bg-white/[0.06] hover:text-text-secondary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Resolution */}
      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2 block">
        Resolution
      </label>
      <div className="flex gap-1.5 mb-4">
        {scales.map((s) => (
          <button
            key={s.value}
            onClick={() => setExportScale(s.value)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              exportScale === s.value
                ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                : 'bg-white/[0.03] text-text-muted hover:bg-white/[0.06] hover:text-text-secondary'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Blend Mode */}
      <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2 block">
        Blend Mode
      </label>
      <div className="flex gap-1.5 mb-5">
        {blendModes.map((b) => (
          <button
            key={b.value}
            onClick={() => setBlendMode(b.value)}
            className={`flex-1 py-2 rounded-lg text-[10px] font-semibold transition-all ${
              blendMode === b.value
                ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                : 'bg-white/[0.03] text-text-muted hover:bg-white/[0.06] hover:text-text-secondary'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Bulk Variations section */}
      <div className="mb-4 border border-white/8 rounded-lg overflow-hidden">
        <button
          onClick={() => setBulkOpen(!bulkOpen)}
          className="w-full flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/[0.05] transition-all"
        >
          {bulkOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <Package size={13} className="text-text-muted" />
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-widest">
            Bulk Variations
          </span>
          {bulkEnabled && bulkTotal > 0 && (
            <span className="ml-auto text-[10px] text-primary font-semibold">{bulkTotal}</span>
          )}
        </button>

        {bulkOpen && (
          <div className="p-3 space-y-3 bg-white/[0.01]">
            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={bulkEnabled}
                onChange={(e) => setBulkEnabled(e.target.checked)}
                className="accent-primary"
              />
              Generate variations
            </label>

            {bulkEnabled && (
              <>
                <div>
                  <label className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1 block">
                    Dimension 1
                  </label>
                  <select
                    value={slot1Kind}
                    onChange={(e) => handleSlotKindChange(1, e.target.value as DimensionSlot)}
                    className="w-full px-2 py-1.5 bg-white/[0.04] border border-white/10 rounded-md text-xs text-text-primary"
                  >
                    {(['none', 'color', 'material', 'object', 'background'] as DimensionSlot[]).map((k) => (
                      <option key={k} value={k}>{dimensionLabel(k)}</option>
                    ))}
                  </select>
                  {dim1 && <div className="mt-2">
                    <DimensionConfig dimension={dim1} onChange={setDim1} />
                  </div>}
                </div>

                {dim1 && (
                  <div>
                    <label className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-1 block">
                      Dimension 2 (optional)
                    </label>
                    <select
                      value={slot2Kind}
                      onChange={(e) => handleSlotKindChange(2, e.target.value as DimensionSlot)}
                      className="w-full px-2 py-1.5 bg-white/[0.04] border border-white/10 rounded-md text-xs text-text-primary"
                    >
                      {(['none', 'color', 'material', 'object', 'background'] as DimensionSlot[])
                        .filter((k) => k === 'none' || k !== slot1Kind)
                        .map((k) => (
                          <option key={k} value={k}>{dimensionLabel(k)}</option>
                        ))}
                    </select>
                    {dim2 && <div className="mt-2">
                      <DimensionConfig dimension={dim2} onChange={setDim2} />
                    </div>}
                  </div>
                )}

                {bulkTotal > 0 && (
                  <div className="text-[11px] text-text-secondary">
                    Will export{' '}
                    <span
                      className={`font-semibold ${
                        bulkTotal > MAX_BULK_VARIATIONS
                          ? 'text-danger'
                          : bulkTotal > BULK_WARN_THRESHOLD
                            ? 'text-amber-400'
                            : 'text-primary'
                      }`}
                    >
                      {bulkTotal}
                    </span>{' '}
                    images
                    {bulkTotal > MAX_BULK_VARIATIONS && (
                      <span className="text-danger ml-1">
                        (over {MAX_BULK_VARIATIONS} limit)
                      </span>
                    )}
                  </div>
                )}

                {bulkProgress && (
                  <div className="space-y-2">
                    <div className="h-1.5 w-full bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${(bulkProgress.current / Math.max(1, bulkProgress.total)) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">{bulkProgress.current}/{bulkProgress.total} exported</span>
                      <button
                        onClick={handleCancelBulk}
                        className="px-2 py-0.5 bg-danger/10 hover:bg-danger/20 text-danger text-[10px] font-medium rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Export Image — switches to bulk mode when enabled and dimensions configured */}
      {bulkEnabled && bulkTotal > 0 ? (
        <button
          onClick={handleBulkExport}
          disabled={!canExport || noObjects || bulkTotal > MAX_BULK_VARIATIONS}
          title={
            bulkTotal > MAX_BULK_VARIATIONS
              ? `Bulk export is capped at ${MAX_BULK_VARIATIONS} variations. Reduce dimensions to proceed.`
              : noObjects
                ? 'Add an object to enable bulk export'
                : undefined
          }
          className="w-full flex items-center justify-center gap-2 py-2.5 mb-2 bg-gradient-to-r from-primary to-primary-hover hover:brightness-110 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-primary/15 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
        >
          {busy ? <Loader size={14} className="animate-spin" /> : <Package size={14} />}
          Export {bulkTotal} variations as ZIP
          {bulkTotal > BULK_WARN_THRESHOLD && bulkTotal <= MAX_BULK_VARIATIONS && ' (Confirm)'}
        </button>
      ) : (
        <button
          onClick={handleExport}
          disabled={!canExport}
          className="w-full flex items-center justify-center gap-2 py-2.5 mb-2 bg-gradient-to-r from-primary to-primary-hover hover:brightness-110 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-primary/15 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
        >
          {busy ? <Loader size={14} className="animate-spin" /> : <Image size={14} />}
          Export {exportFormat.toUpperCase()}
        </button>
      )}

      {/* Export Layers */}
      <button
        onClick={handleExportLayers}
        disabled={!canExport}
        className="w-full flex items-center justify-center gap-2 py-2.5 border border-white/8 rounded-lg text-xs font-medium text-text-secondary hover:bg-white/[0.03] hover:border-white/15 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? <Loader size={14} className="animate-spin" /> : <Layers size={14} />}
        Export Layers
      </button>

      {/* Layer description */}
      <p className="text-[10px] text-text-muted mt-2 leading-relaxed">
        Layers exports three separate PNGs: object-only (transparent), shadow-only, and full composite.
      </p>

      {/* Status */}
      {status && (
        <div
          className={`mt-3 text-xs text-center font-medium flex items-center justify-center gap-1.5 py-1.5 ${
            isSuccess ? 'text-success' : 'text-text-muted'
          }`}
        >
          {isSuccess && <Check size={13} />}
          {status}
        </div>
      )}
    </div>
  );
}
