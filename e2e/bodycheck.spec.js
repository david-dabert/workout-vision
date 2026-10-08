// A counted set the body check flags (8 October 2026, R8): the counted joint disagrees with the rest of the body
// (src/lib/counting/bodyCheck.js, coreAnalysis.js withBodyCheck), so the low-confidence screen shows the app's count
// as one to confirm, with no grade and no measure (neither before the save nor after it), and the spec-guided count
// beside it. Nothing is saved before the person confirms one of them or gives their own.
// The set: a synthetic render of a biceps curl (test/real-phone/synth/sets/soldier-bicep_curl-v60-a20, 8 reps by
// construction) whose elbow the pose model reads at twice the arm's rhythm: the core counts 15, the body check flags it
// (agreement -0.18) and the spec-guided count reads 8. Its render keeps world landmarks only; the image landmarks the
// app reads are the world ones moved into the picture, as e2e/proposal.spec.js does.
// WV_SHOTS=<folder> writes the flagged screen there (390 x 844 at 3x).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { start, openFilm, chooseDrawnVideo, workerOf } from './shared/filmed-set.js';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

const BASE = '/workout-vision/';
const set = JSON.parse(gunzipSync(readFileSync(resolve('test/real-phone/synth/sets/soldier-bicep_curl-v60-a20.json.gz'))));
const frames = set.worldLandmarks.map(w => ({ world: w, image: w && w.map(p => ({ x: p.x + 0.5, y: p.y + 0.5, z: p.z, visibility: p.visibility })) }));
const seconds = Math.ceil(set.timestamps.at(-1)) + 1;

const savedSets = page => page.evaluate(() => new Promise(done => {
  const request = indexedDB.open('workoutVision');
  request.onerror = () => done([]);
  request.onsuccess = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains('workouts')) { db.close(); done([]); return; }
    const all = db.transaction('workouts').objectStore('workouts').getAll();
    all.onsuccess = () => { db.close(); done(all.result); };
    all.onerror = () => { db.close(); done([]); };
  };
}));

async function flaggedSet(page) {
  const errors = await start(page, { worker: workerOf(frames), init: () => window.addEventListener('wv:core-result', e => { window.__coreOutput = e.detail; }) });
  await openFilm(page, BASE);
  await chooseDrawnVideo(page, seconds);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 90000 });
  const out = await page.evaluate(() => ({ refused: window.__coreOutput.refused, count: window.__coreOutput.count, check: window.__coreOutput.bodyCheck, proposal: window.__coreOutput.proposal ?? null, n: window.__coreOutput.timestamps.length }));
  expect(out.refused).toBe(false);
  expect(out.count).toBe(15);
  expect(out.check.flagged).toBe(true);
  expect(out.check.second.count).toBe(8);
  expect(out.proposal).toBeNull();
  return { errors, out };
}

test('a flagged set shows its count to confirm and the body’s count, no grade, saved only once confirmed', async ({ page }, info) => {
  test.setTimeout(150000);
  const { errors, out } = await flaggedSet(page);
  info.annotations.push({ type: 'body-check', description: `${out.n} samples, agreement ${out.check.agreement}, second ${out.check.second.count}, ${out.check.ms} ms` });
  console.log(`[body-check] ${out.n} samples, agreement ${out.check.agreement}, core 15, second ${out.check.second.count}, ${out.check.ms} ms (Chromium, this machine)`);
  await expect(page.locator('.res-low-title')).toHaveText('L’appli n’a pas pu compter cette série avec certitude.');
  await expect(page.locator('.res-cause')).toContainText('Sur cette série, l’angle du coude ne bouge pas comme le reste de votre corps. L’appli a pu mal le lire.');
  // The app's count in the slot, to confirm; the two counts as keys, each saying where it comes from.
  await expect(page.getByTestId('res-typed')).toHaveText('15');
  await expect(page.getByTestId('res-candidates')).toHaveAttribute('aria-label', 'Deux comptes possibles');
  await expect(page.getByTestId('res-cand-joint')).toHaveText('15D’après le coude');
  await expect(page.getByTestId('res-cand-joint')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('res-cand-body')).toHaveText('8D’après tout le corps');
  await expect(page.getByTestId('res-cand-body')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('res-body-note')).toHaveText('Vérifiez ce nombre avant d’enregistrer.');
  await expect(page.getByTestId('res-status')).toContainText('À confirmer');
  // No numeral of a counted set, no measure, no grade.
  await expect(page.getByTestId('res-numeral')).toHaveCount(0);
  await expect(page.locator('[data-testid="res-sides"], [data-testid="res-exp"], [data-testid="set-account"], .res-wave, .bars')).toHaveCount(0);
  await expect(page.getByTestId('res-save')).toHaveText('Confirmer 15 répétitions');
  if (process.env.WV_SHOTS) await page.screenshot({ path: resolve(process.env.WV_SHOTS, 'bodycheck-fr-390x844@3x.png') });
  // The body's count, chosen.
  await page.getByTestId('res-cand-body').click();
  await expect(page.getByTestId('res-typed')).toHaveText('8');
  await expect(page.getByTestId('res-cand-body')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('res-save')).toHaveText('Confirmer 8 répétitions');
  await expect(page.getByTestId('res-status')).toContainText('À confirmer');
  // Nothing is saved before the tap.
  await page.waitForTimeout(500);
  expect(await savedSets(page)).toEqual([]);
  await page.getByTestId('res-save').click();
  await expect(page.getByTestId('saved-card')).toContainText('Compté par l’app : 15. Corrigé : 8.'); // the counted set's saved card, as it stands (it says "l’app")
  const saved = await savedSets(page);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ reps: 8, source: 'counter-core', corrected: true, machineResult: { reps: 15 }, correctedResult: { reps: 8 }, bodyCheck: { second: 8 }, repDetails: [], sides: null, wave: null });
  expect(saved[0].bodyCheck.agreement).toBeLessThan(0.5);
  // Saved, still no measure: they are all read on the joint the check doubts (R8).
  await expect(page.locator('[data-testid="res-sides"], [data-testid="res-exp"], [data-testid="set-account"], [data-testid="level-table"], .res-wave, .bars')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the app’s count confirmed as it stands is saved as confirmed', async ({ page }) => {
  test.setTimeout(150000);
  await flaggedSet(page);
  await page.getByTestId('res-save').click();
  await expect(page.getByTestId('saved-card')).toContainText('Merci. Série enregistrée sur votre téléphone.');
  const saved = await savedSets(page);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ reps: 15, source: 'counter-core', corrected: false, machineResult: { reps: 15 }, correctedResult: null, bodyCheck: { second: 8 }, repDetails: [], sides: null, wave: null });
  await expect(page.locator('[data-testid="res-sides"], [data-testid="res-exp"], [data-testid="set-account"], [data-testid="level-table"], .res-wave, .bars')).toHaveCount(0);
});

test('a number given with + is the person’s count', async ({ page }) => {
  test.setTimeout(150000);
  await flaggedSet(page);
  await page.getByRole('button', { name: 'Une de plus' }).click();
  await expect(page.getByTestId('res-typed')).toHaveText('16');
  await expect(page.getByText('Saisi par vous')).toBeVisible();
  await expect(page.getByTestId('res-status')).toContainText('À vous de compter');
  await expect(page.getByTestId('res-cand-joint')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('res-save')).toHaveText('Enregistrer 16 répétitions');
  expect(await savedSets(page)).toEqual([]);
  await page.getByTestId('res-save').click();
  const saved = await savedSets(page);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ reps: 16, corrected: true, machineResult: { reps: 15 }, correctedResult: { reps: 16 } });
});
