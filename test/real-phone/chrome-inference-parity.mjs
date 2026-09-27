/**
 * Step 3d: Chrome inference parity.
 *
 * Runs the harness (main-thread inference) in Google Chrome on one clip,
 * collects world landmarks, and compares them with the app's worker
 * inference (from parity.json). Reports the first sample that differs
 * and why.
 *
 * The harness runs on the Vite dev server (which serves test/ files).
 * The app's data comes from parity.json (production build, Chrome).
 *
 * Usage:
 *   npx vite --host 127.0.0.1 --port 5173 --strictPort &
 *   node test/real-phone/chrome-inference-parity.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const CLIP = 'bicep_curl_7_side_mufhf3wy';
const devBase = process.env.WV_DEV_BASE || 'http://127.0.0.1:5173/workout-vision/';
const clipPath = `${devBase}test/real-phone/clips/${CLIP}.mov`;
const outDir = resolve('test/real-phone/step3d');
mkdirSync(outDir, { recursive: true });

console.log('=== Chrome inference parity: harness (main-thread) vs app (worker) ===\n');

// --- 1. Run harness in Chrome ---
console.log('1. Harness (main-thread) in Chrome...');
const browser = await chromium.launch({ channel: 'chrome' });
let harnessResult;
try {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(devBase + 'test/real-phone/harness.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => window._harnessReady === true, null, { timeout: 30000 });
  console.log('   Harness ready, processing clip...');

  harnessResult = await page.evaluate(async (url) => {
    const r = await window._fetchAndProcess(url);
    return {
      samples: r.worldLandmarks.length,
      worldLandmarks: r.worldLandmarks,
      imageLandmarks: r.imageLandmarks,
      method: r.metadata.extractionMethod,
      width: r.metadata.extractedWidth,
      height: r.metadata.extractedHeight,
    };
  }, clipPath);
  harnessResult.errors = errors;
  console.log(`   Done: ${harnessResult.samples} samples, ${harnessResult.method}, ${harnessResult.width}x${harnessResult.height}`);
  if (errors.length) console.log('   Errors:', errors.slice(0, 3));
} finally {
  await browser.close();
}

// --- 2. Run app (worker) in Chrome on the production build ---
console.log('\n2. App (worker) in Chrome on production build...');
// Build first
const { execFileSync } = await import('node:child_process');
console.log('   Building...');
execFileSync('npx', ['vite', 'build'], { cwd: resolve('.'), stdio: 'pipe' });

// Start preview server
const { spawn } = await import('node:child_process');
const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4176', '--strictPort'], { cwd: resolve('.'), stdio: 'pipe' });
await new Promise(r => setTimeout(r, 2000));
const previewBase = 'http://127.0.0.1:4176/workout-vision/';

let appResult;
const browser2 = await chromium.launch({ channel: 'chrome' });
try {
  const context = await browser2.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.addInitScript(() => {
    localStorage.setItem('wv_seen_entry', 'true');
    localStorage.setItem('wv_lang', 'fr');
    window.addEventListener('wv:core-result', e => { window.__coreOutput = e.detail; });
  });

  await page.goto(previewBase, { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('.altar', { hasText: 'Curl biceps' }).first().click();
  const input = page.locator('.film-screen input[type="file"]').last();
  await input.waitFor({ state: 'attached', timeout: 15000 });
  await input.setInputFiles(resolve(`test/real-phone/clips/${CLIP}.mov`));
  console.log('   Waiting for analysis...');
  await page.waitForFunction(() => window.__coreOutput || document.querySelector('.refused-title'), null, { timeout: 300000 });

  const failed = await page.evaluate(() => window.__coreOutput ? null : document.querySelector('.refused-title')?.textContent);
  if (failed) {
    console.log('   App FAILED:', failed);
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
    };
  });
  appResult.errors = errors;
  console.log(`   Done: ${appResult.samples} samples, count=${appResult.count}`);
  if (errors.length) console.log('   Errors:', errors.slice(0, 3));
} finally {
  await browser2.close();
  preview.kill();
}

// --- 3. Compare ---
console.log('\n=== Comparison ===');
console.log(`Samples: harness=${harnessResult.samples}, app=${appResult.samples}`);

const minLen = Math.min(harnessResult.samples, appResult.samples);
let firstWorldDiff = -1, worldDiffCount = 0, firstDetail = null;

for (let i = 0; i < minLen; i++) {
  const h = harnessResult.worldLandmarks[i], a = appResult.worldLandmarks[i];
  if (!h && !a) continue;
  if (!h || !a) {
    worldDiffCount++;
    if (firstWorldDiff < 0) { firstWorldDiff = i; firstDetail = { reason: h ? 'app null' : 'harness null' }; }
    continue;
  }
  for (let j = 0; j < Math.min(h.length, a.length); j++) {
    const dx = Math.abs((h[j].x || 0) - (a[j].x || 0));
    const dy = Math.abs((h[j].y || 0) - (a[j].y || 0));
    const dz = Math.abs((h[j].z || 0) - (a[j].z || 0));
    if (dx > 0.0001 || dy > 0.0001 || dz > 0.0001) {
      worldDiffCount++;
      if (firstWorldDiff < 0) {
        firstWorldDiff = i;
        firstDetail = { joint: j, harness: h[j], app: a[j], dx: dx.toFixed(6), dy: dy.toFixed(6), dz: dz.toFixed(6) };
      }
      break;
    }
  }
}

// Also compare image landmarks
let firstImageDiff = -1, imageDiffCount = 0, imageDetail = null;
for (let i = 0; i < minLen; i++) {
  const h = harnessResult.imageLandmarks[i], a = appResult.imageLandmarks[i];
  if (!h && !a) continue;
  if (!h || !a) {
    imageDiffCount++;
    if (firstImageDiff < 0) { firstImageDiff = i; imageDetail = { reason: h ? 'app null' : 'harness null' }; }
    continue;
  }
  for (let j = 0; j < Math.min(h.length, a.length); j++) {
    const dx = Math.abs((h[j].x || 0) - (a[j].x || 0));
    const dy = Math.abs((h[j].y || 0) - (a[j].y || 0));
    if (dx > 0.001 || dy > 0.001) {
      imageDiffCount++;
      if (firstImageDiff < 0) {
        firstImageDiff = i;
        imageDetail = { joint: j, harness: h[j], app: a[j] };
      }
      break;
    }
  }
}

const report = {
  clip: CLIP,
  harnessSamples: harnessResult.samples,
  appSamples: appResult.samples,
  appCount: appResult.count,
  world: { firstDiff: firstWorldDiff, totalDiffs: worldDiffCount, detail: firstDetail },
  image: { firstDiff: firstImageDiff, totalDiffs: imageDiffCount, detail: imageDetail },
  verdict: firstWorldDiff < 0 && firstImageDiff < 0 ? 'MATCH' : 'DIFFER',
};

if (firstWorldDiff >= 0) {
  console.log(`\nWorld landmarks DIFFER at sample ${firstWorldDiff} (${worldDiffCount} of ${minLen} differ)`);
  console.log('  Detail:', JSON.stringify(firstDetail, null, 2));
} else {
  console.log(`\nWorld landmarks: all ${minLen} match within 0.0001`);
}

if (firstImageDiff >= 0) {
  console.log(`Image landmarks DIFFER at sample ${firstImageDiff} (${imageDiffCount} of ${minLen} differ)`);
  console.log('  Detail:', JSON.stringify(imageDetail, null, 2));
} else {
  console.log(`Image landmarks: all ${minLen} match within 0.001`);
}

console.log(`\nVerdict: ${report.verdict}`);
writeFileSync(`${outDir}/chrome-inference-parity.json`, JSON.stringify(report, null, 2));
console.log(`Report: ${outDir}/chrome-inference-parity.json`);
process.exit(report.verdict === 'MATCH' ? 0 : 1);
