#!/usr/bin/env node
/**
 * Automated benchmark runner using Playwright.
 *
 * Usage:
 *   node benchmark/run-benchmark.mjs [--url http://localhost:5173/workout-vision/]
 *
 * Prerequisites:
 *   - npx playwright install chromium  (one-time, from /tmp/pw-runner)
 *   - Dev server running: npx vite (in another terminal)
 *   - Benchmark videos in benchmark/videos/ (symlinked to public/)
 *
 * The script:
 *   1. Opens the validate page
 *   2. Clicks "Load Countix Benchmark"
 *   3. Clicks "Run N tests"
 *   4. Waits for all 43 videos to complete (up to 45 minutes)
 *   5. Intercepts the auto-exported JSON report
 *   6. Prints a report to stdout and saves JSON to benchmark/results/
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  const pw = require('/tmp/pw-runner/node_modules/playwright');
  chromium = pw.chromium;
}
import { mkdirSync, writeFileSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(__dirname, 'results');

// Parse CLI args
const args = process.argv.slice(2);
let baseUrl = 'http://localhost:5173/workout-vision/';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) baseUrl = args[i + 1];
}

const validateUrl = baseUrl.endsWith('/') ? baseUrl + '?validate=1' : baseUrl + '/?validate=1';

async function run() {
  console.log(`\n  WorkoutVision Benchmark Runner`);
  console.log(`   URL: ${validateUrl}\n`);

  // MediaPipe needs WebGL which requires GPU. headless: false opens a real
  // browser window on macOS (auto-closes when done). This is necessary
  // because headless Chrome lacks GPU/WebGL support for MediaPipe WASM.
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // Log page errors and important console messages for debugging
  page.on('pageerror', err => console.error(`  [PAGE ERROR] ${err.message}`));
  page.on('console', msg => {
    const text = msg.text();
    // Only log errors and rep counter debug output
    if (msg.type() === 'error' || text.includes('[RepCounter]') || text.includes('Error'))
      console.log(`  [CONSOLE] ${text.slice(0, 200)}`);
  });

  // Intercept downloads (auto-exported benchmark report + landmark cache)
  const downloads = [];
  page.on('download', async (download) => {
    const name = download.suggestedFilename();
    const savePath = join(RESULTS_DIR, name);
    mkdirSync(RESULTS_DIR, { recursive: true });
    await download.saveAs(savePath);
    downloads.push({ name, path: savePath });
    console.log(`  [DOWNLOAD] Saved: ${name}`);

    // Copy landmark cache to the landmark-cache dir for replay-benchmark
    if (name.startsWith('landmark-cache')) {
      const cacheDir = join(__dirname, 'landmark-cache');
      mkdirSync(cacheDir, { recursive: true });
      const cacheDest = join(cacheDir, name);
      copyFileSync(savePath, cacheDest);
      console.log(`  [DOWNLOAD] Copied to: landmark-cache/${name}`);
    }
  });

  try {
    // 1. Navigate to validate page
    console.log('1. Loading validate page...');
    await page.goto(validateUrl, { waitUntil: 'networkidle', timeout: 60000 });

    // 2. Click "Load Countix Benchmark"
    console.log('2. Loading Countix benchmark...');
    const loadBtn = page.locator('button', { hasText: 'Load Countix Benchmark' });
    await loadBtn.waitFor({ state: 'visible', timeout: 15000 });
    await loadBtn.click();

    // Wait for tests to appear — the "Run N tests" button appears
    console.log('   Waiting for tests to load...');
    const runBtn = page.locator('button', { hasText: /^Run \d+ tests?$/ });
    await runBtn.waitFor({ state: 'visible', timeout: 30000 });

    // Read how many tests
    const runBtnText = await runBtn.textContent();
    console.log(`   Found: "${runBtnText}"`);

    // 3. Click "Run N tests"
    console.log('3. Starting benchmark (this takes 15-30 minutes)...');
    await runBtn.click();

    // 4. Wait for completion by watching the "Running test X of Y..." text
    const startTime = Date.now();
    const maxWait = 45 * 60 * 1000; // 45 minutes max

    // The "Running test X of Y..." div appears while tests run
    const progressLocator = page.locator('text=/Running test \\d+ of \\d+/');

    // Wait for running to start
    await progressLocator.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {
      console.log('   Warning: progress text not detected, polling results instead...');
    });

    let lastCount = 0;
    while (Date.now() - startTime < maxWait) {
      await page.waitForTimeout(15000);
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      // Count result entries: each completed test shows "X/Y reps"
      const resultCount = await page.locator('text=/\\d+\\/\\d+ reps/').count();

      if (resultCount > lastCount) {
        lastCount = resultCount;
        console.log(`   [${elapsed}s] ${resultCount} tests completed...`);
      }

      // Check if still running
      const isRunning = await progressLocator.count();
      if (isRunning === 0 && resultCount > 0) {
        // Double-check: the "Run N tests" button reappears when done
        const btnBack = await runBtn.count();
        if (btnBack > 0 || resultCount >= 40) {
          console.log(`   Completed ${resultCount} tests in ${elapsed}s`);
          break;
        }
      }
    }

    if (Date.now() - startTime >= maxWait) {
      console.error('   TIMEOUT: benchmark did not complete in 45 minutes');
    }

    // 5. Scrape results directly from the DOM
    console.log('\n4. Scraping results...');

    // Wait a moment for final render
    await page.waitForTimeout(2000);

    // Scrape summary stats from the aggregate stats section
    const summary = await page.evaluate(() => {
      // The summary section has a specific structure:
      // Grid with 3 columns: AVG ACCURACY, EXACT MATCH, WITHIN +/-1 (OBO)
      // Then 2 columns: MAE, OBO ACCURACY
      const text = document.body.innerText;

      // Parse from the rendered text — the stats are in separate divs
      // but innerText concatenates them with newlines
      let avgAccuracy = null, exactMatch = null, withinOne = null, mae = null, oboAccuracy = null;

      // Match patterns like "69%\nAVG ACCURACY"
      const accM = text.match(/(\d+)%\s*\n\s*AVG ACCURACY/);
      if (accM) avgAccuracy = parseInt(accM[1]);

      // "13/43\nEXACT MATCH"
      const exM = text.match(/(\d+)\/(\d+)\s*\n\s*EXACT MATCH/);
      if (exM) exactMatch = `${exM[1]}/${exM[2]}`;

      // "21/43\nWITHIN"
      const oboM = text.match(/(\d+)\/(\d+)\s*\n\s*WITHIN/);
      if (oboM) withinOne = `${oboM[1]}/${oboM[2]}`;

      // "2.37\nMAE"
      const maeM = text.match(/([\d.]+)\s*\n\s*MAE/);
      if (maeM) mae = parseFloat(maeM[1]);

      // "49%\nOBO ACCURACY"
      const oboAccM = text.match(/(\d+)%\s*\n\s*OBO ACCURACY/);
      if (oboAccM) oboAccuracy = parseInt(oboAccM[1]);

      return { avgAccuracy, exactMatch, withinOne, mae, oboAccuracy };
    });

    // Scrape per-test results
    const results = await page.evaluate(() => {
      const rows = [];
      // Result entries are divs with borderLeft styling (3px solid var(--accent/yellow/red))
      // Each has: filename, "X/Y reps (±error)", Exercise info, Method info, Frames
      const resultDivs = document.querySelectorAll('[style*="border-left"]');
      for (const div of resultDivs) {
        const text = div.innerText;
        // Match filename.mp4
        const fileM = text.match(/([\w.-]+\.mp4)/);
        // Match "X/Y reps" or "X/? reps"
        const repM = text.match(/(\d+)\/([\d?]+) reps/);
        // Match "(+N)" or "(-N)"
        const errM = text.match(/\(([+-]\d+)\)/);
        // Match "Method: xyz"
        const methM = text.match(/Method:\s*(\S+)/);
        // Match "Frames: N"
        const frameM = text.match(/Frames:\s*(\d+)/);
        // Match "Exercise: XYZ"
        const exM = text.match(/Exercise:\s*([\w\s]+?)(?:\s*\(|$)/);

        if (fileM && repM) {
          rows.push({
            video: fileM[1],
            actual: parseInt(repM[1]),
            expected: repM[2] === '?' ? null : parseInt(repM[2]),
            error: errM ? parseInt(errM[1]) : 0,
            method: methM ? methM[1] : '',
            frames: frameM ? parseInt(frameM[1]) : 0,
            exercise: exM ? exM[1].trim() : '',
          });
        }
      }
      return rows;
    });

    // Print report
    console.log('\n' + '='.repeat(70));
    console.log('  BENCHMARK RESULTS');
    console.log('='.repeat(70));
    if (summary.avgAccuracy !== null) {
      console.log(`  Accuracy:    ${summary.avgAccuracy}%`);
      console.log(`  Exact:       ${summary.exactMatch}`);
      console.log(`  OBO (±1):    ${summary.withinOne} (${summary.oboAccuracy}%)`);
      console.log(`  MAE:         ${summary.mae}`);
    } else {
      console.log('  WARNING: Could not parse summary stats');
    }
    console.log('='.repeat(70));

    if (results.length > 0) {
      console.log(`\n  ${results.length} test results scraped`);
      console.log('\n  Video                                          Got  Exp  Err  Method');
      console.log('  ' + '-'.repeat(68));
      for (const r of results) {
        const name = r.video.padEnd(45);
        const got = String(r.actual).padStart(3);
        const exp = String(r.expected ?? '?').padStart(4);
        const err = r.error === 0 ? '  0' : ((r.error > 0 ? '+' : '') + r.error).padStart(3);
        console.log(`  ${name} ${got} ${exp}  ${err}  ${r.method}`);
      }
    } else {
      console.log('\n  WARNING: No individual results scraped');
      // Take debug screenshot
      const debugPath = join(RESULTS_DIR, 'debug-screenshot.png');
      mkdirSync(RESULTS_DIR, { recursive: true });
      await page.screenshot({ path: debugPath, fullPage: true });
      console.log(`  Debug screenshot: ${debugPath}`);
    }

    // Save results JSON
    mkdirSync(RESULTS_DIR, { recursive: true });
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '');
    const outFile = join(RESULTS_DIR, `benchmark-${timestamp}.json`);
    const report = {
      date: new Date().toISOString(),
      summary,
      results,
    };
    writeFileSync(outFile, JSON.stringify(report, null, 2));
    console.log(`\n  Saved: ${outFile}`);

    // Wait for auto-downloads (benchmark report + landmark cache) to complete
    if (downloads.length < 2) {
      console.log('\n  Waiting for auto-downloads...');
      await page.waitForTimeout(5000);
    }
    console.log(`\n  ${downloads.length} file(s) downloaded from page`);

  } catch (err) {
    console.error(`\nError: ${err.message}`);
    try {
      const screenshotPath = join(RESULTS_DIR, 'error-screenshot.png');
      mkdirSync(RESULTS_DIR, { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.error(`  Screenshot saved: ${screenshotPath}`);
    } catch (_) {}
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
