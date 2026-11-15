import { test, expect } from '@playwright/test';
import { start, openFilm, chooseDrawnVideo } from './shared/filmed-set.js';
import { layoutFaults } from '../test/real-phone/checks.mjs';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, locale: 'fr-FR', reducedMotion: 'reduce' });
const BASE = '/workout-vision/';
const keepFault = f => !f.startsWith('note: ') && !/^text (runs out of its box: "0"|overlaps text: "0" and (":"|"0"))$/.test(f);

async function setCountTo(page, target) {
  const current = Number(await page.getByTestId('res-numeral').textContent());
  const stepBtn = target > current ? 'Une de plus' : 'Une de moins';
  for (let i = 0; i < Math.abs(target - current); i++) {
    await page.getByRole('button', { name: stepBtn }).click();
  }
  await expect(page.getByTestId('res-numeral')).toHaveText(String(target));
}

async function seedWeightedCurl(page, id, reps, weight) {
  await page.goto(BASE);
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  await page.evaluate(({ id, reps, weight }) => new Promise((ok, ko) => {
    const r = indexedDB.open('workoutVision');
    r.onerror = () => ko(r.error);
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction('workouts', 'readwrite');
      tx.objectStore('workouts').put({
        id, exercise: 'bicep_curl', reps, weight, corrected: false, source: 'counter-core', createdAt: Date.now() - 3600_000,
      }, id);
      tx.oncomplete = () => { db.close(); ok(); };
      tx.onerror = () => ko(tx.error);
    };
  }), { id, reps, weight });
}

test('card 033: saved set with load shows double-progression goal line, without load keeps card 011', async ({ page }, testInfo) => {
  test.setTimeout(150000);
  const errors = await start(page);
  await openFilm(page, BASE);
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('moment')).toHaveCount(0);

  await setCountTo(page, 9);
  const saveBtn = page.getByTestId('res-save');
  if (await saveBtn.count()) await saveBtn.click();
  else await page.getByTestId('res-yes').click();

  await expect(page.getByTestId('saved-card')).toBeVisible();
  await expect(page.getByTestId('moment')).toHaveText('Première série enregistrée. C’est parti.');

  await page.getByTestId('saved-load-input').fill('60');
  await page.getByTestId('saved-load-save').click();
  await expect(page.getByTestId('moment')).toHaveText('Objectif\u00A0: 10 répétitions à 60\u00A0kg');
  await page.getByTestId('moment').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: testInfo.outputPath('goal-same-load.png') });
  expect((await page.evaluate(layoutFaults)).filter(keepFault)).toEqual([]);
  expect(errors).toEqual([]);
});

test('card 033: 12 reps at 60 kg suggests 8 reps at 62,5 kg; without load keeps card 011 record line', async ({ page }, testInfo) => {
  test.setTimeout(150000);
  const errors = await start(page);
  await seedWeightedCurl(page, 'prior-12-at-60', 12, 60);

  await openFilm(page, BASE);
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60000 });

  await setCountTo(page, 10);
  const saveBtn = page.getByTestId('res-save');
  if (await saveBtn.count()) await saveBtn.click();
  else await page.getByTestId('res-yes').click();

  await expect(page.getByTestId('saved-card')).toBeVisible();
  await expect(page.getByTestId('moment')).toHaveText('Votre record\u00A0: 12. À battre à la prochaine série.');

  await page.getByTestId('saved-load-input').fill('60');
  await page.getByTestId('saved-load-save').click();
  await expect(page.getByTestId('moment')).toHaveText('Objectif\u00A0: 8 répétitions à 62,5\u00A0kg');
  await page.getByTestId('moment').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: testInfo.outputPath('goal-step-up.png') });
  expect((await page.evaluate(layoutFaults)).filter(keepFault)).toEqual([]);
  expect(errors).toEqual([]);
});

test('card 033: no goal line on a refused set even after saving load (R8)', async ({ page }) => {
  test.setTimeout(150000);
  const errors = await start(page, { nobody: true });
  await seedWeightedCurl(page, 'prior-9-at-60', 9, 60);

  await openFilm(page, BASE);
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60000 });

  const fixCard = page.getByTestId('fix-card');
  for (let i = 0; i < 9; i++) await fixCard.getByRole('button', { name: 'Une de plus' }).click();
  await page.getByTestId('res-save').click();
  await expect(page.getByTestId('saved-card')).toBeVisible();
  await expect(page.getByTestId('moment')).toHaveCount(0);

  await page.getByTestId('saved-load-input').fill('60');
  await page.getByTestId('saved-load-save').click();
  await expect(page.getByTestId('saved-load-status')).toContainText('60');
  await expect(page.getByTestId('moment')).toHaveCount(0);
  expect(errors).toEqual([]);
});
