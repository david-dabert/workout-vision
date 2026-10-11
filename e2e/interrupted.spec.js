// A run stopped by the page being hidden (screen locked, app left) shows the
// interruption and never a count; "Start the analysis again" runs it anew.
import { test, expect } from '@playwright/test';

// Set PW_CHROMIUM to a Chromium binary where Playwright's own download is absent.
if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });

const hide = page => page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
});
const show = page => page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
});
const pagehide = page => page.evaluate(() => window.dispatchEvent(new Event('pagehide')));

for (const [lang, lift, title, again, keepOn] of [
  ['en', 'Biceps curl', 'The analysis was interrupted.', 'Start the analysis again', 'Keep the screen on until the result.'],
  ['fr', 'Curl biceps', 'L’analyse a été interrompue.', 'Recommencer l’analyse', 'Gardez l’écran allumé jusqu’au résultat.'],
]) {
  for (const [how, trigger] of [['hidden', hide], ['pagehide', pagehide]]) {
    test(`interrupted by ${how} (${lang})`, async ({ page }) => {
      const results = [];
      await page.exposeFunction('__coreResult', () => results.push(1));
      // Hold the pose model back so the run is still in progress when the page is hidden.
      await page.route('**/pose_landmarker_full.task', () => {});
      await page.addInitScript(l => {
        localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', l);
        window.addEventListener('wv:core-result', () => window.__coreResult());
        // Record wake lock requests: the run asks to keep the screen on.
        window.__wake = [];
        Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async t => { window.__wake.push(t); return { released: false, release: async () => {} }; } } });
      }, lang);
      await page.goto('/workout-vision/');
      await page.getByRole('button', { name: lift }).first().click({ timeout: 20000 });
      await page.locator('.film-screen input[type=file]').nth(1).setInputFiles({ name: 'set.mov', mimeType: 'video/quicktime', buffer: Buffer.from('not a real video') });
      await expect(page.locator('.watch-screen')).toBeVisible({ timeout: 20000 });
      await expect(page.getByText(keepOn, { exact: true })).toBeVisible();
      await expect.poll(() => page.evaluate(() => window.__wake)).toEqual(['screen']);
      await trigger(page);
      await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 20000 });
      await expect(page.locator('.watch-screen')).toHaveCount(0);
      expect(results).toEqual([]);
      if (how === 'hidden') await show(page);
      await page.getByRole('button', { name: again }).click();
      await expect(page.locator('.watch-screen')).toBeVisible({ timeout: 20000 });
    });
  }
}
