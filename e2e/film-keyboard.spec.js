// The filming screen's two actions are labels announced as buttons: Enter and Space click their file input, which
// opens the camera or the video picker, as a tap does (audit FINDING-024: focusable, but no key did anything).
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block' });

for (const key of ['Enter', ' ']) {
  for (const which of ['.btn-primary', '.btn-ghost']) {
    test(`${which === '.btn-primary' ? 'Filmer ma série' : 'Choisir une vidéo'} opens the picker with ${key === ' ' ? 'Space' : key}`, async ({ page }) => {
      await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
      await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); localStorage.setItem('wv_level', 'intermediate'); });
      await page.goto('/workout-vision/');
      await page.locator('.altar').first().click();
      const action = page.locator(`.film-screen .actions ${which}`);
      await expect(action).toBeVisible();
      // The screen arrives by the card's morph and its blocks rise: the key is pressed once it is still.
      await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 5000 });
      // What the app controls: the key clicks the label's file input, which is what opens the picker. Whether
      // headless Chromium then reports a file chooser varies from run to run (seen 2 October), so it is not awaited.
      await page.evaluate(sel => {
        window.__inputClicks = 0;
        document.querySelector(`.film-screen .actions ${sel} input`).addEventListener('click', e => { window.__inputClicks++; e.preventDefault(); });
      }, which);
      await action.focus();
      await page.keyboard.press(key);
      expect(await page.evaluate(() => window.__inputClicks)).toBe(1);
    });
  }
}
