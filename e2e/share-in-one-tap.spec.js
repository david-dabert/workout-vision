// Card 004 (cards/004-share-in-one-tap.md): from the saved result, the person's video with its skeleton and count is
// reached to send in at most two taps, without waiting once they have watched it. Production build (port 4176). A
// browser with no share sheet (headless Chromium) offers the file, « Enregistrer la vidéo »: the card counts it the same.
//
// What is measured: the person opens the replay (one tap), watches the set once through (as long as the video), then
// asks for the video. The wait is the time from that ask until the file is in hand. Baseline on main at cb32af66,
// measured with this spec before any change: 3 taps, 12.6 s of wait (the recording runs as long as the set).
import { test, expect } from '@playwright/test';
import { start, saveSet } from './shared/filmed-set.js';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
const PROD = 'http://localhost:4176/workout-vision/';
const BASELINE_WAIT_MS = 12600;

test('the video is reached in two taps and is ready when the person has watched it', async ({ page }) => {
  test.setTimeout(150_000);
  await start(page);
  await saveSet(page, PROD);
  let taps = 0;
  await page.getByRole('button', { name: 'Revoir la série avec le squelette', exact: true }).click(); taps += 1;
  await expect(page.locator('.replay-screen')).toBeVisible();
  // The person watches the set through once (the drawn video lasts 12 s).
  await page.waitForTimeout(13_500);
  const get = page.getByRole('link', { name: /^Enregistrer la vidéo$/ }).or(page.getByRole('button', { name: /^Partager la vidéo$/ }));
  const prep = page.getByRole('button', { name: /^Préparer la vidéo à partager$/ });
  const asked = Date.now();
  if (!(await get.isVisible())) { await prep.click(); taps += 1; }
  await expect(get).toBeVisible({ timeout: 60_000 });
  const wait = Date.now() - asked;
  await get.click(); taps += 1;
  console.log(`CARD004 taps=${taps} wait_ms=${wait}`);
  expect(taps, 'taps from the saved result to the video').toBeLessThanOrEqual(2);
  expect(wait, 'wait once the set was watched').toBeLessThanOrEqual(BASELINE_WAIT_MS / 2);
});
