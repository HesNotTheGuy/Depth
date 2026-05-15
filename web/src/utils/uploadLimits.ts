/**
 * Shared limits + helpers for user-supplied image uploads.
 *
 * A single cap (5 MB) protects every FileReader entry point in the app from
 * locking the tab on a giant file. Keep this in sync with MAX_DROP_BYTES in
 * viewport/CompositeViewport.tsx if that ever diverges.
 */
import { confirmModal } from '../store/useModalStore';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ValidateResult = { ok: true } | { ok: false; reason: string };

/** Synchronous check: type prefix + size cap. */
export function validateImage(file: File): ValidateResult {
  if (!file.type.startsWith('image/')) {
    return { ok: false, reason: 'Only image files are supported.' };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, reason: 'Maximum size is 5 MB. Please pick a smaller image.' };
  }
  return { ok: true };
}

/**
 * Validate and, on rejection, show the standard "too large / wrong type"
 * confirm modal. Returns true if the file passed, false if it was rejected.
 */
export async function validateImageWithModal(file: File): Promise<boolean> {
  const result = validateImage(file);
  if (result.ok) return true;
  const isSize = file.size > MAX_IMAGE_BYTES;
  await confirmModal({
    title: isSize ? 'Image too large' : 'Unsupported file',
    description: result.reason,
    confirmLabel: 'OK',
    cancelLabel: '',
  });
  return false;
}
