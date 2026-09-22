#!/usr/bin/env node
/**
 * Automated landmark extraction via headless browser.
 *
 * Downloads YouTube videos, opens them in a headless Chromium with MediaPipe
 * Tasks Vision WASM, extracts 33-point pose landmarks at 10fps, and saves
 * to the benchmark staging directory.
 *
 * Uses Playwright to automate the existing dump-landmarks.html page.
 *
 * Usage:
 *   node benchmark/extract-landmarks.mjs <youtube_url> <exercise> <reps> [--start S] [--end E]
 *   node benchmark/extract-landmarks.mjs --batch manifest.json
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STAGING_DIR = join(__dirname, 'staging');
const CACHE_DIR = join(__dirname, 'landmark-cache');

function extractVideoId(url) {
  const patterns = [
    /(?:v=|\/)([\w-]{11})(?:[&?/]|$)/,
    /(?:youtu\.be\/)([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function downloadVideo(url, outputPath, start, end) {
  const cmd = [
    'yt-dlp',
    '-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best',
    '--merge-output-format', 'mp4',
    '-o', outputPath,
    '--no-playlist',
  ];

  if (start != null || end != null) {
    let section = '*';
    if (start != null) section += start;
    section += '-';
    if (end != null) section += end;
    cmd.push('--download-sections', section, '--force-keyframes-at-cuts');
  }

  cmd.push(url);
  console.log(`  Downloading: ${url}`);
  try {
    execFileSync(cmd[0], cmd.slice(1), { stdio: 'pipe', timeout: 120000 });
    return true;
  } catch (e) {
    console.error(`  Download failed: ${e.message}`);
    return false;
  }
}

async function extractLandmarks(videoPath, exercise, reps, targetFps = 10) {
  console.log(`  Extracting landmarks from: ${videoPath}`);

  // Use Playwright to run MediaPipe in headless browser
  const { chromium } = await import('playwright');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Build an inline HTML page that loads MediaPipe and processes the video
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body>
<video id="vid" muted playsinline></video>
<canvas id="cvs"></canvas>
<script type="module">
const TARGET_FPS = ${targetFps};

async function run() {
  const vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/+esm');
  const { PoseLandmarker, FilesetResolver } = vision;

  const wasmFileset = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
  );

  const landmarker = await PoseLandmarker.createFromOptions(wasmFileset, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task',
      delegate: 'CPU',
    },
    runningMode: 'IMAGE',
    numPoses: 1,
  });

  window._status = 'model_ready';

  // Wait for video to be loaded
  while (!window._videoBlob) {
    await new Promise(r => setTimeout(r, 100));
  }

  const vid = document.getElementById('vid');
  vid.src = URL.createObjectURL(window._videoBlob);
  await new Promise((resolve, reject) => {
    vid.onloadedmetadata = resolve;
    vid.onerror = reject;
  });

  const duration = vid.duration;
  const totalFrames = Math.floor(duration * TARGET_FPS);
  const cvs = document.getElementById('cvs');
  const ctx = cvs.getContext('2d');
  cvs.width = vid.videoWidth;
  cvs.height = vid.videoHeight;

  window._status = 'extracting';
  window._progress = 0;
  window._totalFrames = totalFrames;

  const landmarks = [];

  for (let i = 0; i < totalFrames; i++) {
    const time = i / TARGET_FPS;
    vid.currentTime = time;
    await new Promise(r => {
      vid.onseeked = r;
      // Timeout fallback for last frame
      setTimeout(r, 500);
    });

    ctx.drawImage(vid, 0, 0);
    const imageData = ctx.getImageData(0, 0, cvs.width, cvs.height);

    try {
      const mpImage = new vision.MPImage(cvs, /* fromCanvas */);
    } catch(e) {}

    // Use canvas directly for detection
    const result = landmarker.detect(cvs);

    if (result.landmarks && result.landmarks.length > 0) {
      const frameLms = result.landmarks[0].map(lm => ({
        x: lm.x,
        y: lm.y,
        z: lm.z,
        visibility: lm.visibility,
      }));
      landmarks.push(frameLms);
    } else {
      landmarks.push(null);
    }

    window._progress = i + 1;
  }

  landmarker.close();
  window._landmarks = landmarks;
  window._status = 'done';
}

