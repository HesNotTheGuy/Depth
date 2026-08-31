import { test, expect, type Page } from '@playwright/test';
import { promises as fs } from 'node:fs';

/**
 * Real-world use-case E2E suite.
 *
 * Each test boots the app, uploads a synthetic background, dismisses the
 * "Lighting matched" screen, then exercises one common workflow end-to-end.
 *
 * The scene store is exposed on `window.__depthStore` in dev builds (see
 * `useSceneStore.ts`) so tests can introspect state without scraping React
 * internals from the DOM.
 */

// -------- helpers --------

/** Build a synthetic gradient PNG inside the page and return raw bytes. */
async function synthesizeBackgroundPng(page: Page): Promise<Buffer> {
  const arr = await page.evaluate(async () => {
    const W = 1280;
    const H = 720;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#ffeecc');
    grad.addColorStop(1, '#223344');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(W * 0.75, H * 0.2, 60, 0, Math.PI * 2);
    ctx.fill();
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b: Blob | null) => resolve(b!), 'image/png'),
    );
    const ab = await blob.arrayBuffer();
    return Array.from(new Uint8Array(ab));
  });
  return Buffer.from(arr);
}

/** Build a solid-colored PNG inside the page (for textures / logos). */
async function synthesizeColorPng(page: Page, color: string, size = 128): Promise<Buffer> {
  const arr = await page.evaluate(
    async ({ color, size }) => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, size);
      // A diagonal stripe so the texture isn't pure flat (helps debugging).
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size / 8);
      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b: Blob | null) => resolve(b!), 'image/png'),
      );
      const ab = await blob.arrayBuffer();
      return Array.from(new Uint8Array(ab));
    },
    { color, size },
  );
  return Buffer.from(arr);
}

/** Click a mockup preset button. Featured Image/Phone sit above the fold;
 *  force avoids flaky overflow clipping inside the scrollable sidebar. */
async function clickMockupPreset(page: Page, label: string) {
  await page.getByRole('button', { name: /^object$/i }).click();
  // Ensure an object is selected so the Mockups grid is mounted.
  await expect.poll(async () => (await readStore(page)).selectedObjectId).toBeTruthy();
  const btn = page.getByRole('button', { name: label, exact: true }).first();
  await btn.scrollIntoViewIfNeeded();
  await btn.click({ force: true });
}

/** Common setup: open /app, upload bg, dismiss matched screen. */
async function openEditor(page: Page): Promise<void> {
  await page.goto('/app');
  await page.waitForLoadState('networkidle');

  const bg = await synthesizeBackgroundPng(page);
  await page.setInputFiles('#file-input', {
    name: 'background.png',
    mimeType: 'image/png',
    buffer: bg,
  });

  await expect(page.getByText('Lighting matched')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /continue/i }).click();

  // Sidebar visible = editor mounted.
  await expect(page.getByRole('button', { name: /^object$/i })).toBeVisible();
}

/** Read a snapshot of the zustand scene store from inside the page. */
async function readStore(page: Page): Promise<{
  objects: Array<{
    id: string;
    type: string;
    material: string;
    color: string;
    texture: string | null;
    faceTextures: Record<string, { url: string }>;
  }>;
  selectedObjectId: string | null;
  selectedFace: string | null;
  exportScale: number;
}> {
  return await page.evaluate(() => {
    const w = window as unknown as { __depthStore?: { getState: () => Record<string, unknown> } };
    const s = w.__depthStore?.getState();
    if (!s) throw new Error('window.__depthStore is not exposed — is the app running in DEV mode?');
    return {
      objects: (s.objects as unknown[]).map((o) => {
        const obj = o as Record<string, unknown>;
        return {
          id: obj.id as string,
          type: obj.type as string,
          material: obj.material as string,
          color: obj.color as string,
          texture: obj.texture as string | null,
          faceTextures: (obj.faceTextures ?? {}) as Record<string, { url: string }>,
        };
      }),
      selectedObjectId: s.selectedObjectId as string | null,
      selectedFace: s.selectedFace as string | null,
      exportScale: s.exportScale as number,
    };
  });
}

/** Force the scene store directly — used to drive deterministic face selection. */
async function setStore(page: Page, patch: Record<string, unknown>): Promise<void> {
  await page.evaluate((p) => {
    const w = window as unknown as { __depthStore?: { setState: (s: Record<string, unknown>) => void } };
    w.__depthStore?.setState(p);
  }, patch);
}

// -------- tests --------

