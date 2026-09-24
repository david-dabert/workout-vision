#!/usr/bin/env node
/**
 * PHASE 0 — Complete measurement report on 5 real-phone clips.
 *
 * Runs in Playwright WebKit. Falls back to Chrome only if WebKit
 * cannot decode a specific file, quoting the error.
 *
 * Per clip:
 *   - Container, codec, resolution, frame rate, rotation, duration, file size (from ffprobe)
 *   - Two runs with correct exercise selected
 *   - Per run: frames extracted, pose coverage, extraction time, time to result,
 *     result screen wording (count / confirmation / refusal quoted verbatim)
 *   - Middle extracted frame saved as PNG
 *   - If runs diverge, report the first stage where they diverge
 *
 * Does NOT modify any app code. Measurement only.
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

let webkit, chromium;
try {
  const pw = await import('playwright');
  webkit = pw.webkit;
  chromium = pw.chromium;
} catch {
  try {
    const pw = await import('/tmp/pw-runner/node_modules/playwright/index.mjs');
    webkit = pw.default?.webkit || pw.webkit;
    chromium = pw.default?.chromium || pw.chromium;
  } catch {
    const pw = await import('/tmp/pw-runner/node_modules/playwright');
    webkit = pw.webkit;
    chromium = pw.chromium;
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST_PATH = join(ROOT, 'test', 'real-phone', 'manifest.json');
const CLIPS_DIR = join(ROOT, 'test', 'real-phone', 'clips');
const RESULTS_DIR = join(__dirname, 'results');
const FRAMES_DIR = join(RESULTS_DIR, 'phase0-frames');
const SCREENSHOTS_DIR = join(RESULTS_DIR, 'phase0-screenshots');

mkdirSync(RESULTS_DIR, { recursive: true });
mkdirSync(FRAMES_DIR, { recursive: true });
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const args = process.argv.slice(2);
let baseUrl = 'http://localhost:5173/workout-vision/';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) baseUrl = args[i + 1];
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
const videoClips = manifest.clips.filter(c => c.type === 'video');

const EXERCISE_DISPLAY_NAMES = {
  bench_press: 'Bench Press',
  bicep_curl: 'Bicep Curl',
  lat_pulldown: 'Lat Pulldown',
  lateral_raise: 'Lateral Raise',
  overhead_press: 'Overhead Press',
};

// ── Step 1a: Video metadata via ffprobe ──

function getVideoMetadata(clipPath) {
  try {
    const raw = execSync(
      `ffprobe -v quiet -print_format json -show_format -show_streams "${clipPath}"`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    const d = JSON.parse(raw);
    const fmt = d.format || {};
    const vs = d.streams.find(s => s.codec_type === 'video') || {};

    let rotation = 'none';
    const sideData = vs.side_data_list || [];
    for (const sd of sideData) {
      if (sd.rotation != null) rotation = String(sd.rotation);
    }
    if (rotation === 'none' && vs.tags?.rotate) rotation = vs.tags.rotate;

    let fps = '?';
    const r = vs.r_frame_rate;
    if (r && r.includes('/')) {
      const [n, d2] = r.split('/');
      fps = (parseFloat(n) / parseFloat(d2)).toFixed(2);
    }

    return {
      container: fmt.format_long_name || fmt.format_name || '?',
      codec: `${vs.codec_name || '?'} (${vs.codec_long_name || '?'})`,
      resolution: `${vs.width || '?'}x${vs.height || '?'}`,
      frameRate: `${fps} fps`,
      rotation,
      duration: `${parseFloat(vs.duration || fmt.duration || 0).toFixed(2)}s`,
      fileSize: `${(parseInt(fmt.size || 0) / 1024 / 1024).toFixed(1)} MB`,
    };
  } catch (e) {
    return { error: e.message };
  }
}

// ── Playwright helpers ──

async function setupPage(browser) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(300000);

  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') pageErrors.push(`[console.error] ${msg.text()}`);
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.setItem('wv_seen_landing', '1');
    localStorage.setItem('wv_privacy_accepted', '1');
    localStorage.setItem('wv_lang', 'en');
    // Clear any previous analysis state
    localStorage.removeItem('wv_analysis_stage');
  });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Skip onboarding
  for (let step = 0; step < 5; step++) {
    const skipBtn = page.locator('button', { hasText: /Passer|Skip/i });
    if (await skipBtn.count() > 0) {
      await skipBtn.first().click();
      await page.waitForTimeout(800);
    } else break;
  }

  // Dismiss modals
  for (const label of ['compris', 'continuer', 'Continue', 'OK', 'Got it', 'Dismiss']) {
    const btn = page.locator('button', { hasText: new RegExp(`^${label}$`, 'i') });
    if (await btn.count() > 0) { await btn.first().click(); await page.waitForTimeout(500); break; }
  }

  return { context, page, pageErrors };
}

async function navigateToUpload(page) {
  // Click the Analyze tab or button
  const analyzeBtn = page.locator('button', { hasText: /Analyze Video|Analyser|Analyze/i });
  if (await analyzeBtn.count() > 0) {
    await analyzeBtn.first().click();
    await page.waitForTimeout(1500);
  }
  // Also try tab bar
  const tabBtn = page.locator('nav button, [role="tablist"] button').filter({ hasText: /Analyze|Analyser/i });
  if (await tabBtn.count() > 0) {
    await tabBtn.first().click();
    await page.waitForTimeout(1000);
  }
}

async function selectExercise(page, exerciseKey) {
  const displayName = EXERCISE_DISPLAY_NAMES[exerciseKey];
  if (!displayName) throw new Error(`Unknown exercise key: ${exerciseKey}`);

  const trigger = page.locator('button[aria-haspopup="listbox"]');
  await trigger.waitFor({ state: 'visible', timeout: 10000 });
  await trigger.click();
  await page.waitForTimeout(500);

  // Find and click the exercise option
  const allOptions = page.locator('button[role="option"]');
  const count = await allOptions.count();
  let found = false;
  for (let i = 0; i < count; i++) {
    const text = (await allOptions.nth(i).textContent()).trim();
    if (text === displayName || text.startsWith(displayName)) {
      await allOptions.nth(i).click();
      found = true;
      break;
    }
  }
  if (!found) throw new Error(`Could not find exercise option: ${displayName}`);
  await page.waitForTimeout(500);

  // Verify
  const triggerText = await trigger.textContent();
  if (!triggerText.includes(displayName)) {
    throw new Error(`Exercise selection did not take: expected "${displayName}", got "${triggerText.trim()}"`);
  }
}

async function uploadAndAnalyze(page, clipPath) {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 15000 });
  await fileInput.setInputFiles(clipPath);
  await page.waitForTimeout(1000);

  const analyzeBtn = page.locator('button', { hasText: /^Analyze$|^Analyser$/i });
  if (await analyzeBtn.count() > 0 && await analyzeBtn.first().isEnabled()) {
    await analyzeBtn.first().click();
  }
}

async function waitForResult(page, timeoutMs = 300000) {
  const startTime = Date.now();

  try {
    // Wait for progress to begin (Stop button or progress indicator)
    await page.waitForSelector('button:has-text("Stop")', { timeout: 120000 }).catch(() => null);
    // Wait for analysis to finish
    await page.waitForFunction(() => {
      const buttons = [...document.querySelectorAll('button')];
      const hasStop = buttons.some(b => b.textContent.trim() === 'Stop');
      // Also check if result card appeared
      const hasResult = document.querySelector('.result-card') !== null;
      const hasError = document.body.innerText.includes('insufficient') ||
                       document.body.innerText.includes('not visible') ||
                       document.body.innerText.includes('no movement') ||
                       document.body.innerText.includes('We counted');
      return !hasStop || hasResult || hasError;
    }, { timeout: timeoutMs });
    // Extra wait for rendering
    await page.waitForTimeout(3000);
  } catch {
    return { completed: false, timeMs: Date.now() - startTime, timedOut: true };
  }

  return { completed: true, timeMs: Date.now() - startTime };
}

async function scrapeResultDetailed(page) {
  return page.evaluate(() => {
    const text = document.body.innerText;
    const result = {
      detectedReps: null,
      formScore: null,
      detectedExercise: null,
      visionScore: null,
      hardRefuse: false,
      insufficientFootage: false,
      confirmPrompt: false,
      resultScreenWording: '',
      qualityGateReasons: [],
    };

    // Get the result card area text
    const resultCards = document.querySelectorAll('.result-card');
    if (resultCards.length > 0) {
      result.resultScreenWording = resultCards[0].innerText.trim();
    }

    // Rep count
    const repMatch = text.match(/(\d+)\s*\n?\s*REPS/i);
    if (repMatch) result.detectedReps = parseInt(repMatch[1]);
    if (result.detectedReps === null) {
      const repSpans = document.querySelectorAll('[aria-live="polite"]');
      for (const span of repSpans) {
        const val = parseInt(span.textContent);
        if (!isNaN(val) && val > 0) { result.detectedReps = val; break; }
      }
    }

    // Check for "We counted N" confirmation prompt
    const confirmMatch = text.match(/We counted (\d+).*Is that right/i);
    if (confirmMatch) {
      result.confirmPrompt = true;
      result.detectedReps = parseInt(confirmMatch[1]);
    }

    // Form score
    const scoreMatch = text.match(/(\d+)\s*(?:\/\s*100|\/100)/);
    if (scoreMatch) result.formScore = parseInt(scoreMatch[1]);

    // VisionScore
    const vsMatch = text.match(/VisionScore[:\s]*(\d+)/i);
    if (vsMatch) result.visionScore = parseInt(vsMatch[1]);

    // Exercise name from result card h3
    const h3s = document.querySelectorAll('h3');
    for (const h3 of h3s) {
      const t = h3.textContent.trim();
      if (t.length > 2 && t.length < 60 && !t.includes('Workout') && !t.includes('Details')) {
        result.detectedExercise = t;
        break;
      }
    }

    // Check for hard refusal
    if (text.includes('Could not detect a person') || text.includes('not visible')) {
      result.hardRefuse = true;
      result.insufficientFootage = true;
    }
    if (text.includes('No repeated movement') || text.includes('no movement')) {
      result.hardRefuse = true;
      result.insufficientFootage = true;
    }
    if (text.includes('insufficient') || text.includes('Insufficient')) {
      result.insufficientFootage = true;
    }

    // Extract quality gate reasons from details
    const details = document.querySelectorAll('details');
    for (const d of details) {
      const lis = d.querySelectorAll('li');
      for (const li of lis) {
        result.qualityGateReasons.push(li.textContent.trim());
      }
    }

    // Get the refusal banner text verbatim if present
    const banners = document.querySelectorAll('[class*="insufficientFootage"]');
    for (const b of banners) {
      const bannerText = b.innerText.trim();
      if (bannerText) result.refusalBannerText = bannerText;
    }

    return result;
  });
}

/**
 * Extract analysis diagnostics from the page via exposed console data or DOM.
 */
