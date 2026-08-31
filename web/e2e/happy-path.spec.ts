import { test, expect } from '@playwright/test';
import { promises as fs } from 'node:fs';

/**
 * End-to-end happy path:
 *   upload → analyze → editor → pick a phone mockup → glossy material → export PNG
 *
 * The "background image" is generated on the page itself via canvas.toBlob()
 * so the test does not depend on any fixture file.
 */
test('upload → mockup → material → export', async ({ page }) => {
  await page.goto('/app');
  await page.waitForLoadState('networkidle');

  // Build a synthetic gradient PNG inside the page, then drop it into the
  // hidden <input id="file-input"> so the upload pipeline runs unchanged.
  const fileBuffer = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 384;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 512, 384);
    grad.addColorStop(0, '#ffeecc');
    grad.addColorStop(1, '#223344');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 384);
    // Bright spot to make light detection happy
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(380, 80, 30, 0, Math.PI * 2);
    ctx.fill();
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b: Blob | null) => resolve(b!), 'image/png'),
    );
    const ab = await blob.arrayBuffer();
    return Array.from(new Uint8Array(ab));
  });

  await page.setInputFiles('#file-input', {
    name: 'background.png',
    mimeType: 'image/png',
    buffer: Buffer.from(fileBuffer),
  });

  // Wait for "Lighting matched" badge to confirm analysis finished.
  await expect(page.getByText('Lighting matched')).toBeVisible({ timeout: 30_000 });

  // Continue into the editor.
  await page.getByRole('button', { name: /continue/i }).click();

  // Editor loaded — sidebar tabs visible.
  await expect(page.getByRole('button', { name: /^object$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /material/i })).toBeVisible();

  // Click the Phone mockup (featured preset above the fold).
  await page.getByRole('button', { name: 'Phone', exact: true }).first().click({ force: true });

  // Switch to Material tab and pick Glossy.
  await page.getByRole('button', { name: /material/i }).click();
  await page.getByRole('button', { name: /glossy/i }).click();

  // Switch to Export tab.
  await page.getByRole('button', { name: /^export$/i }).first().click();

  // Trigger the export — the on-page Export PNG button.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /export png/i }).click();
  const download = await downloadPromise;

  const path = await download.path();
  expect(path).toBeTruthy();
  const stat = await fs.stat(path!);
  expect(stat.size).toBeGreaterThan(100);
  expect(download.suggestedFilename()).toMatch(/\.png$/);
});