run().catch(e => { window._status = 'error'; window._error = e.message; });
</script>
</body></html>`;

  // Navigate to a data URL with the HTML
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  // Wait for model to load
  console.log('  Loading MediaPipe model...');
  await page.waitForFunction(() => window._status === 'model_ready' || window._status === 'error', { timeout: 60000 });

  const status = await page.evaluate(() => window._status);
  if (status === 'error') {
    const err = await page.evaluate(() => window._error);
    console.error(`  MediaPipe error: ${err}`);
    await browser.close();
    return null;
  }

  // Load the video file into the page
  const videoBuffer = readFileSync(videoPath);
  await page.evaluate(async (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    window._videoBlob = new Blob([bytes], { type: 'video/mp4' });
  }, videoBuffer.toString('base64'));

  // Wait for extraction to complete
  console.log('  Extracting poses...');
  let lastProgress = 0;
  while (true) {
    const [s, p, t] = await page.evaluate(() => [window._status, window._progress || 0, window._totalFrames || 0]);
    if (s === 'done') break;
    if (s === 'error') {
      const err = await page.evaluate(() => window._error);
      console.error(`  Extraction error: ${err}`);
      await browser.close();
      return null;
    }
    if (p > lastProgress) {
      process.stdout.write(`\r  Frame ${p}/${t}`);
      lastProgress = p;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.log('');

  const landmarks = await page.evaluate(() => window._landmarks);
  const valid = landmarks.filter(l => l !== null).length;
  console.log(`  Extracted ${landmarks.length} frames (${valid} with pose)`);

  await browser.close();
  return landmarks;
}

async function main() {
  const args = process.argv.slice(2);

  // Parse --batch mode
  if (args[0] === '--batch') {
    const manifest = JSON.parse(readFileSync(args[1], 'utf-8'));
    for (const entry of manifest) {
      console.log(`\n=== ${entry.exercise} (${entry.reps} reps) ===`);
      await processVideo(entry.url, entry.exercise, entry.reps, entry.start, entry.end);
    }
    return;
  }

  if (args.length < 3) {
    console.log('Usage: node benchmark/extract-landmarks.mjs <youtube_url> <exercise> <reps> [--start S] [--end E]');
    console.log('       node benchmark/extract-landmarks.mjs --batch <manifest.json>');
    process.exit(1);
  }

  const url = args[0];
  const exercise = args[1];
  const reps = parseInt(args[2]);
  let start = null, end = null;

  for (let i = 3; i < args.length; i++) {
    if (args[i] === '--start') start = parseFloat(args[++i]);
    if (args[i] === '--end') end = parseFloat(args[++i]);
  }

  await processVideo(url, exercise, reps, start, end);
}

async function processVideo(url, exercise, reps, start, end) {
  mkdirSync(STAGING_DIR, { recursive: true });

  const videoId = extractVideoId(url);
  if (!videoId) {
    console.error(`Cannot extract video ID from ${url}`);
    return;
  }

  const filename = `${exercise}_${videoId}_${reps}reps`;
  const videoPath = join(STAGING_DIR, `${filename}.mp4`);
  const cachePath = join(STAGING_DIR, `${filename}.json`);

  if (existsSync(cachePath)) {
    console.log(`  Already staged: ${filename}.json`);
    return;
  }

  // Download if needed
  if (!existsSync(videoPath)) {
    if (!downloadVideo(url, videoPath, start, end)) return;
  }

  // Extract landmarks
  const landmarks = await extractLandmarks(videoPath, exercise, reps);
  if (!landmarks) return;

  // Save
  const entry = {
    video: `${filename}.mp4`,
    exercise,
    expected: reps,
    fps: 10,
    landmarks,
  };

  writeFileSync(cachePath, JSON.stringify(entry));
  console.log(`  Saved: ${filename}.json`);
}

main().catch(console.error);
