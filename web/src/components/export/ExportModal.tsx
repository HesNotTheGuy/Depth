import { useState, useCallback } from 'react';
import { X, Download, Clipboard, Check } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import { downloadBlob, copyBlobToClipboard } from '../../utils/exportHelpers';

type ExportFormat = 'png' | 'webp' | 'jpeg';

export function ExportModal() {
  const show = useUIStore((s) => s.showExportModal);
  const setShow = useUIStore((s) => s.setShowExportModal);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [transparent, setTransparent] = useState(false);
  const [status, setStatus] = useState('');

  const handleExport = useCallback(
    async (mode: 'download' | 'clipboard') => {
      setStatus(mode === 'download' ? 'Rendering...' : 'Copying...');

      try {
        const blob = await renderComposite(format, transparent);

        if (mode === 'download') {
          downloadBlob(blob, `depth-composite.${format}`);
          setStatus('Downloaded!');
        } else {
          await copyBlobToClipboard(blob);
          setStatus('Copied!');
        }
      } catch {
        setStatus('Export failed');
      }

      setTimeout(() => setStatus(''), 2000);
    },
    [format, transparent]
  );

  if (!show) return null;

  const isSuccess = status === 'Downloaded!' || status === 'Copied!';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-surface-raised border border-white/8 rounded-2xl shadow-2xl shadow-black/50 w-96 max-w-[90vw] animate-fade-in">
        <div className="flex items-center justify-between p-4 border-b border-white/6">
          <h2 className="font-semibold text-sm text-text-primary">Export Composite</h2>
          <button
            onClick={() => setShow(false)}
            className="p-1 hover:bg-white/5 rounded-lg text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-widest mb-2 block">
              Format
            </label>
            <div className="flex gap-1.5">
              {(['png', 'webp', 'jpeg'] as ExportFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold uppercase transition-all ${
                    format === f
                      ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                      : 'bg-white/[0.03] text-text-muted hover:bg-white/[0.06] hover:text-text-secondary'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
              disabled={format === 'jpeg'}
            />
            <span className={`text-xs ${format === 'jpeg' ? 'text-text-muted line-through' : 'text-text-secondary group-hover:text-text-primary transition-colors'}`}>
              3D object only (transparent background)
            </span>
          </label>

          {status && (
            <div className={`text-xs text-center font-medium flex items-center justify-center gap-1.5 py-1.5 ${
              isSuccess ? 'text-success' : 'text-text-muted'
            }`}>
              {isSuccess && <Check size={13} />}
              {status}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-white/6">
          <button
            onClick={() => handleExport('clipboard')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-white/8 rounded-lg text-xs font-medium text-text-secondary hover:bg-white/[0.03] hover:border-white/15 transition-all"
          >
            <Clipboard size={14} />
            Copy
          </button>
          <button
            onClick={() => handleExport('download')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-primary to-primary-hover hover:brightness-110 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-primary/15"
          >
            <Download size={14} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

async function renderComposite(
  format: ExportFormat,
  transparentOnly: boolean
): Promise<Blob> {
  const threeCanvas = document.querySelector('canvas') as HTMLCanvasElement | null;
  if (!threeCanvas) throw new Error('No canvas found');

  const outputCanvas = document.createElement('canvas');
  const w = threeCanvas.clientWidth * 2;
  const h = threeCanvas.clientHeight * 2;
  outputCanvas.width = w;
  outputCanvas.height = h;
  const ctx = outputCanvas.getContext('2d')!;

  if (!transparentOnly) {
    const bgImg = document.querySelector<HTMLImageElement>('.flex-1.relative > img');
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, w, h);
    }
  }

  ctx.drawImage(threeCanvas, 0, 0, w, h);

  const mimeType =
    format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';

  return new Promise((resolve, reject) => {
    outputCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob'))),
      mimeType,
      format === 'jpeg' ? 0.92 : undefined
    );
  });
}