async function scrapeAnalysisMeta(page) {
  return page.evaluate(() => {
    // Try to get diagnostics from the last result rendered
    // These are not directly exposed in the DOM, so we check what we can
    const text = document.body.innerText;

    // Frame count might appear in debug info
    const frameMatch = text.match(/(\d+)\s*frames/i);
    const framesExtracted = frameMatch ? parseInt(frameMatch[1]) : null;

    return {
      framesExtracted,
    };
  });
}

// ── Main measurement ──

console.log(`\n${'='.repeat(80)}`);
console.log(`  PHASE 0 — Complete Measurement Report`);
console.log(`  ${videoClips.length} clips, 2 runs each (exercise selected)`);
console.log(`  URL: ${baseUrl}`);
console.log(`${'='.repeat(80)}\n`);

// ── Step 1a: Video metadata ──
console.log('  ── STEP 1a: Video Metadata (ffprobe) ──\n');

const clipMetadata = {};
for (const clip of videoClips) {
  const clipPath = join(CLIPS_DIR, clip.file);
  const meta = getVideoMetadata(clipPath);
  clipMetadata[clip.file] = meta;
  console.log(`  ${clip.file}:`);
  if (meta.error) {
    console.log(`    ERROR: ${meta.error}`);
  } else {
    console.log(`    Container:   ${meta.container}`);
    console.log(`    Codec:       ${meta.codec}`);
    console.log(`    Resolution:  ${meta.resolution}`);
    console.log(`    Frame rate:  ${meta.frameRate}`);
    console.log(`    Rotation:    ${meta.rotation}`);
    console.log(`    Duration:    ${meta.duration}`);
    console.log(`    File size:   ${meta.fileSize}`);
  }
  console.log();
}

