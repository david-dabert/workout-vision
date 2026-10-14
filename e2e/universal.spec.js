// An exercise the counter does not offer (counting research of 14 October 2026): the guide lists it as "Non compté", and
// filming it never gives a counted result. Read by the universal engine (src/lib/universalProposal.js), the set is
// refused; its number is offered as "Proposition de l'appli" to confirm when the joints it needs were seen on at least
// half the samples, and nothing is shown when they were not. No numeral of a counted set, no measure, no grade (R8).
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
  await expect(page.getByTestId('res-proposal')).toContainText('Proposition de l’appli');
  await expect(page.getByText('L’appli ne compte pas encore cet exercice.')).toBeVisible();
  await expect(page.getByTestId('res-proposal-note')).toHaveText('Ce nombre n’est pas un comptage validé. Vérifiez-le avant d’enregistrer.');
  await expect(page.getByTestId('res-numeral')).toHaveCount(0);
  await expect(page.getByTestId('res-yes')).toHaveCount(0);
  for (const id of ['res-exp', 'set-account', 'level-table', 'res-sides']) await expect(page.getByTestId(id)).toHaveCount(0);
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
