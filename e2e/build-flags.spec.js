// The build flags (src/lib/buildFlags.js; WP0.3, WP0.4 of docs/SPEC-production.md). Production is built with VITE_LIVE
// unset and, since 13 November 2026 (David: "Build both"), VITE_CONTRIBUTE on (deploy.yml): the Film screen offers no
// live counting; after the first saved set the card asks once to help, nothing is kept before a yes, and a yes keeps
// each new set on the phone, ready to send from the history. The paused path (a build without the flag) is held by
// src/components/experience/__tests__/contribute-paused.test.jsx. The production build is served on port 4176
// (playwright.config.js); the build the other specs test, with both flags on, on port 4173.
//
// A set is reached on the video path, as a person films one: a video drawn in the page (MediaRecorder, its duration
// written in, as the phone's camera does), and a pose worker that answers each sample with the landmarks of David's
// real biceps curl set (test/real-phone/landmarks, as contribute-ask.spec.js does for live counting).
import { test, expect } from '@playwright/test';
import { start, openFilm, saveSet, openHistory } from './shared/filmed-set.js';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

const PROD = 'http://localhost:4176/workout-vision/';
const FLAGS_ON = 'http://localhost:4173/workout-vision/';

const idb = (page, f, arg) => page.evaluate(([f, arg]) => new Promise((ok, ko) => {
  const r = indexedDB.open('workoutVision');
  r.onerror = () => ko(r.error);
  r.onsuccess = () => {
    const db = r.result;
    // eslint-disable-next-line no-new-func
    new Function('db', 'arg', 'ok', 'ko', f)(db, arg, v => { db.close(); ok(v); }, e => { db.close(); ko(e); });
  };
}), [f.toString().replace(/^[^{]*{|}$/g, ''), arg]);
const contributions = page => idb(page, () => {
  if (!db.objectStoreNames.contains('contributions')) { ok(0); return; }
  const q = db.transaction('contributions').objectStore('contributions').count();
  q.onsuccess = () => ok(q.result);
  q.onerror = () => ko(q.error);
});
const putContribution = page => idb(page, () => {
  const tx = db.transaction('contributions', 'readwrite');
  tx.objectStore('contributions').put({ setId: 'w0', kind: 'workout-vision-contribution', savedAt: new Date().toISOString(), lift: 'bicep_curl', count: 7, appCount: 7, worldLandmarks: [], timestamps: [] }, 'w0');
  tx.oncomplete = () => ok();
  tx.onerror = () => ko(tx.error);
});
const seedSet = page => idb(page, () => {
  const tx = db.transaction('workouts', 'readwrite');
  tx.objectStore('workouts').put({ id: 'w1', exercise: 'bicep_curl', reps: 7, source: 'counter-core', createdAt: Date.now() }, 'w1');
  tx.oncomplete = () => ok();
  tx.onerror = () => ko(tx.error);
});
test.describe('the build with both flags on (port 4173, as ci.yml builds it for these tests)', () => {
  test('offers live counting, and asks to help after the first set filmed', async ({ page }) => {
    test.setTimeout(120000);
    const errors = await start(page);
    await openFilm(page, FLAGS_ON);
    // A dist built without the flags (a plain npm run build) fails here, not in live.spec.js and contribute*.spec.js.
    await expect(page.getByTestId('mode-live'), 'dist was built without VITE_LIVE=1: run npm run build:e2e').toBeVisible();
    // The same video set as below, so the production test's "no question" is not a set that would never be asked.
    const card = await saveSet(page, FLAGS_ON);
    await expect(card.getByTestId('contribute-ask'), 'dist was built without VITE_CONTRIBUTE=1: run npm run build:e2e').toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('the production build (port 4176: VITE_LIVE and VITE_EVENTS_URL unset, VITE_CONTRIBUTE on, as deploy.yml)', () => {
  test('the Film screen offers no live counting, even to a phone that chose it before', async ({ page }) => {
    const errors = await start(page, { filmMode: 'live' });
    await openFilm(page, PROD);
    await expect(page.locator('.film-mode')).toHaveCount(0);
    await expect(page.getByTestId('mode-live')).toHaveCount(0);
    await expect(page.getByTestId('film-live')).toHaveCount(0);
    await expect(page.getByText('En direct')).toHaveCount(0);
    // The video, its two inputs (the camera and the library), and its own line on privacy.
    await expect(page.locator('.film-screen input[type=file]')).toHaveCount(2);
    await expect(page.locator('.film-screen .privacy')).toHaveText('La vidéo reste sur votre téléphone.');
    expect(errors).toEqual([]);
  });

  test('a first set filmed asks once to help, and nothing is kept before a yes', async ({ page }) => {
    test.setTimeout(120000);
    const errors = await start(page);
    const card = await saveSet(page, PROD);
    await expect(card.getByTestId('contribute-ask')).toBeVisible();
    await expect(card.getByTestId('contribute-ask').getByRole('button')).toHaveText(['Quoi exactement ?', 'Oui, aider', 'Pas maintenant']);
    expect(await page.evaluate(() => localStorage.getItem('wv_contribute'))).toBe(null);
    expect(await contributions(page)).toBe(0);
    expect(errors).toEqual([]);
  });

  test('a phone that said yes keeps each new set on the phone, ready to send from the history', async ({ page }) => {
    test.setTimeout(120000);
    const errors = await start(page, { choice: 'yes' });
    const card = await saveSet(page, PROD);
    await expect(card.getByTestId('contribute-ask')).toHaveCount(0);
    await expect.poll(() => contributions(page)).toBe(1);
    await page.locator('.result-screen .icon-btn').first().click();
    await openHistory(page);
    const box = page.getByTestId('contribute-history');
    await expect(box.getByTestId('contribute-paused')).toHaveCount(0);
    await expect(box.getByRole('button')).toHaveText(['Envoyer', 'Arrêter et effacer']);
    expect(errors).toEqual([]);
  });

  test('sets left waiting after a no can still be erased', async ({ page }) => {
    const errors = await start(page, { choice: 'no' });
    await page.goto(PROD);
    await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
    await seedSet(page);
    await page.reload();
    await openHistory(page);
    await putContribution(page);
    // The history read again, as a person coming back to it.
    await page.getByRole('button', { name: 'Retour' }).first().click();
    await openHistory(page);
    const box = page.getByTestId('contribute-history');
    await expect(box.getByRole('button')).toHaveText(['Aider', 'Arrêter et effacer']);
    await box.getByRole('button', { name: 'Arrêter et effacer' }).click();
    await expect(box.locator('[role="status"]')).toHaveText('C’est arrêté. Les séries en attente sont effacées.');
    expect(await contributions(page)).toBe(0);
    expect(errors).toEqual([]);
  });
});
