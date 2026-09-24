#!/usr/bin/env node
/**
 * MEASUREMENT 1, Step A — Extract landmarks from real-phone clips.
 *
 * Uses the app's own frame extraction + MediaPipe pipeline in a Playwright
 * browser (WebKit preferred, Chrome channel fallback). After analysis completes,
 * reads cached landmarks from IndexedDB and saves them as JSON.
 *
 * Per clip records: codec, resolution, duration, frames extracted, extraction time.
 *
 * Does NOT modify any app code. Measurement only.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
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
const LANDMARKS_DIR = join(ROOT, 'test', 'real-phone', 'landmarks');

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

console.log(`\n  MEASUREMENT 1A — Landmark Extraction`);
console.log(`  ${videoClips.length} clips`);
console.log(`  URL: ${baseUrl}\n`);

async function run() {
  let browser;
  let engineUsed = 'webkit';
  try {
    browser = await webkit.launch({
      headless: false,
      args: ['--enable-webgl'],
    });
    console.log('  Engine: WebKit\n');
  } catch (e) {
    console.log(`  WebKit failed: ${e.message}`);
    console.log('  Falling back to Chrome channel...\n');
    browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
      args: ['--enable-webgl', '--ignore-gpu-blocklist'],
    });
    engineUsed = 'chrome';
  }

  mkdirSync(LANDMARKS_DIR, { recursive: true });
  const extractionResults = [];

  for (let i = 0; i < videoClips.length; i++) {
    const clip = videoClips[i];
    const clipPath = join(CLIPS_DIR, clip.file);
    const landmarkFile = join(LANDMARKS_DIR, clip.file.replace(/\.\w+$/, '.landmarks.json'));
    console.log(`  [${i + 1}/${videoClips.length}] ${clip.file}`);

    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    page.setDefaultTimeout(600000); // 10 min default for all waits
    page.on('pageerror', err => console.error(`    [PAGE ERROR] ${err.message}`));

    try {
      // Clear IndexedDB so we get fresh landmark extraction
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.evaluate(async () => {
        localStorage.setItem('wv_seen_landing', '1');
        localStorage.setItem('wv_privacy_accepted', '1');
        localStorage.setItem('wv_lang', 'en');
        // Clear the landmark cache so we force fresh extraction
        try {
          const dbs = await indexedDB.databases();
          for (const db of dbs) {
            if (db.name === 'workoutVisionCache') {
              indexedDB.deleteDatabase(db.name);
            }
          }
        } catch {}
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
      for (const label of ['compris', 'continuer', 'Continue', 'OK', 'Got it', 'Dismiss']) {
        const btn = page.locator('button', { hasText: new RegExp(label, 'i') });
        if (await btn.count() > 0) { await btn.first().click(); await page.waitForTimeout(500); break; }
      }

      // Navigate to upload
      const analyzeBtn = page.locator('button', { hasText: /Analyze Video|Analyser/i });
      if (await analyzeBtn.count() > 0) {
        await analyzeBtn.first().click();
        await page.waitForTimeout(1500);
      }

      // Select the correct exercise
      const displayName = EXERCISE_DISPLAY_NAMES[clip.exercise];
      const trigger = page.locator('button[aria-haspopup="listbox"]');
      await trigger.waitFor({ state: 'visible', timeout: 10000 });
      await trigger.click();
      await page.waitForTimeout(500);

      const allOptions = page.locator('button[role="option"]');
      const optCount = await allOptions.count();
      let selected = false;
      for (let j = 0; j < optCount; j++) {
        const text = await allOptions.nth(j).textContent();
        if (text.trim().startsWith(displayName)) {
          await allOptions.nth(j).click();
          selected = true;
          break;
        }
      }
      if (!selected) throw new Error(`Could not find exercise: ${displayName}`);
      await page.waitForTimeout(500);

      // Upload the clip
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.waitFor({ state: 'attached', timeout: 15000 });
      await fileInput.setInputFiles(clipPath);
      await page.waitForTimeout(1000);

      // Click Analyze
      const analyzeStartBtn = page.locator('button', { hasText: /^Analyze$|^Analyser$/i });
      if (await analyzeStartBtn.count() > 0) {
        await analyzeStartBtn.click();
      }

      console.log(`    Analyzing...`);
      const extractStart = Date.now();

      // Wait for analysis to complete
      // Large clips (60-90MB) can take a long time to hash and start extracting.
      // Wait up to 120s for the Stop button to appear (analysis started).
      await page.waitForSelector('button:has-text("Stop")', { timeout: 120000 }).catch(() => null);
      // Then wait up to 10 minutes for analysis to finish.
      await page.waitForFunction(() => {
        const buttons = [...document.querySelectorAll('button')];
        return !buttons.some(b => b.textContent.trim() === 'Stop');
      }, { timeout: 600000 });

      const extractTime = Date.now() - extractStart;
      await page.waitForTimeout(3000);

      // Read landmarks from IndexedDB
      const landmarkData = await page.evaluate(async () => {
        return new Promise((resolve) => {
          const req = indexedDB.open('workoutVisionCache', 4);
          req.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('landmarks')) {
              resolve(null);
              return;
            }
            const tx = db.transaction('landmarks', 'readonly');
            const store = tx.objectStore('landmarks');
            const allReq = store.getAllKeys();
            allReq.onsuccess = () => {
              const keys = allReq.result;
              if (keys.length === 0) { resolve(null); return; }
              // Get the most recent entry (last key)
              const getReq = store.get(keys[keys.length - 1]);
              getReq.onsuccess = () => {
                const entry = getReq.result;
                if (!entry) { resolve(null); return; }
                // Handle versioned envelope
                let landmarks = null;
                if (entry && entry._v != null && entry.landmarks) {
                  landmarks = entry.landmarks;
                } else if (Array.isArray(entry)) {
                  landmarks = entry;
                }
                resolve({
                  key: keys[keys.length - 1],
                  landmarks,
                  frameCount: landmarks ? landmarks.length : 0,
                });
              };
              getReq.onerror = () => resolve(null);
            };
            allReq.onerror = () => resolve(null);
          };
          req.onerror = () => resolve(null);
        });
      });

      // Also scrape the result card for metadata
      const resultMeta = await page.evaluate(() => {
        const text = document.body.innerText;
        let detectedReps = null;
        const repMatch = text.match(/(\d+)\s*\n?\s*REPS/i);
        if (repMatch) detectedReps = parseInt(repMatch[1]);

        let duration = null;
        const durMatch = text.match(/(\d+:\d+)\s*\n?\s*DURATION/i);
        if (durMatch) {
          const parts = durMatch[1].split(':');
          duration = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }

        // Get detected exercise name
        let detectedExercise = null;
        const h3s = document.querySelectorAll('h3');
        for (const h3 of h3s) {
          const t = h3.textContent.trim();
          if (t.length > 2 && t.length < 60 && !t.includes('Workout')) {
            detectedExercise = t;
            break;
          }
        }

        return { detectedReps, duration, detectedExercise };
      });

      if (landmarkData && landmarkData.landmarks && landmarkData.landmarks.length > 0) {
        writeFileSync(landmarkFile, JSON.stringify({
          file: clip.file,
          exercise: clip.exercise,
          expectedReps: clip.reps,
          view: clip.view,
          framesExtracted: landmarkData.frameCount,
          extractionTimeMs: extractTime,
          detectedReps: resultMeta.detectedReps,
          duration: resultMeta.duration,
          landmarks: landmarkData.landmarks,
        }));

        console.log(`    ${landmarkData.frameCount} frames extracted in ${(extractTime / 1000).toFixed(1)}s`);
        console.log(`    App counted: ${resultMeta.detectedReps ?? '???'} reps`);
        console.log(`    Saved: ${landmarkFile}`);

        extractionResults.push({
          file: clip.file,
          exercise: clip.exercise,
          view: clip.view,
          extractionTimeMs: extractTime,
          framesExtracted: landmarkData.frameCount,
          duration: resultMeta.duration,
          detectedReps: resultMeta.detectedReps,
          landmarksSaved: true,
        });
      } else {
        console.log(`    WARNING: No landmarks in IndexedDB after analysis`);
        console.log(`    App showed: ${resultMeta.detectedReps ?? '???'} reps`);

        extractionResults.push({
          file: clip.file,
          exercise: clip.exercise,
          view: clip.view,
          extractionTimeMs: extractTime,
          framesExtracted: 0,
          detectedReps: resultMeta.detectedReps,
          landmarksSaved: false,
          note: 'No landmarks found in IndexedDB after analysis',
        });
      }
    } catch (err) {
      console.log(`    FAILED: ${err.message}`);
      extractionResults.push({
        file: clip.file,
        exercise: clip.exercise,
        view: clip.view,
        extractionTimeMs: null,
        framesExtracted: 0,
        landmarksSaved: false,
        error: err.message,
      });
    }

    await context.close();
  }

  await browser.close();
  return { engine: engineUsed, results: extractionResults };
}

const { engine, results } = await run();

// Summary
console.log('\n' + '='.repeat(70));
console.log('  MEASUREMENT 1A — Landmark Extraction Summary');
console.log('='.repeat(70));
console.log(`  Engine: ${engine}`);
console.log(`\n  File                                    Frames  Time(s)  Saved`);
console.log('  ' + '-'.repeat(66));
for (const r of results) {
  const f = r.file.slice(0, 38).padEnd(38);
  const frames = String(r.framesExtracted || 0).padStart(6);
  const time = r.extractionTimeMs != null ? (r.extractionTimeMs / 1000).toFixed(1).padStart(7) : '      -';
  const saved = r.landmarksSaved ? 'YES' : 'NO';
  console.log(`  ${f}  ${frames}  ${time}  ${saved}`);
}
console.log('='.repeat(70));

// Save extraction metadata
mkdirSync(RESULTS_DIR, { recursive: true });
const ts = new Date().toISOString().slice(0, 10);
const outFile = join(RESULTS_DIR, `real-phone-${ts}.json`);
let combined = {};
try { combined = JSON.parse(readFileSync(outFile, 'utf-8')); } catch {}
combined.date = new Date().toISOString();
combined.measurement1_extraction = { engine, results };
writeFileSync(outFile, JSON.stringify(combined, null, 2));
console.log(`\n  Saved: ${outFile}\n`);
