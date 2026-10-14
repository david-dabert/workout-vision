// An exercise the counter does not offer (counting research of 14 October 2026): the guide lists it as "Non compté", and
// filming it never gives a counted result. Read by the universal engine (src/lib/universalProposal.js), the set is
// refused; its number is offered as one key, "Proposition de l'appli", under an empty slot when the joints it needs were
// seen on at least half the samples, and nothing is shown when they were not. A hold gets no slot at all. No numeral of a
// counted set, no measure, no grade (R8; second round of the honesty pass, 14 October 2026).
// The pose worker answers with David's real biceps curl landmarks (e2e/shared/filmed-set.js), or with them all unseen.
import { test, expect } from '@playwright/test';
import { start, chooseDrawnVideo, fakeWorker, workerOf } from './shared/filmed-set.js';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

const BASE = '/workout-vision/';

async function filmFromGuide(page, query) {
  await page.goto(BASE);
  await page.getByRole('button', { name: /Un autre exercice/ }).click({ timeout: 20000 });
  await page.locator('#guide-search').fill(query);
  const item = page.locator('.list .item').first();
  await expect(item.locator('.tag')).toHaveText('Non compté');
  await item.locator('.item-btn').click();
  await expect(item.locator('.guide-detail')).toContainText('Pas encore compté par l’appli');
  await item.getByRole('button', { name: 'Filmer cet exercice' }).click();
  await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20000 });
}

test('a non-offered exercise read clearly gives a proposal to confirm, never a counted result', async ({ page }) => {
  test.setTimeout(120_000);
  await start(page, { worker: fakeWorker });
  await filmFromGuide(page, 'kickback');
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.res-low-title')).toHaveText('L’appli ne compte pas encore cet exercice.');
  await expect(page.getByText('Elle propose un nombre à vérifier.')).toBeVisible();
  // The slot opens empty; the app's number is one key, taken by a tap, then confirmed.
  await expect(page.getByTestId('res-empty')).toBeVisible();
  await expect(page.getByTestId('res-save')).toBeDisabled();
  const key = page.getByTestId('res-proposal-key').getByRole('button');
  await expect(key).toContainText('Proposition de l’appli');
  const n = Number((await key.locator('.res-cand-n').textContent()).trim());
  expect(n).toBeGreaterThan(0);
  await key.click();
  await expect(page.getByTestId('res-typed')).toHaveText(String(n));
  await expect(page.getByTestId('res-save')).toHaveText(`Confirmer ${n} ${n > 1 ? 'répétitions' : 'répétition'}`);
  for (const id of ['res-numeral', 'res-yes', 'res-proposal-note', 'res-exp', 'set-account', 'level-table', 'res-sides']) await expect(page.getByTestId(id)).toHaveCount(0);
});

test('a hold the app does not time offers no number and no slot, only a way back to the exercises', async ({ page }) => {
  test.setTimeout(120_000);
  await start(page, { worker: fakeWorker });
  await filmFromGuide(page, 'Planche');
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('res-status')).toContainText('Non compté');
  await expect(page.getByText('Elle ne mesure pas encore le temps de maintien.')).toBeVisible();
  await expect(page.getByTestId('change-lift')).toBeVisible();
  for (const id of ['res-empty', 'res-save', 'res-proposal-key', 'res-dock', 'report-count']) await expect(page.getByTestId(id)).toHaveCount(0);
  await expect(page.getByText('Combien en avez-vous fait')).toHaveCount(0);
});

test('a non-offered exercise whose joints were mostly unseen gives no number at all', async ({ page }) => {
  test.setTimeout(120_000);
  // The curl's landmarks, every one below the 0.5 visibility floor on every sample (a body found, never clearly seen):
  // whatever signal the universal engine picks, its landmarks are seen on none of the samples.
  const clip = JSON.parse(gunzipSync(readFileSync(resolve('test/real-phone/landmarks/bicep_curl_7_side_mufhf3wy.json.gz'))));
  const hide = f => f && f.map(p => ({ ...p, visibility: 0.1 }));
  const frames = clip.timestamps.map((_, k) => ({ image: hide(clip.imageLandmarks[k]), world: hide(clip.worldLandmarks[k]) }));
  await start(page, { worker: workerOf(frames) });
  await filmFromGuide(page, 'kickback');
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60000 });
  await expect(page.getByText('Le mouvement n’était pas assez visible pour proposer un nombre.')).toBeVisible();
  await expect(page.getByTestId('res-proposal')).toHaveCount(0);
  await expect(page.getByTestId('res-empty')).toBeVisible();
  await expect(page.getByTestId('res-save')).toBeDisabled();
});
