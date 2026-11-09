#!/usr/bin/env node
/**
 * dump_browser_landmarks.mjs
 * 
 * Runs test/real-phone/harness.html in Chromium and WebKit for the 5 demo clips:
 *   dip-13, ez-curl-10, bodyweight-squat-9, lat-pulldown-6, bicep-curl-5
 * 
 * Saves full per-frame world landmarks and timestamps to:
 *   ~/wv-tools/browser-diff/<clip>-<browser>.json
 */

import { chromium, webkit } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(os.homedir(), 'wv-tools', 'browser-diff');
const HARNESS_URL = 'http://localhost:5173/workout-vision/test/real-phone/harness.html';

const CLIPS = [
  'dip-13',
  'ez-curl-10',
  'bodyweight-squat-9',
  'lat-pulldown-6',
  'bicep-curl-5',
];

async function extractClipLandmarks(page, clipName, videoFilePath) {
  const buffer = fs.readFileSync(videoFilePath);
  const result = await page.evaluate(async ({ bytes, name }) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: 'video/mp4' });
    const blobUrl = URL.createObjectURL(blob);
    let processed;
    try {
      processed = await window._fetchAndProcess(blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
    return {
      clip: name,
      timestamps: processed.timestamps,
      worldLandmarks: processed.worldLandmarks,
    };
  }, { bytes: Array.from(buffer), name: clipName });

  return result;
}

async function runBrowser(browserType, browserName) {
  console.log(`[${browserName}] Launching browser...`);
  const browser = await browserType.launch({ headless: true });
  const page = await browser.newPage();

  page.on('pageerror', err => console.error(`[${browserName} error]`, err));

  console.log(`[${browserName}] Navigating to harness...`);
  await page.goto(HARNESS_URL);
  await page.waitForFunction(() => window._harnessReady === true, { timeout: 30000 });
  console.log(`[${browserName}] Harness ready!`);

  for (const clip of CLIPS) {
    const videoFilePath = path.join(REPO_ROOT, 'public', 'demo', `${clip}.mp4`);
    if (!fs.existsSync(videoFilePath)) {
      throw new Error(`Video file not found: ${videoFilePath}`);
    }

    const outputPath = path.join(OUTPUT_DIR, `${clip}-${browserName}.json`);
    console.log(`[${browserName}] Processing ${clip} (${videoFilePath})...`);
    const t0 = Date.now();

    const result = await extractClipLandmarks(page, clip, videoFilePath);
    result.browser = browserName;

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[${browserName}] Saved ${outputPath} (${result.timestamps.length} frames in ${elapsed}s)`);
  }

  await browser.close();
  console.log(`[${browserName}] Done.`);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const browserArg = args.find(a => a.startsWith('--browser='))?.split('=')[1] || 'all';

  if (browserArg === 'chromium' || browserArg === 'all') {
    await runBrowser(chromium, 'chromium');
  }
  if (browserArg === 'webkit' || browserArg === 'all') {
    await runBrowser(webkit, 'webkit');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
