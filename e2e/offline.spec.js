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

// SW now precaches all hashed JS/CSS assets via inject-sw-precache.js post-build.
// First load triggers SW install; second load is intercepted by SW and cached;
// offline reload serves from cache.
test('app loads offline after service worker precache', async ({ page, context }) => {
  // 1. First load — triggers SW install + precache of hashed assets
  await page.goto('/workout-vision/');
  await expect(page.locator('.logo')).toBeVisible({ timeout: 15_000 });

  // 2. Wait for SW to activate and claim the page
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('No SW support');
    const reg = await navigator.serviceWorker.ready;
    // Wait for clients.claim() to take effect
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
        setTimeout(resolve, 5000);
      });
    }
    // Give time for precache to complete
    await new Promise((r) => setTimeout(r, 3000));
  });

  // 3. Navigate again while online so SW intercepts and caches the response
  await page.goto('/workout-vision/');
  await expect(page.locator('.logo')).toBeVisible({ timeout: 15_000 });

  // 4. Go offline
  await context.setOffline(true);

  // 5. Reload — should serve entirely from SW cache
  await page.reload({ waitUntil: 'domcontentloaded' });

  // 6. Full app renders: logo + tab bar (not just shell HTML)
  await expect(page.locator('.logo')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.tab-bar')).toBeVisible({ timeout: 5_000 });
});
