// Collecting David's sets from the result screen (src/lib/phoneCollect.js, CollectHistory.jsx), on the video path with
// the pose worker that answers with David's real biceps curl set (e2e/shared/filmed-set.js): opened at #collecte, a set
// kept on the result screen keeps its landmark file, sent from the history in one share sheet and then cleared; without
// the flag, nothing is kept and the history shows nothing of it.
import { test, expect } from '@playwright/test';
import { start, saveSet, openHistory } from './shared/filmed-set.js';

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
  await saveSet(page, BASE);
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
