// Shoots step 2's screens on the production build, in Chromium at 390×664 (2x). Run by copying it to
// e2e/zz-step2-shots.spec.js (it is not named *.spec.js here, so that Vitest leaves it alone):
//   PW_CHROMIUM=… npx playwright test e2e/zz-step2-shots.spec.js; then remove the copy.
import { test, expect } from '@playwright/test';
test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM }, viewport: { width: 390, height: 664 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
const OUT = 'test/real-phone/step2/screens';
for (const lang of ['fr', 'en']) {
  test(`step 2 screens, ${lang}`, async ({ page }) => {
    await page.addInitScript(l => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', l); }, lang);
    await page.goto('/workout-vision/');
    await expect(page.locator('.all-exercises .item')).toHaveCount(181, { timeout: 20000 });
    await page.locator('.all-exercises').scrollIntoViewIfNeeded();
    await page.evaluate(() => document.querySelector('.all-exercises').scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/choice-list-${lang}-390x664.png` });
    await page.fill('#all-search', lang === 'fr' ? 'fente avant' : 'forward lunge');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/choice-search-${lang}-390x664.png` });
    await page.locator('.all-exercises [data-exercise="forward_lunge"] .item-btn').click();
    await expect(page.locator('.film-screen .guide-frames img')).toHaveCount(3, { timeout: 10000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/film-forward-lunge-${lang}-390x664.png` });
  });
}
