import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, locale: 'fr-FR', reducedMotion: 'reduce' });

// Card 043 (16 November 2026): the home invites no patient comparison before a written regulatory opinion (EU MDR,
// Rule 11; docs/SPEC-production.md); a physiotherapist who has the address still opens the workspace.
test('card 043: no Espace kiné row on the home, #kine still opens', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wv_seen_entry', 'true');
    localStorage.setItem('wv_lang', 'fr');
  });
  await page.goto('/workout-vision/');
  await expect(page.locator('.rail').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('choice-reference')).toHaveCount(0);
  await page.goto('/workout-vision/#kine');
  await expect(page.locator('[data-testid^="kn-"]').first()).toBeVisible({ timeout: 20_000 });
});
