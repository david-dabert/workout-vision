// Tactility sprint (28 September 2026): the rail glides and pans without hesitation,
// only the centred card animates, the chosen card names the frame it grows into, and
// the guide's licence credit closes the list.
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });

test('rail, card and transition', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // Choosing a lift prefetches the pose model; no analysis runs here, and a fresh test context
  // cannot cache the 9 MB file (net::ERR_CACHE_WRITE_FAILURE), so it is answered empty.
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'en'); });
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar')).toHaveCount(8, { timeout: 20000 });
  const rail = await page.locator('.rail').evaluate(el => ({ touch: getComputedStyle(el).touchAction, snap: getComputedStyle(el.children[0]).scrollSnapStop }));
  expect(rail).toEqual({ touch: 'pan-x pan-y', snap: 'normal' });
  // Only the centred card draws: a card off screen keeps the same pixels over time.
  const still = await page.evaluate(async () => {
    const c = document.querySelectorAll('.altar canvas')[5];
    const a = c.toDataURL(); await new Promise(r => setTimeout(r, 400)); return a === c.toDataURL();
  });
  expect(still).toBe(true);
  const moving = await page.evaluate(async () => {
    const c = document.querySelectorAll('.altar canvas')[0];
    const a = c.toDataURL(); await new Promise(r => setTimeout(r, 400)); return a !== c.toDataURL();
  });
  expect(moving).toBe(true);
  // The dot follows the card in the centre, also after a partial swipe that snaps back.
  const dot = await page.evaluate(async () => {
    const r = document.querySelector('.rail'), wait = ms => new Promise(f => setTimeout(f, ms));
    r.style.scrollSnapType = 'none'; r.scrollLeft = 100; await wait(200); r.scrollLeft = 0; await wait(200);
    r.style.scrollSnapType = '';
    return [...document.querySelectorAll('.dots i')].findIndex(d => d.classList.contains('on'));
  });
  expect(dot).toBe(0);
  // Choosing, going back and choosing again at once: one name at a time, no transition error.
  await page.locator('.altar').nth(0).click();
  await expect(page.locator('.film-screen .frame')).toBeVisible({ timeout: 20000 });
  await page.locator('.film-screen .icon-btn').first().click();
  await page.waitForTimeout(150);
  await page.locator('.choose-screen .altar').nth(1).click();
  await page.waitForURL(/#film$/);
  await expect(page.locator('.wv-leaving')).toHaveCount(0, { timeout: 20000 });
  // After its transition the frame gives the name back.
  await expect.poll(() => page.locator('.film-screen .frame').evaluate(el => el.style.viewTransitionName)).toBe('');
  // A navigation right after a card is chosen wins over the transition still pending.
  await page.locator('.film-screen .icon-btn').first().click();
  await page.locator('.choose-screen .altar').nth(2).click();
  await page.goto('/workout-vision/#exercises');
  await expect(page.locator('.wv-current .guide-screen')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.wv-current .guide-credit')).toHaveCount(1, { timeout: 20000 });
  await page.locator('input[type=search], .guide-search input, input').first().fill('zzzz');
  await expect(page.locator('.empty')).toBeVisible();
  expect(await page.evaluate(() => !!(document.querySelector('.empty').compareDocumentPosition(document.querySelector('.guide-credit')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await page.locator('input[type=search], .guide-search input, input').first().fill('');
  const creditLast = await page.evaluate(() => {
    const credit = document.querySelector('.guide-credit'), list = document.querySelector('.list');
    return !!(list.compareDocumentPosition(credit) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(creditLast).toBe(true);
  await expect(page.locator('.guide-credit')).toContainText('Illustrations: Everkinetic, via bryllim/workout-guide, CC BY-SA 4.0. Resized and converted to WebP.');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('a vertical drag that starts on a card scrolls a short screen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 548 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'en'); });
  await page.goto('/workout-vision/');
  await expect(page.locator('.altar')).toHaveCount(8, { timeout: 20000 });
  await page.waitForTimeout(1200);
  const box = await page.locator('.altar').first().boundingBox();
  const cdp = await context.newCDPSession(page);
  const x = Math.round(box.x + box.width / 2);
  let y = Math.round(box.y + box.height * 0.7);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 0; i < 10; i++) { y -= 20; await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); await page.waitForTimeout(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => document.querySelector('.choose-screen').scrollTop)).toBeGreaterThan(0);
  await context.close();
});
