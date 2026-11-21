// The coach's comparison (David, 18 November 2026): from Espace pro, the coach's own video beside the client's, in the
// coach's words, with no physiotherapist's word, no healthy-side mode and no verdict.
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, locale: 'fr-FR', reducedMotion: 'reduce' });

test('Espace pro opens the comparison of the coach\'s video with the client\'s, in the coach\'s words', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/');
  await page.getByTestId('choice-pro').click();
  await expect(page.getByTestId('pro-screen')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('pro-compare').click();
  const screen = page.getByTestId('coach-compare-screen');
  await expect(screen).toBeVisible({ timeout: 20_000 });
  const text = await screen.innerText();
  for (const word of ['Votre vidéo', 'La vidéo de votre client']) expect(text).toContain(word);
  for (const word of ['kiné', 'patient', 'Rééducation', 'côté sain']) expect(text).not.toContain(word);
  await expect(page.getByTestId('rc-mode-healthy')).toHaveCount(0);
  await expect(page.getByTestId('rc-compare')).toBeDisabled();
  await page.getByTestId('reference-back-btn').click();
  await expect(page.getByTestId('pro-screen')).toBeVisible();
});

// The production build offers the coach comparison directly.
test('the production build offers the coach comparison', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('http://localhost:4176/workout-vision/');
  await page.getByTestId('choice-pro').click();
  await expect(page.getByTestId('pro-screen')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('pro-compare')).toBeVisible();
  expect(await page.locator('body').innerText()).toContain('Comparer avec votre vidéo');
});
