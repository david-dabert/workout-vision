// Counting paused (27 September 2026): the choice of lift and the Film screen stay,
// the Film screen offers no recording, and the pose model is never fetched.
import { test, expect } from '@playwright/test';

// Set PW_CHROMIUM to a Chromium binary where Playwright's own download is absent.
if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });

for (const [lang, lift, note, guide, foot] of [
  ['en', 'Biceps curl', 'Counting is paused while each exercise is tested on new videos. The guide remains available.', 'Open the guide', 'Counting is paused while each exercise is tested on new videos.'],
  ['fr', 'Curl biceps', 'Le comptage est en pause pendant que chaque exercice est testé sur de nouvelles vidéos. Le guide reste disponible.', 'Ouvrir le guide', 'Le comptage est en pause pendant que chaque exercice est testé sur de nouvelles vidéos.'],
]) {
  test(`counting paused (${lang})`, async ({ page }) => {
    const errors = [], model = [], analysis = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', r => { if (/pose_landmarker|\.wasm/.test(r.url())) model.push(r.url()); if (/CoreUpload/.test(r.url())) analysis.push(r.url()); });
    await page.addInitScript(l => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', l); }, lang);
    await page.goto('/workout-vision/');
    await expect(page.getByText(foot, { exact: true })).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: lift }).first().click();
    await expect(page.getByText(note, { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.film-screen input[type=file]')).toHaveCount(0);
    await page.getByRole('button', { name: guide }).click();
    await expect(page).toHaveURL(/#exercises$/, { timeout: 20000 });
    // Back from the guide returns to the Film screen of the same lift.
    await page.goBack();
    await expect(page.getByText(note, { exact: true })).toBeVisible({ timeout: 20000 });
    // The app warms its screens up to 3 s after arrival: the analysis code must never load.
    await page.waitForTimeout(3500);
    expect(analysis).toEqual([]);
    expect(model).toEqual([]);
    expect(errors).toEqual([]);
  });
}
