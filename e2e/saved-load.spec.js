import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { start, openFilm, chooseDrawnVideo, openHistory } from './shared/filmed-set.js';
import { layoutFaults } from '../test/real-phone/checks.mjs';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, locale: 'fr-FR', reducedMotion: 'reduce' });
const BASE = '/workout-vision/';

const allSets = page => page.evaluate(() => new Promise((ok, ko) => {
  const r = indexedDB.open('workoutVision');
  r.onerror = () => ko(r.error);
  r.onsuccess = () => {
    const db = r.result;
    const q = db.transaction('workouts').objectStore('workouts').getAll();
    q.onsuccess = () => { db.close(); ok(q.result.sort((a, b) => b.createdAt - a.createdAt)); };
    q.onerror = () => { db.close(); ko(q.error); };
  };
}));

test('card 032: entering 60 kg once saved updates history, record by load and CSV export with no extra tap before saving', async ({ page }, testInfo) => {
  test.setTimeout(150000);
  const errors = await start(page);
  await page.goto(BASE);
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  // Seed one prior lighter curl set so History renders the exercise record lines.
  await page.evaluate(() => new Promise((ok, ko) => {
    const r = indexedDB.open('workoutVision');
    r.onerror = () => ko(r.error);
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction('workouts', 'readwrite');
      tx.objectStore('workouts').put({
        id: 'prior-curl', exercise: 'bicep_curl', reps: 5, source: 'counter-core', corrected: false, weight: 50, createdAt: Date.now() - 3600_000,
      }, 'prior-curl');
      tx.oncomplete = () => { db.close(); ok(); };
      tx.onerror = () => ko(tx.error);
    };
  }));

  await openFilm(page, BASE);
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60000 });
  // Zero taps added before saving: no load input before confirming.
  await expect(page.getByTestId('saved-load')).toHaveCount(0);

  await page.getByRole('button', { name: /^Oui, \d+ répétitions?$/ }).click();
  const card = page.getByTestId('saved-card');
  await expect(card).toBeVisible();
  await expect(page.getByTestId('saved-load-input')).toBeVisible();
  await page.getByTestId('saved-load').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  await page.screenshot({ path: testInfo.outputPath('saved-without-load.png') });
  const keepFault = f => !f.startsWith('note: ');
  expect((await page.evaluate(layoutFaults)).filter(keepFault)).toEqual([]);

  await page.getByTestId('saved-load-input').fill('60');
  await page.getByTestId('saved-load-save').click();
  await expect(page.getByTestId('saved-load-status')).toContainText('60');
  await page.getByTestId('saved-load').scrollIntoViewIfNeeded();
  // Wait for the rest clock's first second tick so layoutFaults always checks changed digits (e.g. 0:01) too.
  await expect(page.getByTestId('rest-clock')).not.toContainText('0:00');
  await page.screenshot({ path: testInfo.outputPath('saved-with-load.png') });
  expect((await page.evaluate(layoutFaults)).filter(keepFault)).toEqual([]);

  const sets = await allSets(page);
  expect(sets[0].weight).toBe(60);

  await page.getByRole('button', { name: 'Fermer' }).click();
  await openHistory(page);
  await expect(page.locator('.hist-btn').first()).toContainText('60\u00A0kg');
  await expect(page.locator('.hist-prog')).toContainText('Charge max\u00A0: 60\u00A0kg');

  const downloads = [];
  page.on('download', d => downloads.push(d));
  await page.getByRole('button', { name: 'Exporter vos séries' }).click();
  await expect.poll(() => downloads.length).toBe(2);
  const files = Object.fromEntries(await Promise.all(downloads.map(async d => [d.suggestedFilename(), await readFile(await d.path(), 'utf8')])));
  const csvName = Object.keys(files).find(n => n.startsWith('series-'));
  const rows = files[csvName].slice(1).split('\r\n').filter(Boolean);
  expect(rows[0].split(';')[6]).toBe('Charge (kg)');
  expect(rows.at(-1).split(';')[6]).toBe('60');
  expect(errors).toEqual([]);
});

test('card 032: saving without entering a load stores no weight field, not 0', async ({ page }) => {
  test.setTimeout(150000);
  const errors = await start(page);
  await openFilm(page, BASE);
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: /^Oui, \d+ répétitions?$/ }).click();
  await expect(page.getByTestId('saved-card')).toBeVisible();
  await page.getByTestId('new-set').click();
  await expect(page.locator('.film-screen')).toBeVisible();

  const sets = await allSets(page);
  expect(sets).toHaveLength(1);
  expect('weight' in sets[0]).toBe(false);
  expect(errors).toEqual([]);
});
