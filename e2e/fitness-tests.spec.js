// The fitness tests (fitness-tests.js) from the choice screen: each opens its filming screen with its protocol,
// the "Filmer le test" action in view without scrolling at the two gated heights (PLAN.md rule 6), in both
// languages; a beginner, whose exercises open the guide first, goes straight to the protocol.
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ serviceWorkers: 'block' });

const STEP2 = {
  chair_stand_test: { fr: 'bras croisés sur la poitrine', en: 'arms crossed on your chest' },
  arm_curl_test: { fr: '2,3 kg pour une femme, 3,6 kg pour un homme', en: '2.3 kg for a woman, 3.6 kg for a man' },
};

for (const size of [{ width: 390, height: 664 }, { width: 390, height: 745 }]) {
  for (const lang of ['fr', 'en']) {
    for (const key of Object.keys(STEP2)) {
      test(`${key} at ${size.width}x${size.height} (${lang}): the protocol, and its action in view`, async ({ browser }) => {
        const context = await browser.newContext({ viewport: size, serviceWorkers: 'block' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
        await page.addInitScript(([l]) => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', l); localStorage.setItem('wv_level', 'beginner'); }, [lang]);
        await page.goto('/workout-vision/');
        await page.getByTestId(`choose-${key}`).click();
        await expect(page.locator('.film-screen')).toBeVisible();
        await expect(page.locator('.film-screen .eyebrow')).toHaveText(lang === 'fr' ? 'Test de condition physique' : 'Fitness test');
        await expect(page.locator('.film-screen .steps')).toContainText(STEP2[key][lang]);
        const action = page.locator('.film-screen .actions .btn-primary');
        await expect(action).toContainText(lang === 'fr' ? 'Filmer le test' : 'Record the test');
        await page.waitForTimeout(1200); // the reveal has settled
        const box = await action.boundingBox();
        expect(box.y + box.height).toBeLessThanOrEqual(size.height);
        expect(errors).toEqual([]);
        await context.close();
      });
    }
  }
}
