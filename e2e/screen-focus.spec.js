// After a screen change, focus is on the new screen, never left on the screen that went (inert) or on nothing:
// VoiceOver and the keyboard go on from the new screen's title (audit of 3 October).
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });

test('the new screen takes the focus', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/');
  const row = page.getByRole('button', { name: /Vos séries/ });
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.history-screen')).toBeVisible({ timeout: 20000 });
  await expect.poll(() => page.evaluate(() => {
    const a = document.activeElement;
    return !!a && a !== document.body && !a.closest('.wv-leaving') && !!a.closest('.wv-current');
  })).toBe(true);
});

test('after a set is deleted, focus is on the next set, not on nothing', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => new Promise((ok, ko) => {
    const r = indexedDB.open('workoutVision');
    r.onerror = () => ko(r.error);
    r.onsuccess = () => { const tx = r.result.transaction('workouts', 'readwrite'); for (const [id, t] of [['a', 1], ['b', 2]]) tx.objectStore('workouts').put({ id, exercise: 'bicep_curl', reps: 7, source: 'counter-core', createdAt: Date.now() - t * 60000 }, id); tx.oncomplete = () => { r.result.close(); ok(); }; tx.onerror = () => ko(tx.error); };
  }));
  await page.reload();
  await page.getByRole('button', { name: /Vos séries/ }).click();
  await page.locator('.hist-btn').first().click();
  await page.getByRole('button', { name: 'Supprimer cette série' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Touchez encore pour supprimer' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.hist-btn')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList.contains('hist-btn') ?? false)).toBe(true);
});
