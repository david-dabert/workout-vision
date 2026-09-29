// Smoothness pass (28 September 2026), after the swipe fix of cd7d670. Each test must fail on
// cd7d670 and pass after its fix: a card dipping under :active, a list item lighting at once
// under a finger that starts a scroll, the light of a quick tap wiped by pointerleave, every
// figure drawn to open the choice, the guide's figure drawing on out of view, the scan line
// laid out on every frame, a WebGL context made before the first frame, screens loaded during
// a swipe.
import { test, expect } from '@playwright/test';

if (process.env.PW_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM } });
test.use({ viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });

const seen = () => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'en'); };
const touchContext = browser => browser.newContext({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });

test('only the press dips a lift card, never :active', async ({ page }) => {
  // iOS Safari applies :active the moment a finger lands, also on a swipe that starts on the card.
  await page.addInitScript(seen);
  await page.goto('/workout-vision/');
  await expect(page.locator('.rail > .altar').first()).toBeVisible({ timeout: 20000 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.rail > .altar' });
  await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] });
  await page.waitForTimeout(400); // past any transition
  expect(await page.locator('.rail > .altar').first().evaluate(el => getComputedStyle(el).scale)).toBe('none');
  await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
  await page.locator('.rail > .altar').first().evaluate(el => el.classList.add('is-pressed'));
  await page.waitForTimeout(400);
  expect(await page.locator('.rail > .altar').first().evaluate(el => getComputedStyle(el).scale)).toBe('0.975');
});

test('in a scrolling list the press waits 80 ms, and a scroll cancels it', async ({ browser }) => {
  const context = await touchContext(browser);
  const page = await context.newPage();
  await page.addInitScript(seen);
  await page.goto('/workout-vision/#exercises');
  const item = page.locator('.list .item-btn').nth(3);
  await expect(item).toBeAttached({ timeout: 20000 });
  await item.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200); // the reveal has settled
  const box = await item.boundingBox();
  const at = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  const cdp = await context.newCDPSession(page);
  // Held still, the press appears after 80 ms, not before.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
  const early = await page.evaluate(() => new Promise(r => setTimeout(() => r(document.querySelectorAll('.list .is-pressed').length), 40)));
  await page.waitForTimeout(150);
  expect(early).toBe(0);
  expect(await page.locator('.list .is-pressed').count()).toBe(1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await page.waitForTimeout(50);
  // A second touch: the list scrolls before the 80 ms are up, and the press never appears.
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
  await page.evaluate(() => new Promise(r => setTimeout(() => { document.querySelector('.wv-current .wv-experience').scrollTop += 120; r(); }, 30)));
  await page.waitForTimeout(150);
  expect(await page.locator('.list .is-pressed').count()).toBe(0);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await context.close();
});

