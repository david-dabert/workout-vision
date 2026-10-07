// Screenshot guard (C8 of the design review, 7 October 2026): seven key screens at 390 px wide, compared pixel for
// pixel with the committed baselines (e2e/visual.spec.js-snapshots/). A refactor of the colours or the type that
// should change nothing must leave every picture as it was; a change meant to be seen updates the baselines in the
// same commit (npx playwright test e2e/visual.spec.js --update-snapshots), so the review sees the pictures.
//
// Frozen: Reduce Motion (the stage draws one still frame at t = 1.5 s, stage-loop.js), CSS animations disabled by
// toHaveScreenshot, Math.random seeded so the dust and the grain are the same at every run, the date fixed, the fonts
// the app's own (@fontsource, bundled, no system font in the shot) and loaded before the shot.
//
// A picture depends on the browser's build: the baselines are made with Chromium 153.0.8010.12, the
// chromium-headless-shell that @playwright/test 1.63 installs and CI's e2e job runs (npx playwright install chromium).
// In another Chromium (PW_CHROMIUM naming an older binary on a dev machine) the test skips and says why; in CI a
// mismatch fails, so a Playwright upgrade comes with new baselines. Locally, the same build is run by pointing
// PW_CHROMIUM at Chrome for Testing's chrome-headless-shell 153.0.8010.12 (linux64).
// A zero diff in Chromium is not "unchanged on the iPhone" (R3, R6): David's check stays the gate.
import { test, expect } from '@playwright/test';
import { start, openFilm, chooseDrawnVideo } from './shared/filmed-set.js';

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
  // The same pseudo-random sequence at every load (mulberry32), so what the app draws at random is drawn the same.
  await page.addInitScript(() => {
    let a = 0x9e3779b9;
    Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  });
  await page.clock.setFixedTime(new Date('2026-10-01T10:00:00+02:00'));
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
});

async function shot(page, name, mask = []) {
  await page.evaluate(() => document.fonts.ready);
  // Two frames, so the stage's still frame and any layout settled after the fonts are on screen.
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot(`${name}.png`, { animations: 'disabled', caret: 'hide', maxDiffPixels: 0, mask, maskColor: '#ff00ff' });
}

const seen = (page, lang = 'fr') => page.addInitScript(l => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', l); }, lang);

test('entry', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wv_lang', 'fr'));
  await page.goto(BASE);
  await expect(page.getByRole('button', { name: 'Voir un exemple' })).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(800);
  await shot(page, 'entry');
});

test('choice', async ({ page }) => {
  await seen(page);
  await page.goto(BASE);
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  await shot(page, 'choice');
});

test('demo end', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wv_lang', 'fr'));
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Voir un exemple' }).click({ timeout: 20000 });
  await expect(page.getByTestId('demo-result')).toBeVisible({ timeout: 10000 });
  await shot(page, 'demo-end');
});

test('result', async ({ page }) => {
  test.setTimeout(120_000);
  await start(page);
  await openFilm(page, BASE);
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('button', { name: /^Oui, \d+ répétitions?$/ })).toBeVisible();
  // The angle curve is drawn from the frames the drawn video happened to hold (MediaRecorder's timing), not from
  // the styles: it is masked, the rest of the screen is compared.
  await shot(page, 'result', [page.locator('.res-wave svg')]);
});

test('history', async ({ page }) => {
  await seen(page);
  await page.goto(BASE);
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('workoutVision');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('workouts', 'readwrite');
      const at = new Date('2026-09-30T18:00:00+02:00').getTime();
      tx.objectStore('workouts').put({ id: 'manual-a', exercise: 'bicep_curl', reps: 7, source: 'manual', createdAt: at }, 'manual-a');
      tx.objectStore('workouts').put({ id: 'manual-b', exercise: 'squat', reps: 12, source: 'manual', createdAt: at - 86400000 }, 'manual-b');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
  }));
  await page.reload();
  await page.locator('button, a').filter({ hasText: /Vos séries/ }).first().click({ timeout: 20000 });
  await expect(page.locator('.hist-btn').first()).toBeVisible({ timeout: 20000 });
  await shot(page, 'history');
});

test('about', async ({ page }) => {
  await seen(page);
  await page.goto(BASE);
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  const link = page.getByTestId('about-link');
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await expect(page.locator('.about-screen h1.title')).toBeVisible({ timeout: 20000 });
  await expect.poll(() => page.locator('.about-screen img').first().evaluate(e => e.complete && e.naturalWidth > 0), { timeout: 15000 }).toBe(true);
  await shot(page, 'about');
});

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
