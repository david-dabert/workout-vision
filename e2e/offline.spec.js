import { test, expect } from '@playwright/test';

// The deploy runs this spec on the very build it publishes, built with the real VITE_EVENTS_URL, online
// (deploy.yml): every usage count those test visits would send is aborted here, so they never reach the production
// counts (review finding N2). The page's own requests run as before, so the artifact tested is the one published.
// The service worker leaves POSTs and other origins to the network (public/sw.js), and the context's routes see
// both the page's and the worker's requests.
const EVENTS = process.env.VITE_EVENTS_URL ? new URL(process.env.VITE_EVENTS_URL).origin : '';
let blocked = 0;
test.beforeEach(async ({ context }) => {
  if (!EVENTS) return;
  await context.route(url => url.origin === EVENTS, route => { blocked += 1; return route.abort('blockedbyclient'); });
});
test.afterAll(() => { if (EVENTS) console.log(`usage counts aborted, never sent to ${EVENTS}: ${blocked} request(s)`); });

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
  await expect(lifts).toHaveCount(9, { timeout: 15_000 }); // nine lifts on offer since 28 September (PLAN.md, Lift tiers)
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

  // 6. The full app renders, not just the shell: the nine lifts on the choice screen
  await expect(page.locator('.altar')).toHaveCount(9, { timeout: 10_000 });
});

// Choosing a lift warms the files a first analysis needs, the decoder's WASM among them, so an analysis made offline
// before any made online still decodes with WebCodecs, not the playback fallback (third audit, C15).
test('choosing a lift keeps the decoder WASM for an analysis made offline', async ({ page }) => {
  await page.goto('/workout-vision/');
  await reachChoice(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
        setTimeout(resolve, 5000);
      });
    }
  });
  await page.locator('.altar').first().click();
  await expect.poll(() => page.evaluate(async () => {
    for (const name of await caches.keys()) {
      if (!name.startsWith('wv-wasm-')) continue;
      const cache = await caches.open(name);
      if (await cache.match(new URL('web-demuxer.wasm', location.origin + '/workout-vision/').href)) return true;
    }
    return false;
  }), { timeout: 20_000 }).toBe(true);
});
