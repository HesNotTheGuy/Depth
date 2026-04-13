import { useState, useCallback } from 'react';
import { X, Download, Clipboard } from 'lucide-react';
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
        // Composite the background image + 3D canvas into one image
        const blob = await renderComposite(format, transparent);

        if (mode === 'download') {
          downloadBlob(blob, `depth-composite.${format}`);
          setStatus('Downloaded!');
        } else {
          await copyBlobToClipboard(blob);
          setStatus('Copied to clipboard!');
        }
      } catch {
        setStatus('Export failed. Try again.');
      }

      setTimeout(() => setStatus(''), 2000);
    },
    [format, transparent]
  );

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-96 max-w-[90vw]">
        <div className="flex items-center justify-between p-4 border-b border-panel-border">
          <h2 className="font-semibold text-text-primary">Export Composite</h2>
          <button onClick={() => setShow(false)} className="p-1 hover:bg-gray-100 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 block">
              Format
            </label>
            <div className="flex gap-2">
              {(['png', 'webp', 'jpeg'] as ExportFormat[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 py-2 rounded text-sm font-medium uppercase transition-colors ${
                    format === f
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
              disabled={format === 'jpeg'}
              className="accent-primary"
            />
            <span className="text-sm text-text-secondary">
              3D object only (transparent, no background)
              {format === 'jpeg' ? ' — not available for JPEG' : ''}
            </span>
          </label>

          {status && <p className="text-sm text-primary text-center font-medium">{status}</p>}
        </div>

        <div className="flex gap-2 p-4 border-t border-panel-border">
          <button
            onClick={() => handleExport('clipboard')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-panel-border rounded-lg text-sm font-medium text-text-secondary hover:bg-gray-50 transition-colors"
          >
            <Clipboard size={16} />
            Copy
          </button>
          <button
            onClick={() => handleExport('download')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a composite: background image + 3D canvas layered together.
 */
async function renderComposite(
  format: ExportFormat,
  transparentOnly: boolean
): Promise<Blob> {
  const threeCanvas = document.querySelector('canvas') as HTMLCanvasElement | null;
  if (!threeCanvas) throw new Error('No canvas found');

  const outputCanvas = document.createElement('canvas');
  const w = threeCanvas.clientWidth * 2; // 2x for quality
  const h = threeCanvas.clientHeight * 2;
  outputCanvas.width = w;
  outputCanvas.height = h;
  const ctx = outputCanvas.getContext('2d')!;

  if (!transparentOnly) {
    // Draw background image first
    const bgImg = document.querySelector<HTMLImageElement>('.flex-1.relative > img');
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, w, h);
    }
  }

  // Draw the 3D canvas on top
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
