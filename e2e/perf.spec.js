import { test, expect } from '@playwright/test';

// Phase 5 of David's order of 6 November 2026 (PLAN.md): on 4G and a slow phone, the first paint comes within 800 ms,
// the choice of lift takes a tap within 1500 ms of the start, and no pose file (the model, its WASM, the decoder's WASM)
// is fetched before the user's first tap. Measured on the build production gets (dist-prod, port 4176, built fresh by
// playwright.config.js), in Chromium at 375×667, each run from an empty profile (no HTTP cache, no service worker), three
// runs per case, the median judged.
//
// Network: WebPageTest's "4G" connectivity profile, 9 Mbps down and up, 170 ms round trip ([4G] in
// www/settings/connectivity.ini.sample, WPO-Foundation/webpagetest, commit a7cf6a77). Status: convention.
// Chromium applies it per request (Network.emulateNetworkConditions): the latency is added to each request, with no TCP
// or TLS handshake modelled, and the page comes from localhost, so this is lighter than a real 4G link of the same figures.
// CPU: 4x slowdown, Lighthouse's default ("a constant 4x CPU multiplier which moves a typical run in the high-end desktop
// bracket somewhere into the mid-tier mobile bracket", GoogleChrome/lighthouse docs/throttling.md). Status: convention.
// A CI runner is slower than a desktop, so 4x on it stands for a slow phone.
// Thresholds: David's (PLAN.md, Phase 5, Verification).

const PROD = 'http://localhost:4176/workout-vision/';
const FOUR_G = { offline: false, latency: 170, downloadThroughput: 9_000_000 / 8, uploadThroughput: 9_000_000 / 8 };
const CPU_SLOWDOWN = 4;
const FCP_MS = 800;
const INTERACTIVE_MS = 1500;
const RUNS = 3;
// A pose file: the model, the pose library's WASM and loaders (public/mediapipe/), the decoder's WASM.
const POSE_FILE = /\/mediapipe\/|\.task(?:\?|$)|\.wasm(?:\?|$)/;

test.skip(({ browserName }) => browserName !== 'chromium', 'network and CPU emulation use the DevTools protocol');

// In the page from its first script: the moment the element takes a tap, that is, it is in the view, enabled, and the
// point at the centre of its visible part hits it (no layer over it). Checked at every frame from the start.
function tappableProbe(sel) {
  const tick = () => {
    const el = document.querySelector(sel);
    if (el && !el.disabled) {
      const r = el.getBoundingClientRect();
      const left = Math.max(r.left, 0), right = Math.min(r.right, innerWidth);
      const top = Math.max(r.top, 0), bottom = Math.min(r.bottom, innerHeight);
      if (right > left && bottom > top) {
        const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
        if (hit && (hit === el || el.contains(hit))) { window.__wvTappable = performance.now(); return; }
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function coldRun(browser, { returning, target }) {
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR',
  });
  if (returning) await context.addInitScript(() => { try { localStorage.setItem('wv_seen_entry', 'true'); localStorage.setItem('wv_seen_landing', 'true'); } catch { /* none */ } });
  await context.addInitScript(tappableProbe, target);
  const requests = [];
  // The context sees the page's requests and its service worker's.
  context.on('request', r => requests.push(r.url()));
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', FOUR_G);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
  await page.goto(PROD, { waitUntil: 'commit' });
  const tappable = await (await page.waitForFunction(() => window.__wvTappable, null, { timeout: 20_000 })).jsonValue();
  const fcp = await (await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint')[0]?.startTime, null, { timeout: 20_000 })).jsonValue();
  // Left alone for 4 s: the screens' code warms when the page is quiet (App.jsx, whenQuiet), the service worker installs.
  await page.waitForTimeout(4000);
  return { context, page, fcp, tappable, requests: [...requests] };
}

const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

test('a returning visit with an empty cache: first paint under 800 ms, the choice takes a tap under 1500 ms, no pose file before the tap', async ({ browser }) => {
  test.setTimeout(180_000);
  const fcps = [], taps = [];
  for (let i = 0; i < RUNS; i++) {
    const run = await coldRun(browser, { returning: true, target: '.altar' });
    fcps.push(run.fcp); taps.push(run.tappable);
    expect(run.requests.filter(u => POSE_FILE.test(u)), 'no pose file before the first tap').toEqual([]);
    if (i === RUNS - 1) {
      // The deferral is not a removal: the tap on a lift starts the model's download (App.jsx, warmPoseFiles).
      const model = run.page.waitForRequest(r => /pose_landmarker_full\.task$/.test(r.url()), { timeout: 15_000 });
      await run.page.locator('.altar').first().click();
      await model;
    }
    await run.context.close();
  }
  const line = `returning visit, 4G and 4x CPU: first paint ${fcps.map(Math.round).join(', ')} ms (median ${Math.round(median(fcps))}); choice tappable ${taps.map(Math.round).join(', ')} ms (median ${Math.round(median(taps))})`;
  console.log(line);
  test.info().annotations.push({ type: 'perf', description: line });
  expect(median(fcps), line).toBeLessThan(FCP_MS);
  expect(median(taps), line).toBeLessThan(INTERACTIVE_MS);
});

test('a first visit: first paint under 800 ms, no pose file before any tap', async ({ browser }) => {
  test.setTimeout(180_000);
  const fcps = [], taps = [];
  for (let i = 0; i < RUNS; i++) {
    // The entry's "Commencer": measured and printed; the entry plays before it takes a tap, by design (Entry.jsx).
    const run = await coldRun(browser, { returning: false, target: '.entry .enter' });
    fcps.push(run.fcp); taps.push(run.tappable);
    expect(run.requests.filter(u => POSE_FILE.test(u)), 'no pose file before any tap').toEqual([]);
    await run.context.close();
  }
  const line = `first visit, 4G and 4x CPU: first paint ${fcps.map(Math.round).join(', ')} ms (median ${Math.round(median(fcps))}); "Commencer" tappable ${taps.map(Math.round).join(', ')} ms (median ${Math.round(median(taps))})`;
  console.log(line);
  test.info().annotations.push({ type: 'perf', description: line });
  expect(median(fcps), line).toBeLessThan(FCP_MS);
});
