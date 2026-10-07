// Installing the app on the home screen (install.js, Install.jsx): the row at the foot of the choice shows only where
// the app can be installed and is not; on an iPhone it opens the three taps, in an app's browser it asks for Safari
// with a copy key; Chromium's own prompt is called from the key; once the app runs from the home screen nothing shows;
// the one-time suggestion comes on the saved card, after the count is confirmed, and never again once dismissed.
// Chromium plays each phone by its user agent: what Safari itself does stays David's check on his iPhone (R3, R6).
import { test, expect } from '@playwright/test';
import { start, openFilm, chooseDrawnVideo } from './shared/filmed-set.js';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, locale: 'fr-FR' });

const BASE = '/workout-vision/';
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0 (iPhone15,2; iOS 18_0; fr_FR; fr; scale=3.00; 1179x2556)';

async function openChoice(page) {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto(BASE);
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
}

// Chromium hands its install prompt to the page (a beforeinstallprompt event; headless Chromium never sends one).
const handPrompt = (page, outcome = 'accepted') => page.evaluate(outcome => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; return Promise.resolve(); };
  e.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(e);
}, outcome);

test.describe('Chromium', () => {
  test('the row shows once Chromium hands its prompt over, calls it, and goes once the app is installed', async ({ page }) => {
    await openChoice(page);
    const row = page.getByTestId('install-row');
    // No prompt yet, no way to install: no row.
    await expect(row).toHaveCount(0);
    await handPrompt(page);
    await expect(row).toBeVisible();
    await expect(row).toContainText('Installer l’app');
    await row.click();
    await expect.poll(() => page.evaluate(() => window.__prompted)).toBe(1);
    // The prompt is used once: no sheet opens in its place.
    await expect(page.getByTestId('install-sheet')).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await expect(row).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('wv_install_hint'))).toBe('installed');
  });
});

test.describe('iPhone Safari', () => {
  test.use({ userAgent: IPHONE_SAFARI });
  test('the row opens the three taps; Escape closes the sheet and gives the focus back', async ({ page }) => {
    await openChoice(page);
    const row = page.getByTestId('install-row');
    await row.scrollIntoViewIfNeeded();
    await expect(row).toBeVisible();
    // A 44 pt target at least.
    expect((await row.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await row.click();
    const sheet = page.getByRole('dialog', { name: 'Installer l’app' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('data-kind', 'ios');
    await expect(sheet.getByTestId('share-glyph')).toBeVisible();
    await expect(sheet.locator('.ins-step')).toHaveCount(3);
    await expect(sheet.locator('.ins-step').nth(0)).toContainText('Partager');
    await expect(sheet.locator('.ins-step').nth(1)).toContainText('Sur l’écran d’accueil');
    await expect(sheet.locator('.ins-step').nth(2)).toContainText('Ajouter');
    await expect(sheet.getByTestId('install-why')).toContainText('sept jours');
    // The focus is in the sheet, on its title; the app behind is out of reach.
    await expect(page.locator('#ins-title')).toBeFocused();
    expect(await page.evaluate(() => document.getElementById('root').inert)).toBe(true);
    // Tab stays inside the sheet.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]'))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(row).toBeFocused();
    expect(await page.evaluate(() => document.getElementById('root').inert)).toBe(false);
    // The close key closes it too.
    await row.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).last().click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  // Chromium's CDP emulation does not cover display-mode, so the page's matchMedia answers as an installed app's does
  // (iOS also sets navigator.standalone, the other half of onHomeScreen, keep-sets.js).
  for (const how of ['display-mode', 'navigator.standalone']) test(`nothing shows once the app runs from the home screen (${how})`, async ({ page }) => {
    await page.addInitScript(how => {
      if (how === 'navigator.standalone') { Object.defineProperty(Navigator.prototype, 'standalone', { get: () => true }); return; }
      const real = window.matchMedia.bind(window);
      window.matchMedia = q => (/display-mode:\s*standalone/.test(q)
        ? { matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }
        : real(q));
    }, how);
    await openChoice(page);
    await page.getByTestId('about-link').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('about-link')).toBeVisible();
    await expect(page.getByTestId('install-row')).toHaveCount(0);
    // Even with Chromium's prompt in hand.
    await handPrompt(page);
    await page.waitForTimeout(200);
    await expect(page.getByTestId('install-row')).toHaveCount(0);
  });
});

test.describe('the browser inside Instagram', () => {
  test.use({ userAgent: INSTAGRAM });
  test('asks to open the link in Safari, with a key that copies it', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openChoice(page);
    await page.getByTestId('install-row').click();
    const sheet = page.getByRole('dialog', { name: 'Ouvrez le lien dans Safari' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('data-kind', 'in-app');
    await expect(sheet.getByTestId('install-open-elsewhere')).toContainText('collez-le dans Safari');
    await expect(sheet.getByTestId('install-link')).toHaveText(/\/workout-vision\/$/);
    await sheet.getByTestId('install-copy').click();
    await expect(sheet.getByRole('status')).toHaveText('Lien copié.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/workout-vision\/$/);
  });
});

test('the suggestion comes once, on the saved card, after the count is confirmed', async ({ page }) => {
  test.setTimeout(120_000);
  await start(page);
  await openFilm(page, BASE);
  await handPrompt(page, 'dismissed');
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60000 });
  const yes = page.getByRole('button', { name: /^Oui, \d+ répétitions?$/ });
  await expect(yes).toBeVisible();
  // Before the confirmation: nothing.
  await expect(page.getByTestId('install-suggest')).toHaveCount(0);
  await yes.click();
  const suggest = page.getByTestId('install-suggest');
  await expect(suggest).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('wv_install_hint'))).toBe('shown');
  await suggest.getByTestId('install-dismiss').click();
  await expect(suggest).toHaveCount(0);
  await expect(page.getByTestId('install-later')).toContainText('Le lien reste en bas de la liste des exercices.');
  expect(await page.evaluate(() => localStorage.getItem('wv_install_hint'))).toBe('dismissed');
  // The next set: saved again, and no suggestion.
  await page.getByTestId('new-set').click();
  await expect(page.locator('.film-screen')).toBeVisible({ timeout: 20000 });
  await chooseDrawnVideo(page);
  await expect(yes).toBeVisible({ timeout: 60000 });
  await yes.click();
  await expect(page.getByTestId('saved-card')).toBeVisible();
  await expect(page.getByTestId('install-suggest')).toHaveCount(0);
});
