import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, locale: 'fr-FR', reducedMotion: 'reduce' });

// Task 3 (16 November 2026, David after meeting Christopher): Espace kiné returns to the home screen immediately
// so physiotherapists can send video exercise links; kineJudged() stays false in production (no automatic verdict).
test('task 3: Espace kiné row is on the home and opens #kine with no automatic verdict', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wv_seen_entry', 'true');
    localStorage.setItem('wv_lang', 'fr');
  });
  await page.goto('/workout-vision/');
  await expect(page.locator('.rail').first()).toBeVisible({ timeout: 20_000 });
  const refBtn = page.getByTestId('choice-reference');
  await expect(refBtn).toBeVisible();
  await expect(refBtn).toContainText('Espace kiné');
  await expect(refBtn).toContainText('Vos exercices en vidéo, envoyés à vos patients en un lien');
  await refBtn.click();
  await expect(page.locator('[data-testid^="kn-"]').first()).toBeVisible({ timeout: 20_000 });
  const text = await page.locator('body').innerText();
  for (const judged of ['Conforme', 'À revoir', 'Suivi']) expect(text).not.toContain(judged);
});

// Think tank of 16 November 2026: a patient opening a programme link for the first time lands on the programme, not
// on the welcome; the page judges nothing (buildFlags.js, kineJudged).
test('a first-time patient opens the programme link on the programme, with nothing judged', async ({ page }) => {
  await page.goto('/workout-vision/#kine-p=zH4sIAEIm-2oCA0WOwQrCMBBE_2XOW7DqQXL27geIh0AXXNsmJVmqEvrvbiG1p33M7IMpmOFaQi-B4QqCH-3iNsgsnECYnnFtYMijl2HFxWJOV_-FOxLezH2GOxNC1PoqyqNl9wLpLDEx5OYVJShnqxNP1rYHQmY1Ou3uQtVJUb1KDA1_lJNt2LTLZtnsv_UgdL7yD9smG5HUAAAA');
  await expect(page.getByTestId('kine-patient-screen')).toBeVisible({ timeout: 20_000 });
  const text = await page.locator('body').innerText();
  for (const judged of ['Conforme', 'À revoir', 'Envoyer le résultat', 'Proche de la référence']) expect(text).not.toContain(judged);
});
