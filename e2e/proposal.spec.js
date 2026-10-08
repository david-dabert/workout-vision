// A refused set with the app's proposal (8 October 2026, delegated decision of David, R8): where the core refuses a
// set, PSC's count (src/lib/counting/psc.js, coreAnalysis.js withProposal) is offered on the low-confidence screen as a
// number to confirm. Nothing is saved before the person confirms or changes it; no grade, no measure.
// The set: a synthetic render of a biceps curl with a plate hiding the arm (test/real-phone/occlusion/sets/
// michelle-bicep_curl-v90-plate, 6 reps by construction), which the core refuses and PSC counts 6 on the bench. Its
// render keeps world landmarks only; the image landmarks the app reads are the world ones moved into the picture.
// WV_SHOTS=<folder> writes the proposal screen there (390 x 844 at 3x).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { start, openFilm, chooseDrawnVideo, workerOf } from './shared/filmed-set.js';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

const BASE = '/workout-vision/';
const set = JSON.parse(gunzipSync(readFileSync(resolve('test/real-phone/occlusion/sets/michelle-bicep_curl-v90-plate.json.gz'))));
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

async function refusedWithProposal(page) {
  const errors = await start(page, { worker: workerOf(frames), init: () => window.addEventListener('wv:core-result', e => { window.__coreOutput = e.detail; }) });
  await openFilm(page, BASE);
  await chooseDrawnVideo(page, seconds);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 90000 });
  const out = await page.evaluate(() => ({ refused: window.__coreOutput.refused, proposal: window.__coreOutput.proposal?.count ?? null, ms: window.__coreOutput.proposal?.ms ?? null, n: window.__coreOutput.timestamps.length }));
  expect(out.refused).toBe(true);
  expect(out.proposal).toBe(6);
  return { errors, out };
}

test('a refused set shows the app’s proposal, saved only once confirmed', async ({ page }, info) => {
  test.setTimeout(150000);
  const { errors, out } = await refusedWithProposal(page);
  info.annotations.push({ type: 'psc', description: `${out.n} samples, proposal ${out.proposal} in ${out.ms} ms` });
  console.log(`[proposal] ${out.n} samples, PSC ${out.proposal} in ${out.ms} ms (Chromium, this machine)`);
  // The proposal, labelled, in the slot; no numeral of a counted set, no measure, no grade.
  await expect(page.getByTestId('res-proposal')).toHaveText('Proposition de l’appli : 6');
  await expect(page.getByTestId('res-typed')).toHaveText('6');
  await expect(page.getByTestId('res-proposal-note')).toBeVisible();
  await expect(page.locator('.res-low-title')).toHaveText('L’appli n’a pas pu compter cette série avec certitude.');
  await expect(page.getByTestId('res-status')).toContainText('À confirmer');
  await expect(page.getByTestId('res-numeral')).toHaveCount(0);
  await expect(page.locator('[data-testid="res-sides"], [data-testid="res-exp"], [data-testid="set-account"], .res-wave, .bars')).toHaveCount(0);
  const confirm = page.getByTestId('res-save');
  await expect(confirm).toHaveText('Confirmer 6 répétitions');
  await expect(confirm).toBeEnabled();
  if (process.env.WV_SHOTS) await page.screenshot({ path: resolve(process.env.WV_SHOTS, 'proposal-fr-390x844@3x.png') });
  // Nothing is saved before the tap.
  await page.waitForTimeout(500);
  expect(await savedSets(page)).toEqual([]);
  await confirm.click();
  await expect(page.getByTestId('saved-card')).toContainText('Merci. 6 répétitions enregistrées, confirmées par vous.');
  const saved = await savedSets(page);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ reps: 6, source: 'manual', afterRefusal: true, machineResult: null, proposal: { reps: 6, by: 'psc' }, repDetails: [], wave: null });
  expect(errors).toEqual([]);
});

test('a proposal changed with + is the person’s count', async ({ page }) => {
  test.setTimeout(150000);
  await refusedWithProposal(page);
  await page.getByRole('button', { name: 'Une de plus' }).click();
  await expect(page.getByTestId('res-typed')).toHaveText('7');
  await expect(page.getByText('Saisi par vous')).toBeVisible();
  await expect(page.getByTestId('res-proposal')).toHaveText('Proposition de l’appli : 6');
  await expect(page.getByTestId('res-save')).toHaveText('Enregistrer 7 répétitions');
  expect(await savedSets(page)).toEqual([]);
  await page.getByTestId('res-save').click();
  await expect(page.getByTestId('saved-card')).toContainText('7 répétitions enregistrées, saisies à la main.');
  const saved = await savedSets(page);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ reps: 7, source: 'manual', proposal: { reps: 6, by: 'psc' } });
});
