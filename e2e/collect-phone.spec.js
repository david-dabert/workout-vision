// Collecting David's sets from the result screen (src/lib/phoneCollect.js, CollectHistory.jsx), on the video path with
// the pose worker that answers with David's real biceps curl set (e2e/shared/filmed-set.js): opened at #collecte, a set
// kept on the result screen keeps its landmark file, sent from the history in one share sheet and then cleared; without
// the flag, nothing is kept and the history shows nothing of it.
import { test, expect } from '@playwright/test';
import { start, saveSet, openHistory, openFilm, chooseDrawnVideo } from './shared/filmed-set.js';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
const BASE = '/workout-vision/';

const collected = page => page.evaluate(() => new Promise((ok, ko) => {
  const r = indexedDB.open('workoutVision');
  r.onerror = () => ko(r.error);
  r.onsuccess = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains('collected')) { db.close(); ok([]); return; }
    const q = db.transaction('collected').objectStore('collected').getAllKeys();
    q.onsuccess = () => { db.close(); ok(q.result); };
    q.onerror = () => { db.close(); ko(q.error); };
  };
}));
const shareStub = () => {
  window.__sharedFiles = [];
  navigator.canShare = () => true;
  navigator.share = d => { window.__sharedFiles.push((d.files || []).map(f => f.name)); return Promise.resolve(); };
};

test('opened at #collecte, a kept set keeps its file, sent from the history and then cleared', async ({ page }) => {
  test.setTimeout(150000);
  const errors = await start(page, { init: shareStub });
  await page.goto(`${BASE}#collecte`);
  await expect(page.getByTestId('collect-switched')).toHaveText('Collecte activée sur ce téléphone : chaque série gardée garde aussi son fichier de repères.');
  expect(new URL(page.url()).hash).toBe('');
  expect(await page.evaluate(() => localStorage.getItem('wv_collecte'))).toBe('1');
  // The phone asks the count before the app's (blind.js): "Je ne sais pas" leaves the flow as it was.
  await saveSet(page, BASE, { blind: 'unsure' });
  await expect.poll(() => collected(page)).toHaveLength(1);
  const [name] = await collected(page);
  expect(name).toMatch(/^bicep_curl_\d+_side_[0-9a-f]{8}\.json\.gz$/);
  // The file as the scoreboard reads it (test/real-phone/accuracy/sets.ts): gzip, the lift, the kept count, the
  // world landmarks and their times; marked after-app, the app's own count beside it, the video's hash in its name.
  const d = await page.evaluate(n => new Promise((ok, ko) => {
    const r = indexedDB.open('workoutVision');
    r.onsuccess = () => {
      const q = r.result.transaction('collected').objectStore('collected').get(n);
      q.onsuccess = async () => { r.result.close(); ok(JSON.parse(await new Response(q.result.blob.stream().pipeThrough(new DecompressionStream('gzip'))).text())); };
      q.onerror = () => ko(q.error);
    };
  }), name);
  expect(d).toMatchObject({ lift: 'bicep_curl', view: 'side', labelKind: 'after-app', hashOf: 'video', extraction: { fps: 15 } });
  expect(name).toBe(`bicep_curl_${d.count}_side_${d.videoSha256.slice(0, 8)}.json.gz`);
  expect(d.count).toBe(d.appCount);
  expect(d.blind).toEqual({ count: null, p: 1 });
  expect(d.worldLandmarks.length).toBe(d.timestamps.length);
  expect(d.worldLandmarks.length).toBeGreaterThan(100);
  // The confirmation shows once: back on the choice, it is gone.
  await page.goto(BASE);
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('collect-switched')).toHaveCount(0);
  await openHistory(page);
  const box = page.getByTestId('collect-history');
  await box.getByRole('button', { name: 'Envoyer les séries collectées (1)' }).click();
  await expect(box.locator('[role="status"]')).toHaveText('1 série partagée. Les effacer de ce téléphone ?');
  expect(await page.evaluate(() => window.__sharedFiles)).toEqual([[name]]);
  await box.getByRole('button', { name: 'Effacer' }).click();
  await expect(box.locator('[role="status"]')).toHaveText('Séries collectées effacées de ce téléphone.');
  expect(await collected(page)).toEqual([]);
  await expect(box).toContainText('Aucune série collectée pour l’instant.');
  // #collecte-off switches it off, and the history no longer shows the section.
  await page.goto(`${BASE}#collecte-off`);
  await expect(page.getByTestId('collect-switched')).toHaveText('Collecte désactivée sur ce téléphone.');
  expect(await page.evaluate(() => localStorage.getItem('wv_collecte'))).toBe(null);
  await openHistory(page);
  await expect(page.getByTestId('collect-history')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('without the flag, a kept set keeps no file and the history shows nothing of it', async ({ page }) => {
  test.setTimeout(150000);
  const errors = await start(page, { init: shareStub });
  await saveSet(page, BASE);
  await page.waitForTimeout(500);
  expect(await collected(page)).toEqual([]);
  await page.goto(BASE);
  await expect(page.getByTestId('collect-switched')).toHaveCount(0);
  await openHistory(page);
  await expect(page.getByTestId('collect-history')).toHaveCount(0);
  await expect(page.getByText(/séries collectées/i)).toHaveCount(0);
  expect(errors).toEqual([]);
});

// The blind question (blind.js; David's order of 9 October 2026, pillar 1): on the #collecte phone, the count is asked
// while the video is read, and the app's count stays off the screen until the answer, even once the analysis is done.
// The answer opens the result on the person's number, the app's beside it; the collected file keeps both.
test('on the #collecte phone, the count is asked first and the app\'s count waits for the answer', async ({ page }) => {
  test.setTimeout(150000);
  const errors = await start(page, { init: shareStub });
  await page.goto(`${BASE}#collecte`);
  await expect(page.getByTestId('collect-switched')).toBeVisible();
  await openFilm(page, BASE);
  await chooseDrawnVideo(page);
  const ask = page.getByTestId('blind-ask');
  await expect(ask).toBeVisible({ timeout: 60000 });
  await expect(ask.getByTestId('blind-ok')).toBeDisabled();
  // The analysis ends; the result does not show, and no count of the app's is anywhere on the page.
  await expect(page.locator('[role="progressbar"][aria-valuenow="100"]')).toHaveCount(1, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await expect(page.locator('.result-screen')).toHaveCount(0);
  for (const id of ['res-numeral', 'res-yes', 'res-typed', 'res-proposal']) await expect(page.getByTestId(id)).toHaveCount(0);
  // Typed then deleted: no number, Valider waits (review of 9 October 2026).
  await ask.getByTestId('blind-field').fill('7');
  await ask.getByTestId('blind-field').fill('');
  await expect(ask.getByTestId('blind-ok')).toBeDisabled();
  await expect(ask.getByTestId('blind-empty')).toHaveCount(1);
  // 5, typed on the number pad, then Valider.
  await ask.getByTestId('blind-field').fill('5');
  await ask.getByTestId('blind-field').blur();
  await expect(ask.getByTestId('blind-n')).toHaveText('5');
  await ask.getByTestId('blind-ok').click();
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 20000 });
  const app = Number((await page.locator('.res-src').innerText()).match(/(\d+)/)[1]);
  expect(app).not.toBe(5);
  await expect(page.getByTestId('res-numeral')).toHaveText('5');
  await page.getByTestId('res-save').click();
  await expect(page.getByTestId('saved-card')).toBeVisible();
  await expect.poll(() => collected(page)).toHaveLength(1);
  const [name] = await collected(page);
  const d = await page.evaluate(n => new Promise((ok, ko) => {
    const r = indexedDB.open('workoutVision');
    r.onsuccess = () => {
      const q = r.result.transaction('collected').objectStore('collected').get(n);
      q.onsuccess = async () => { r.result.close(); ok(JSON.parse(await new Response(q.result.blob.stream().pipeThrough(new DecompressionStream('gzip'))).text())); };
      q.onerror = () => ko(q.error);
    };
  }), name);
  expect(d).toMatchObject({ count: 5, labelKind: 'after-app', appCount: app, corrected: true, blind: { count: 5, p: 1 } });
  // The screen opened on the person's number: no neighbour keys were offered, so none is recorded (review, 9 October).
  expect(d.choice).toBeUndefined();
  expect(errors).toEqual([]);
});

test('without the flag, nothing is asked before the result', async ({ page }) => {
  test.setTimeout(150000);
  const errors = await start(page);
  await openFilm(page, BASE);
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('blind-ask')).toHaveCount(0);
  expect(errors).toEqual([]);
});

