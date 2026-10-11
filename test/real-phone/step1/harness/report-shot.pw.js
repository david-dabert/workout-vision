// Shoots the report sheet on the production build, in Chromium at 390×664 (2x), from a saved set of
// 7 biceps curls entered in the history (its only numbers). Run by copying it to e2e/zz-report-shot.spec.js (it is not named *.spec.js here, so that Vitest leaves it alone):
//   PW_CHROMIUM=… npx playwright test e2e/zz-report-shot.spec.js; then remove the copy.
import { test, expect } from '@playwright/test';
test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM }, viewport: { width: 390, height: 664 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
test('report sheet', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar').first()).toBeVisible({ timeout: 20000 });
  await page.evaluate(() => new Promise(r => { const q = indexedDB.open('workoutVision'); q.onsuccess = () => { const tx = q.result.transaction('workouts', 'readwrite'); tx.objectStore('workouts').put({ id: 's', exercise: 'bicep_curl', reps: 7, source: 'manual', createdAt: Date.now() }, 's'); tx.oncomplete = () => { q.result.close(); r(); }; }; }));
  await page.reload();
  await page.getByRole('button', { name: /Vos séries/ }).click();
  await page.locator('.hist-btn').click();
  await page.locator('.hist-detail .btn-line').click();
  await page.fill('#fName', 'Anaïs Lefèvre');
  await page.getByRole('button', { name: 'En binôme' }).click();
  await page.fill('#fPartner', 'Sam Dupont');
  await page.getByRole('button', { name: 'Intermédiaire' }).click();
  await page.fill('#fNotes', 'Tempo lent.');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test/real-phone/step1/screens/report-fr-form-390x664.png' });
  await page.locator('.sheet').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 200));
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'test/real-phone/step1/screens/report-fr-sheet-390x664.png' });
});
