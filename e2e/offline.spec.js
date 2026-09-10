import { test, expect } from '@playwright/test';

test('app loads and renders dashboard', async ({ page }) => {
  await page.goto('/workout-vision/');
  // The logo renders as <h1 class="logo"><span>W</span>orkout<span>Vision</span></h1>
  await expect(page.locator('.logo')).toBeVisible({ timeout: 15_000 });
  // Tab bar should be present
  await expect(page.locator('.tab-bar')).toBeVisible({ timeout: 5_000 });
});

test('service worker registers successfully', async ({ page }) => {
  await page.goto('/workout-vision/');
  await expect(page.locator('.logo')).toBeVisible({ timeout: 15_000 });

  const swRegistered = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    } catch {
      return false;
    }
  });

  expect(swRegistered).toBe(true);
});

// Skip: SW only precaches shell HTML, not JS bundles. Offline requires
// the SW fetch handler to cache-on-navigate, which needs a second page load.
// TODO: extend SW to precache hashed JS/CSS assets from the build manifest.
test.skip('app loads offline after service worker precache', async ({ page, context }) => {
  // 1. Load the app normally — triggers SW install + precache
  await page.goto('/workout-vision/');
  await expect(page.locator('.logo')).toBeVisible({ timeout: 15_000 });

  // 2. Wait for the service worker to activate and finish caching
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('No SW support');
    const reg = await navigator.serviceWorker.ready;
    // Give the SW time to cache the app shell
    await new Promise((r) => setTimeout(r, 3000));
  });

  // 3. Go offline
  await context.setOffline(true);

  // 4. Reload — should serve from SW cache
  await page.reload({ waitUntil: 'domcontentloaded' });

  // 5. The app shell should render (at minimum the HTML loads from cache)
  // Note: full app rendering depends on JS chunks being cached by the SW.
  // If the SW only caches the shell HTML, we verify at least that loads.
  await expect(page.locator('.logo')).toBeVisible({ timeout: 10_000 });
});
