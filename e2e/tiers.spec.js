// Lift tiers (28 September 2026): eight lifts on offer, each labelled Beta or
// Experimental on its card, on the filming screen and in the guide.
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });

const EXP_EN = 'Experimental: we are still learning this exercise', EXP_FR = 'Expérimental : nous apprenons encore cet exercice';

for (const [lang, beta, exp, squat, bench, whole] of [
  ['en', 'Beta', EXP_EN, 'Squat', 'Bench press', 'Your whole body in the frame, feet included.'],
  ['fr', 'Bêta', EXP_FR, 'Squat', 'Développé couché', 'Le corps entier dans le cadre, pieds compris.'],
]) {
  test(`tiers on the cards, the filming screen and the guide (${lang})`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(l => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', l); }, lang);
    await page.goto('/workout-vision/');
    await expect(page.locator('.altar')).toHaveCount(8, { timeout: 20000 });
    await expect(page.locator('.altar .tier-beta')).toHaveCount(4);
    await expect(page.locator('.altar .tier-experimental')).toHaveCount(4);
    await expect(page.locator('.altar', { hasText: squat }).first().locator('.tier')).toHaveText(beta);
    await expect(page.locator('.altar', { hasText: bench }).locator('.tier')).toHaveText(exp);
    await page.locator('.altar', { hasText: bench }).click();
    await expect(page.locator('.film-screen .tier')).toHaveText(exp, { timeout: 20000 });
    await page.goBack();
    await page.locator('.altar', { hasText: squat }).first().click();
    await expect(page.getByText(whole, { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.film-screen .tier')).toHaveText(beta);
    await page.goto('/workout-vision/#exercises');
    await expect(page.locator('[data-exercise="bench_press"] .tag')).toHaveText(lang === 'fr' ? 'Expérimental' : 'Experimental', { timeout: 20000 });
    await expect(page.locator('[data-exercise="squat"] .tag')).toHaveText(beta);
    await expect(page.locator('[data-exercise="overhead_press"] .tag')).toHaveText('Guide');
    expect(errors, errors.join('\n')).toEqual([]);
  });
}
