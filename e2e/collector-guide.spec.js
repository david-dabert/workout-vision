import { test, expect } from '@playwright/test';
import { layoutFaults } from '../test/real-phone/checks.mjs';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, locale: 'fr-FR', reducedMotion: 'reduce' });

const keepFault = f => !f.startsWith('note: ');

test('card 040: #guide-collecte opens directly on a fresh French phone, renders 4 steps with zero faults, and enables #collecte', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.addInitScript(() => { localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/#guide-collecte');

  const screen = page.getByTestId('collect-guide');
  await expect(screen).toBeVisible({ timeout: 20_000 });
  await expect(screen).toContainText('Envoyer vos séries de test.');
  await expect(screen).toContainText('Choisir une vidéo');
  await expect(screen).toContainText('Envoyer les séries collectées');
  await expect(page.getByTestId('collect-guide-status')).toContainText('pas encore activée');
  expect((await page.evaluate(layoutFaults)).filter(keepFault)).toEqual([]);

  await page.getByTestId('collect-guide-activate').click();
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('collect-switched')).toContainText('Collecte activée sur ce téléphone');
  expect(await page.evaluate(() => localStorage.getItem('wv_collecte'))).toBe('1');
  expect(errors).toEqual([]);
});
