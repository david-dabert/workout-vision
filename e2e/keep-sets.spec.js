// Keeping the sets (keep-sets.js, KeepSets.jsx): the history saves every set into one backup file and puts
// back, from that file, only the sets this phone lost; a file that is not a backup is refused.
import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block', acceptDownloads: true });

const put = (page, sets) => page.evaluate(sets => new Promise((resolve, reject) => {
  const r = indexedDB.open('workoutVision');
  r.onerror = () => reject(r.error);
  r.onsuccess = () => { const tx = r.result.transaction('workouts', 'readwrite'); for (const w of sets) tx.objectStore('workouts').put(w, w.id); tx.oncomplete = () => { r.result.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
}), sets);
const remove = (page, id) => page.evaluate(id => new Promise((resolve, reject) => {
  const r = indexedDB.open('workoutVision');
  r.onsuccess = () => { const tx = r.result.transaction('workouts', 'readwrite'); tx.objectStore('workouts').delete(id); tx.oncomplete = () => { r.result.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
  r.onerror = () => reject(r.error);
}), id);

test('a backup of the sets restores only what this phone lost', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => { if (!location.protocol.startsWith('http')) return; localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  const now = Date.now();
  await put(page, [
    { id: 'set-a', exercise: 'bicep_curl', reps: 7, source: 'counter-core', createdAt: now - 60000, machineResult: { reps: 7 }, correctedResult: null },
    { id: 'set-b', exercise: 'lateral_raise', reps: 12, corrected: true, source: 'counter-core', createdAt: now, machineResult: { reps: 8 }, correctedResult: { reps: 12 } },
  ]);
  await page.reload();
  await page.locator('button, a').filter({ hasText: /Vos séries/ }).first().click();
  const keep = page.getByTestId('keep-sets');
  await expect(keep).toBeVisible();

  // The backup: one file holding both sets as stored.
  const [download] = await Promise.all([page.waitForEvent('download'), keep.getByRole('button', { name: 'Sauvegarder vos séries' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^workout-vision-series-\d{4}-\d{2}-\d{2}\.json$/);
  const file = info.outputPath('backup.json');
  await download.saveAs(file);
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  expect(backup.sets.map(w => w.id).sort()).toEqual(['set-a', 'set-b']);
  expect(backup.sets.find(w => w.id === 'set-b').machineResult.reps).toBe(8);

  // One set lost; the backup puts back that one and says the other was already here.
  await remove(page, 'set-b');
  // A fresh page, so the sets are read again from storage (the app keeps them in memory once read).
  await page.goto('about:blank');
  await page.goto('/workout-vision/');
  await page.locator('button, a').filter({ hasText: /Vos séries/ }).first().click();
  await expect(page.locator('.hist-btn')).toHaveCount(1);
  await page.getByTestId('keep-sets').locator('input[type="file"]').setInputFiles(file);
  await expect(page.getByTestId('keep-sets').locator('[role="status"]')).toHaveText('1 série restaurée. 1 était déjà sur ce téléphone.');
  await expect(page.locator('.hist-btn')).toHaveCount(2);
  await expect(page.locator('.hist-btn', { hasText: 'Corrigé' })).toHaveCount(1);

  // A file that is not a backup is refused, and nothing changes.
  const other = info.outputPath('other.json');
  writeFileSync(other, JSON.stringify({ hello: 'world' }));
  await page.getByTestId('keep-sets').locator('input[type="file"]').setInputFiles(other);
  await expect(page.getByTestId('keep-sets').locator('[role="status"]')).toHaveText('Ce fichier n’est pas une sauvegarde de vos séries.');
  await expect(page.locator('.hist-btn')).toHaveCount(2);
  expect(errors).toEqual([]);
});
