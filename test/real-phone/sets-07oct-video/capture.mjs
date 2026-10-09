#!/usr/bin/env node
// David's real videos of 7 October through the app's own path, stored as test sets (README.md of this folder).
// For each set of manifest.json: the built app (dist/, served by vite preview) reads the video through
// analyzeCoreVideo on its check page (check.html, the same function the app's upload screen calls), in Chromium;
// the page's wv:core-result event gives the timestamps, landmarks and metadata exactly as the app holds them. Two
// observers are added by an init script and change nothing the app computes:
//  - every full read of a sample's canvas (the extractor's one getImageData per sample, frameExtractor.js) is also
//    drawn to a 128 px gray copy, as test/real-phone/motion/capture.mjs takes it; the last pass's copies are kept
//    (a decoder that restarts begins again at sample 0, and the app keeps only its last pass);
//  - the pose worker's answers are recorded, so a read the app refuses as partial (PartialReadError: no wv:core-result)
//    still leaves its landmarks, on nominal sample times (index / 15 s), marked `read.partial`.
// The gray copies are reduced to what the motion count reads (src/lib/counting/motionRhythm.js): the pose region of
// the set (roiFromBoxes over the image landmarks' boxes) shrunk to 24 x 24 gray bytes per sample, as the occlusion
// sets store them (test/real-phone/synth/synth.js). No video is written into the repository.
//
//   npm run build
//   PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node test/real-phone/sets-07oct-video/capture.mjs <folder of the VP9 re-encodes> [name ...]
//
// The folder holds <name>.mp4 for each set: David's original re-encoded to VP9 with its own frame timestamps
// (ffmpeg -an -c:v libvpx-vp9 -crf 18 -b:v 0 -fps_mode passthrough -enc_time_base 1:600 -video_track_timescale 600),
// since this Chromium has no H.264 decoder. SETS_OUT=<dir> writes elsewhere than this folder. Unset, the page reads as
// the app does (MediaPipe in IMAGE mode); SETS_POSEMODE=video reads in VIDEO mode (the check page's ?posemode=video;
// shipped on the morning of 9 October 2026, withdrawn that evening). The mode is written into each file
// (extraction.poseMode).
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { roiFromBoxes, shrinkRegion, GRID } from '../../../src/lib/counting/motionRhythm.js';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..');
const [videoDir, ...only] = process.argv.slice(2);
if (!videoDir) throw new Error('usage: node test/real-phone/sets-07oct-video/capture.mjs <folder of re-encodes> [name ...]');
const OUT = process.env.SETS_OUT || HERE;
const manifest = JSON.parse(readFileSync(resolve(HERE, 'manifest.json'), 'utf8'));
const version = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version;
const PORT = Number(process.env.SETS_PORT || 4179), BASE = `http://localhost:${PORT}/workout-vision/`;
const GRAY_SIDE = 128;
const POSE_MODE = process.env.SETS_POSEMODE === 'video' ? 'video' : 'image';

