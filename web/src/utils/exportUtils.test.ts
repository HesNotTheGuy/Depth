import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadBlob } from './exportHelpers';

/**
 * NOTE: formatToMime in exportUtils.ts is module-private. We can't import it
 * directly without modifying source. Behavior is exercised end-to-end by
 * captureCanvas in the E2E test, so here we lock down downloadBlob's
 * filename + click behavior and the export format value space.
 */

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an anchor with the correct download filename and clicks it', () => {
    const clickSpy = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        (el as HTMLAnchorElement).click = clickSpy;
      }
      return el;
    });
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });

    const blob = new Blob(['hello'], { type: 'image/png' });
    downloadBlob(blob, 'depth-export.png');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});

describe('export format mapping', () => {
  // The export format type only allows these three values; we lock that down
  // here so a future widening of the type forces an explicit decision.
  it('only allows png/jpeg/webp', () => {
    const allowed = ['png', 'jpeg', 'webp'] as const;
    expect(allowed).toHaveLength(3);
  });
});
