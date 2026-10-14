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
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (name, dflt) => (process.argv.find(a => a.startsWith(`--${name}=`)) ?? `=${dflt}`).split('=')[1];
const BROWSER = arg('browser', 'safari');
const RUNS = Number(arg('runs', '1'));
const OUT = arg('out', 'readings');
const BASE = arg('base', 'http://localhost:5173/workout-vision/');
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

// Run inside the page: read one clip whole, keep what the comparison needs (no image landmarks, no frame picture).
const IN_PAGE = `
  const done = arguments[arguments.length - 1];
  const url = arguments[0];
  (async () => {
    for (let i = 0; i < 300 && !window._harnessReady; i++) await new Promise(r => setTimeout(r, 200));
    const t0 = performance.now();
    const r = await window._fetchAndProcess(url);
    return { seconds: (performance.now() - t0) / 1000, metadata: r.metadata, timestamps: r.timestamps,
      worldLandmarks: r.worldLandmarks, pixelHashes: r.pixelHashes, userAgent: navigator.userAgent };
  })().then(done, e => done({ error: String(e && e.stack || e) }));
`;

async function withSafari(fn) {
  const { Builder } = await import('selenium-webdriver');
  const driver = await new Builder().forBrowser('safari').build();
  await driver.manage().setTimeouts({ script: 600000, pageLoad: 120000 });
  try {
    return await fn(async url => { await driver.get(HARNESS); return driver.executeAsyncScript(IN_PAGE, url); });
  } finally { await driver.quit(); }
}

async function withChromium(fn) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  try {
    return await fn(async url => {
      const page = await browser.newPage();
      await page.goto(HARNESS);
      const r = await page.evaluate(([src, u]) => new Promise(done => new Function(src).call(null, u, done)), [IN_PAGE, url]);
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
      const r = await read(`${BASE}demo/${c.clip}.mp4`);
      if (r?.error) console.log(`[${BROWSER} run ${k}] ${c.clip}: ERROR ${r.error.split('\n')[0]}`);
      else console.log(`[${BROWSER} run ${k}] ${c.clip}: ${r.timestamps.length} samples, ${r.seconds.toFixed(1)} s, ${r.metadata?.extractionMethod}`);
      writeFileSync(join(OUT, `${c.clip}.${BROWSER}.${k}.json`), JSON.stringify({ ...c, browser: BROWSER, run: k, ...r }));
    }
  }
});
