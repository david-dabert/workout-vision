// Small screens (28 September 2026). David's iPhone, a 4.7-inch screen, showed the choice in the
// Claude app's browser at 375 x 556, with the bottom 77 px under the browser's floating bar: the
// first card ran under that bar and its figure had a strip 66 px high. The heading, the rail and
// the dots now fill the visible screen less a reserve for that bar, whatever the language or the
// greeting. Each test must fail on 51024ef and pass after the fix.
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });

async function open(browser, size, lang, returning = false) {
  const context = await browser.newContext({ viewport: size, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(l => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', l); }, lang);
  await page.goto('/workout-vision/');
  await expect(page.locator('.rail > .altar').first()).toBeVisible({ timeout: 20000 });
  if (returning) {
    // A saved set makes the visit a return: the choice opens on its greeting.
    await page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('workoutVision');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('workouts', 'readwrite');
        tx.objectStore('workouts').put({ id: 'manual-test', exercise: 'bicep_curl', reps: 6, source: 'manual', createdAt: Date.now() }, 'manual-test');
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    }));
    await page.reload();
    await expect(page.locator('.choose-screen.has-welcome')).toBeVisible({ timeout: 20000 });
  }
  await page.waitForTimeout(1500); // the reveal has settled
  const card = await page.evaluate(() => {
    const c = document.querySelector('.rail > .altar').getBoundingClientRect(), f = document.querySelector('.rail > .altar canvas').getBoundingClientRect();
    return { bottom: c.bottom, height: c.height, figure: f.height };
  });
  return { context, card };
}

for (const [lang, returning] of [['en', false], ['fr', false], ['fr', true]]) {
  test(`a 4.7-inch iPhone in an app's browser shows the whole first card above the bar (${lang}${returning ? ', returning' : ''})`, async ({ browser }) => {
    const { context, card } = await open(browser, { width: 375, height: 556 }, lang, returning);
    expect(card.bottom).toBeLessThanOrEqual(556 - 77);
    expect(card.figure).toBeGreaterThanOrEqual(120);
    await context.close();
  });
}

test('on every phone size the first card clears a floating browser bar and keeps its height', async ({ browser }) => {
  for (const size of [{ width: 375, height: 548 }, { width: 375, height: 667 }, { width: 390, height: 664 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    const { context, card } = await open(browser, size, 'fr');
    expect(card.bottom, JSON.stringify(size)).toBeLessThanOrEqual(size.height - 72);
    expect(card.height, JSON.stringify(size)).toBeGreaterThanOrEqual(248);
    await context.close();
  }
});

test('with ?perf=1 the instrument reads out the screen the page is given', async ({ browser }) => {
  // On the phone this tells the layout's real numbers: the window, the small and dynamic viewport
  // heights, the safe areas at the top and bottom, and a browser or the home screen.
  const context = await browser.newContext({ viewport: { width: 375, height: 556 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'en'); });
  await page.goto('/workout-vision/?perf=1');
  await expect(page.locator('[data-testid="perf-overlay"]')).toContainText('375×556 · svh 556 · dvh 556 · safe 0/0 · browser', { timeout: 20000 });
  await context.close();
});
