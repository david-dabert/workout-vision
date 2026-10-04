// The history's export (Chromium copy of history.spec.js's seeding): the saved sets leave as two
// spreadsheet files, each measure heading marked experimental while none is validated (measures.js), handed to the share sheet where it takes files, else downloaded; in French with
// semicolons and decimal commas; and the action overlaps nothing on the small screens.
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { layoutFaults } from '../test/real-phone/checks.mjs';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block' });

const LABEL = { fr: 'Exporter vos séries', en: 'Export your sets' };
const rep = (index, startTime, conc, ecc, rom) => ({ index, startTime, endTime: startTime + conc + ecc, concentricSec: conc, eccentricSec: ecc, romDegrees: rom, peakSpeed: 200, meanSpeed: 100 });

async function seeded(page, lang) {
  await page.addInitScript(lang => {
    localStorage.setItem('wv_seen_entry', 'true');
    localStorage.setItem('wv_lang', lang);
  }, lang);
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  const now = Date.now();
  const sets = [
    { id: 'curl', exercise: 'bicep_curl', reps: 5, source: 'counter-core', duration: 18.4, corrected: true, createdAt: now - 60000,
      machineResult: { reps: 4, confidence: 0.9 }, correctedResult: { reps: 5 }, repDetailsVersion: 2,
      repDetails: [rep(1, 0, 1, 1.4, 118.2), rep(2, 3, 1.1, 1.5, 116), rep(3, 6, 1.3, 1.5, 115), rep(4, 9, 1.5, 1.6, 112), rep(5, 12, 1.6, 1.7, 110)] },
    { id: 'squat', exercise: 'squat', reps: 8, source: 'manual', weight: 62.5, duration: 0, createdAt: now - 3600000,
      machineResult: { reps: 8, confidence: null }, correctedResult: null },
  ];
  await page.evaluate(sets => new Promise((resolve, reject) => {
    const request = indexedDB.open('workoutVision');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('workouts', 'readwrite');
      for (const s of sets) tx.objectStore('workouts').put(s, s.id);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }), sets);
  await page.reload();
  await page.getByRole('button', { name: lang === 'fr' ? /Vos séries/ : /Your sets/ }).click();
  await expect(page.locator('.hist-btn')).toHaveCount(2);
}

