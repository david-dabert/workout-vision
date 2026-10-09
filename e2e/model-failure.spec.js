// The pose model that cannot load: the screen asks for a reload and offers it (audit of 2 October).
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });

test('a model that cannot load offers the reload its words ask for', async ({ page }) => {
  let loads = 0;
  page.on('load', () => { loads++; });
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 404, body: '' }));
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/');
  await page.getByRole('button', { name: 'Curl biceps' }).first().click({ timeout: 20000 });
  await page.locator('.film-screen input[type=file]').nth(1).setInputFiles({ name: 'set.mov', mimeType: 'video/quicktime', buffer: Buffer.from('not a real video') });
  await expect(page.getByText('L’analyse n’a pas pu démarrer.', { exact: true })).toBeVisible({ timeout: 60000 });
  // One button per action: back to Film is "Refilmer", once; no second button doing the same (third audit C14, 3 October).
  await expect(page.getByRole('button', { name: 'Refilmer' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Choisir une autre vidéo' })).toHaveCount(0);
  const before = loads;
  await page.getByRole('button', { name: 'Recharger la page' }).click();
  await expect.poll(() => loads).toBeGreaterThan(before);
});

// A set the app could not read is still the lifter's to log (excellence hunt, 9 October 2026): the failure screen
// offers to try again without losing the video, and to type the count by hand, saved as the person's with no count
// of the app.
test('a set the app could not read can be typed by hand', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 404, body: '' }));
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/');
  await page.getByRole('button', { name: 'Curl biceps' }).first().click({ timeout: 20000 });
  await page.locator('.film-screen input[type=file]').nth(1).setInputFiles({ name: 'set.mov', mimeType: 'video/quicktime', buffer: Buffer.from('not a real video') });
  await expect(page.getByText('L’analyse n’a pas pu démarrer.', { exact: true })).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('error-restart')).toHaveText('Relancer l’analyse');
  await page.getByTestId('by-hand').click();
  await expect(page.getByTestId('fix-card')).toContainText('La vidéo n’a pas pu être lue, donc l’app ne propose aucun nombre.');
  await expect(page.locator('.rp-open')).toHaveCount(0);
  for (let k = 0; k < 8; k++) await page.getByRole('button', { name: 'Une de plus' }).click();
  await expect(page.getByTestId('res-typed')).toHaveText('8');
  await page.getByTestId('res-save').click();
  await expect(page.getByTestId('saved-card')).toContainText('8 répétitions enregistrées, saisies à la main.');
  const saved = await page.evaluate(() => new Promise(done => {
    const request = indexedDB.open('workoutVision');
    request.onsuccess = () => { const all = request.result.transaction('workouts').objectStore('workouts').getAll(); all.onsuccess = () => done(all.result); };
  }));
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ exercise: 'bicep_curl', reps: 8, source: 'manual', afterRefusal: true, machineResult: null });
});