test('a quick tap lights the control for a moment after the finger lifts', async ({ browser }) => {
  const context = await touchContext(browser);
  const page = await context.newPage();
  await page.addInitScript(seen);
  await page.goto('/workout-vision/#exercises');
  const chip = page.locator('.chip').first();
  await expect(chip).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1200);
  const box = await chip.boundingBox();
  const at = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  const cdp = await context.newCDPSession(page);
  // The 50 ms is timed in the page from the pointerup itself: a timer started by a later Playwright
  // call counts the gap between the calls against the light's 140 ms (as in CI run 148; local run of
  // 29 September).
  await page.evaluate(() => {
    window.__litAfterUp = new Promise(r => document.addEventListener('pointerup', () => setTimeout(() => r(document.querySelectorAll('.chip.is-pressed').length), 50), { once: true }));
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  // After a touch the browser sends pointerleave to the document; the light must outlive it.
  expect(await page.evaluate(() => window.__litAfterUp)).toBe(1);
  await page.waitForTimeout(400);
  expect(await page.locator('.chip.is-pressed').count()).toBe(0);
  await context.close();
});

test('opening the choice makes only the figures near the view; a swipe brings the next ones', async ({ page }) => {
  await page.addInitScript(seen);
  await page.goto('/workout-vision/');
  await expect(page.locator('.rail > .altar').first()).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(600);
  // A canvas keeps its default 300 x 150 until a scene sizes it.
  const sized = () => page.evaluate(() => [...document.querySelectorAll('.altar canvas')].map(c => !(c.width === 300 && c.height === 150)));
  const first = await sized();
  expect(first.slice(0, 2)).toEqual([true, true]);
  expect(first.length).toBeGreaterThan(4);
  expect(first.slice(4)).toEqual(first.slice(4).map(() => false));
  await page.evaluate(() => { const r = document.querySelector('.rail'); r.scrollLeft = r.children[4].offsetLeft - 40; });
  await expect.poll(async () => (await sized())[4]).toBe(true);
  // The card now in the centre animates.
  await expect.poll(() => page.evaluate(async () => {
    const r = document.querySelector('.rail'), mid = r.getBoundingClientRect().left + r.clientWidth / 2;
    const card = [...r.children].find(c => { const b = c.getBoundingClientRect(); return b.left < mid && b.right > mid; });
    const c = card.querySelector('canvas'), a = c.toDataURL();
    await new Promise(f => setTimeout(f, 300));
    return a !== c.toDataURL();
  })).toBe(true);
});

test('the guide figure stops drawing once scrolled out of view, and starts again', async ({ page }) => {
  await page.addInitScript(seen);
  await page.goto('/workout-vision/#exercises');
  await expect(page.locator('.map canvas')).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1000);
  const changes = () => page.evaluate(async () => {
    const c = document.querySelector('.map canvas'), a = c.toDataURL();
    await new Promise(r => setTimeout(r, 400));
    return a !== c.toDataURL();
  });
  await page.evaluate(() => { document.querySelector('.wv-current .wv-experience').scrollTop = 3000; });
  await page.waitForTimeout(300);
  expect(await changes()).toBe(false);
  await page.evaluate(() => { document.querySelector('.wv-current .wv-experience').scrollTop = 0; });
  await page.waitForTimeout(300);
  expect(await changes()).toBe(true);
});

test('the scan line of the filming screen moves by translation, never by top', async ({ page }) => {
  await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(seen);
  await page.goto('/workout-vision/');
  await expect(page.locator('.rail > .altar').first()).toBeVisible({ timeout: 20000 });
  await page.locator('.altar').first().click();
  const scan = page.locator('.film-screen .scan');
  await expect(scan).toBeAttached({ timeout: 20000 });
  const props = await scan.evaluate(el => el.getAnimations().flatMap(a => a.effect.getKeyframes().flatMap(k => Object.keys(k))));
  expect(props).toContain('translate');
  expect(props).not.toContain('top');
});

test('no WebGL context is made before the first frame', async ({ page }) => {
  await page.addInitScript(() => {
    window.__contexts = [];
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) { window.__contexts.push(String(type)); return get.call(this, type, ...rest); };
  });
  await page.addInitScript(seen);
  await page.goto('/workout-vision/');
  await expect(page.locator('.rail > .altar').first()).toBeVisible({ timeout: 20000 });
  expect((await page.evaluate(() => window.__contexts)).filter(t => /webgl/i.test(t))).toEqual([]);
});

test('the next screens load in a pause, never while a finger moves', async ({ browser }) => {
  const context = await touchContext(browser);
  const page = await context.newPage();
  const loads = [];
  page.on('request', r => { const m = r.url().match(/\/assets\/(Film|CoreUpload|Guide|History)-[^/]+\.js$/); if (m) loads.push({ name: m[1], at: Date.now() }); });
  await page.addInitScript(seen);
  await page.goto('/workout-vision/');
  await expect(page.locator('.rail > .altar').first()).toBeVisible({ timeout: 20000 });
  const cdp = await context.newCDPSession(page);
  const box = await page.locator('.rail').boundingBox();
  let x = Math.round(box.x + box.width * 0.6);
  const y = Math.round(box.y + 60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  const from = Date.now() + 200; // a load already started when the finger landed is let through
  for (let i = 0; i < 30; i++) {
    x += i % 2 ? 6 : -6;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
    await page.waitForTimeout(100);
  }
  const until = Date.now();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(loads.filter(l => l.at >= from && l.at < until)).toEqual([]);
  // Once the finger has lifted and the screen is quiet, filming's code comes first.
  await expect.poll(() => loads.map(l => l.name), { timeout: 10000 }).toContain('Film');
  await context.close();
});
