// Main's CI run 1064 (13 November 2026): back from the filming screen and a quick tap on another card left two elements
// named `lift-hero` (the leaving filming frame and the chosen card) while the leaving screen faded out, so the browser
// aborted the view transition ("Unexpected duplicate view-transition-name: lift-hero"). On CI's slower runner the tap
// landed inside the fade; here the tap is made while the filming screen is still leaving, and the names are counted
// at the moment the transition would capture them.
//
// Result, 13 November 2026: this passes on main, so the leaving filming frame is not the second `lift-hero`; the cause of
// run 1064's failure is not found. Not reproduced in 50 timed round trips, with the CPU slowed six times or not. Kept on
// branch fix/lift-hero-race for the next attempt, not merged.
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('back from the filming screen and a tap on another card at once: one element named lift-hero', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'en'); });
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar')).toHaveCount(9, { timeout: 20000 });
  await page.locator('.altar').nth(0).click();
  await expect(page.locator('.film-screen .frame')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.wv-leaving')).toHaveCount(0, { timeout: 20000 });
  // Back, then a tap on another card while the filming screen is still leaving.
  await page.locator('.film-screen .icon-btn').first().click();
  await page.waitForFunction(() => document.querySelector('.wv-leaving .film-screen') && document.querySelectorAll('.choose-screen .altar').length > 1, null, { polling: 'raf' });
  const named = await page.evaluate(() => {
    document.querySelectorAll('.choose-screen .altar')[1].click();
    return [...document.querySelectorAll('*')].filter(el => getComputedStyle(el).viewTransitionName === 'lift-hero')
      .map(el => el.className.toString().split(' ')[0]);
  });
  expect(named).toHaveLength(1);
});
