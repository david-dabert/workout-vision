// After a screen change, focus is on the new screen, never left on the screen that went (inert) or on nothing:
// VoiceOver and the keyboard go on from the new screen's title (audit of 3 October).
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });

test('the new screen takes the focus', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/');
  const row = page.getByRole('button', { name: /Vos séries/ });
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.history-screen')).toBeVisible({ timeout: 20000 });
  await expect.poll(() => page.evaluate(() => {
    const a = document.activeElement;
    return !!a && a !== document.body && !a.closest('.wv-leaving') && !!a.closest('.wv-current');
  })).toBe(true);
});
