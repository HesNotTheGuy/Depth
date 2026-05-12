import { useEffect, useRef, useState } from 'react';
import { useModalStore, type ModalRequest } from '../../store/useModalStore';

/**
 * Mount this once at the App root. It renders whatever modal request is
 * currently active in the zustand store, then resolves the underlying promise
 * when the user clicks confirm/cancel (or presses Enter/Escape).
 */
export function ModalRoot() {
  const current = useModalStore((s) => s.current);
  if (!current) return null;
  // Key on request id so the inner form fully remounts per request — this
  // avoids stale input state and keeps focus management trivial.
  return <ModalForm key={current.id} request={current} />;
}

function ModalForm({ request: current }: { request: ModalRequest }) {
  const resolveCurrent = useModalStore((s) => s.resolveCurrent);
  const inputRef = useRef<HTMLInputElement>(null);
  const initial = current.kind === 'prompt' ? current.defaultValue ?? '' : '';
  const [value, setValue] = useState(initial);

  // Auto-focus the prompt input on mount.
  useEffect(() => {
    if (current.kind === 'prompt') inputRef.current?.focus();
  }, [current.kind]);

  // Keyboard handlers: Enter confirms, Escape cancels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (current.kind === 'prompt') resolveCurrent(null);
        else resolveCurrent(false);
      } else if (e.key === 'Enter') {
        // For prompts, don't intercept Enter when focus is in the input — the
        // input's own onKeyDown handles it (so we don't double-fire).
        if (current.kind === 'prompt' && document.activeElement === inputRef.current) return;
        e.preventDefault();
        if (current.kind === 'prompt') {
          const v = value.trim();
          if (v) resolveCurrent(v);
        } else {
          resolveCurrent(true);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, resolveCurrent, value]);

  const cancelLabel = current.cancelLabel;
  const showCancel = cancelLabel !== '';

  const onConfirm = () => {
    if (current.kind === 'prompt') {
      const v = value.trim();
      if (!v) return;
      resolveCurrent(v);
    } else {
      resolveCurrent(true);
    }
  };

  const onCancel = () => {
    if (current.kind === 'prompt') resolveCurrent(null);
    else resolveCurrent(false);
  };

  const destructive = current.kind === 'confirm' && current.destructive;
  const confirmClass = destructive
    ? 'bg-red-500/90 hover:bg-red-500 text-white'
    : 'bg-gradient-to-r from-primary to-primary-hover hover:brightness-110 text-white';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]"
      onMouseDown={(e) => {
        // Click outside the card cancels.
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={current.title}
    >
      <div className="bg-surface-raised border border-white/8 rounded-xl shadow-xl shadow-black/50 max-w-md w-[90vw] p-5 animate-fade-in">
        <h2 className="text-base font-semibold text-text-primary mb-1">{current.title}</h2>
        {current.description && (
          <p className="text-sm text-text-muted mb-4">{current.description}</p>
        )}

        {current.kind === 'prompt' && (
          <input
            ref={inputRef}
            type="text"
            value={value}
            placeholder={current.placeholder ?? ''}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                onCancel();
              }
            }}
            className="w-full px-3 py-2 mb-4 bg-white/[0.04] border border-white/10 focus:border-primary/50 focus:outline-none rounded-lg text-sm text-text-primary placeholder:text-text-muted"
          />
        )}

        <div className="flex items-center justify-end gap-2">
          {showCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-text-secondary hover:bg-white/5 transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all shadow-lg shadow-black/20 ${confirmClass}`}
          >
            {current.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
