// Card 013 (cards/013-honest-screens.md): the production build shows nothing built on the readings switched off on
// 11 November 2026 (measures.js, UNVALIDATED_BIOMECHANICS_SHOWN). Served on port 4176 with the flags production gets
// (playwright.config.js). The session report's part of the card is held by report.test.js.
import { test, expect } from '@playwright/test';
import { start as baseStart, saveSet } from './shared/filmed-set.js';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

const PROD = 'http://localhost:4176/workout-vision/';
const home = async (page, hash = '') => {
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto(PROD + hash);
};

test('the home offers no athlete profile quiz', async ({ page }) => {
  await home(page);
  await expect(page.getByTestId('choose-head-pro')).toBeVisible();
  await expect(page.getByTestId('choice-athlete-profile')).toHaveCount(0);
});

for (const address of ['equine', 'veterinary', 'sports', 'golf', 'tennis', 'padel', 'cycling', 'baseball', 'rowing', 'skiing', 'swimming']) {
  test(`#${address} returns to the home`, async ({ page }) => {
    await home(page, `#${address}`);
    await expect(page.getByTestId('choose-head-pro')).toBeVisible();
    await expect(page.getByText('Le trot, foulée par foulée')).toHaveCount(0);
    await expect(page.getByText('Le geste, sport par sport')).toHaveCount(0);
  });
}

test('Card 050: #nimporte-quoi shows « Cette page n’existe pas » with the home, while #kine-p=, #kine-r=, #programme= and #resultats= still open', async ({ page }) => {
  await home(page, '#nimporte-quoi');
  await expect(page.getByTestId('choose-head-pro')).toBeVisible();
  await expect(page.getByTestId('unknown-address')).toContainText('Cette page n’existe pas');

  // Patient and client links still open without showing the unknown-address notice.
  await page.goto(PROD + '#kine-p=zH4sIAEIm-2oCA0WOwQrCMBBE_2XOW7DqQXL27geIh0AXXNsmJVmqEvrvbiG1p33M7IMpmOFaQi-B4QqCH-3iNsgsnECYnnFtYMijl2HFxWJOV_-FOxLezH2GOxNC1PoqyqNl9wLpLDEx5OYVJShnqxNP1rYHQmY1Ou3uQtVJUb1KDA1_lJNt2LTLZtnsv_UgdL7yD9smG5HUAAAA');
  await expect(page.getByTestId('kine-patient-screen')).toBeVisible();
  await expect(page.getByTestId('unknown-address')).toHaveCount(0);

  await page.goto(PROD + '#kine-r=bad');
  await expect(page.getByTestId('kine-result-screen')).toBeVisible();
  await expect(page.getByTestId('unknown-address')).toHaveCount(0);

  await page.goto(PROD + '#programme=bad');
  await expect(page.getByTestId('programme-screen')).toBeVisible();
  await expect(page.getByTestId('unknown-address')).toHaveCount(0);

  await page.goto(PROD + '#resultats=bad');
  await expect(page.getByTestId('results-screen')).toBeVisible();
  await expect(page.getByTestId('unknown-address')).toHaveCount(0);
});

test('Card 050: the history has no level control, and the level stays settable where it is first asked', async ({ page }) => {
  test.setTimeout(120_000);
  await baseStart(page);
  await page.addInitScript(() => {
    localStorage.removeItem('wv_level');
    localStorage.removeItem('wv_level_asked');
    localStorage.setItem('wv_first_word', JSON.stringify({ skipped: true }));
    localStorage.setItem('wv_contribute', 'no');
  });
  await page.goto(PROD + '#history');
  await expect(page.locator('.history-screen')).toBeVisible();
  await expect(page.getByTestId('history-level')).toHaveCount(0);
  await expect(page.locator('#hist-level')).toHaveCount(0);

  const card = await saveSet(page, PROD);
  await expect(card.getByTestId('level-ask')).toBeVisible();
  await card.getByTestId('level-ask').getByRole('button', { name: 'Confirmé' }).click();
  expect(await page.evaluate(() => localStorage.getItem('wv_level'))).toBe('expert');
});
