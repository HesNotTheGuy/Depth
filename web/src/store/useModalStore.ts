import { create } from 'zustand';

export type PromptRequest = {
  kind: 'prompt';
  id: number;
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (value: string | null) => void;
};

export type ConfirmRequest = {
  kind: 'confirm';
  id: number;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  resolve: (value: boolean) => void;
};

export type ModalRequest = PromptRequest | ConfirmRequest;

interface ModalState {
  current: ModalRequest | null;
  push: (req: ModalRequest) => void;
  resolveCurrent: (value: string | boolean | null) => void;
}

export const useModalStore = create<ModalState>((set, get) => ({
  current: null,
  push: (req) => set({ current: req }),
  resolveCurrent: (value) => {
    const cur = get().current;
    if (!cur) return;
    if (cur.kind === 'prompt') cur.resolve(value as string | null);
    else cur.resolve(value as boolean);
    set({ current: null });
  },
}));

let nextId = 1;

export function promptModal(opts: {
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    useModalStore.getState().push({
      kind: 'prompt',
      id: nextId++,
      title: opts.title,
      description: opts.description,
      placeholder: opts.placeholder,
      defaultValue: opts.defaultValue,
      confirmLabel: opts.confirmLabel ?? 'OK',
      cancelLabel: opts.cancelLabel ?? 'Cancel',
      resolve,
    });
  });
}

export function confirmModal(opts: {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    useModalStore.getState().push({
      kind: 'confirm',
      id: nextId++,
      title: opts.title,
      description: opts.description,
      confirmLabel: opts.confirmLabel ?? 'Confirm',
      cancelLabel: opts.cancelLabel ?? 'Cancel',
      destructive: opts.destructive ?? false,
      resolve,
    });
  });
}
