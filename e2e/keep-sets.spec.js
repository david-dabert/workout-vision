// Keeping the sets (keep-sets.js, KeepSets.jsx): the history saves every set into one backup file and puts
// back, from that file, only the sets this phone lost; a file that is not a backup is refused.
import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

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
  // The subtitle says what is true beside a way to share the sets: they leave the phone only when shared.
  await expect(page.locator('.history-screen .sub')).toContainText('Enregistrées sur ce téléphone, elles n’en sortent que si vous les partagez.');
  // Not an iPhone: no word on Safari's deletion.
  await expect(page.getByTestId('keep-why')).toHaveCount(0);

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

// Shared helpers for the two tests below: two saved sets, the history opened.
async function openHistory(page) {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => { if (!location.protocol.startsWith('http')) return; localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  await put(page, [{ id: 'set-a', exercise: 'bicep_curl', reps: 7, source: 'counter-core', createdAt: Date.now(), machineResult: { reps: 7 }, correctedResult: null }]);
  await page.reload();
  await page.locator('button, a').filter({ hasText: /Vos séries/ }).first().click();
  await expect(page.getByTestId('keep-sets')).toBeVisible();
}

test.describe('on an iPhone outside the home screen', () => {
  test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  test('the history says why a backup matters', async ({ page }) => {
    await openHistory(page);
    await expect(page.getByTestId('keep-why')).toHaveText('Sur iPhone, Safari peut effacer vos séries après sept jours d’utilisation sans ouvrir l’app. Ajoutez-la à l’écran d’accueil, ou gardez une sauvegarde.');
  });
});

test('after a share that fails, the next tap downloads at once', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.canShare = () => true;
    navigator.share = () => Promise.reject(Object.assign(new Error('refused'), { name: 'NotAllowedError' }));
  });
  await openHistory(page);
  const save = page.getByTestId('keep-sets').getByRole('button', { name: 'Sauvegarder vos séries' });
  await save.click();
  await expect(page.getByTestId('keep-sets').locator('[role="status"]')).toHaveText('Le partage n’a pas abouti. Touchez à nouveau pour télécharger.');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), save.click()]);
  expect(download.suggestedFilename()).toMatch(/^workout-vision-series-/);
});

// A phone with no set, after Safari erased them or on a new phone, is when a backup is needed: the history,
// and its restore, are reached from the choice of lift all the same (audit of 2 October).
test('with no set on the phone, the backup can still be restored from the first screen', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => { if (!location.protocol.startsWith('http')) return; localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  const row = page.getByRole('button', { name: /Vos séries/ });
  await expect(row).toContainText('Restaurer une sauvegarde');
  await row.click();
  await expect(page.getByTestId('keep-sets').locator('input[type="file"]')).toHaveCount(1);
});
