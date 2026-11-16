import { test, expect } from '@playwright/test';
import { start, openFilm, chooseDrawnVideo } from './shared/filmed-set.js';
import { drawnWebm } from './shared/drawn-video.js';
import { layoutFaults } from '../test/real-phone/checks.mjs';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
const BASE = '/workout-vision/';
const keepFault = f => !f.startsWith('note: ');

const collectedKeys = page => page.evaluate(() => new Promise((ok, ko) => {
  const r = indexedDB.open('workoutVision');
  r.onerror = () => ko(r.error);
  r.onsuccess = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains('collected')) { db.close(); ok([]); return; }
    const q = db.transaction('collected').objectStore('collected').getAllKeys();
    q.onsuccess = () => { db.close(); ok(q.result); };
    q.onerror = () => { db.close(); ko(q.error); };
  };
}));

const savedSetCount = page => page.evaluate(() => new Promise((ok, ko) => {
  const r = indexedDB.open('workoutVision');
  r.onerror = () => ko(r.error);
  r.onsuccess = () => {
    const db = r.result;
    const storeName = ['sets', 'workouts'].find(name => db.objectStoreNames.contains(name));
    if (!storeName) { db.close(); ok(0); return; }
    const q = db.transaction(storeName).objectStore(storeName).count();
    q.onsuccess = () => { db.close(); ok(q.result); };
    q.onerror = () => { db.close(); ko(q.error); };
  };
}));

test('card 044: sample video shows Exemple, never saves/collects, and resets cleanly in the same SPA session', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = await start(page);
  await page.goto(`${BASE}#collecte`);
  await expect(page.getByTestId('collect-switched')).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => localStorage.getItem('wv_collecte'))).toBe('1');

  await openFilm(page, BASE);
  // Fulfill the bundled demo fetch with a Chromium-decodable 12s WebM (as e2e/check-inject.spec.js does).
  const demoVideo = Buffer.from(await drawnWebm(page, 12_000), 'base64');
  await page.route('**/demo/bicep-curl-5.mp4', r => r.fulfill({ status: 200, contentType: 'video/webm', body: demoVideo }));

  // 1. Sample run -> Result shows Exemple, no save keys, closing returns via SPA straight to Choice.
  await page.getByTestId('film-sample-btn').click();
  await expect(page.getByTestId('res-status')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId('res-status')).toContainText('Exemple');
  await expect(page.getByTestId('res-state')).toContainText('Exemple');
  await expect(page.getByTestId('res-src')).toContainText('exemple');
  expect((await page.evaluate(layoutFaults)).filter(keepFault)).toEqual([]);

  const saveYes = page.getByTestId('res-yes');
  if (await saveYes.count()) await saveYes.first().click();
  const saveManual = page.getByTestId('res-save');
  if (await saveManual.count()) await saveManual.first().click();
  expect(await page.getByTestId('res-yes').count()).toBe(0);
  expect(await page.getByTestId('res-save').count()).toBe(0);
  expect(await page.getByTestId('saved-card').count()).toBe(0);

  await page.locator('.result-screen .topbar .icon-btn').click();
  expect(await page.getByTestId('close-card').count()).toBe(0);
  await expect(page.locator('.choose-screen')).toBeVisible({ timeout: 20_000 });
  expect(await savedSetCount(page)).toBe(0);
  expect(await collectedKeys(page)).toEqual([]);

  // 2. Sample -> "Filmer ma série" -> real video in the SAME SPA session (no page.goto reload): resets sample state.
  await page.locator('.rail > .altar[aria-label="Curl biceps"]').first().click();
  await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('film-sample-btn').click();
  await expect(page.getByTestId('res-status')).toContainText('Exemple', { timeout: 45_000 });
  await page.getByTestId('sample-film').click();
  await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20_000 });

  await chooseDrawnVideo(page);
  await page.getByTestId('blind-unsure').click({ timeout: 60_000 });
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('res-status')).not.toContainText('Exemple');
  await page.getByRole('button', { name: /^Oui, \d+ répétitions?$/ }).click();
  await expect(page.getByTestId('saved-card')).toBeVisible();
  await expect.poll(() => savedSetCount(page)).toBe(1);
  await expect.poll(() => collectedKeys(page)).toHaveLength(1);

  expect(errors).toEqual([]);
});
