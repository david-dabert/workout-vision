// A lift card starts a View Transition whose update runs a frame later (App.jsx, go). A navigation
// by the browser in that frame, before React has rendered it, must win: the pending update must not
// put the filming screen back and rewrite the address. This window made tactility.spec.js fail
// intermittently in CI (runs 139 and 145, 28 and 29 September 2026). Here the update is held and
// released right after the address changes, so the window is hit every time.
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });

test('a navigation in the frame before a card\'s transition updates wins over it', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('wv_seen_entry', 'true');
    localStorage.setItem('wv_lang', 'en');
    // Hold the transition's update instead of running it on the next frame.
    document.startViewTransition = update => {
      window.__heldUpdate = update;
      const done = Promise.resolve();
      return { finished: done, ready: done, updateCallbackDone: done, skipTransition() {} };
    };
  });
  await page.goto('/workout-vision/');
  await page.locator('.rail > .altar').first().click({ timeout: 20000 });
  await page.waitForFunction(() => typeof window.__heldUpdate === 'function', null, { timeout: 20000 });
  // The browser moves to the guide, and the held update runs before React renders that move.
  await page.evaluate(() => { location.hash = '#exercises'; window.__heldUpdate(); });
  await expect(page.locator('.wv-current .guide-screen')).toBeVisible({ timeout: 20000 });
  await expect(page).toHaveURL(/#exercises$/);
});

test.describe('with Reduce Motion, where a screen already loaded changes at once', () => {
  test.use({ reducedMotion: 'reduce' });
  test('a tap made after the browser moved, before React rendered the move, does not undo it', async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'en'); });
    const guide = page.waitForResponse(r => /\/assets\/Guide-[^/]+\.js$/.test(r.url()), { timeout: 20000 });
    await page.goto('/workout-vision/');
    await guide; // the guide's code is already in, so the tap below changes the screen at once
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      location.hash = '#history';
      document.querySelector('.row-link').click(); // "Another exercise": the guide, in the same task
    });
    await expect(page).toHaveURL(/#history$/);
    await expect(page.locator('.wv-current .guide-screen')).toHaveCount(0);
  });
});

test('a navigation announced but not yet rendered also wins over a card\'s held transition', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('wv_seen_entry', 'true');
    localStorage.setItem('wv_lang', 'en');
    document.startViewTransition = update => {
      window.__heldUpdate = update;
      const done = Promise.resolve();
      return { finished: done, ready: done, updateCallbackDone: done, skipTransition() {} };
    };
  });
  await page.goto('/workout-vision/');
  await page.locator('.rail > .altar').first().click({ timeout: 20000 });
  await page.waitForFunction(() => typeof window.__heldUpdate === 'function', null, { timeout: 20000 });
  // The held update runs right after the app has heard the hashchange, before React renders it.
  await page.evaluate(() => { addEventListener('hashchange', () => window.__heldUpdate(), { once: true }); location.hash = '#exercises'; });
  await expect(page.locator('.wv-current .guide-screen')).toBeVisible({ timeout: 20000 });
  await expect(page).toHaveURL(/#exercises$/);
});

test('back then forward while a card waits for its screen\'s code cancels the card', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  let release;
  const held = new Promise(r => { release = r; });
  await page.route(/\/assets\/Film-[^/]+\.js$/, async route => { await held; await route.continue(); });
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'en'); });
  await page.goto('/workout-vision/');
  await expect(page.locator('.rail > .altar').first()).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => { location.hash = '#exercises'; });
  await expect(page.locator('.wv-current .guide-screen')).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => { location.hash = ''; });
  await expect(page.locator('.wv-current .choose-screen')).toBeVisible({ timeout: 20000 });
  await page.locator('.rail > .altar').first().click();
  await page.evaluate(() => history.back());
  await expect(page.locator('.wv-current .guide-screen')).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => history.forward());
  await expect(page.locator('.wv-current .choose-screen')).toBeVisible({ timeout: 20000 });
  release();
  await page.waitForTimeout(1500);
  await expect(page.locator('.wv-current .film-screen')).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe('');
});
