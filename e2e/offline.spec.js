import { test, expect } from '@playwright/test';

// A first visit plays the entry once, then shows the choice of lift.
// A returning visit opens straight on the choice.
async function reachChoice(page) {
  const enter = page.locator('.enter');
  const lifts = page.locator('.altar');
  await Promise.race([
    enter.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}),
    lifts.first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {}),
  ]);
  // The button takes taps once the entry has started to play; click() waits for that.
  if (await enter.isVisible().catch(() => false)) await enter.click();
  await expect(lifts).toHaveCount(3, { timeout: 15_000 });
}

test('app loads and shows the choice of lift', async ({ page }) => {
  await page.goto('/workout-vision/');
  await reachChoice(page);
});

test('service worker registers successfully', async ({ page }) => {
  await page.goto('/workout-vision/');
  await reachChoice(page);

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

// SW precaches all hashed JS/CSS assets via inject-sw-precache.js post-build.
// First load triggers SW install; second load is intercepted by SW and cached;
// offline reload serves from cache.
test('app loads offline after service worker precache', async ({ page, context }) => {
  // 1. First load — triggers SW install + precache of hashed assets
  await page.goto('/workout-vision/');
  await reachChoice(page);

  // 2. Wait for SW to activate and claim the page
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('No SW support');
    await navigator.serviceWorker.ready;
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
  await reachChoice(page);

  // 4. Go offline
  await context.setOffline(true);

  // 5. Reload — should serve entirely from SW cache
  await page.reload({ waitUntil: 'domcontentloaded' });

  // 6. The full app renders, not just the shell: the three lifts on the choice screen
  await expect(page.locator('.altar')).toHaveCount(3, { timeout: 10_000 });
});
