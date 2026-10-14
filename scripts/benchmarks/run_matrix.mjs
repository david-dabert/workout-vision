#!/usr/bin/env node
/**
 * Run stability matrix across 5 clips × 16 variants in Playwright (Chromium & WebKit).
 * Uses test/real-phone/harness.html served by Vite dev server.
 * Records results in data/benchmarks/stability/results.json.
 */

import { chromium, webkit } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'data/benchmarks/stability/variants_manifest.json');
const RESULTS_PATH = path.join(REPO_ROOT, 'data/benchmarks/stability/results.json');
const HARNESS_URL = 'http://localhost:5173/workout-vision/test/real-phone/harness.html';

// Lift mapping from clip id
const LIFT_MAP = {
  'bicep-curl-5': 'bicep_curl',
  'bodyweight-squat-9': 'squat',
  'lat-pulldown-6': 'lat_pulldown',
  'ez-curl-10': 'bicep_curl',
  'dip-13': 'dip',
};

function loadResults() {
  if (fs.existsSync(RESULTS_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));
    } catch (e) {
      console.warn('Could not parse existing results.json, starting fresh');
    }
  }
  return { runs: [] };
}

function saveResults(data) {
  fs.mkdirSync(path.dirname(RESULTS_PATH), { recursive: true });
  fs.writeFileSync(RESULTS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

async function processVariant(page, videoFilePath, lift) {
  const buffer = fs.readFileSync(videoFilePath);
  const fileName = path.basename(videoFilePath);

  const evalResult = await page.evaluate(async ({ bytes, name, liftName }) => {
    const { summarizeCount } = await import('../../src/lib/coreAnalysis.js');
    const blob = new Blob([new Uint8Array(bytes)], { type: 'video/mp4' });
    const blobUrl = URL.createObjectURL(blob);

    const t0 = performance.now();
    let processed;
    try {
      processed = await window._fetchAndProcess(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
    const procTime = (performance.now() - t0) / 1000;

    const countResult = summarizeCount(processed.worldLandmarks, processed.timestamps, liftName);
    return {
      count: countResult.count,
      refused: countResult.refused,
      samples: processed.timestamps.length,
      duration: processed.metadata.duration,
      extractionMethod: processed.metadata.extractionMethod,
      poseCoverage: processed.metadata.poseCoverage,
      elapsedSeconds: parseFloat(procTime.toFixed(2)),
      detectedCount: processed.worldLandmarks.filter(x => x !== null).length,
    };
  }, { bytes: Array.from(buffer), name: fileName, liftName: lift });

  return evalResult;
}

async function runBrowser(browserType, browserName, manifest, targetRuns = 2, variantsFilter = null) {
  console.log(`[${browserName}] Launching browser...`);
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage();

  page.on('pageerror', err => console.error(`[${browserName} error]`, err));

  console.log(`[${browserName}] Navigating to harness...`);
  await page.goto(HARNESS_URL);
  await page.waitForFunction(() => window._harnessReady === true, { timeout: 30000 });
  console.log(`[${browserName}] Harness ready!`);

  for (let runIdx = 1; runIdx <= targetRuns; runIdx++) {
    for (const [clipId, clipInfo] of Object.entries(manifest.clips)) {
      const lift = LIFT_MAP[clipId];
      const trueCount = clipInfo.true_count;

      for (const [variantName, variantInfo] of Object.entries(clipInfo.variants)) {
        if (variantsFilter && !variantsFilter.includes(variantName)) {
          continue;
        }
        const results = loadResults();
        const existing = results.runs.find(r => 
          r.browser === browserName &&
          r.clip_id === clipId &&
          r.variant === variantName &&
          r.run_index === runIdx
        );

        if (existing) {
          console.log(`[${browserName}][run ${runIdx}] Skipping already completed: ${clipId} / ${variantName}`);
          continue;
        }

        const videoPath = variantInfo.file_path;
        if (!videoPath || !fs.existsSync(videoPath)) {
          console.error(`[${browserName}] Video file not found: ${videoPath}`);
          continue;
        }

        console.log(`[${browserName}][run ${runIdx}] Evaluating ${clipId} / ${variantName} (lift: ${lift}, true: ${trueCount})...`);
        const t0 = Date.now();
        try {
          const evalResult = await processVariant(page, videoPath, lift);
          const totalSec = ((Date.now() - t0) / 1000).toFixed(1);

          const runRecord = {
            clip_id: clipId,
            lift,
            true_count: trueCount,
            variant: variantName,
            browser: browserName,
            run_index: runIdx,
            count: evalResult.count,
            diff_from_true: evalResult.refused ? null : evalResult.count - trueCount,
            refused: evalResult.refused,
            samples: evalResult.samples,
            duration: evalResult.duration,
            extraction_method: evalResult.extractionMethod,
            pose_coverage: evalResult.poseCoverage,
            elapsed_sec: evalResult.elapsedSeconds,
            total_clock_sec: parseFloat(totalSec),
            timestamp: new Date().toISOString()
          };

          results.runs.push(runRecord);
          saveResults(results);

          console.log(`  -> Count: ${evalResult.count} (true: ${trueCount}, diff: ${runRecord.diff_from_true}), Refused: ${evalResult.refused}, Samples: ${evalResult.samples} in ${totalSec}s`);
        } catch (err) {
          console.error(`  -> ERROR evaluating ${clipId} / ${variantName}:`, err.message);
          const errorRecord = {
            clip_id: clipId,
            lift,
            true_count: trueCount,
            variant: variantName,
            browser: browserName,
            run_index: runIdx,
            count: null,
            diff_from_true: null,
            refused: true,
            error: err.message,
            timestamp: new Date().toISOString()
          };
          results.runs.push(errorRecord);
          saveResults(results);
        }
      }
    }
  }

  await browser.close();
  console.log(`[${browserName}] Completed all runs.`);
}

async function main() {
  const args = process.argv.slice(2);
  const browserArg = args.find(a => a.startsWith('--browser='))?.split('=')[1] || 'all';
  const runsArg = parseInt(args.find(a => a.startsWith('--runs='))?.split('=')[1] || '2', 10);

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Manifest not found at ${MANIFEST_PATH}. Run make_variants.py first.`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  const variantsArg = args.find(a => a.startsWith('--variants='))?.split('=')[1]?.split(',') || null;

  if (browserArg === 'chromium' || browserArg === 'all') {
    await runBrowser(chromium, 'chromium', manifest, runsArg, variantsArg);
  }
  if (browserArg === 'webkit' || browserArg === 'all') {
    await runBrowser(webkit, 'webkit', manifest, runsArg, variantsArg);
  }
}

main().catch(err => {
  console.error('Fatal error running matrix:', err);
  process.exit(1);
});
