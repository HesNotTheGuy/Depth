import { useState, useCallback } from 'react';
import { Layers, Image, Check, Loader } from 'lucide-react';
import { useSceneStore } from '../../store/useSceneStore';
import type { ExportFormat, BlendMode } from '../../store/useSceneStore';
import { useExportStore } from '../../store/useExportStore';
import { captureComposite, captureLayered } from '../../utils/exportUtils';

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

export function ExportPanel() {
  const exportScale = useSceneStore((s) => s.exportScale);
  const setExportScale = useSceneStore((s) => s.setExportScale);
  const exportFilename = useSceneStore((s) => s.exportFilename);
  const setExportFilename = useSceneStore((s) => s.setExportFilename);
  const exportFormat = useSceneStore((s) => s.exportFormat);
  const setExportFormat = useSceneStore((s) => s.setExportFormat);
  const blendMode = useSceneStore((s) => s.blendMode);
  const setBlendMode = useSceneStore((s) => s.setBlendMode);

  const renderer = useExportStore((s) => s.renderer);
  const scene = useExportStore((s) => s.scene);
  const camera = useExportStore((s) => s.camera);

  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const canExport = renderer && scene && camera && !busy;

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

      {/* Export Image */}
      <button
        onClick={handleExport}
        disabled={!canExport}
        className="w-full flex items-center justify-center gap-2 py-2.5 mb-2 bg-gradient-to-r from-primary to-primary-hover hover:brightness-110 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-primary/15 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100"
      >
        {busy ? <Loader size={14} className="animate-spin" /> : <Image size={14} />}
        Export {exportFormat.toUpperCase()}
      </button>

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
