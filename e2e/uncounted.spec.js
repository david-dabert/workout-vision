// R8, 3 October 2026: a set the app counted no rep in (not refused) is saved as the person's count, with the app's 0
// kept apart as a correction (Result.jsx, unsure; saved-set.js). No e2e here can make the counter return 0 without a
// real clip and the pose model, so the result screen is tested at the component level
// (src/components/experience/__tests__/result-uncounted.test.jsx); this spec seeds the set as the screen saves it
// and checks that the history, the report and the spreadsheet say the app counted none, with no measure.
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 664 } });

async function seeded(page) {
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  // The record saved-set.js writes for a set the app counted 0 and the person corrected to 8.
  const set = { id: 'uncounted', exercise: 'bicep_curl', reps: 8, repDetails: [], arm: 'right', confidence: 0.4, date: new Date().toISOString(), createdAt: Date.now(),
    source: 'counter-core', duration: 20, corrected: true, sides: null, machineResult: { reps: 0, confidence: 0.4 }, correctedResult: { reps: 8 },
    repDetailsVersion: 2, wave: { t: [0, 0.1, 0.2], a: [150, 151, 150] } };
  await page.evaluate(set => new Promise((resolve, reject) => {
    const request = indexedDB.open('workoutVision');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('workouts', 'readwrite');
      tx.objectStore('workouts').put(set, set.id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), set);
  await page.reload();
  await page.getByRole('button', { name: /Vos séries/ }).click();
  await expect(page.locator('.hist-btn')).toHaveCount(1);
}

test('a set the app counted none in is a correction in the history, the report and the spreadsheet', async ({ page }) => {
  await seeded(page);
  await expect(page.locator('.hist-btn')).toContainText('Corrigé');
  await page.locator('.hist-btn').click();
  await expect(page.locator('.hist-corr')).toHaveText('Compté par l’app : 0. Corrigé : 8.');
  // The spreadsheet: 8 reps, 0 counted by the app, corrected, and no measure.
  const got = [];
  page.on('download', d => got.push(d));
  await page.getByRole('button', { name: 'Exporter vos séries' }).click();
  await expect.poll(() => got.length).toBe(1);
  const rows = (await readFile(await got[0].path())).toString('utf8').slice(1).split('\r\n').filter(Boolean);
  const row = rows[1].split(rows[0].includes(';') ? ';' : ',');
  expect(row.slice(2, 5)).toEqual(['8', '0', 'oui']);
  expect(row.slice(8).every(v => v === '')).toBe(true);
  // The report: the person's count, the app's 0 beside it, no wave of reps.
  await page.locator('.hist-detail .btn-line').click();
  await expect(page.locator('.sheet')).toBeVisible();
  await expect(page.locator('.sh-opener')).toHaveText('Vous avez compté 8 répétitions.');
  await expect(page.locator('.sh-details > span')).toHaveText([/Compté par l’app\s*0/, /Corrigé\s*8/, /Bras suivi/]);
  await expect(page.getByTestId('sh-wave')).toHaveCount(0);
});
