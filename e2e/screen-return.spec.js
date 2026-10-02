// A screen one returns to is already there (ScreenFade.jsx): its entrance is not played again, and the screen
// being left fades away on top of it. Back from a filming screen used to replay the choice's entrance from
// transparent while the filming screen faded out: the stage dipped nearly black (tour, t04-back-to-choice,
// 29 September twice, 2 October twice).
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 745 } });

test('back to the choice: the choice is whole at once, the filming screen fades over it', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); localStorage.setItem('wv_level', 'intermediate'); });
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar')).toHaveCount(9);
  await page.waitForTimeout(1500);
  await page.locator('.altar').first().click();
  await expect(page.locator('.film-screen')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.locator('.film-screen .icon-btn').click();
  await page.waitForTimeout(150);
  const state = await page.evaluate(() => {
    const current = document.querySelector('.wv-current .choose-screen');
    const title = current?.querySelector('.title');
    const leaving = document.querySelector('.wv-leaving');
    const z = el => Number(getComputedStyle(el).zIndex) || 0;
    return {
      screen: current ? Number(getComputedStyle(current).opacity) : null,
      title: title ? Number(getComputedStyle(title).opacity) : null,
      leavingOnTop: leaving ? z(leaving) > z(document.querySelector('.wv-current')) : null,
    };
  });
  expect(state.screen).toBe(1);
  expect(state.title).toBe(1);
  expect(state.leavingOnTop).toBe(true);
});

test('a first visit to a screen still plays its entrance', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); localStorage.setItem('wv_level', 'intermediate'); });
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar')).toHaveCount(9);
  await page.waitForTimeout(1500);
  // The guide, reached for the first time, plays its entrance: it is not marked as a return.
  await page.locator('.row-link').first().click();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => [...document.querySelectorAll('.wv-current')].some(e => e.classList.contains('wv-return')))).toBe(false);
});