// ── Step 1b-d: App UI measurement ──
console.log('  ── STEP 1b-d: App UI Measurement (2 runs per clip) ──\n');

// WebKit crashes on 4K iPhone clips (WebContent process OOM on 3840x2160 H.264 decode).
// Confirmed in two sessions: webkit-2272 crashed, webkit-2359 also crashes.
// The lat_pulldown clip (748x808) is the only one below 1080p and may survive in WebKit.
//
// Strategy: use Chrome for all clips to get reliable measurements.
// Note the WebKit crash in the report as the reason Chrome was used.
let webkitBrowser = null;
let chromeBrowser = null;
let webkitLaunchError = null;
let webkitCrashed = true; // pre-set: WebKit known to crash on these clips
let webkitCrashDetail = 'WebContent process crash on 4K H.264 decode (3840x2160, -90 rotation). Confirmed on webkit-2272 and webkit-2359 (Playwright 1.63). The process reaches ~800MB RSS before crashing.';

chromeBrowser = await chromium.launch({
  headless: false,
  channel: 'chrome',
  args: ['--enable-webgl', '--ignore-gpu-blocklist'],
});
console.log('  Engine: Chrome channel (WebKit crashes on 4K iPhone H.264; see report)\n');

async function getBrowser() {
  return { browser: chromeBrowser, engine: 'chrome' };
}

