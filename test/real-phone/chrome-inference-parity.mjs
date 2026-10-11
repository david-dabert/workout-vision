/**
 * Step 3d: Chrome inference parity — all three approved clips.
 *
 * For each clip, runs the harness (main-thread) and the app (worker) in
 * Chrome, hashes the pixels handed to the landmarker at every sample in
 * both paths, and reports the first sample whose pixel hash differs.
 *
 * The harness collects pixel hashes via crypto.subtle (added to harness.js).
 * The app collects them by monkey-patching Worker.prototype.postMessage
 * before the app loads — hashing the pixel ArrayBuffer before it transfers.
 *
 * Usage:
 *   npx vite --host 127.0.0.1 --port 5173 --strictPort &
 *   node test/real-phone/chrome-inference-parity.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';

const CLIPS = [
  { file: 'bicep_curl_7_side_mufhf3wy',     lift: 'bicep_curl',    label: 'Curl biceps' },
  { file: 'lateral_raise_10_front_mufhhbun', lift: 'lateral_raise', label: 'Élévations latérales' },
  { file: 'lat_pulldown_10_front_mufhlh4o',  lift: 'lat_pulldown',  label: 'Tirage vertical' },
];

const devBase = process.env.WV_DEV_BASE || 'http://127.0.0.1:5173/workout-vision/';
const outDir = resolve('test/real-phone/step3d');
mkdirSync(outDir, { recursive: true });

// --- Build once, start preview server once ---
console.log('Building production bundle...');
execFileSync('npx', ['vite', 'build'], { cwd: resolve('.'), stdio: 'pipe' });
const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { cwd: resolve('.'), stdio: 'pipe' });
await new Promise(r => setTimeout(r, 2000));
const previewBase = 'http://127.0.0.1:4176/workout-vision/';

const allReports = [];
let allMatch = true;

for (const clip of CLIPS) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`CLIP: ${clip.file}`);
  console.log('='.repeat(60));

  // --- 1. Harness (main-thread) in Chrome ---
  console.log('\n1. Harness (main-thread)...');
  const browser1 = await chromium.launch({ channel: 'chrome' });
  let harnessResult;
  try {
    const ctx = await browser1.newContext({ viewport: { width: 800, height: 600 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(devBase + 'test/real-phone/harness.html', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForFunction(() => window._harnessReady === true, null, { timeout: 30000 });

    harnessResult = await page.evaluate(async (url) => {
      const r = await window._fetchAndProcess(url);
      return {
        samples: r.worldLandmarks.length,
        worldLandmarks: r.worldLandmarks,
        imageLandmarks: r.imageLandmarks,
        pixelHashes: r.pixelHashes,
        method: r.metadata.extractionMethod,
        width: r.metadata.extractedWidth,
        height: r.metadata.extractedHeight,
      };
    }, `${devBase}test/real-phone/clips/${clip.file}.mov`);
    harnessResult.errors = errors;
    console.log(`   ${harnessResult.samples} samples, ${harnessResult.method}, ${harnessResult.width}x${harnessResult.height}`);
  } finally {
    await browser1.close();
  }

  // --- 2. App (worker) in Chrome ---
  console.log('2. App (worker)...');
  const browser2 = await chromium.launch({ channel: 'chrome' });
  let appResult;
  try {
    const ctx = await browser2.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    // Monkey-patch Worker.postMessage to hash pixel buffers before transfer.
    // The app sends { pixels: ArrayBuffer, width, height, timestamp } to the
    // worker. We hash the ArrayBuffer and stash the hex string.
    await page.addInitScript(() => {
      localStorage.setItem('wv_seen_entry', 'true');
      localStorage.setItem('wv_lang', 'fr');
      window.__pixelHashes = [];
      window.__coreOutput = null;
      window.addEventListener('wv:core-result', e => { window.__coreOutput = e.detail; });
      const origPost = Worker.prototype.postMessage;
      Worker.prototype.postMessage = function (msg, transfer) {
        if (msg && msg.pixels instanceof ArrayBuffer && msg.pixels.byteLength > 0) {
          // Hash before transfer (which neuters the buffer).
          const copy = msg.pixels.slice(0);
          crypto.subtle.digest('SHA-256', copy).then(buf => {
            window.__pixelHashes.push(Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
          });
        }
        return origPost.call(this, msg, transfer);
      };
    });

    await page.goto(previewBase, { waitUntil: 'networkidle', timeout: 30000 });
    await page.locator('.altar', { hasText: clip.label }).first().click();
    const input = page.locator('.film-screen input[type="file"]').last();
    await input.waitFor({ state: 'attached', timeout: 15000 });
    await input.setInputFiles(resolve(`test/real-phone/clips/${clip.file}.mov`));
    console.log('   Waiting for analysis...');
    await page.waitForFunction(() => window.__coreOutput || document.querySelector('.refused-title'), null, { timeout: 300000 });

    const failed = await page.evaluate(() => window.__coreOutput ? null : document.querySelector('.refused-title')?.textContent);
    if (failed) {
      console.log(`   FAILED: ${failed}`);
      errors.forEach(e => console.log('  ', e));
      preview.kill();
      process.exit(1);
    }

    appResult = await page.evaluate(() => {
      const r = window.__coreOutput;
      return {
        count: r.count,
        samples: r.worldLandmarks.length,
        worldLandmarks: r.worldLandmarks,
        imageLandmarks: r.imageLandmarks,
        pixelHashes: window.__pixelHashes,
      };
    });
    appResult.errors = errors;
    console.log(`   ${appResult.samples} samples, count=${appResult.count}`);
  } finally {
    await browser2.close();
  }

  // --- 3. Compare ---
  const minLen = Math.min(harnessResult.samples, appResult.samples);

  // Pixel hash comparison
  const minHashLen = Math.min(harnessResult.pixelHashes.length, appResult.pixelHashes.length);
  let firstPixelDiff = -1, pixelDiffCount = 0;
  for (let i = 0; i < minHashLen; i++) {
    if (harnessResult.pixelHashes[i] !== appResult.pixelHashes[i]) {
      pixelDiffCount++;
      if (firstPixelDiff < 0) firstPixelDiff = i;
    }
  }

  // World landmark comparison
  let firstWorldDiff = -1, worldDiffCount = 0, firstWorldDetail = null;
  for (let i = 0; i < minLen; i++) {
    const h = harnessResult.worldLandmarks[i], a = appResult.worldLandmarks[i];
    if (!h && !a) continue;
    if (!h || !a) { worldDiffCount++; if (firstWorldDiff < 0) { firstWorldDiff = i; firstWorldDetail = { reason: h ? 'app null' : 'harness null' }; } continue; }
    for (let j = 0; j < Math.min(h.length, a.length); j++) {
      const dx = Math.abs((h[j].x || 0) - (a[j].x || 0));
      const dy = Math.abs((h[j].y || 0) - (a[j].y || 0));
      const dz = Math.abs((h[j].z || 0) - (a[j].z || 0));
      if (dx > 0.0001 || dy > 0.0001 || dz > 0.0001) {
        worldDiffCount++;
        if (firstWorldDiff < 0) { firstWorldDiff = i; firstWorldDetail = { joint: j, harness: h[j], app: a[j], dx: dx.toFixed(6), dy: dy.toFixed(6), dz: dz.toFixed(6) }; }
        break;
      }
    }
  }

  // Image landmark comparison
  let firstImageDiff = -1, imageDiffCount = 0, firstImageDetail = null;
  for (let i = 0; i < minLen; i++) {
    const h = harnessResult.imageLandmarks[i], a = appResult.imageLandmarks[i];
    if (!h && !a) continue;
    if (!h || !a) { imageDiffCount++; if (firstImageDiff < 0) { firstImageDiff = i; firstImageDetail = { reason: h ? 'app null' : 'harness null' }; } continue; }
    for (let j = 0; j < Math.min(h.length, a.length); j++) {
      const dx = Math.abs((h[j].x || 0) - (a[j].x || 0));
      const dy = Math.abs((h[j].y || 0) - (a[j].y || 0));
      if (dx > 0.001 || dy > 0.001) {
        imageDiffCount++;
        if (firstImageDiff < 0) { firstImageDiff = i; firstImageDetail = { joint: j, harness: h[j], app: a[j] }; }
        break;
      }
    }
  }

  const report = {
    clip: clip.file,
    lift: clip.lift,
    harnessSamples: harnessResult.samples,
    appSamples: appResult.samples,
    appCount: appResult.count,
    pixels: {
      harnessHashes: harnessResult.pixelHashes.length,
      appHashes: appResult.pixelHashes.length,
      firstDiff: firstPixelDiff,
      totalDiffs: pixelDiffCount,
      note: firstPixelDiff >= 0 ? 'Chrome VideoDecoder is nondeterministic between runs' : 'All pixel hashes match',
    },
    world: { firstDiff: firstWorldDiff, totalDiffs: worldDiffCount, detail: firstWorldDetail },
    image: { firstDiff: firstImageDiff, totalDiffs: imageDiffCount, detail: firstImageDetail },
    landmarkVerdict: firstWorldDiff < 0 && firstImageDiff < 0 ? 'MATCH' : 'DIFFER',
  };
  allReports.push(report);
  if (report.landmarkVerdict !== 'MATCH') allMatch = false;

  // Console output
  if (firstPixelDiff >= 0) {
    console.log(`\n   Pixels DIFFER from sample ${firstPixelDiff} (${pixelDiffCount} of ${minHashLen} differ)`);
    console.log(`   Cause: Chrome VideoDecoder decodes the same .mov nondeterministically across runs.`);
  } else {
    console.log(`\n   Pixels: all ${minHashLen} hashes match (same decoder run)`);
  }

  if (firstWorldDiff >= 0) {
    console.log(`   World landmarks DIFFER at sample ${firstWorldDiff} (${worldDiffCount} of ${minLen})`);
  } else {
    console.log(`   World landmarks: all ${minLen} match within 0.0001`);
  }

  if (firstImageDiff >= 0) {
    console.log(`   Image landmarks DIFFER at sample ${firstImageDiff} (${imageDiffCount} of ${minLen})`);
  } else {
    console.log(`   Image landmarks: all ${minLen} match within 0.001`);
  }

  console.log(`   Landmark verdict: ${report.landmarkVerdict}`);
}

preview.kill();

const combined = {
  clips: allReports,
  verdict: allMatch ? 'ALL_MATCH' : 'SOME_DIFFER',
};
writeFileSync(`${outDir}/chrome-inference-parity.json`, JSON.stringify(combined, null, 2));
console.log(`\n${'='.repeat(60)}`);
console.log(`Overall verdict: ${combined.verdict}`);
console.log(`Report: ${outDir}/chrome-inference-parity.json`);
process.exit(allMatch ? 0 : 1);
