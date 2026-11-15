import { test, expect } from '@playwright/test';
import { layoutFaults } from '../test/real-phone/checks.mjs';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, locale: 'fr-FR', reducedMotion: 'reduce' });

const keepFault = f => !f.startsWith('note: ');

// Card 042 (15 November 2026): the placement note gives the angle and the framing, and no figure from rendered bodies (R8).
const CLAIM = /exactes|Synth[eè]se|synth[eé]tique|\b\d\/6\b/;

test('cards 041 and 042: Guide and Film show per-lift camera placement, with no figure, without pushing Filmer ma série below the fold', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.addInitScript(() => {
    if (sessionStorage.getItem('wv_test_init')) return;
    sessionStorage.setItem('wv_test_init', '1');
    localStorage.setItem('wv_seen_entry', 'true');
    localStorage.setItem('wv_lang', 'fr');
    localStorage.setItem('wv_level', 'intermediate');
  });

  // 1. Check Guide accordion item placement note for bicep_curl (90° side).
  await page.goto('/workout-vision/#exercises');
  await expect(page.locator('#guide-search')).toBeVisible({ timeout: 20_000 });
  await page.locator('#guide-search').fill('Curl biceps');
  const curlBtn = page.locator('[data-exercise="bicep_curl"] .item-btn').first();
  await expect(curlBtn).toBeVisible();
  await curlBtn.click();

  const guideNote = page.getByTestId('guide-filming-note');
  await expect(guideNote).toBeVisible();
  await expect(guideNote).toContainText('De profil (90°)');
  await expect(guideNote).not.toHaveText(CLAIM);
  expect((await page.evaluate(layoutFaults)).filter(keepFault)).toEqual([]);

  // 2. Navigate from Guide into Film for bicep_curl and verify primary CTA stays in viewport.
  await page.locator('.guide-detail .btn-line').click();
  await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20_000 });
  const filmNote = page.getByTestId('film-filming-note');
  await expect(filmNote).toBeVisible();
  await expect(filmNote).toContainText('De profil (90°)');
  await expect(filmNote).not.toHaveText(CLAIM);

  const filmBtn = page.locator('.film-screen .actions .btn-primary');
  await expect(filmBtn).toContainText('Filmer ma série');
  const curlBox = await filmBtn.boundingBox();
  expect(curlBox).not.toBeNull();
  expect(curlBox.y + curlBox.height).toBeLessThanOrEqual(844);
  expect((await page.evaluate(layoutFaults)).filter(keepFault)).toEqual([]);

  // 3. Check front lift (lateral_raise, 0° front) on Film directly from Choice.
  await page.goto('/workout-vision/');
  await page.locator('.rail > .altar[aria-label="Élévations latérales"]').first().click();
  await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('film-filming-note')).toContainText('De face (0°)');
  await expect(page.getByTestId('film-filming-note')).not.toHaveText(CLAIM);

  const lrBox = await page.locator('.film-screen .actions .btn-primary').boundingBox();
  expect(lrBox).not.toBeNull();
  expect(lrBox.y + lrBox.height).toBeLessThanOrEqual(844);
  expect((await page.evaluate(layoutFaults)).filter(keepFault)).toEqual([]);

  expect(errors).toEqual([]);
});
