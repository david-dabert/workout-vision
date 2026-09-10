import { test, expect } from '@playwright/test';

test('app loads offline after service worker precache', async ({ page, context }) => {
  // 1. Load the app normally — triggers SW install + precache
  await page.goto('/workout-vision/');
  await expect(page.locator('text=Workout Vision')).toBeVisible({ timeout: 15_000 });

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

  // 5. The app title should still render
  await expect(page.locator('text=Workout Vision')).toBeVisible({ timeout: 10_000 });
});
