#!/usr/bin/env node
/**
 * Automated benchmark runner using Playwright.
 *
 * Usage:
 *   node benchmark/run-benchmark.mjs [--url http://localhost:5173/workout-vision/]
 *
 * Prerequisites:
 *   - npx playwright install chromium  (one-time)
 *   - Dev server running: npx vite (in another terminal)
 *   - Benchmark videos in benchmark/videos/ (symlinked to public/)
 *
 * The script:
 *   1. Opens the validate page
 *   2. Clicks "Load Countix Benchmark"
 *   3. Clicks "Run All"
 *   4. Waits for all 43 videos to complete (up to 30 minutes)
 *   5. Scrapes the results table and summary stats
 *   6. Prints a report to stdout and saves JSON to benchmark/results/
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
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

// Ensure the validate page URL
const validateUrl = baseUrl.endsWith('/') ? baseUrl + '?validate=1' : baseUrl + '/?validate=1';

async function run() {
  console.log(`\n🏋️  WorkoutVision Benchmark Runner`);
  console.log(`   URL: ${validateUrl}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    // Block download dialog — we'll scrape results directly
    acceptDownloads: false,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  // Suppress noisy console logs from MediaPipe
  page.on('console', () => {});

  try {
    // Navigate to validate page
    console.log('1. Loading validate page...');
    await page.goto(validateUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Click "Load Countix Benchmark"
    console.log('2. Loading Countix benchmark...');
    const loadBtn = page.locator('button:has-text("Load Countix Benchmark")');
    await loadBtn.click();

    // Wait for tests to appear (the button text changes or test rows appear)
    await page.waitForTimeout(2000);

    // Click "Run All Tests"
    console.log('3. Starting benchmark (this takes 10-20 minutes)...');
    const runBtn = page.locator('button:has-text("Run All")');
    await runBtn.click();

    // Wait for completion: poll for the running state to end
    // The page shows results as each video completes
    const startTime = Date.now();
    const maxWait = 30 * 60 * 1000; // 30 minutes max

    let lastProgress = '';
    while (Date.now() - startTime < maxWait) {
      await page.waitForTimeout(5000);

      // Check if still running
      const runBtnDisabled = await page.locator('button:has-text("Run All")').isDisabled().catch(() => true);
      const runningIndicator = await page.locator('button:has-text("Running")').count().catch(() => 0);

      // Show progress
      const progressText = await page.locator('[class*="stat"], [style*="font-size"]').first().textContent().catch(() => '');
      if (progressText && progressText !== lastProgress) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        process.stdout.write(`   [${elapsed}s] ${progressText.substring(0, 60)}\r`);
        lastProgress = progressText;
      }

      if (!runBtnDisabled && runningIndicator === 0) {
        // Check if we have results
        const resultCount = await page.locator('text=/\\d+\\/\\d+ reps/').count();
        if (resultCount > 0) break;
      }
    }

    console.log('\n4. Scraping results...');

    // Scrape the summary stats
    const summary = await page.evaluate(() => {
      const text = document.body.innerText;

      // Extract key metrics from page text
      const avgAccMatch = text.match(/(\d+)%\s*AVG ACCURACY/);
      const exactMatch = text.match(/(\d+)\/(\d+)\s*EXACT MATCH/);
      const oboMatch = text.match(/(\d+)\/(\d+)\s*WITHIN/);
      const maeMatch = text.match(/([\d.]+)\s*MAE/);
      const oboAccMatch = text.match(/(\d+)%\s*OBO ACCURACY/);

      return {
        avgAccuracy: avgAccMatch ? parseInt(avgAccMatch[1]) : null,
        exactMatch: exactMatch ? `${exactMatch[1]}/${exactMatch[2]}` : null,
        withinOne: oboMatch ? `${oboMatch[1]}/${oboMatch[2]}` : null,
        mae: maeMatch ? parseFloat(maeMatch[1]) : null,
        oboAccuracy: oboAccMatch ? parseInt(oboAccMatch[1]) : null,
      };
    });

    // Scrape individual results
    const results = await page.evaluate(() => {
      const rows = [];
      // Find all result entries (they show filename + reps)
      const elements = document.querySelectorAll('[style*="border-radius"]');
      for (const el of elements) {
        const text = el.innerText;
        const fileMatch = text.match(/(\w+\.mp4)/);
        const repMatch = text.match(/(\d+)\/(\d+) reps/);
        const methodMatch = text.match(/Method:\s*(\S*)/);
        const errorMatch = text.match(/\(([+-]\d+)\)/);

        if (fileMatch && repMatch) {
          rows.push({
            video: fileMatch[1],
            actual: parseInt(repMatch[1]),
            expected: parseInt(repMatch[2]),
            error: errorMatch ? parseInt(errorMatch[1]) : 0,
            method: methodMatch ? methodMatch[1] : '',
          });
        }
      }
      return rows;
    });

    // Print report
    console.log('\n' + '='.repeat(70));
    console.log('  BENCHMARK RESULTS');
    console.log('='.repeat(70));
    console.log(`  Accuracy:    ${summary.avgAccuracy}%`);
    console.log(`  Exact:       ${summary.exactMatch}`);
    console.log(`  OBO (±1):    ${summary.withinOne} (${summary.oboAccuracy}%)`);
    console.log(`  MAE:         ${summary.mae}`);
    console.log('='.repeat(70));

    if (results.length > 0) {
      console.log('\n  Video                                          Got  Exp  Err  Method');
      console.log('  ' + '-'.repeat(68));
      for (const r of results) {
        const name = r.video.padEnd(45);
        const got = String(r.actual).padStart(3);
        const exp = String(r.expected).padStart(4);
        const err = (r.error > 0 ? '+' : '') + r.error;
        console.log(`  ${name} ${got} ${exp}  ${err.padStart(3)}  ${r.method}`);
      }
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

  } catch (err) {
    console.error(`\nError: ${err.message}`);
    // Take screenshot for debugging
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
