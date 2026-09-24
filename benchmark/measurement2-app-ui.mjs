#!/usr/bin/env node
/**
 * MEASUREMENT 2 — App as a user sees it, in Playwright WebKit.
 *
 * For each clip in the real-phone manifest:
 *   Part A: Select the correct exercise from manifest BEFORE analysis.
 *   Part B: Run on Automatic to record what the detector identifies.
 *
 * Records per clip: completed or not, time to result, what the result screen
 * shows (count, confirmation prompt, or refusal with reason).
 *
 * Does NOT modify any app code. Measurement only.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

let webkit, chromium;
try {
  const pw = await import('playwright');
  webkit = pw.webkit;
  chromium = pw.chromium;
} catch {
  const pw = (await import('/tmp/pw-runner/node_modules/playwright/index.mjs')).default
    || await import('/tmp/pw-runner/node_modules/playwright');
  webkit = pw.webkit;
  chromium = pw.chromium;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST_PATH = join(ROOT, 'test', 'real-phone', 'manifest.json');
const CLIPS_DIR = join(ROOT, 'test', 'real-phone', 'clips');
const RESULTS_DIR = join(__dirname, 'results');

const args = process.argv.slice(2);
let baseUrl = 'http://localhost:5173/workout-vision/';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) baseUrl = args[i + 1];
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
const videoClips = manifest.clips.filter(c => c.type === 'video');

// Map exercise keys to display names for the custom dropdown
const EXERCISE_DISPLAY_NAMES = {
  bench_press: 'Bench Press',
  bicep_curl: 'Bicep Curl',
  lat_pulldown: 'Lat Pulldown',
  lateral_raise: 'Lateral Raise',
  overhead_press: 'Overhead Press',
};

console.log(`\n  MEASUREMENT 2 — App UI Benchmark (WebKit)`);
console.log(`  ${videoClips.length} clips, 2 runs each (manual + auto)`);
console.log(`  URL: ${baseUrl}\n`);

async function setupPage(browser) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  page.setDefaultTimeout(300000); // 5 min default
  page.on('pageerror', err => console.error(`    [PAGE ERROR] ${err.message}`));

  // Navigate and skip onboarding
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('wv_seen_landing', '1');
    localStorage.setItem('wv_privacy_accepted', '1');
    localStorage.setItem('wv_lang', 'en');
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Skip onboarding steps
  for (let step = 0; step < 5; step++) {
    const skipBtn = page.locator('button', { hasText: /Passer|Skip/i });
    if (await skipBtn.count() > 0) {
      await skipBtn.first().click();
      await page.waitForTimeout(800);
    } else break;
  }

  // Dismiss modals
  for (const label of ['compris', 'continuer', 'Continue', 'OK', 'Got it', 'Dismiss']) {
    const btn = page.locator('button', { hasText: new RegExp(label, 'i') });
    if (await btn.count() > 0) { await btn.first().click(); await page.waitForTimeout(500); break; }
  }

  return { context, page };
}

async function navigateToUpload(page) {
  const analyzeBtn = page.locator('button', { hasText: /Analyze Video|Analyser/i });
  if (await analyzeBtn.count() > 0) {
    await analyzeBtn.first().click();
    await page.waitForTimeout(1500);
  }
}

async function selectExercise(page, exerciseKey) {
  const displayName = EXERCISE_DISPLAY_NAMES[exerciseKey];
  if (!displayName) throw new Error(`Unknown exercise key: ${exerciseKey}`);

  // Click the exercise selector trigger button (aria-haspopup="listbox")
  const trigger = page.locator('button[aria-haspopup="listbox"]');
  await trigger.waitFor({ state: 'visible', timeout: 10000 });
  await trigger.click();
  await page.waitForTimeout(500);

  // Click the exercise option in the dropdown
  const option = page.locator(`button[role="option"]`, { hasText: new RegExp(`^${displayName.replace(/[()]/g, '\\$&')}`, 'i') });
  if (await option.count() === 0) {
    // Try scrolling through regions to find it
    const allOptions = page.locator('button[role="option"]');
    const count = await allOptions.count();
    let found = false;
    for (let i = 0; i < count; i++) {
      const text = await allOptions.nth(i).textContent();
      if (text.trim().startsWith(displayName)) {
        await allOptions.nth(i).click();
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error(`Could not find exercise option: ${displayName}`);
    }
  } else {
    await option.first().click();
  }
  await page.waitForTimeout(500);

  // Verify selection took effect
  const triggerText = await trigger.textContent();
  if (!triggerText.includes(displayName)) {
    throw new Error(`Exercise selection did not take: expected "${displayName}", got "${triggerText}"`);
  }
}

async function selectAutomatic(page) {
  const trigger = page.locator('button[aria-haspopup="listbox"]');
  await trigger.waitFor({ state: 'visible', timeout: 10000 });
  await trigger.click();
  await page.waitForTimeout(500);

  const autoOption = page.locator('button[role="option"]', { hasText: /Automatic|Automatique/i });
  if (await autoOption.count() > 0) {
    await autoOption.first().click();
  } else {
    throw new Error('Could not find Automatic option');
  }
  await page.waitForTimeout(500);
}

async function uploadAndAnalyze(page, clipPath) {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 15000 });
  await fileInput.setInputFiles(clipPath);
  await page.waitForTimeout(1000);

  // Click Analyze button
  const analyzeBtn = page.locator('button', { hasText: /^Analyze$|^Analyser$/i });
  if (await analyzeBtn.count() > 0) {
    await analyzeBtn.click();
  }
}

async function waitForResult(page, timeoutMs = 300000) {
  const startTime = Date.now();

  try {
    // Wait for Stop button to appear (large clips need longer to hash/start)
    await page.waitForSelector('button:has-text("Stop")', { timeout: 120000 }).catch(() => null);
    // Then wait for analysis to finish (Stop button disappears)
    await page.waitForFunction(() => {
      const buttons = [...document.querySelectorAll('button')];
      return !buttons.some(b => b.textContent.trim() === 'Stop');
    }, { timeout: timeoutMs });
  } catch {
    return { completed: false, timeMs: Date.now() - startTime, timedOut: true };
  }

  await page.waitForTimeout(3000); // Wait for animations

  return { completed: true, timeMs: Date.now() - startTime };
}

async function scrapeResult(page) {
  return page.evaluate(() => {
    const text = document.body.innerText;
    let detectedReps = null;
    let formScore = null;
    let detectedExercise = null;
    let visionScore = null;

    // Rep count
    const repMatch = text.match(/(\d+)\s*\n?\s*REPS/i);
    if (repMatch) detectedReps = parseInt(repMatch[1]);

    if (detectedReps === null) {
      const repSpans = document.querySelectorAll('[aria-live="polite"]');
      for (const span of repSpans) {
        const val = parseInt(span.textContent);
        if (!isNaN(val) && val > 0) { detectedReps = val; break; }
      }
    }

    // Form score
    const scoreMatch = text.match(/(\d+)\s*(?:\/\s*100|\/100)/);
    if (scoreMatch) formScore = parseInt(scoreMatch[1]);

    // VisionScore
    const vsMatch = text.match(/VisionScore[:\s]*(\d+)/i);
    if (vsMatch) visionScore = parseInt(vsMatch[1]);

    // Exercise name from result card h3
    const h3s = document.querySelectorAll('h3');
    for (const h3 of h3s) {
      const t = h3.textContent.trim();
      if (t.length > 2 && t.length < 60 && !t.includes('Workout')) {
        detectedExercise = t;
        break;
      }
    }

    // Check for refusal indicators
    const hardRefuse = text.includes('not visible') || text.includes('no movement');
    const insufficientFootage = text.includes('insufficient') || text.includes('Insufficient');
    const confirmPrompt = text.includes('confirm') || text.includes('Confirm');

    return { detectedReps, formScore, detectedExercise, visionScore, hardRefuse, insufficientFootage, confirmPrompt };
  });
}

async function run() {
  // Try WebKit first
  let browser;
  let engineUsed = 'webkit';
  try {
    browser = await webkit.launch({
      headless: false,
      args: ['--enable-webgl'],
    });
    console.log('  Engine: WebKit (Safari/iPhone engine)\n');
  } catch (e) {
    console.log(`  WebKit launch failed: ${e.message}`);
    console.log('  Falling back to Chrome channel...\n');
    browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
      args: ['--enable-webgl', '--ignore-gpu-blocklist'],
    });
    engineUsed = 'chrome';
  }

  const resultsManual = [];
  const resultsAuto = [];
  const debugDir = join(RESULTS_DIR, 'debug', 'measurement2');
  mkdirSync(debugDir, { recursive: true });

  // ── PART A: Manual exercise selection ──
  console.log('  ═══ PART A: Manual exercise selection ═══\n');

  for (let i = 0; i < videoClips.length; i++) {
    const clip = videoClips[i];
    const clipPath = join(CLIPS_DIR, clip.file);
    const displayName = EXERCISE_DISPLAY_NAMES[clip.exercise];
    console.log(`  [${i + 1}/${videoClips.length}] ${clip.exercise} — expected ${clip.reps} reps (${clip.view})`);

    const { context, page } = await setupPage(browser);

    try {
      await navigateToUpload(page);

      // Select exercise BEFORE uploading
      await selectExercise(page, clip.exercise);
      console.log(`    Exercise selected: ${displayName}`);

      // Upload and analyze
      const startTime = Date.now();
      await uploadAndAnalyze(page, clipPath);
      console.log(`    Analyzing...`);

      const waitResult = await waitForResult(page);

      await page.screenshot({ path: join(debugDir, `manual-${i}-${clip.exercise}.png`), fullPage: true });

      if (waitResult.completed) {
        const result = await scrapeResult(page);
        const error = result.detectedReps !== null ? result.detectedReps - clip.reps : null;

        resultsManual.push({
          file: clip.file,
          exercise: clip.exercise,
          view: clip.view,
          expectedReps: clip.reps,
          mode: 'manual',
          completed: true,
          timeToResultMs: waitResult.timeMs,
          detectedReps: result.detectedReps,
          error,
          formScore: result.formScore,
          visionScore: result.visionScore,
          detectedExercise: result.detectedExercise,
          hardRefuse: result.hardRefuse,
          insufficientFootage: result.insufficientFootage,
          confirmPrompt: result.confirmPrompt,
        });

        const errStr = error !== null ? (error === 0 ? ' exact' : ` ${error > 0 ? '+' : ''}${error}`) : ' ???';
        console.log(`    Got ${result.detectedReps ?? '???'} reps${errStr}  |  form: ${result.formScore ?? '-'}  |  time: ${(waitResult.timeMs / 1000).toFixed(1)}s`);
      } else {
        resultsManual.push({
          file: clip.file,
          exercise: clip.exercise,
          view: clip.view,
          expectedReps: clip.reps,
          mode: 'manual',
          completed: false,
          timeToResultMs: waitResult.timeMs,
          timedOut: true,
        });
        console.log(`    TIMED OUT after ${(waitResult.timeMs / 1000).toFixed(1)}s`);
      }
    } catch (err) {
      resultsManual.push({
        file: clip.file,
        exercise: clip.exercise,
        view: clip.view,
        expectedReps: clip.reps,
        mode: 'manual',
        completed: false,
        error: null,
        failReason: err.message,
      });
      console.log(`    FAILED: ${err.message}`);
      await page.screenshot({ path: join(debugDir, `manual-fail-${i}-${clip.exercise}.png`), fullPage: true }).catch(() => {});
    }

    await context.close();
  }

  // ── PART B: Automatic detection ──
  console.log('\n  ═══ PART B: Automatic detection ═══\n');

  for (let i = 0; i < videoClips.length; i++) {
    const clip = videoClips[i];
    const clipPath = join(CLIPS_DIR, clip.file);
    console.log(`  [${i + 1}/${videoClips.length}] ${clip.exercise} — Automatic mode`);

    const { context, page } = await setupPage(browser);

    try {
      await navigateToUpload(page);

      // Select Automatic
      await selectAutomatic(page);
      console.log(`    Set to Automatic`);

      const startTime = Date.now();
      await uploadAndAnalyze(page, clipPath);
      console.log(`    Analyzing...`);

      const waitResult = await waitForResult(page);

      await page.screenshot({ path: join(debugDir, `auto-${i}-${clip.exercise}.png`), fullPage: true });

      if (waitResult.completed) {
        const result = await scrapeResult(page);

        resultsAuto.push({
          file: clip.file,
          exercise: clip.exercise,
          view: clip.view,
          expectedReps: clip.reps,
          mode: 'automatic',
          completed: true,
          timeToResultMs: waitResult.timeMs,
          detectedReps: result.detectedReps,
          detectedExercise: result.detectedExercise,
          formScore: result.formScore,
          visionScore: result.visionScore,
          hardRefuse: result.hardRefuse,
          insufficientFootage: result.insufficientFootage,
          confirmPrompt: result.confirmPrompt,
        });

        console.log(`    Detected as: ${result.detectedExercise ?? '???'}  |  reps: ${result.detectedReps ?? '???'}  |  time: ${(waitResult.timeMs / 1000).toFixed(1)}s`);
      } else {
        resultsAuto.push({
          file: clip.file,
          exercise: clip.exercise,
          view: clip.view,
          expectedReps: clip.reps,
          mode: 'automatic',
          completed: false,
          timeToResultMs: waitResult.timeMs,
          timedOut: true,
        });
        console.log(`    TIMED OUT after ${(waitResult.timeMs / 1000).toFixed(1)}s`);
      }
    } catch (err) {
      resultsAuto.push({
        file: clip.file,
        exercise: clip.exercise,
        view: clip.view,
        expectedReps: clip.reps,
        mode: 'automatic',
        completed: false,
        failReason: err.message,
      });
      console.log(`    FAILED: ${err.message}`);
      await page.screenshot({ path: join(debugDir, `auto-fail-${i}-${clip.exercise}.png`), fullPage: true }).catch(() => {});
    }

    await context.close();
  }

  await browser.close();

  return { manual: resultsManual, auto: resultsAuto, engine: engineUsed };
}

const { manual, auto, engine } = await run();

// Print summary tables
console.log('\n' + '='.repeat(80));
console.log('  MEASUREMENT 2 — PART A: Manual exercise selection');
console.log('='.repeat(80));
console.log(`  Engine: ${engine}`);
console.log(`\n  Exercise                  Expected  Got  Error  Form  Time(s)  Status`);
console.log('  ' + '-'.repeat(74));
for (const r of manual) {
  const ex = r.exercise.replace(/_/g, ' ').padEnd(24);
  const exp = String(r.expectedReps).padStart(4);
  const got = String(r.detectedReps ?? '???').padStart(4);
  const err = r.error != null ? (r.error === 0 ? '   0' : (`${r.error > 0 ? '+' : ''}${r.error}`).padStart(4)) : ' ???';
  const form = r.formScore != null ? String(r.formScore).padStart(4) : '   -';
  const time = r.timeToResultMs != null ? (r.timeToResultMs / 1000).toFixed(1).padStart(7) : '      -';
  let status = r.completed ? 'OK' : (r.timedOut ? 'TIMEOUT' : 'FAIL');
  if (r.hardRefuse) status = 'REFUSE';
  if (r.insufficientFootage) status = 'INSUFF';
  if (r.confirmPrompt) status += '+CONFIRM';
  console.log(`  ${ex} ${exp}  ${got}  ${err}  ${form}  ${time}  ${status}`);
}

console.log('\n' + '='.repeat(80));
console.log('  MEASUREMENT 2 — PART B: Automatic detection');
console.log('='.repeat(80));
console.log(`\n  Exercise (true)           Detected as                     Reps  Time(s)  Status`);
console.log('  ' + '-'.repeat(78));
for (const r of auto) {
  const ex = r.exercise.replace(/_/g, ' ').padEnd(24);
  const det = (r.detectedExercise ?? '???').padEnd(30);
  const reps = String(r.detectedReps ?? '???').padStart(4);
  const time = r.timeToResultMs != null ? (r.timeToResultMs / 1000).toFixed(1).padStart(7) : '      -';
  let status = r.completed ? 'OK' : (r.timedOut ? 'TIMEOUT' : 'FAIL');
  console.log(`  ${ex} ${det}  ${reps}  ${time}  ${status}`);
}
console.log('='.repeat(80));

// Save results
mkdirSync(RESULTS_DIR, { recursive: true });
const ts = new Date().toISOString().slice(0, 10);
const outFile = join(RESULTS_DIR, `real-phone-${ts}.json`);

// Load existing or create new
let combined = {};
try {
  combined = JSON.parse(readFileSync(outFile, 'utf-8'));
} catch { /* new file */ }

combined.date = new Date().toISOString();
combined.measurement2 = {
  engine,
  manual,
  auto,
};

writeFileSync(outFile, JSON.stringify(combined, null, 2));
console.log(`\n  Saved: ${outFile}\n`);
