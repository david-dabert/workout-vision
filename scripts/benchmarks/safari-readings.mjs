#!/usr/bin/env node
/**
 * Real Safari, read through the app's own harness (test/real-phone/harness.html), on the public demo clips
 * (14 October 2026). Safari is driven by safaridriver through selenium-webdriver; Chromium by Playwright on the same
 * machine, for comparison. Per clip and run it saves the landmarks, timestamps and the SHA-256 of every pixel buffer
 * handed to the pose model (harness pixelHashes), so safari-compare.ts can say whether the browsers decode the same
 * pixels and count the same reps. Runs in CI on macOS (.github/workflows/safari-readings.yml): no person's video
 * leaves the repository, only the five clips already published in public/demo/.
 *
 *   node scripts/benchmarks/safari-readings.mjs --browser=safari --runs=2 --out=readings
 *   node scripts/benchmarks/safari-readings.mjs --browser=chromium --runs=1 --out=readings
 *   node scripts/benchmarks/safari-readings.mjs --browser=safari --runs=2 --set=iphone --out=readings
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (name, dflt) => (process.argv.find(a => a.startsWith(`--${name}=`)) ?? `=${dflt}`).split('=')[1];
const BROWSER = arg('browser', 'safari');
const RUNS = Number(arg('runs', '1'));
const OUT = arg('out', 'readings');
const BASE = arg('base', 'http://localhost:5173/workout-vision/');
// --set=iphone reads the same clips re-encoded as an iPhone stores them (public/demo/iphone/: HEVC in .mov, frames stored
// out of display order, a frame dropped in seven so the frame rate varies), 14 November 2026: David's iPhone counted a
// hip thrust 1 for 12 after reading all 370 samples, where a computer reading a VP9 copy counts 12.
const SET = arg('set', 'demo');
// --readback=cpu: the extraction canvas kept in memory (frameExtractor.js options.readback), for runners that refuse
// Safari's readback of the default canvas.
const READBACK = arg('readback', '');
// demo: public/demo/<clip>.mp4. iphone: the same clips as HEVC with reordered frames at a variable rate, upright.
// iphone-rot: those stored sideways with a -90 degree display matrix, as an iPhone stores a portrait video, so WebKit's
// hand rotation (frameExtractor.js manualRotationNeeded) is read (14 November 2026).
const SUFFIX = { demo: '', iphone: '', 'iphone-rot': '-rot' }[SET];
if (SUFFIX === undefined) throw new Error(`unknown --set=${SET}`);
const HARNESS = `${BASE}test/real-phone/harness.html`;

// The five demo sets published on the About page (public/demo/), each named with David's count, and the lift the
// stability matrix of PR #174 read them as.
export const CLIPS = [
  { clip: 'dip-13', lift: 'dip', label: 13 },
  { clip: 'ez-curl-10', lift: 'bicep_curl', label: 10 },
  { clip: 'bodyweight-squat-9', lift: 'squat', label: 9 },
  { clip: 'lat-pulldown-6', lift: 'lat_pulldown', label: 6 },
  { clip: 'bicep-curl-5', lift: 'bicep_curl', label: 5 },
];

// Run inside the page: read one clip whole, keep what the comparison needs (no image landmarks); the middle frame as
// the pose model received it, to see whether a rotated clip reached it upright (14 November 2026).
const IN_PAGE = `
  const done = arguments[arguments.length - 1];
  const url = arguments[0];
  (async () => {
    for (let i = 0; i < 300 && !window._harnessReady; i++) await new Promise(r => setTimeout(r, 200));
    if (typeof arguments[1] === 'string' && arguments[1]) window.__WV_HARNESS_READBACK__ = arguments[1];
    const t0 = performance.now();
    const r = await window._fetchAndProcess(url);
    return { seconds: (performance.now() - t0) / 1000, metadata: r.metadata, timestamps: r.timestamps,
      worldLandmarks: r.worldLandmarks, pixelHashes: r.pixelHashes, midFrame: r.midFrameDataURL, userAgent: navigator.userAgent };
  // Safari's stack names no message: name and message first, then the stack (14 November 2026, run 43626543919).
  })().then(done, e => done({ error: e ? e.name + ': ' + e.message + ' | ' + (e.stack || '') : String(e) }));
`;

async function withSafari(fn) {
  const { Builder } = await import('selenium-webdriver');
  const driver = await new Builder().forBrowser('safari').build();
  await driver.manage().setTimeouts({ script: 600000, pageLoad: 120000 });
  try {
    return await fn(async url => { await driver.get(HARNESS); return driver.executeAsyncScript(IN_PAGE, url, READBACK); });
  } finally { await driver.quit(); }
}

async function withChromium(fn) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  try {
    return await fn(async url => {
      const page = await browser.newPage();
      await page.goto(HARNESS);
      const r = await page.evaluate(([src, u, rb]) => new Promise(done => new Function(src).call(null, u, rb, done)), [IN_PAGE, url, READBACK]);
      await page.close();
      return r;
    });
  } finally { await browser.close(); }
}

mkdirSync(OUT, { recursive: true });
const run = BROWSER === 'safari' ? withSafari : withChromium;
await run(async read => {
  for (let k = 1; k <= RUNS; k++) {
    for (const c of CLIPS) {
      const url = SET === 'demo' ? `${BASE}demo/${c.clip}.mp4` : `${BASE}demo/iphone/${c.clip}${SUFFIX}.mov`;
      // Some macOS runners refuse Safari's canvas readback ("InvalidStateError" at getImageData, runs 43626543919 and
      // 43628027656; another runner read all ten): a read refused so is tried again, twice at most, in a fresh page.
      let r = await read(url);
      for (let t = 0; t < 2 && /InvalidStateError/.test(r?.error ?? ''); t++) r = await read(url);
      if (r?.error) console.log(`[${BROWSER} run ${k}] ${c.clip}: ERROR ${r.error.split('\n').slice(0, 6).join(' | ')}`);
      else console.log(`[${BROWSER} run ${k}] ${c.clip}: ${r.timestamps.length} samples, ${r.seconds.toFixed(1)} s, ${r.metadata?.extractionMethod}`);
      const clip = SET === 'demo' ? c.clip : `${c.clip}-${SET}`;
      writeFileSync(join(OUT, `${clip}.${BROWSER}.${k}.json`), JSON.stringify({ ...c, clip, browser: BROWSER, run: k, ...r }));
    }
  }
});
