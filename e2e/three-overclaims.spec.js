// Card 014 (cards/014-three-overclaims.md; docs/FLAWS-2026-11.md #2, #3, #4): on the production build, after a person's
// third saved set of a curl, no profile quiz with its femur and calorie claims, no "Mocap" on the report button, and no
// bar path offered on a set without a bar.
import { test, expect } from '@playwright/test';
import { start, saveSet } from './shared/filmed-set.js';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
const PROD = 'http://localhost:4176/workout-vision/';

test('after a third saved curl: no profile quiz, no "Mocap", no bar path', async ({ page }) => {
  test.setTimeout(300_000);
  await start(page);
  // Three curls filmed and saved, as a person would: the third result is the one read.
  await saveSet(page, PROD);
  await saveSet(page, PROD);
  const card = await saveSet(page, PROD);
  await expect(card).toBeVisible();
  // The quiz's offer is read when the result screen draws again after the sets are read back (Result.jsx reads
  // knownSets() in render): any later tap redraws it, here « Défier un ami ».
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Défier un ami' }).click();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('open-retention-quiz-btn')).toHaveCount(0);
  await expect(page.getByTestId('res-report-btn')).not.toContainText(/mocap/i);
  await page.getByRole('button', { name: 'Revoir la série avec le squelette', exact: true }).click();
  await expect(page.locator('.replay-screen')).toBeVisible();
  await expect(page.getByTestId('rp-mocap-toggle')).toBeVisible();
  await expect(page.getByTestId('rp-barpath-toggle')).toHaveCount(0);
});
