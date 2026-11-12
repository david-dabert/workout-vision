// Card 013 (cards/013-honest-screens.md): the production build shows nothing built on the readings switched off on
// 11 November 2026 (measures.js, UNVALIDATED_BIOMECHANICS_SHOWN). Served on port 4176 with the flags production gets
// (playwright.config.js). The session report's part of the card is held by report.test.js.
import { test, expect } from '@playwright/test';

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
