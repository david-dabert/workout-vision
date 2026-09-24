#!/usr/bin/env node
/**
 * Extract landmarks from local video files using Playwright + the app's
 * own dump-landmarks.html page (MediaPipe in real Chromium, GPU-accelerated).
 *
 * For each clip in test/real-phone/manifest.json, this script:
 *   1. Opens benchmark/dump-landmarks.html in headed Chromium
 *   2. Feeds the video file via the file input
 *   3. Waits for extraction to complete
 *   4. Captures the landmarks JSON
 *   5. Feeds the landmarks through the replay pipeline to get a rep count
 *   6. Saves results to test/real-phone/results.json
 *
 * Usage:
 *   node scripts/extract-landmarks-local.mjs
 *   node scripts/extract-landmarks-local.mjs --clip bench_press_5_front.mov
 *
 * Prerequisites:
 *   - npx playwright install chromium (one-time)
 *   - Clips in test/real-phone/clips/ matching manifest.json
 *   - Dev server NOT required (uses dump-landmarks.html directly via file://)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REAL_PHONE_DIR = join(ROOT, 'test', 'real-phone');
const MANIFEST_PATH = join(REAL_PHONE_DIR, 'manifest.json');
const CLIPS_DIR = join(REAL_PHONE_DIR, 'clips');
const LANDMARKS_DIR = join(REAL_PHONE_DIR, 'landmarks');
const RESULTS_PATH = join(REAL_PHONE_DIR, 'results.json');
const DUMP_HTML = join(ROOT, 'benchmark', 'dump-landmarks.html');

// Parse CLI args
const args = process.argv.slice(2);
let clipFilter = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--clip' && args[i + 1]) clipFilter = args[i + 1];
}

if (!existsSync(MANIFEST_PATH)) {
  console.error('No manifest at test/real-phone/manifest.json');
  console.error('David needs to film clips and run: node scripts/build-manifest.mjs');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
let clips = manifest.clips || [];

if (clipFilter) {
  clips = clips.filter(c => c.file.includes(clipFilter));
  if (clips.length === 0) {
    console.error(`No clips matching "${clipFilter}" in manifest`);
    process.exit(1);
  }
}

console.log(`\n  Extract Landmarks — Local Clips`);
console.log(`  Manifest: ${clips.length} clips${clipFilter ? ` (filtered: ${clipFilter})` : ''}`);
console.log(`  HTML: ${DUMP_HTML}\n`);

// Import Playwright
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const pw = require('/tmp/pw-runner/node_modules/playwright');
    chromium = pw.chromium;
  } catch {
    console.error('Playwright not found. Run: npx playwright install chromium');
    process.exit(1);
  }
}

mkdirSync(LANDMARKS_DIR, { recursive: true });

// MediaPipe needs WebGL → must use headed (non-headless) Chromium
const browser = await chromium.launch({
  headless: false,
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});

const results = [];

for (const clip of clips) {
  const clipPath = resolve(CLIPS_DIR, clip.file);
  if (!existsSync(clipPath)) {
    console.log(`  SKIP ${clip.file} — file not found`);
    results.push({
      file: clip.file, exercise: clip.exercise,
      expected: clip.reps, actual: null, error: null,
      note: 'file not found',
    });
    continue;
  }

  console.log(`  Processing ${clip.file}...`);

  const landmarkFile = join(LANDMARKS_DIR, clip.file.replace(/\.[^.]+$/, '.json'));

  // Check if landmarks already cached
  if (existsSync(landmarkFile) && !args.includes('--force')) {
    console.log(`    Cached landmarks found, skipping extraction`);
  } else {
    // Extract landmarks via Playwright
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Open the dump-landmarks page via file://
      await page.goto(`file://${DUMP_HTML}`, { waitUntil: 'networkidle', timeout: 60_000 });

      // Wait for model to load (status shows "Model loaded.")
      await page.waitForFunction(
        () => document.getElementById('status')?.textContent?.includes('Model loaded.'),
        { timeout: 120_000 }
      );

      // Set the file input
      const fileInput = await page.$('#videoFile');
      await fileInput.setInputFiles(clipPath);

      // Click run
      await page.click('#runBtn');

      // Wait for "Done." in status — extraction complete
      await page.waitForFunction(
        () => document.getElementById('status')?.textContent?.includes('Done.'),
        { timeout: 300_000 } // 5 min max per clip
      );

      // Intercept the download: read the artifact from the page
      // The page creates a download link — we'll evaluate to get the data directly
      const artifact = await page.evaluate(() => {
        // The extractLandmarks function stores result in memory;
        // we need to re-extract from the status text or re-run.
        // Simpler: intercept via the blob URL in the anchor.
        // Actually, the simplest: the page creates an <a> element with
        // href=blob:... — we can read that.
        const anchors = document.querySelectorAll('a[download]');
        if (anchors.length === 0) return null;
        const lastAnchor = anchors[anchors.length - 1];
        // Can't read blob URL cross-origin. Let's use a different approach.
        return null;
      });

      // Alternative: capture via download event
      // Let's use page.on('download') approach instead
      // Actually, the simplest approach: modify the page to expose the artifact
      // We'll inject a script that captures the result

      // Re-approach: we'll intercept the blob URL
      const landmarkData = await page.evaluate(async () => {
        // The page stores the artifact in the closure. Let's re-extract
        // by reading the status and the last created blob URL.
        // Hack: the anchor's href is a blob URL we can fetch within the page context.
        const anchors = document.querySelectorAll('a[download]');
        if (anchors.length === 0) return null;
        const lastAnchor = anchors[anchors.length - 1];
        const resp = await fetch(lastAnchor.href);
        return await resp.text();
      });

      if (landmarkData) {
        writeFileSync(landmarkFile, landmarkData);
        console.log(`    Landmarks saved: ${landmarkFile}`);
      } else {
        console.log(`    WARNING: Could not capture landmark data`);
      }
    } catch (err) {
      console.error(`    ERROR: ${err.message}`);
      results.push({
        file: clip.file, exercise: clip.exercise,
        expected: clip.reps, actual: null, error: null,
        note: `extraction error: ${err.message}`,
      });
      await context.close();
      continue;
    }

    await context.close();
  }

  // Now run the replay pipeline on the extracted landmarks
  if (existsSync(landmarkFile)) {
    try {
      const landmarks = JSON.parse(readFileSync(landmarkFile, 'utf-8'));
      const frames = landmarks.frames || [];
      const landmarkArrays = frames
        .filter(f => f.landmarks)
        .map(f => f.landmarks);

      if (landmarkArrays.length === 0) {
        results.push({
          file: clip.file, exercise: clip.exercise,
          expected: clip.reps, actual: 0, error: -clip.reps,
          note: 'no landmarks detected',
        });
        continue;
      }

      // Import RepCounter (same approach as replay-benchmark)
      const { RepCounter } = await import('../src/lib/repCounter/index.js');
      const counter = new RepCounter(clip.exercise, {
        fps: landmarks.metadata?.fps || 15,
        mode: 'video',
      });

      for (const lm of landmarkArrays) {
        counter.update(lm);
      }
      counter.finalize();

      const actual = counter.reps || 0;
      results.push({
        file: clip.file,
        exercise: clip.exercise,
        expected: clip.reps,
        actual,
        error: actual - clip.reps,
        video: clip.file,
      });

      const errStr = actual - clip.reps === 0 ? '✓' : (actual - clip.reps > 0 ? '+' : '') + (actual - clip.reps);
      console.log(`    Result: ${actual} reps (expected ${clip.reps}, ${errStr})`);
    } catch (err) {
      console.error(`    Replay error: ${err.message}`);
      results.push({
        file: clip.file, exercise: clip.exercise,
        expected: clip.reps, actual: null, error: null,
        note: `replay error: ${err.message}`,
      });
    }
  }
}

await browser.close();

// Save results
writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
console.log(`\n  Results saved: ${RESULTS_PATH}`);
console.log(`  Total: ${results.length} clips`);
const scored = results.filter(r => r.error != null);
if (scored.length > 0) {
  const exact = scored.filter(r => r.error === 0).length;
  console.log(`  Exact: ${exact}/${scored.length} (${Math.round(exact / scored.length * 100)}%)`);
}