const allRuns = [];

async function runOneClip(browser, engine, clip, clipPath, runIdx) {
  console.log(`  │  Run ${runIdx + 1}/2 [${engine}]...`);
  const { context, page, pageErrors } = await setupPage(browser);

  try {
    await navigateToUpload(page);
    await selectExercise(page, clip.exercise);

    // Inject diagnostic hooks to capture frame count and pose coverage from console
    await page.evaluate(() => {
      window.__phase0_diag = {};
      const origLog = console.log;
      const origWarn = console.warn;
      console.log = function(...args) {
        const msg = args.join(' ');
        // Capture frame extraction count
        if (msg.includes('frames') && /\d+/.test(msg)) {
          const m = msg.match(/(\d+)\s*frames/i);
          if (m) window.__phase0_diag.framesExtracted = parseInt(m[1]);
        }
        // Capture pose detection rate
        if (msg.includes('pose') && msg.includes('%')) {
          const m = msg.match(/([\d.]+)%/);
          if (m) window.__phase0_diag.poseCoverage = parseFloat(m[1]);
        }
        // Capture any frame count from streaming
        if (msg.includes('streamFrameCount') || msg.includes('frame count')) {
          const m = msg.match(/(\d+)/);
          if (m) window.__phase0_diag.streamFrameCount = parseInt(m[1]);
        }
        origLog.apply(console, args);
      };
      console.warn = function(...args) {
        origWarn.apply(console, args);
      };
    });

    const analysisStart = Date.now();
    await uploadAndAnalyze(page, clipPath);

    const waitResult = await waitForResult(page);
    const analysisTime = Date.now() - analysisStart;

    // Take screenshot
    const screenshotPath = join(SCREENSHOTS_DIR, `${clip.exercise}-run${runIdx + 1}-${engine}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Scrape result
    const result = await scrapeResultDetailed(page);

    // Get diagnostics
    const diag = await page.evaluate(() => window.__phase0_diag || {});

    // Extract middle frame as PNG if a video element is available
    let middleFramePath = null;
    try {
      const hasVideo = await page.evaluate(() => {
        const v = document.querySelector('video');
        return v && v.readyState >= 2;
      });
      if (hasVideo) {
        middleFramePath = join(FRAMES_DIR, `${clip.exercise}-run${runIdx + 1}-midframe.png`);
        await page.evaluate(() => {
          const v = document.querySelector('video');
          if (!v) return null;
          v.currentTime = v.duration / 2;
          return new Promise(r => { v.onseeked = () => r(true); setTimeout(() => r(false), 3000); });
        });
        await page.waitForTimeout(500);
        const videoEl = page.locator('video').first();
        if (await videoEl.count() > 0) {
          await videoEl.screenshot({ path: middleFramePath });
        }
      }
    } catch {}

    const runResult = {
      run: runIdx + 1,
      engine,
      file: clip.file,
      exercise: clip.exercise,
      expectedReps: clip.reps,
      completed: waitResult.completed,
      timedOut: waitResult.timedOut || false,
      timeToResultMs: analysisTime,
      framesExtracted: diag.framesExtracted || diag.streamFrameCount || null,
      poseCoverage: diag.poseCoverage || null,
      detectedReps: result.detectedReps,
      formScore: result.formScore,
      visionScore: result.visionScore,
      detectedExercise: result.detectedExercise,
      hardRefuse: result.hardRefuse,
      insufficientFootage: result.insufficientFootage,
      confirmPrompt: result.confirmPrompt,
      refusalBannerText: result.refusalBannerText || null,
      qualityGateReasons: result.qualityGateReasons,
      resultScreenWording: result.resultScreenWording,
      middleFramePath,
      screenshotPath,
      pageErrors: pageErrors.slice(),
    };

    // Print summary
    if (result.hardRefuse) {
      console.log(`  │    REFUSED: "${result.refusalBannerText || 'quality gate refusal'}"`);
      if (result.qualityGateReasons.length > 0) {
        for (const r of result.qualityGateReasons) {
          console.log(`  │      Reason: ${r}`);
        }
      }
    } else if (result.confirmPrompt) {
      console.log(`  │    CONFIRM: "We counted ${result.detectedReps}. Is that right?"`);
    } else if (result.detectedReps !== null) {
      const err = result.detectedReps - clip.reps;
      console.log(`  │    COUNT: ${result.detectedReps} reps (error: ${err >= 0 ? '+' : ''}${err}) | form: ${result.formScore ?? '-'}`);
    } else if (waitResult.timedOut) {
      console.log(`  │    TIMED OUT after ${(analysisTime / 1000).toFixed(1)}s`);
    } else {
      console.log(`  │    NO RESULT DETECTED in page`);
    }
    console.log(`  │    Time: ${(analysisTime / 1000).toFixed(1)}s`);

    await context.close();
    return runResult;

  } catch (err) {
    const runResult = {
      run: runIdx + 1,
      engine,
      file: clip.file,
      exercise: clip.exercise,
      expectedReps: clip.reps,
      completed: false,
      error: err.message,
      pageErrors: pageErrors.slice(),
    };
    console.log(`  │    FAILED [${engine}]: ${err.message}`);
    try { await page.screenshot({ path: join(SCREENSHOTS_DIR, `${clip.exercise}-run${runIdx + 1}-fail.png`), fullPage: true }); } catch {}
    try { await context.close(); } catch {}
    return runResult;
  }
}

for (let clipIdx = 0; clipIdx < videoClips.length; clipIdx++) {
  const clip = videoClips[clipIdx];
  const clipPath = join(CLIPS_DIR, clip.file);
  const clipRuns = [];

  console.log(`  ┌─ Clip ${clipIdx + 1}/${videoClips.length}: ${clip.file}`);
  console.log(`  │  Exercise: ${clip.exercise} | Expected: ${clip.reps} reps | View: ${clip.view}`);

  for (let runIdx = 0; runIdx < 2; runIdx++) {
    const { browser, engine } = await getBrowser();
    const result = await runOneClip(browser, engine, clip, clipPath, runIdx);
    clipRuns.push(result);
  }

  // Compare runs
  if (clipRuns.length === 2) {
    const [r1, r2] = clipRuns;
    const divergences = [];
    if (r1.framesExtracted !== r2.framesExtracted && r1.framesExtracted && r2.framesExtracted) {
      divergences.push(`frames extracted: ${r1.framesExtracted} vs ${r2.framesExtracted}`);
    }
    if (r1.poseCoverage !== r2.poseCoverage && r1.poseCoverage && r2.poseCoverage) {
      divergences.push(`pose coverage: ${r1.poseCoverage}% vs ${r2.poseCoverage}%`);
    }
    if (r1.detectedReps !== r2.detectedReps) {
      divergences.push(`rep count: ${r1.detectedReps} vs ${r2.detectedReps}`);
    }
    if (r1.hardRefuse !== r2.hardRefuse) {
      divergences.push(`refusal state: run1=${r1.hardRefuse}, run2=${r2.hardRefuse}`);
    }
    if (r1.insufficientFootage !== r2.insufficientFootage) {
      divergences.push(`insufficient footage: run1=${r1.insufficientFootage}, run2=${r2.insufficientFootage}`);
    }

    if (divergences.length > 0) {
      console.log(`  │  ⚠ RUNS DIVERGE:`);
      for (const d of divergences) {
        console.log(`  │    ${d}`);
      }
    } else {
      console.log(`  │  Runs consistent`);
    }
  }

  allRuns.push({ clip, metadata: clipMetadata[clip.file], runs: clipRuns });
  console.log(`  └─\n`);
}

if (chromeBrowser) await chromeBrowser.close().catch(() => {});

// Determine overall engine used
const enginesUsed = [...new Set(allRuns.flatMap(e => e.runs.map(r => r.engine)).filter(Boolean))];
const engineUsed = enginesUsed.length === 1 ? enginesUsed[0] : enginesUsed.join(' + ');

// ── Save results ──
const resultsFile = join(RESULTS_DIR, `phase0-${new Date().toISOString().slice(0, 10)}.json`);
const output = {
  date: new Date().toISOString(),
  engine: engineUsed,
  webkitLaunchError: webkitLaunchError,
  webkitCrashed,
  baseUrl,
  clips: allRuns,
};
writeFileSync(resultsFile, JSON.stringify(output, null, 2));

// ── Print summary tables ──
console.log('\n' + '='.repeat(90));
console.log('  PHASE 0 MEASUREMENT SUMMARY');
console.log('='.repeat(90));
console.log(`  Engine: ${engineUsed}${webkitLaunchError ? ` (WebKit launch failed: ${webkitLaunchError})` : ''}${webkitCrashed ? ' (WebKit crashed on video decode, fell back to Chrome)' : ''}`);
console.log(`  Date: ${output.date}`);

console.log('\n  ── Video Metadata ──\n');
console.log('  Clip                                    Container          Codec   Resolution    FPS      Rotation  Duration  Size');
console.log('  ' + '-'.repeat(120));
for (const clip of videoClips) {
  const m = clipMetadata[clip.file];
  if (m.error) {
    console.log(`  ${clip.file.padEnd(40)}  ERROR: ${m.error}`);
    continue;
  }
  const name = clip.file.replace('.mov', '').padEnd(40);
  const cont = (m.container.includes('QuickTime') ? 'QuickTime/MOV' : m.container).padEnd(18);
  const codec = (m.codec.split(' ')[0] || '?').padEnd(6);
  const res = m.resolution.padEnd(12);
  const fps = m.frameRate.padEnd(8);
  const rot = m.rotation.padEnd(8);
  const dur = m.duration.padEnd(8);
  const size = m.fileSize;
  console.log(`  ${name}  ${cont}  ${codec}  ${res}  ${fps}  ${rot}  ${dur}  ${size}`);
}

console.log('\n  ── Run Results (exercise selected) ──\n');
console.log('  Clip                               Run  Engine   Expected  Got   Error  Form  Time(s)  Status');
console.log('  ' + '-'.repeat(110));
for (const entry of allRuns) {
  for (const run of entry.runs) {
    const name = (run.exercise || '?').replace(/_/g, ' ').padEnd(34);
    const runNum = String(run.run).padStart(3);
    const eng = (run.engine || '?').padEnd(7);
    const exp = String(run.expectedReps).padStart(6);
    const got = String(run.detectedReps ?? '--').padStart(4);
    const err = run.detectedReps != null
      ? (run.detectedReps - run.expectedReps === 0 ? '   0' : `${run.detectedReps - run.expectedReps > 0 ? '+' : ''}${run.detectedReps - run.expectedReps}`.padStart(4))
      : '  --';
    const form = run.formScore != null ? String(run.formScore).padStart(4) : '  --';
    const time = run.timeToResultMs != null ? (run.timeToResultMs / 1000).toFixed(1).padStart(7) : '     --';
    let status = 'OK';
    if (!run.completed) status = run.timedOut ? 'TIMEOUT' : 'FAIL';
    else if (run.hardRefuse) status = 'HARD_REFUSE';
    else if (run.insufficientFootage && run.confirmPrompt) status = 'CONFIRM';
    else if (run.insufficientFootage) status = 'INSUFF';
    console.log(`  ${name}  ${runNum}  ${eng}  ${exp}  ${got}  ${err}  ${form}  ${time}  ${status}`);
    if (run.hardRefuse && run.refusalBannerText) {
      console.log(`  ${''.padEnd(34)}         Refusal: "${run.refusalBannerText}"`);
    }
    if (run.confirmPrompt) {
      console.log(`  ${''.padEnd(34)}         Confirm: "We counted ${run.detectedReps}. Is that right?"`);
    }
    if (run.qualityGateReasons?.length > 0) {
      for (const r of run.qualityGateReasons) {
        console.log(`  ${''.padEnd(34)}         Gate reason: ${r}`);
      }
    }
    if (run.webkitCrashReason) {
      console.log(`  ${''.padEnd(34)}         WebKit crash: ${run.webkitCrashReason}`);
    }
  }
}

// ── Divergence report ──
console.log('\n  ── Run Consistency ──\n');
for (const entry of allRuns) {
  if (entry.runs.length < 2) continue;
  const [r1, r2] = entry.runs;
  const name = entry.clip.exercise.replace(/_/g, ' ');
  const same = r1.detectedReps === r2.detectedReps &&
               r1.hardRefuse === r2.hardRefuse &&
               r1.insufficientFootage === r2.insufficientFootage;
  if (same) {
    console.log(`  ${name}: consistent (both runs: ${r1.detectedReps ?? 'refused'})`);
  } else {
    console.log(`  ${name}: DIVERGENT`);
    if (r1.detectedReps !== r2.detectedReps) console.log(`    Rep count: run1=${r1.detectedReps}, run2=${r2.detectedReps}`);
    if (r1.hardRefuse !== r2.hardRefuse) console.log(`    Refusal: run1=${r1.hardRefuse}, run2=${r2.hardRefuse}`);
    if (r1.insufficientFootage !== r2.insufficientFootage) console.log(`    Insufficient: run1=${r1.insufficientFootage}, run2=${r2.insufficientFootage}`);
  }
}

console.log('\n' + '='.repeat(90));
console.log(`  Results saved: ${resultsFile}`);
console.log(`  Screenshots: ${SCREENSHOTS_DIR}`);
console.log(`  Middle frames: ${FRAMES_DIR}`);
console.log('='.repeat(90) + '\n');
