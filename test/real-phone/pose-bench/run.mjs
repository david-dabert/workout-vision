#!/usr/bin/env node
// Pose-model bench on real videos (David's order of 4 October: make the pose model excellent).
// Each video goes through the app's own extraction and pose code (test/real-phone/harness.html, the same modules as the
// app), once per pose model, and its landmarks are written to OUT/<model>/<video>.json.gz. score.test.ts then counts
// them with the app's counter against the dataset's human labels.
//
//   BENCH_VIDEOS=<dir of .webm>  BENCH_OUT=<dir>  BENCH_MODELS="full,heavy=/path/heavy.task"  node test/real-phone/pose-bench/run.mjs
//
// "full" is the model the app ships (public/mediapipe); name=path hands another model's bytes to the app's loader
// through the bench hook (poseAnalysis.js, __WV_BENCH_POSE_MODEL__). Nothing here is committed with the data: datasets
// whose licence David has not cleared stay outside the repository (R1).
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const VIDEOS = process.env.BENCH_VIDEOS, OUT = process.env.BENCH_OUT;
if (!VIDEOS || !OUT) throw new Error('BENCH_VIDEOS and BENCH_OUT are required');
const MODELS = (process.env.BENCH_MODELS || 'full').split(',').map(m => {
  const [name, path] = m.split('=');
  return { name, bytes: path ? readFileSync(path) : null };
});
const ONLY = process.env.BENCH_ONLY ? new RegExp(process.env.BENCH_ONLY) : null;
const files = readdirSync(VIDEOS).filter(f => f.endsWith('.webm') && (!ONLY || ONLY.test(f))).sort();
const PORT = Number(process.env.BENCH_PORT || 5193);
// BENCH_BASE: a dev server already running (npx vite --port <p>); otherwise one is started here.
const BASE = process.env.BENCH_BASE || `http://localhost:${PORT}/workout-vision/`;
const server = process.env.BENCH_BASE ? null : spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });

try {
  for (let i = 0; i < 90; i++) { try { await fetch(BASE); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  for (const model of MODELS) {
    mkdirSync(resolve(OUT, model.name), { recursive: true });
    for (const f of files) {
      const out = resolve(OUT, model.name, f.replace(/\.webm$/, '.json.gz'));
      if (existsSync(out)) continue;
      const page = await browser.newPage();
      page.on('pageerror', e => console.log('pageerror', model.name, f, e.message));
      if (process.env.BENCH_DEBUG) page.on('console', m => console.log('console', m.text().slice(0, 160)));
      await page.route('**/bench-video/**', r => r.fulfill({ body: readFileSync(resolve(VIDEOS, f)), contentType: 'video/webm' }));
      if (model.bytes) await page.route('**/bench-pose.task', r => r.fulfill({ body: model.bytes, contentType: 'application/octet-stream' }));
      const t0 = Date.now();
      await page.goto(`${BASE}test/real-phone/harness.html`, { timeout: 300000 });
      await page.waitForFunction(() => window._harnessReady === true, null, { timeout: 300000 });
      const r = await page.evaluate(async ({ bench, url }) => {
        if (bench) globalThis.__WV_BENCH_POSE_MODEL__ = await (await fetch('bench-pose.task')).arrayBuffer();
        const x = await window._fetchAndProcess(url);
        return { metadata: x.metadata, timestamps: x.timestamps, worldLandmarks: x.worldLandmarks, imageLandmarks: x.imageLandmarks };
      }, { bench: !!model.bytes, url: `${BASE}bench-video/${f}` });
      writeFileSync(out, gzipSync(JSON.stringify({ model: model.name, video: f, ...r })));
      const seen = r.worldLandmarks.filter(Boolean).length;
      console.log(`${model.name} ${f}: ${r.timestamps.length} samples, pose in ${seen}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      await page.close();
    }
  }
  await browser.close();
} finally { if (server) { try { process.kill(-server.pid); } catch { /* already gone */ } } }