// A French phone: the file's separator and decimal mark follow the phone's locale (review, 30 September).
test.describe('on a French phone', () => {
test.use({ locale: 'fr-FR' });
test('without a share sheet for files, the export downloads the sets and the reps (fr)', async ({ page }) => {
  await seeded(page, 'fr');
  const got = [];
  page.on('download', d => got.push(d));
  await page.getByRole('button', { name: LABEL.fr }).click();
  await expect.poll(() => got.length).toBe(2);
  const files = Object.fromEntries(await Promise.all(got.map(async d => [d.suggestedFilename(), await readFile(await d.path())])));
  const names = Object.keys(files).sort();
  expect(names[0]).toMatch(/^repetitions-\d{4}-\d\d-\d\d\.csv$/);
  expect(names[1]).toMatch(/^series-\d{4}-\d\d-\d\d\.csv$/);
  const sets = files[names[1]], reps = files[names[0]];
  // UTF-8 with its byte order mark.
  expect([...sets.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const setRows = sets.toString('utf8').slice(1).split('\r\n').filter(Boolean);
  expect(setRows[0]).toBe('Date;Exercice;Répétitions;Comptées par l’app;Corrigée;Confirmée;Charge (kg);Durée (s);Tempo moyen (mesure expérimentale)');
  // Oldest first: the squat entered by hand, then the corrected curl.
  expect(setRows[1].split(';').slice(1, 8)).toEqual(['Squat', '8', '', '', 'oui', '62,5', '']);
  expect(setRows[2].split(';').slice(1, 8)).toEqual(['Curl biceps', '5', '4', 'oui', 'oui', '', '18,4']);
  const repRows = reps.toString('utf8').slice(1).split('\r\n').filter(Boolean);
  expect(repRows).toHaveLength(6);
  // The curl was corrected (4 counted, 5 kept): its rows are the marks the app detected, named as the report names them (third audit C12).
  expect(repRows[1].split(';').slice(1)).toEqual(['Curl biceps', 'Repère 1', '118', '1,0', '1,4', '200', '100', 'non']);
  // The app cannot know what the browser saved; it says what it did (review, 30 September).
  await expect(page.getByRole('status').filter({ hasText: 'Téléchargement lancé\u00A0: vos séries et le détail des répétitions.' })).toBeVisible();
});
});

test('with a share sheet for files, the export shares both files inside the tap and downloads nothing (en)', async ({ page }) => {
  await page.addInitScript(() => {
    window.__shared = null;
    navigator.canShare = data => Array.isArray(data?.files) && data.files.every(f => f instanceof File);
    navigator.share = async data => {
      if (!navigator.userActivation.isActive) throw new DOMException('no gesture', 'NotAllowedError');
      window.__shared = await Promise.all(data.files.map(async f => ({ name: f.name, type: f.type, text: await f.text() })));
    };
  });
  await seeded(page, 'en');
  let downloads = 0;
  page.on('download', () => { downloads += 1; });
  await page.getByRole('button', { name: LABEL.en }).click();
  await expect.poll(() => page.evaluate(() => window.__shared)).not.toBeNull();
  const shared = await page.evaluate(() => window.__shared);
  expect(shared.map(f => f.name)).toEqual([expect.stringMatching(/^sets-\d{4}-\d\d-\d\d\.csv$/), expect.stringMatching(/^reps-\d{4}-\d\d-\d\d\.csv$/)]);
  expect(shared[1].text.split('\r\n').filter(Boolean)).toHaveLength(6);
  expect(shared.every(f => f.type === 'text/csv')).toBe(true);
  const rows = shared[0].text.replace('﻿', '').split('\r\n').filter(Boolean);
  expect(rows[0]).toBe('Date,Exercise,Reps,Counted by the app,Corrected,Confirmed,Load (kg),Duration (s),Average tempo (experimental measure)');
  expect(rows[1].split(',').slice(1, 7)).toEqual(['Squat', '8', '', '', 'yes', '62.5']);
  await page.waitForTimeout(500);
  expect(downloads).toBe(0);
});

// Review, 30 September: a double tap saves each file once.
test('a double tap downloads each file once (fr)', async ({ page }) => {
  await seeded(page, 'fr');
  const got = [];
  page.on('download', d => got.push(d.suggestedFilename()));
  await page.getByRole('button', { name: LABEL.fr }).dblclick();
  await expect.poll(() => got.length).toBe(2);
  await page.waitForTimeout(1200);
  expect(got).toHaveLength(2);
});

// Review, 30 September: a share sheet that never answers (the app sent to the background) does not
// freeze the button; WebKit refuses a second share while one is open, and the next tap downloads.
test('a share that never settles leaves the next tap a way to the files (en)', async ({ page }) => {
  await page.addInitScript(() => {
    let open = false;
    navigator.canShare = data => Array.isArray(data?.files);
    navigator.share = () => { if (open) return Promise.reject(new DOMException('busy', 'InvalidStateError')); open = true; return new Promise(() => {}); };
  });
  await seeded(page, 'en');
  const got = [];
  page.on('download', d => got.push(d.suggestedFilename()));
  const button = page.getByRole('button', { name: LABEL.en });
  await button.click();
  await button.click();
  await expect(page.getByRole('status').filter({ hasText: 'Tap again' })).toBeVisible();
  await button.click();
  await expect.poll(() => got.length).toBe(2);
});

for (const size of [{ width: 390, height: 664 }, { width: 375, height: 548 }]) {
  for (const lang of ['fr', 'en']) {
    test(`the export action overlaps nothing at ${size.width}x${size.height} (${lang})`, async ({ browser }, info) => {
      const context = await browser.newContext({ viewport: size, serviceWorkers: 'block' });
      const page = await context.newPage();
      await seeded(page, lang);
      const button = page.getByRole('button', { name: LABEL[lang] });
      // Since 2 October the data actions follow the sets, so the first set stays in view (tour, rule 6): the
      // export is scrolled to, then checked where it stands.
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport();
      await page.waitForTimeout(1200); // the reveal has settled
      const box = await button.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(size.width);
      const faults = (await page.evaluate(layoutFaults)).filter(f => !f.startsWith('note: '));
      expect(faults).toEqual([]);
      await page.screenshot({ path: info.outputPath(`history-export-${size.width}x${size.height}-${lang}.png`) });
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/history-export-${size.width}x${size.height}-${lang}.png` });
      await context.close();
    });
  }
}
