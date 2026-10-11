// The screen shown when the app cannot start (28 September 2026): it spoke English only, in the
// colours of the old brand, and its Reload button did nothing, since the page's CSP has no
// 'unsafe-inline' and so blocks onclick attributes. Must fail on 51024ef and pass after the fix.
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 375, height: 667 }, serviceWorkers: 'block' });

test('if the app cannot start, the screen speaks the page language and its button reloads', async ({ page }) => {
  // The app's entry script is answered with one that throws before React mounts.
  await page.route(/\/assets\/index-[^/]+\.js$/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'throw new Error("boot test")' }));
  await page.addInitScript(() => { localStorage.setItem('wv_lang', 'fr'); });
  await page.goto('/workout-vision/');
  await expect(page.getByRole('heading', { name: 'Un problème est survenu.' })).toBeVisible({ timeout: 10000 });
  let loads = 0;
  page.on('load', () => { loads += 1; });
  await page.getByRole('button', { name: 'Recharger' }).click();
  await expect.poll(() => loads, { timeout: 10000 }).toBeGreaterThan(0);
});