test.describe('Use cases', () => {
  test('1. Phone mockup with screen image, exported as PNG', async ({ page }) => {
    await openEditor(page);

    await clickMockupPreset(page, 'Phone');
    await expect.poll(async () => (await readStore(page)).objects[0]?.type).toBe('phone');

    // Material tab — screen PNG is the primary path for phone mockups.
    await page.getByRole('button', { name: /^material$/i }).click();

    const tex = await synthesizeColorPng(page, '#22c55e');
    await page.locator('[data-testid="screen-texture-input"]').setInputFiles({
      name: 'screen.png',
      mimeType: 'image/png',
      buffer: tex,
    });

    // Assert the screen texture made it into faceTextures.front (and global texture).
    await expect
      .poll(async () => {
        const s = await readStore(page);
        return s.objects[0]?.faceTextures?.front?.url ?? '';
      }, { timeout: 5000 })
      .toMatch(/^data:image\//);

    // Export tab + PNG export.
    await page.getByRole('button', { name: /^export$/i }).first().click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export png/i }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).toBeTruthy();
    const stat = await fs.stat(path!);
    expect(stat.size).toBeGreaterThan(1024);
    expect(download.suggestedFilename()).toMatch(/\.png$/);
  });

  test('1b. Flat PNG image plate via Add PNG', async ({ page }) => {
    await openEditor(page);

    await page.getByRole('button', { name: /^object$/i }).click();

    const art = await synthesizeColorPng(page, '#f59e0b');
    await page.locator('[data-testid="png-mockup-input"]').setInputFiles({
      name: 'mockup-art.png',
      mimeType: 'image/png',
      buffer: art,
    });

    await expect
      .poll(async () => {
        const s = await readStore(page);
        const img = s.objects.find((o) => o.type === 'image');
        return img?.texture ?? '';
      }, { timeout: 5000 })
      .toMatch(/^data:image\//);
  });

  test('2. Mug mockup with a global logo texture', async ({ page }) => {
    await openEditor(page);

    await clickMockupPreset(page, 'Mug');
    await expect.poll(async () => (await readStore(page)).objects[0]?.type).toBe('mug');

    // Material tab + upload global texture.
    await page.getByRole('button', { name: /^material$/i }).click();

    const logo = await synthesizeColorPng(page, '#ef4444');
    await page.locator('[data-testid="global-texture-input"]').setInputFiles({
      name: 'logo.png',
      mimeType: 'image/png',
      buffer: logo,
    });

    await expect
      .poll(async () => (await readStore(page)).objects[0]?.texture, { timeout: 5000 })
      .toMatch(/^data:image\//);
  });

  test('3. Business card with a front face texture', async ({ page }) => {
    await openEditor(page);

    await clickMockupPreset(page, 'Card');
    await expect.poll(async () => (await readStore(page)).objects[0]?.type).toBe('card');

    await page.getByRole('button', { name: /^material$/i }).click();
    await setStore(page, { selectedFace: 'front' });
    await expect(page.getByText(/Selected: front/i)).toBeVisible();

    const design = await synthesizeColorPng(page, '#0ea5e9');
    await page.locator('[data-testid="face-texture-input"]').setInputFiles({
      name: 'card-front.png',
      mimeType: 'image/png',
      buffer: design,
    });

    await expect
      .poll(async () => {
        const s = await readStore(page);
        return s.objects[0]?.faceTextures?.front?.url ?? '';
      }, { timeout: 5000 })
      .toMatch(/^data:image\//);
  });

  test('4. Multiple objects + undo/redo', async ({ page }) => {
    await openEditor(page);

    // The store starts with one Cube. Turn it into a phone, then Add a mug.
    await clickMockupPreset(page, 'Phone');
    await expect.poll(async () => (await readStore(page)).objects.length).toBe(1);

    // Add a fresh object via the "+ Add" button, then convert that one to a mug.
    await page.getByRole('button', { name: /^add$/i }).first().click();
    await expect.poll(async () => (await readStore(page)).objects.length).toBe(2);
    await clickMockupPreset(page, 'Mug');

    const afterAdd = await readStore(page);
    expect(afterAdd.objects).toHaveLength(2);
    expect(afterAdd.objects.map((o) => o.type).sort()).toEqual(['mug', 'phone']);

    // Delete the mug via the per-row Delete button. The button exposes an
    // accessible name like "Delete Mug 2" — match on /^Delete /i to find it.
    await page.getByRole('button', { name: /^delete mug/i }).first().click();

    await expect.poll(async () => (await readStore(page)).objects.length).toBe(1);

    // Undo brings the mug back. The keyboard handler is bound at window level.
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await readStore(page)).objects.length, { timeout: 3000 }).toBe(2);

    // Redo removes it again.
    await page.keyboard.press('Control+Shift+z');
    await expect.poll(async () => (await readStore(page)).objects.length, { timeout: 3000 }).toBe(1);
  });

  test('5. 4x export resolution produces a high-res PNG', async ({ page }) => {
    await openEditor(page);

    await clickMockupPreset(page, 'Phone');

    await page.getByRole('button', { name: /^export$/i }).first().click();
    await page.getByRole('button', { name: /^4x$/i }).click();
    await expect.poll(async () => (await readStore(page)).exportScale).toBe(4);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export png/i }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).toBeTruthy();

    const bytes = await fs.readFile(path!);
    // PNG IHDR width is at offset 16..20, big-endian uint32.
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    // Canvas display size is driven by the viewport (Playwright default 1280×720,
    // minus the 320px sidebar → ~960px-wide display canvas). At 4x the export
    // should be ~3840px wide. We assert >= 3500 to absorb minor viewport
    // variance while still proving the 4x multiplier is actually applied
    // (a 1x export would only be ~960px wide).
    expect(width).toBeGreaterThanOrEqual(3500);
    expect(height).toBeGreaterThanOrEqual(2000);
  });

  // Persistence shipped in scenePersistence.ts — verify it actually works.
  test('6. Scene survives a page reload', async ({ page }) => {
    await openEditor(page);

    await clickMockupPreset(page, 'Phone');
    await page.getByRole('button', { name: /^material$/i }).click();
    await page.getByRole('button', { name: /glossy/i }).click();

    await page.reload();
    await page.waitForLoadState('networkidle');

    const s = await readStore(page);
    expect(s.objects[0]?.type).toBe('phone');
    expect(s.objects[0]?.material).toBe('glossy');
  });
});