// The one-tap neighbours (result-choices.js; pillar 2) on the #collecte phone, after "Je ne sais pas": a tap saves the
// neighbour, the saved card says the corrected number, and the file records what was offered and that a neighbour was
// picked (review of 9 October 2026: the screen kept showing the app's count after the tap).
test('on the #collecte phone, a neighbour of the count saves in one tap, and the screen says so', async ({ page }) => {
  test.setTimeout(150000);
  const errors = await start(page, { init: shareStub });
  await page.goto(`${BASE}#collecte`);
  await expect(page.getByTestId('collect-switched')).toBeVisible();
  await openFilm(page, BASE);
  await chooseDrawnVideo(page);
  await page.getByTestId('blind-unsure').click({ timeout: 60000 });
  await expect(page.getByTestId('res-alts')).toBeVisible({ timeout: 20000 });
  const app = Number(await page.getByTestId('res-numeral').innerText());
  await page.getByTestId('res-alt').last().click();
  await expect(page.getByTestId('saved-card')).toBeVisible();
  await expect(page.getByTestId('res-numeral')).toHaveText(String(app + 1));
  await expect.poll(() => collected(page)).toHaveLength(1);
  const [name] = await collected(page);
  const d = await page.evaluate(n => new Promise((ok, ko) => {
    const r = indexedDB.open('workoutVision');
    r.onsuccess = () => {
      const q = r.result.transaction('collected').objectStore('collected').get(n);
      q.onsuccess = async () => { r.result.close(); ok(JSON.parse(await new Response(q.result.blob.stream().pipeThrough(new DecompressionStream('gzip'))).text())); };
      q.onerror = () => ko(q.error);
    };
  }), name);
  expect(d).toMatchObject({ count: app + 1, appCount: app, corrected: true, blind: { count: null, p: 1 }, choice: { rule: 'neighbours-v1', offered: [app, app + 1, app - 1], picked: 'alt' } });
  expect(errors).toEqual([]);
});