// The pose box of a sample in [0, 1] image coordinates (landmarks with visibility >= 0.5), as capture.mjs and synth.js.
const box = lm => {
  if (!lm) return null;
  const v = lm.filter(p => (p.visibility ?? 1) >= 0.5);
  if (v.length < 4) return null;
  const xs = v.map(p => p.x), ys = v.map(p => p.y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(z => Math.round(z * 1000) / 1000);
};

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', 'localhost'], { cwd: ROOT, stdio: 'ignore', detached: true });
try {
  for (let i = 0; i < 60; i++) { try { await fetch(BASE); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : { channel: 'chrome' });
  for (const set of manifest.sets) {
    if (only.length && !only.includes(set.name)) continue;
    const file = resolve(videoDir, `${set.name}.mp4`);
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(side => {
      const gray = [];
      let small = null, sctx = null, busy = false;
      const tap = function (canvas) {
        if (busy) return;
        busy = true;
        try {
          const k = side / Math.max(canvas.width, canvas.height);
          const w = Math.max(8, Math.round(canvas.width * k)), h = Math.max(8, Math.round(canvas.height * k));
          if (!small || small.width !== w || small.height !== h) { small = new OffscreenCanvas(w, h); sctx = small.getContext('2d', { willReadFrequently: true }); }
          sctx.imageSmoothingEnabled = true; sctx.imageSmoothingQuality = 'high';
          sctx.drawImage(canvas, 0, 0, w, h);
          const px = sctx.getImageData(0, 0, w, h).data, g = new Uint8Array(w * h);
          for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = (77 * px[i] + 150 * px[i + 1] + 29 * px[i + 2]) >> 8;
          let s = ''; for (let i = 0; i < g.length; i++) s += String.fromCharCode(g[i]);
          gray.push({ w, h, b: btoa(s) });
        } finally { busy = false; }
      };
      for (const P of [CanvasRenderingContext2D, OffscreenCanvasRenderingContext2D]) {
        const orig = P.prototype.getImageData;
        P.prototype.getImageData = function (sx, sy, sw, sh, ...rest) {
          const c = this.canvas;
          // A whole sample read (the extractor's), never this tap's own small canvas.
          if (!busy && sx === 0 && sy === 0 && sw === c.width && sh === c.height && Math.max(sw, sh) > side) tap(c);
          return orig.call(this, sx, sy, sw, sh, ...rest);
        };
      }
      const answers = [];
      const W = window.Worker;
      window.Worker = class extends W {
        constructor(...a) {
          super(...a);
          this.addEventListener('message', e => { const d = e.data; if (d && 'world' in d) answers.push({ image: d.image, world: d.world }); });
        }
      };
      window.__wv = { gray, answers, result: null };
      window.addEventListener('wv:core-result', e => { window.__wv.result = e.detail; });
    }, GRAY_SIDE);
    await page.goto(`${BASE}check.html${POSE_MODE === 'video' ? '?posemode=video' : ''}`, { timeout: 120000 });
    const t0 = Date.now();
    await page.locator('.clip input[type="file"]').first().setInputFiles(file);
    // Done: a result, or the row marked bad (an error the page shows).
    await page.waitForFunction(() => window.__wv.result || document.querySelector('.clip.bad, .clip.ok'), null, { timeout: 1800000 });
    const seconds = (Date.now() - t0) / 1000;
    const r = await page.evaluate(() => {
      const x = window.__wv.result;
      const row = document.querySelector('.clip .out')?.textContent || '';
      return { result: x ? { timestamps: x.timestamps, worldLandmarks: x.worldLandmarks, imageLandmarks: x.imageLandmarks, metadata: x.metadata } : null, gray: window.__wv.gray, answers: window.__wv.answers, row };
    });
    await context.close();
    let timestamps, worldLandmarks, imageLandmarks, metadata, read;
    if (r.result) {
      ({ timestamps, worldLandmarks, imageLandmarks, metadata } = r.result);
      read = { partial: false };
    } else {
      // The app refused the read (PartialReadError and the like): its answers on nominal sample times.
      worldLandmarks = r.answers.map(a => a.world); imageLandmarks = r.answers.map(a => a.image);
      timestamps = r.answers.map((_, i) => Math.round((i / 15) * 1e6) / 1e6);
      metadata = null;
      read = { partial: true, appMessage: r.row.split('\n')[0], timestampsNominal: true };
    }
    const n = timestamps.length;
    if (r.gray.length < n) throw new Error(`${set.name}: ${r.gray.length} gray copies for ${n} samples`);
    const gray = r.gray.slice(r.gray.length - n);
    const boxes = imageLandmarks.map(box);
    const roi = roiFromBoxes(boxes);
    const frames = gray.map(g => {
      const px = Buffer.from(g.b, 'base64');
      const q = shrinkRegion(px, g.w, g.h, roi, GRID);
      return Buffer.from(Array.from(q, v => Math.max(0, Math.min(255, Math.round(v))))).toString('base64');
    });
    const first = gray[0];
    const original = resolve(process.env.SETS_ORIGINALS || videoDir, `${set.name}.mp4`);
    const out = {
      lift: set.lift, count: set.label, labelSource: set.labelSource ?? 'David (R1), labels.txt of 7 October 2026', view: set.view, what: set.what,
      original: set.original, videoSha256: createHash('sha256').update(readFileSync(original)).digest('hex'),
      // World landmarks as the app holds them (the counter reads these); image landmarks rounded to 1e-4 of the frame
      // (0.06 px at 640 px) to keep the folder small: they serve the pose boxes, whose region is computed before rounding.
      read, worldLandmarks, imageLandmarks: imageLandmarks.map(lm => lm && lm.map(p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v])))), timestamps,
      frame: metadata ? { width: metadata.width, height: metadata.height } : null,
      extraction: { fps: 15, maxLongSide: 640, poseMode: POSE_MODE, path: 'analyzeCoreVideo, built app (check.html), Chromium, VP9 re-encode keeping the frame timestamps' },
      metadata, version, analysisSeconds: Math.round(seconds),
      motion: { grid: GRID, roi, boxes, gray: { w: first.w, h: first.h, from: 'the sample canvas the pose model reads, drawn to 128 px gray (77 R + 150 G + 29 B) >> 8' }, frames },
    };
    const path = resolve(OUT, `${set.name}.json.gz`);
    writeFileSync(path, gzipSync(JSON.stringify(out), { level: 9 }));
    const seen = worldLandmarks.filter(Boolean).length;
    console.log(`${set.name}  ${set.lift}  label ${set.label}: ${n} samples, pose ${seen} (${Math.round((100 * seen) / n)} %), ${read.partial ? `READ REFUSED BY THE APP (${read.appMessage})` : metadata.method}, ${Math.round(seconds)} s${errors.length ? `, page errors: ${errors.join(' | ')}` : ''}`);
  }
  await browser.close();
} finally { try { process.kill(-server.pid); } catch { /* already gone */ } }
