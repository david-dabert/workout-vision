// The gym session loop (Phase 1 of docs/SPEC-production.md), on the video path with a pose worker that answers with
// David's real biceps curl set (e2e/shared/filmed-set.js), or with no body, which the app refuses:
//   WP1.3 after a saved set, "Nouvelle série" lands on the filming screen of the same lift;
//   WP1.4 closing a counted set not yet saved asks "Garder cette série ?": keep saves, discard does not; back too;
//   WP1.5 the choice shows the recent lifts, one tap to their filming screen;
//   WP1.6 a refused set can be logged by hand, and the history says "Saisi à la main".
import { test, expect } from '@playwright/test';
import { start, openFilm, chooseDrawnVideo, saveSet, openHistory } from './shared/filmed-set.js';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
const BASE = '/workout-vision/';

async function analysed(page) {
  await openFilm(page, BASE);
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60000 });
}
const savedCount = page => page.evaluate(() => new Promise((ok, ko) => {
  const r = indexedDB.open('workoutVision');
  r.onerror = () => ko(r.error);
  r.onsuccess = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains('workouts')) { db.close(); ok(0); return; }
    const q = db.transaction('workouts').objectStore('workouts').count();
    q.onsuccess = () => { db.close(); ok(q.result); };
    q.onerror = () => { db.close(); ko(q.error); };
  };
}));

test('WP1.3: "Nouvelle série" goes back to filming the same lift; "Changer d’exercice" to the choice, with the lift in the recents (WP1.5)', async ({ page }) => {
  test.setTimeout(150000);
  const errors = await start(page);
  await saveSet(page, BASE);
  await page.getByTestId('new-set').click();
  await expect(page.locator('.film-screen')).toBeVisible();
  await expect(page.locator('.film-screen .title')).toHaveText('Curl biceps');
  await expect(page).toHaveURL(/#film$/);
  // A second set of the same lift, then a change of lift: the choice offers the lift back in one tap.
  await chooseDrawnVideo(page);
  await expect(page.locator('.result-screen')).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: 'Oui, c’est juste' }).click();
  await page.getByTestId('change-lift').click();
  const recents = page.getByTestId('recents');
  await expect(recents).toBeVisible();
  await expect(recents.getByRole('button')).toHaveText(['Curl biceps']);
  await recents.getByRole('button', { name: 'Curl biceps' }).click();
  await expect(page.locator('.film-screen .title')).toHaveText('Curl biceps');
  expect(await savedCount(page)).toBe(2);
  expect(errors).toEqual([]);
});

test('WP1.4: closing an unsaved set asks; "Ne pas garder" saves nothing, "Garder" saves it', async ({ page }) => {
  test.setTimeout(150000);
  const errors = await start(page);
  await analysed(page);
  await page.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByTestId('close-card')).toBeVisible();
  await expect(page.getByTestId('close-card')).toContainText('Garder cette série');
  await expect(page.locator('#close-q')).toBeFocused();
  await page.getByTestId('close-discard').click();
  await expect(page.locator('.choose-screen')).toBeVisible();
  expect(await savedCount(page)).toBe(0);
  // The same set again: this time kept from the close button.
  await analysed(page);
  await page.getByRole('button', { name: 'Fermer' }).click();
  await page.getByTestId('close-keep').click();
  await expect(page.locator('.choose-screen')).toBeVisible();
  expect(await savedCount(page)).toBe(1);
  expect(errors).toEqual([]);
});

test('WP1.4: the browser\'s back on an unsaved set stays on it and asks; once saved, close asks nothing', async ({ page }) => {
  test.setTimeout(150000);
  const errors = await start(page);
  await analysed(page);
  await page.goBack();
  await expect(page.getByTestId('close-card')).toBeVisible();
  await expect(page.locator('.result-screen')).toBeVisible();
  // A second back asks again, and does not leave.
  await page.goBack();
  await expect(page.locator('.result-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Oui, c’est juste' }).click();
  await expect(page.getByTestId('saved-card')).toBeVisible();
  await expect(page.getByTestId('close-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.locator('.choose-screen')).toBeVisible();
  expect(await savedCount(page)).toBe(1);
  expect(errors).toEqual([]);
});

test('WP1.6: a refused set is logged by hand, from 0, and the history says it was typed', async ({ page }) => {
  test.setTimeout(150000);
  const errors = await start(page, { nobody: true });
  await analysed(page);
  await expect(page.locator('.refused-title')).toHaveText('Nous n’avons pas pu compter cette série.');
  await page.getByTestId('manual-open').click();
  const card = page.getByTestId('fix-card');
  await expect(card).toBeVisible();
  const save = card.getByRole('button', { name: 'Enregistrer' });
  await expect(save).toBeDisabled();
  for (let i = 0; i < 8; i++) await card.getByRole('button', { name: 'Une de plus' }).click();
  await save.click();
  await expect(page.getByTestId('saved-card')).toContainText('8 répétitions enregistrées, saisies à la main.');
  await page.getByTestId('change-lift').click();
  await openHistory(page);
  await expect(page.locator('.hist-btn').first()).toContainText('Saisi à la main');
  await page.locator('.hist-btn').first().click();
  await expect(page.locator('.hist-corr')).toHaveText('Saisi à la main : l’app n’a pas pu compter cette série.');
  expect(errors).toEqual([]);
});
