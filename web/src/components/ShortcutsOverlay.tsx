import { X } from 'lucide-react';
import { useUIStore } from '../store/useUIStore';

interface Shortcut {
  keys: string[];
  label: string;
}

interface Section {
  title: string;
  shortcuts: Shortcut[];
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

const SECTIONS: Section[] = [
  {
    title: 'General',
    shortcuts: [
      { label: 'Undo', keys: [MOD, 'Z'] },
      { label: 'Redo', keys: [MOD, 'Shift', 'Z'] },
      { label: 'Redo (alt)', keys: [MOD, 'Y'] },
      { label: 'Show / hide shortcuts', keys: ['?'] },
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      { label: 'Delete selected object', keys: ['Delete'] },
      { label: 'Delete selected object', keys: ['Backspace'] },
      { label: 'Duplicate selected object', keys: [MOD, 'D'] },
      { label: 'Deselect', keys: ['Esc'] },
    ],
  },
  {
    title: 'Transform',
    shortcuts: [
      { label: 'Nudge position', keys: ['←', '→', '↑', '↓'] },
      { label: 'Nudge position (large)', keys: ['Shift', '←/→/↑/↓'] },
      { label: 'Reset rotation', keys: ['R'] },
      { label: 'Reset position', keys: ['0'] },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { label: 'Fit to screen', keys: [MOD, '0'] },
      { label: 'Zoom to 100%', keys: [MOD, '1'] },
      { label: 'Zoom in', keys: [MOD, '+'] },
      { label: 'Zoom out', keys: [MOD, '-'] },
    ],
  },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-md border border-panel-border bg-surface-raised text-[11px] font-mono font-medium text-text-primary shadow-sm">
      {children}
    </kbd>
  );
}

export function ShortcutsOverlay() {
  const show = useUIStore((s) => s.showShortcuts);
  const setShow = useUIStore((s) => s.setShowShortcuts);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setShow(false)}
    >
      <div
        className="relative w-[min(640px,92vw)] max-h-[85vh] overflow-y-auto rounded-2xl border border-panel-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-panel-border bg-surface/95 backdrop-blur">
          <div>
            <h2 className="text-sm font-semibold text-text-primary tracking-tight">
              Keyboard shortcuts
            </h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              Press <span className="font-mono">?</span> any time to toggle this panel.
            </p>
          </div>
          <button
            onClick={() => setShow(false)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-2">
                {section.title}
              </h3>
              <ul className="divide-y divide-panel-border/60">
                {section.shortcuts.map((sc, i) => (
                  <li
                    key={`${section.title}-${i}`}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-xs text-text-secondary">{sc.label}</span>
                    <span className="flex items-center gap-1">
                      {sc.keys.map((k, j) => (
                        <span key={j} className="flex items-center gap-1">
                          {j > 0 && (
                            <span className="text-[10px] text-text-muted">+</span>
                          )}
                          <Kbd>{k}</Kbd>
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
