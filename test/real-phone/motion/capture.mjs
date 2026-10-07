#!/usr/bin/env node
// Motion rhythm bench, step 1 of 2 (7 October; TRIED.md). Runs one video through the app's own extraction and pose code
// (test/real-phone/harness.html, the app's defaults: crop retry on, backward pass off) and keeps, for every sample:
// the decoded frame shrunk to grayscale (long side MOTION_SIDE px, default 128), its timestamp, and the box of the pose
// found on it (image landmarks, or null). Also the skeleton's count (summarizeCount) and the pose coverage.
// Writes one JSON file outside the repository; analyse.mjs reads it. Changes nothing in the app.
//
//   node test/real-phone/motion/capture.mjs <video file> <lift> <label> <out.json>
//
// MOTION_PATH=rvfc reads by playback instead of WebCodecs. Desktop Chrome by default; PW_CHROMIUM=<path> runs another Chromium (this environment's has no H.264: feed .webm).
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const [video, lift, label, out] = process.argv.slice(2);
if (!video || !lift || !label || !out) throw new Error('usage: node test/real-phone/motion/capture.mjs <video> <lift> <label> <out.json>');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const PORT = Number(process.env.MOTION_PORT || 5195), BASE = `http://localhost:${PORT}/workout-vision/`;
const SIDE = Number(process.env.MOTION_SIDE || 128);
const TYPES = { '.mov': 'video/quicktime', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm' };
const bytes = readFileSync(video), type = TYPES[extname(video).toLowerCase()] || 'application/octet-stream';
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
try {
  for (let i = 0; i < 90; i++) { try { await fetch(BASE); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : { channel: 'chrome' });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('pageerror', e.message));
  await page.route('**/motion-video/**', r => r.fulfill({ body: bytes, contentType: type }));
  await page.goto(`${BASE}test/real-phone/harness.html`, { timeout: 300000 });
  await page.waitForFunction(() => window._harnessReady === true, null, { timeout: 300000 });
  const r = await page.evaluate(async ({ url, lift, core, side, path }) => {
    if (path) globalThis.__WV_HARNESS_PATH__ = path;
    const frames = [];
    let small = null, w = 0, h = 0;
    globalThis.__WV_HARNESS_FRAME_TAP__ = (canvas, frameIndex) => {
      if (frameIndex === 0) frames.length = 0; // a restarted decode keeps only its last pass, as the harness does
      if (!small) {
        const k = side / Math.max(canvas.width, canvas.height);
        w = Math.max(8, Math.round(canvas.width * k)); h = Math.max(8, Math.round(canvas.height * k));
        small = new OffscreenCanvas(w, h);
      }
      const g = small.getContext('2d', { willReadFrequently: true });
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(canvas, 0, 0, w, h);
      const px = g.getImageData(0, 0, w, h).data, gray = new Uint8Array(w * h);
      for (let i = 0, j = 0; j < gray.length; i += 4, j++) gray[j] = (77 * px[i] + 150 * px[i + 1] + 29 * px[i + 2]) >> 8;
      let s = ''; for (let i = 0; i < gray.length; i++) s += String.fromCharCode(gray[i]);
      frames.push(btoa(s));
    };
    const x = await window._fetchAndProcess(url);
    const { summarizeCount } = await import(core);
    const c = summarizeCount(x.worldLandmarks, x.timestamps, lift);
    // Pose box per sample, in [0, 1] image coordinates: the landmarks the model sees (visibility >= 0.5), else null.
    const boxes = x.imageLandmarks.map(lm => {
      if (!lm) return null;
      const v = lm.filter(p => (p.visibility ?? 1) >= 0.5);
      if (v.length < 4) return null;
      const xs = v.map(p => p.x), ys = v.map(p => p.y);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(z => Math.round(z * 1000) / 1000);
    });
    return { w, h, frames, timestamps: x.timestamps, boxes, skeleton: c.refused ? null : c.count, refused: !!c.refused, seen: x.worldLandmarks.filter(Boolean).length, n: x.timestamps.length, method: x.metadata.extractionMethod, size: [x.metadata.extractedWidth, x.metadata.extractedHeight] };
  }, { url: `${BASE}motion-video/${encodeURIComponent(basename(video))}`, lift, core: `${BASE}src/lib/coreAnalysis.js`, side: SIDE, path: process.env.MOTION_PATH || '' });
  if (r.frames.length !== r.n) throw new Error(`frames ${r.frames.length} != samples ${r.n}`);
  writeFileSync(out, JSON.stringify({ video: basename(video), lift, label: Number(label), ...r }));
  console.log(`${basename(video)}  ${lift}  label ${label}: skeleton ${r.refused ? 'refused' : r.skeleton}, pose ${r.seen}/${r.n}, ${r.w}x${r.h} gray from ${r.size.join('x')} (${r.method})`);
  await browser.close();
} finally { try { process.kill(-server.pid); } catch { /* already gone */ } }
