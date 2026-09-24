#!/usr/bin/env node
/**
 * Real-phone benchmark — feeds David's clips through the app UI via Playwright,
 * reads back the rep counts, and compares to ground truth from the manifest.
 *
 * Usage:
 *   node benchmark/real-phone-benchmark.mjs [--url http://localhost:5173/workout-vision/]
 *
 * Prerequisites:
 *   - Dev server running: npm run dev
 *   - Clips collected via: npm run collect
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
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST_PATH = join(ROOT, 'test', 'real-phone', 'manifest.json');
const CLIPS_DIR = join(ROOT, 'test', 'real-phone', 'clips');
const RESULTS_DIR = join(__dirname, 'results');

// Parse CLI args
const args = process.argv.slice(2);
let baseUrl = 'http://localhost:5173/workout-vision/';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) baseUrl = args[i + 1];
}

// Load manifest
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
let videoClips = manifest.clips.filter(c => c.type === 'video');
// If --first flag, run only the first (smallest) clip for testing
if (args.includes('--first')) videoClips = videoClips.slice(0, 1);
// If --smallest flag, sort by size and take first
if (args.includes('--smallest')) {
  videoClips = [...videoClips].sort((a, b) => a.sizeBytes - b.sizeBytes);
  videoClips = videoClips.slice(0, 1);
}

if (videoClips.length === 0) {
  console.error('No video clips in manifest. Run npm run collect first.');
  process.exit(1);
}

console.log(`\n  Real-Phone Benchmark`);
console.log(`  ${videoClips.length} clips from manifest`);
console.log(`  URL: ${baseUrl}\n`);

async function run() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--enable-webgl', '--ignore-gpu-blocklist'],
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1280, height: 900 },
  });

  const results = [];

  for (let i = 0; i < videoClips.length; i++) {
    const clip = videoClips[i];
    const clipPath = join(CLIPS_DIR, clip.file);
    console.log(`  [${i + 1}/${videoClips.length}] ${clip.exercise} — expected ${clip.reps} reps (${clip.view})`);

    const page = await context.newPage();

    page.on('pageerror', err => console.error(`    [PAGE ERROR] ${err.message}`));

    try {
      // Pre-set localStorage to skip landing + privacy, then navigate
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.evaluate(() => {
        localStorage.setItem('wv_seen_landing', '1');
        localStorage.setItem('wv_privacy_accepted', '1');
        localStorage.setItem('wv_lang', 'en');
      });
      // Reload so the app reads the flags
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // If onboarding profile step still shows, skip through it
      for (let step = 0; step < 5; step++) {
        const skipBtn = page.locator('button', { hasText: /Passer|Skip/i });
        if (await skipBtn.count() > 0) {
          await skipBtn.first().click();
          await page.waitForTimeout(800);
        } else {
          break;
        }
      }

      // If any other modal/button blocks, dismiss it
      for (const label of ['compris', 'continuer', 'Continue', 'OK', 'Got it', 'Dismiss']) {
        const btn = page.locator('button', { hasText: new RegExp(label, 'i') });
        if (await btn.count() > 0) { await btn.first().click(); await page.waitForTimeout(500); break; }
      }

      // Click "Analyze Video" button to open the upload page
      const analyzeBtn = page.locator('button', { hasText: /Analyze Video|Analyser/i });
      if (await analyzeBtn.count() > 0) {
        await analyzeBtn.first().click();
        await page.waitForTimeout(1500);
      }

      // Select the exercise via the custom ExerciseSelector component
      // The selector is a button that opens a dropdown panel with exercise options
      try {
        // Click the trigger button to open the dropdown
        const selectorTrigger = page.locator('button[aria-haspopup="listbox"]').first();
        if (await selectorTrigger.count() > 0) {
          await selectorTrigger.click();
          await page.waitForTimeout(500);
          // Find and click the exercise option button (role="option")
          // Exercise keys map to display names; try clicking by partial text match
          const exerciseDisplayNames = {
            bench_press: 'Bench Press',
            bicep_curl: 'Bicep Curl',
            lat_pulldown: 'Lat Pulldown',
            lateral_raise: 'Lateral Raise',
            overhead_press: 'Overhead Press',
          };
          const displayName = exerciseDisplayNames[clip.exercise] || clip.exercise.replace(/_/g, ' ');
          const optionBtn = page.locator(`button[role="option"]`, { hasText: new RegExp(displayName, 'i') }).first();
          if (await optionBtn.count() > 0) {
            await optionBtn.click();
            await page.waitForTimeout(500);
            console.log(`    Selected exercise: ${displayName}`);
          } else {
            console.log(`    Warning: could not find exercise option for ${clip.exercise}`);
          }
        }
      } catch (selectErr) {
        console.log(`    Warning: exercise selection failed: ${selectErr.message}`);
      }

      // Debug screenshot after navigating past onboarding
      const debugDir = join(RESULTS_DIR, 'debug');
      mkdirSync(debugDir, { recursive: true });
      await page.screenshot({ path: join(debugDir, `after-onboarding-${i}.png`), fullPage: true });
      const allBtns = await page.evaluate(() =>
        [...document.querySelectorAll('button')].map(el => el.textContent.trim().slice(0, 60))
      );
      console.log(`    Buttons after onboarding: ${JSON.stringify(allBtns)}`);
      const allInputs = await page.evaluate(() =>
        [...document.querySelectorAll('input')].map(el => ({ type: el.type, accept: el.accept }))
      );
      console.log(`    Inputs after onboarding: ${JSON.stringify(allInputs)}`);

      // Find the file input (may be hidden) and upload the clip
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.waitFor({ state: 'attached', timeout: 15000 });
      await fileInput.setInputFiles(clipPath);
      await page.waitForTimeout(1000);

      // Re-select exercise after file upload if it was not already set
      try {
        const currentExText = await page.locator('button[aria-haspopup="listbox"]').first().textContent();
        if (currentExText && currentExText.includes('Select exercise')) {
          const selectorTrigger2 = page.locator('button[aria-haspopup="listbox"]').first();
          await selectorTrigger2.click();
          await page.waitForTimeout(500);
          const exerciseDisplayNames2 = {
            bench_press: 'Bench Press', bicep_curl: 'Bicep Curl',
            lat_pulldown: 'Lat Pulldown', lateral_raise: 'Lateral Raise',
            overhead_press: 'Overhead Press',
          };
          const dn2 = exerciseDisplayNames2[clip.exercise] || clip.exercise.replace(/_/g, ' ');
          const opt2 = page.locator(`button[role="option"]`, { hasText: new RegExp(dn2, 'i') }).first();
          if (await opt2.count() > 0) {
            await opt2.click();
            await page.waitForTimeout(500);
          }
        }
      } catch {}

      // Click the "Analyze" button to start analysis
      // The button text is "Analyze" when exercise is selected, or "select_exercise_first" when not
      const analyzeStartBtn = page.locator('button', { hasText: /^Analyze$|^Analyser$|^Analyze \d/i });
      if (await analyzeStartBtn.count() > 0) {
        await analyzeStartBtn.click();
      } else {
        // Fallback: click the primary/submit button that is not disabled
        const primaryBtn = page.locator('button.btn-primary:not([disabled])').first();
        if (await primaryBtn.count() > 0) {
          await primaryBtn.click();
        }
      }

      console.log(`    Analyzing...`);

      // Wait for analysis to complete: the "Stop" button disappears when done,
      // and the result card appears. Also, the progress indicator goes away.
      // Strategy: wait for "Stop" button to disappear (analysis done)
      try {
        // First wait for analysis to start (Stop button appears)
        await page.waitForSelector('button:has-text("Stop")', { timeout: 30000 }).catch(() => null);
        // Then wait for analysis to finish (Stop button disappears)
        await page.waitForFunction(() => {
          const buttons = [...document.querySelectorAll('button')];
          return !buttons.some(b => b.textContent.trim() === 'Stop');
        }, { timeout: 900000 }); // 15 min max per clip (v2 pipeline is slow)
        console.log(`    Analysis complete`);
      } catch {
        console.log(`    Warning: timed out waiting for analysis to complete`);
      }

      // Wait for result card animations to settle
      await page.waitForTimeout(5000);

      // Take post-analysis screenshot
      mkdirSync(join(RESULTS_DIR, 'debug'), { recursive: true });
      await page.screenshot({ path: join(RESULTS_DIR, 'debug', `result-${i}-${clip.exercise}.png`), fullPage: true });

      // Scrape the result using multiple strategies
      const result = await page.evaluate(() => {
        // Strategy 1: find the rep count by looking for the large number near "REPS"
        let detectedReps = null;
        let formScore = null;
        let detectedExercise = null;
        let visionScore = null;

        const text = document.body.innerText;

        // V2 result card: "We counted\n7\nIs that right?"
        const v2Match = text.match(/We counted\s*\n?\s*(\d+)\s*\n?\s*Is that right/i);
        if (v2Match) detectedReps = parseInt(v2Match[1]);

        // V1 result card: big number, then "REPS" below it
        if (detectedReps === null) {
          const repMatch = text.match(/(\d+)\s*\n?\s*REPS/i);
          if (repMatch) detectedReps = parseInt(repMatch[1]);
        }

        // Also check for the repDisplayCount span directly
        if (detectedReps === null) {
          const repSpans = document.querySelectorAll('[class*="repDisplay"], [aria-live="polite"]');
          for (const span of repSpans) {
            const val = parseInt(span.textContent);
            if (!isNaN(val) && val > 0) { detectedReps = val; break; }
          }
        }

        // Also try the large-font span pattern (2rem)
        if (detectedReps === null) {
          const bigSpans = document.querySelectorAll('span');
          for (const span of bigSpans) {
            const fs = getComputedStyle(span).fontSize;
            if (parseFloat(fs) >= 28 && /^\d+$/.test(span.textContent.trim())) {
              detectedReps = parseInt(span.textContent.trim());
              break;
            }
          }
        }

        // Form score: look for "B+" or "A" grade, or percentage
        const scoreMatch = text.match(/(\d+)\s*(?:\/\s*100|%|\/100)/);
        if (scoreMatch) formScore = parseInt(scoreMatch[1]);

        // Also look for grade letter as proxy
        const gradeMatch = text.match(/\b([ABCDF][+-]?)\b.*?(?:grade|form|score)/i);

        // VisionScore
        const vsMatch = text.match(/VisionScore[:\s]*(\d+)/i);
        if (vsMatch) visionScore = parseInt(vsMatch[1]);

        // Exercise name — typically at the top of the result card
        const h3s = document.querySelectorAll('h3');
        for (const h3 of h3s) {
          const t = h3.textContent.trim();
          if (t.length > 2 && t.length < 40 && !t.includes('Workout')) {
            detectedExercise = t;
            break;
          }
        }

        // Check for hard refuse / insufficient
        const hardRefuse = text.includes('not visible') || text.includes('no movement');
        const insufficientFootage = text.includes('insufficient') || text.includes('Insufficient') || text.includes('confirm');

        return { detectedReps, formScore, detectedExercise, visionScore, hardRefuse, insufficientFootage };
      });

      const error = result.detectedReps !== null ? result.detectedReps - clip.reps : null;
      const exact = error === 0;
      const obo = error !== null && Math.abs(error) <= 1;

      results.push({
        file: clip.file,
        exercise: clip.exercise,
        view: clip.view,
        expectedReps: clip.reps,
        detectedReps: result.detectedReps,
        error,
        exact,
        obo,
        formScore: result.formScore,
        visionScore: result.visionScore,
        detectedExercise: result.detectedExercise,
        hardRefuse: result.hardRefuse,
        insufficientFootage: result.insufficientFootage,
      });

      const errStr = error !== null ? (error === 0 ? ' ✓' : ` ${error > 0 ? '+' : ''}${error}`) : ' ???';
      console.log(`    Got ${result.detectedReps ?? '???'} reps${errStr}  |  form: ${result.formScore ?? '-'}  |  vision: ${result.visionScore ?? '-'}`);

    } catch (err) {
      console.error(`    FAILED: ${err.message}`);
      results.push({
        file: clip.file,
        exercise: clip.exercise,
        view: clip.view,
        expectedReps: clip.reps,
        detectedReps: null,
        error: null,
        exact: false,
        obo: false,
        formScore: null,
        visionScore: null,
        failed: true,
        failReason: err.message,
      });
    }

    await page.close();
  }

  await browser.close();

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('  REAL-PHONE BENCHMARK RESULTS');
  console.log('='.repeat(70));
  console.log(`\n  Exercise                  Expected  Got  Error  Form  Vision`);
  console.log('  ' + '-'.repeat(64));

  let exactCount = 0, oboCount = 0, totalError = 0, counted = 0;

  for (const r of results) {
    const ex = r.exercise.replace(/_/g, ' ').padEnd(24);
    const exp = String(r.expectedReps).padStart(4);
    const got = String(r.detectedReps ?? '???').padStart(4);
    const err = r.error !== null ? (r.error === 0 ? '   0' : (`${r.error > 0 ? '+' : ''}${r.error}`).padStart(4)) : ' ???';
    const form = r.formScore !== null ? String(r.formScore).padStart(4) : '   -';
    const vis = r.visionScore !== null ? String(r.visionScore).padStart(6) : '     -';
    const mark = r.exact ? ' ✓' : r.obo ? ' ~' : r.error !== null ? ' ✗' : '';

    console.log(`  ${ex} ${exp}  ${got}  ${err}  ${form}  ${vis}${mark}`);

    if (r.error !== null) {
      counted++;
      totalError += Math.abs(r.error);
      if (r.exact) exactCount++;
      if (r.obo) oboCount++;
    }
  }

  console.log('  ' + '-'.repeat(64));
  if (counted > 0) {
    console.log(`  Exact match:   ${exactCount}/${counted} (${Math.round(exactCount / counted * 100)}%)`);
    console.log(`  Within ±1:     ${oboCount}/${counted} (${Math.round(oboCount / counted * 100)}%)`);
    console.log(`  MAE:           ${(totalError / counted).toFixed(2)}`);
  }
  console.log('='.repeat(70));

  // Save results
  mkdirSync(RESULTS_DIR, { recursive: true });
  const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '');
  const outFile = join(RESULTS_DIR, `real-phone-${ts}.json`);
  writeFileSync(outFile, JSON.stringify({
    date: new Date().toISOString(),
    source: 'david-phone',
    clips: results,
    summary: {
      total: counted,
      exact: exactCount,
      obo: oboCount,
      mae: counted > 0 ? totalError / counted : null,
    },
  }, null, 2));
  console.log(`\n  Saved: ${outFile}\n`);
}

run();
