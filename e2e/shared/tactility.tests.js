// Tactility sprint (28 September 2026): the rail glides and pans without hesitation,
// only the centred card animates, the chosen card names the frame it grows into, and
// the guide's licence credit closes the list.
// The tests themselves, run in Chromium (tactility.spec.js) and in WebKit with the iPhone profile
// (tactility.webkit.spec.js). `cdp` is false in WebKit.
export default function tactilityTests(test, expect, { cdp = true } = {}) {
  test('rail, card and transition', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    // Choosing a lift prefetches the pose model; no analysis runs here, and a fresh test context
    // cannot cache the 9 MB file (net::ERR_CACHE_WRITE_FAILURE), so it is answered empty.
    await page.route('**/pose_landmarker_full.task', r => r.fulfill({ status: 200, body: '' }));
    await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'en'); });
    await page.goto('/workout-vision/');
    await expect(page.locator('.altar')).toHaveCount(9, { timeout: 20000 });
    const rail = await page.locator('.rail').evaluate(el => ({ touch: getComputedStyle(el).touchAction, snap: getComputedStyle(el.children[0]).scrollSnapStop }));
    expect(rail).toEqual({ touch: 'pan-x pan-y', snap: 'normal' });
    // No switch input may sit in the rail: on iOS Safari it takes the horizontal drag for its thumb.
    await expect(page.locator('.rail input[switch]')).toHaveCount(0);
    await expect(page.locator('.rail input')).toHaveCount(0);
    await expect(page.locator('.rail > button.altar')).toHaveCount(9);
    // Without ?perf=1 there is no instrument.
    await expect(page.locator('[data-testid="perf-overlay"]')).toHaveCount(0);
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

  // Drives touch through Chrome's DevTools protocol, which WebKit does not have: Chromium only.
  if (cdp) {
    test('a vertical drag that starts on a card scrolls a short screen', async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 375, height: 548 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      const page = await context.newPage();
      await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'en'); });
      await page.goto('/workout-vision/');
      await expect(page.locator('.altar')).toHaveCount(9, { timeout: 20000 });
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
  }

  // Drives touch through Chrome's DevTools protocol, which WebKit does not have: Chromium only.
  if (cdp) {
    test('the ?perf=1 instrument shows frames per second and the element touched, and sends nothing', async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      const page = await context.newPage();
      const outside = [];
      page.on('request', r => { if (!r.url().startsWith('http://localhost:4173/')) outside.push(r.url()); });
      await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'en'); });
      await page.goto('/workout-vision/?perf=1');
      const overlay = page.locator('[data-testid="perf-overlay"]');
      await expect(overlay).toHaveCount(1, { timeout: 20000 });
      await expect(overlay).toContainText('fps', { timeout: 5000 });
      // A tap on the title, without a scroll, is no swipe.
      const cdp = await context.newCDPSession(page);
      const t = await page.locator('.choose-screen .title').boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(t.x + 20), y: Math.round(t.y + 10) }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(600);
      await expect(overlay).toContainText('frames dropped on the last swipe: none');
      await expect(overlay).toContainText('touched: h1');
      // A touch on a card names the card's button.
      const box = await page.locator('.altar').first().boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(box.x + box.width / 2), y: Math.round(box.y + 40) }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect(overlay).toContainText('button.altar.tactile', { timeout: 5000 });
      expect(outside).toEqual([]);
      await context.close();
    });
  }

  // Drives touch through Chrome's DevTools protocol, which WebKit does not have: Chromium only.
  if (cdp) {
    test('the instrument speaks French, follows the phone language and uses no em dash', async ({ browser }) => {
      // A French phone with no stored choice: the app and the instrument are in French.
      const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      const page = await context.newPage();
      await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.removeItem('wv_lang'); });
      await page.goto('/workout-vision/?perf=1');
      const overlay = page.locator('[data-testid="perf-overlay"]');
      await expect(overlay).toContainText('i/s', { timeout: 20000 });
      await expect(overlay).toContainText('images perdues au dernier balayage\u00A0: aucune');
      const cdp = await context.newCDPSession(page);
      // The figure on the card is a canvas inside the card's button.
      const n = await page.locator('.altar canvas').first().boundingBox();
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: Math.round(n.x + n.width / 2), y: Math.round(n.y + n.height / 2) }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await expect(overlay).toContainText('canvas dans button.altar.tactile', { timeout: 5000 });
      const text = await overlay.textContent();
      expect(text).not.toContain('\u2014');
      expect(text).not.toContain(' in ');
      await context.close();
    });
  }

  // The entry's key since the design review of 7 October 2026 (C2): "Commencer", 17 px at 600, a bone key.
  test('the entry\'s Start button keeps its size, weight and colour', async ({ page }) => {
    await page.goto('/workout-vision/?entry');
    const style = await page.locator('.enter').evaluate(el => { const s = getComputedStyle(el); return { size: s.fontSize, weight: s.fontWeight, tag: el.tagName, colour: s.color }; });
    expect(style).toEqual({ size: '17px', weight: '600', tag: 'BUTTON', colour: 'rgb(8, 7, 6)' });
  });

  // Drives touch through Chrome's DevTools protocol, which WebKit does not have: Chromium only.
  if (cdp) {
    test('a card press waits 80 ms and a rail scroll cancels it, leaving other presses alone', async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
      const page = await context.newPage();
      await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'en'); });
      await page.goto('/workout-vision/');
      await expect(page.locator('.altar')).toHaveCount(9, { timeout: 20000 });
      await page.waitForTimeout(1200);
      const cdp = await context.newCDPSession(page);
      const box = await page.locator('.altar').first().boundingBox();
      const at = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + 60) };
      // Held still, the press appears after 80 ms, not before.
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
      const early = await page.evaluate(() => new Promise(r => setTimeout(() => r(document.querySelectorAll('.rail .is-pressed').length), 40)));
      await page.waitForTimeout(150);
      expect(early).toBe(0);
      expect(await page.locator('.rail .is-pressed').count()).toBe(1);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await page.waitForTimeout(50);
      // A second touch: the rail scrolls before the 80 ms are up, and the press never appears.
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
      await page.evaluate(() => {
        document.querySelector('.row-link')?.classList.add('is-pressed');
        return new Promise(r => setTimeout(() => { document.querySelector('.rail').scrollLeft = 292; r(); }, 40));
      });
      await page.waitForTimeout(120);
      expect(await page.locator('.rail .is-pressed').count()).toBe(0); // the scroll cancelled it
      expect(await page.locator('.row-link.is-pressed').count()).toBe(1); // a press elsewhere stays
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await context.close();
    });
  }

  // In WebKit, where Chrome's DevTools protocol is missing, these are weaker stand-ins under their own
  // titles, not the same checks. The instrument is driven by Playwright's touch tap, a real touch event
  // in WebKit (PerfOverlay listens to touchstart). The press logic of main.jsx is fed pointer events
  // made in page script, so it proves the logic runs in WebKit, not that WebKit delivers pointerdown for
  // a finger held on a card: Playwright's WebKit touchscreen only taps, so a held touch and the native
  // vertical drag stay open in WebKit (29 September 2026).
  if (!cdp) {
    test('open in WebKit: a vertical drag that starts on a card scrolls a short screen', () => {
      test.skip(true, 'needs native touch scrolling, which only Chrome\'s DevTools protocol can drive here: Chromium only');
    });

    test('the ?perf=1 instrument shows frames per second and the element tapped (Playwright tap), and sends nothing', async ({ page }) => {
      const outside = [];
      page.on('request', r => { if (!r.url().startsWith('http://localhost:4173/')) outside.push(r.url()); });
      await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'en'); });
      await page.goto('/workout-vision/?perf=1');
      const overlay = page.locator('[data-testid="perf-overlay"]');
      await expect(overlay).toHaveCount(1, { timeout: 20000 });
      await expect(overlay).toContainText('fps', { timeout: 5000 });
      // A tap on the title, without a scroll, is no swipe.
      const t = await page.locator('.choose-screen .title').boundingBox();
      await page.touchscreen.tap(Math.round(t.x + 20), Math.round(t.y + 10));
      await page.waitForTimeout(600);
      await expect(overlay).toContainText('frames dropped on the last swipe: none');
      await expect(overlay).toContainText('touched: h1');
      // A touch on a card names the card's button.
      const box = await page.locator('.altar').first().boundingBox();
      await page.touchscreen.tap(Math.round(box.x + box.width / 2), Math.round(box.y + 40));
      await expect(overlay).toContainText('button.altar.tactile', { timeout: 5000 });
      expect(outside).toEqual([]);
    });

    test.describe('on a French phone', () => {
      test.use({ locale: 'fr-FR' });
      test('the instrument speaks French, follows the phone language and uses no em dash (Playwright tap)', async ({ page }) => {
        await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.removeItem('wv_lang'); });
        await page.goto('/workout-vision/?perf=1');
        const overlay = page.locator('[data-testid="perf-overlay"]');
        await expect(overlay).toContainText('i/s', { timeout: 20000 });
        await expect(overlay).toContainText('images perdues au dernier balayage\u00A0: aucune');
        // The figure on the card is a canvas inside the card's button.
        const n = await page.locator('.altar canvas').first().boundingBox();
        await page.touchscreen.tap(Math.round(n.x + n.width / 2), Math.round(n.y + n.height / 2));
        await expect(overlay).toContainText('canvas dans button.altar.tactile', { timeout: 5000 });
        const text = await overlay.textContent();
        expect(text).not.toContain('\u2014');
        expect(text).not.toContain(' in ');
      });
    });

    test('the press logic, fed synthetic pointer and scroll events: 80 ms wait, a rail scroll cancels, a scroll elsewhere does not', async ({ page }) => {
      await page.addInitScript(() => { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_lang', 'en'); });
      await page.goto('/workout-vision/');
      await expect(page.locator('.altar')).toHaveCount(9, { timeout: 20000 });
      await page.waitForTimeout(1200);
      const card = page.locator('.altar').first();
      const box = await card.boundingBox();
      const at = { clientX: Math.round(box.x + box.width / 2), clientY: Math.round(box.y + 60) };
      const finger = { pointerType: 'touch', isPrimary: true, pointerId: 1, ...at };
      // Every time is measured inside the page from the pointerdown itself: two separate Playwright
      // calls leave an unbounded gap that eats the 80 ms (CI run 148). WebKit delivers a real scroll
      // event at its next rendering update, which on CI came more than 140 ms after the scroll (run
      // 150), after the 80 ms. So the scroll that must cancel the waiting press is a scroll event sent
      // 10 ms after the touch, which reaches main.jsx's capturing listener as a real one does; a real
      // scroll is checked apart, for its arrival and its effect once it arrives (review, 29 September).
      const press = (sendAt, where = '.rail') => page.evaluate(([f, sendAt, where]) => new Promise(resolve => {
        const card = document.querySelector('.altar'), scroller = document.querySelector(where);
        const lit = () => document.querySelectorAll('.rail .is-pressed').length;
        const out = {};
        card.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true, ...f }));
        setTimeout(() => { out.at40 = lit(); }, 40);
        if (sendAt != null) setTimeout(() => scroller.dispatchEvent(new Event('scroll')), sendAt);
        setTimeout(() => { out.at150 = lit(); resolve(out); }, 150);
      }), [finger, sendAt, where]);
      // Held still, the press appears after 80 ms, not before.
      const still = await press(null);
      expect(still.at40).toBe(0);
      expect(still.at150).toBe(1);
      await card.dispatchEvent('pointercancel', finger);
      await page.waitForTimeout(50);
      // A second touch: the rail scrolls before the 80 ms are up, and the press never appears.
      const scrolled = await press(10);
      expect(scrolled.at150).toBe(0);
      await card.dispatchEvent('pointercancel', finger);
      await page.waitForTimeout(50);
      // A third: a real scroll of the rail arrives, whenever WebKit sends it, and leaves no press shown.
      const real = await page.evaluate(f => new Promise(resolve => {
        const card = document.querySelector('.altar'), rail = document.querySelector('.rail');
        card.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true, ...f }));
        rail.addEventListener('scroll', () => setTimeout(() => resolve({ afterScroll: document.querySelectorAll('.rail .is-pressed').length }), 100), { once: true });
        setTimeout(() => { rail.scrollLeft = rail.scrollLeft ? 0 : 292; }, 10);
        setTimeout(() => resolve({}), 3000); // no scroll event at all: afterScroll stays undefined
      }), finger);
      expect(real.afterScroll).toBe(0);
      await card.dispatchEvent('pointercancel', finger);
      await page.waitForTimeout(50);
      // A fourth: a region that does not hold the card scrolls, and the press still appears.
      await page.evaluate(() => {
        const box = Object.assign(document.createElement('div'), { id: 'other-scroller' });
        box.style.cssText = 'position:fixed;left:0;top:0;width:40px;height:40px;overflow:auto;opacity:0.01';
        box.innerHTML = '<div style="height:400px"></div>';
        document.body.appendChild(box);
      });
      const elsewhere = await press(10, '#other-scroller');
      expect(elsewhere.at150).toBe(1); // only a scroll that holds the card cancels its press
      await card.dispatchEvent('pointercancel', finger);
      await page.evaluate(() => document.getElementById('other-scroller').remove());
    });
  }
}
