// Screenshot guard for Espace Pro / Programme builder (extended routes).
// Runs against a build with VITE_EXTENDED_ROUTES=1 in the extended Playwright project.
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'fr-FR', timezoneId: 'Europe/Paris' });

const BASELINE_CHROMIUM = '153.0.8010.12';
const BASE = '/workout-vision/';

test.beforeEach(async ({ page, browser }) => {
  const version = browser.version();
  const why = `the baselines were made in Chromium ${BASELINE_CHROMIUM}; this is ${version}. Run with PW_CHROMIUM unset after npx playwright install chromium, or with Chrome for Testing's chrome-headless-shell ${BASELINE_CHROMIUM}`;
  if (version !== BASELINE_CHROMIUM) {
    if (process.env.CI) throw new Error(`Screenshot guard: ${why}; regenerate the baselines with --update-snapshots in CI's browser.`);
    test.skip(true, why);
  }
  await page.addInitScript(() => {
    let a = 0x9e3779b9;
    Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  });
  await page.clock.setFixedTime(new Date('2026-10-01T10:00:00+02:00'));
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
});

async function shot(page, name, mask = []) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixels: 0, mask, maskColor: '#ff00ff' });
}

const seen = (page, lang = 'fr') => page.addInitScript(l => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', l); }, lang);

test('pro builder', async ({ page }) => {
  await seen(page);
  await page.goto(BASE);
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  const row = page.getByTestId('choice-pro');
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(page.getByTestId('pro-screen')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('pro-new').click();
  await expect(page.getByTestId('pro-editor')).toBeVisible();
  await page.locator('#pTitle').fill('Bas du corps, semaine 1');
  await page.locator('#pWho').fill('Camille');
  await page.getByTestId('pro-add').click();
  await page.locator('#all-search').fill('squat');
  await page.locator('[data-exercise="squat"] button').click();
  await expect(page.getByTestId('pro-item')).toHaveCount(1);
  await page.locator('#pTitle').focus();
  await page.locator('#pTitle').blur();
  await page.evaluate(() => { const s = document.querySelector('.pro-screen'); if (s) s.scrollTop = 0; window.scrollTo(0, 0); });
  await shot(page, 'pro-builder');
});
