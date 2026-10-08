#!/usr/bin/env node
// node test/real-phone/synth/run.mjs [matrix.json] — renders each synthetic set in Chromium (synth.js) and
// writes its landmarks with its truth to OUT (default: the scratch folder given by SYNTH_OUT). Vite on 5191.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..');
const OUT = process.env.SYNTH_OUT, MODEL = process.env.SYNTH_MODEL;
// BENCH_POSE: another pose model file to measure in place of the shipped one (poseAnalysis.js bench hook).
const BENCH = process.env.BENCH_POSE ? readFileSync(process.env.BENCH_POSE) : null;
// LOST_POSE: a second pose model run only on the frames still without a pose (synth.js, P.lostPose).
const LOST = process.env.LOST_POSE ? readFileSync(process.env.LOST_POSE) : null;
// SYNTH_LOCK=1: the pose path with the lifter lock on (synth.js, P.lock; src/lib/lifterLock.js).
const LOCK = !!process.env.SYNTH_LOCK;
// SYNTH_GATE=1: the pose path with the continuity gate on (synth.js, P.gate; src/lib/jumpGate.js).
const GATE = !!process.env.SYNTH_GATE;
// SYNTH_MODELS=name=<glb>,name=<glb>: a body per set, by its matrix entry's `model` (the motion library, library.mjs).
const MODELS = Object.fromEntries((process.env.SYNTH_MODELS ?? '').split(',').filter(Boolean).map(x => { const [k, f] = x.split('='); return [k, readFileSync(f)]; }));
if (!OUT || (!MODEL && !Object.keys(MODELS).length)) throw new Error('SYNTH_OUT and SYNTH_MODEL (or SYNTH_MODELS) are required');
mkdirSync(OUT, { recursive: true });
const sets = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const PORT = Number(process.env.SYNTH_PORT || 5191), URL = `http://localhost:${PORT}/workout-vision/test/real-phone/synth/synth.html`;
// SYNTH_SERVER=external: a Vite server already listens on SYNTH_PORT (several run.mjs at once share one, so they do
// not race on Vite's dependency cache; motion-library.yml); otherwise this run starts its own and stops it at the end.
const server = process.env.SYNTH_SERVER === 'external' ? null : spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
const glb = MODEL ? readFileSync(MODEL) : null;
try {
  for (let i = 0; i < 60; i++) { try { await fetch(URL); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const p of sets) {
    const file = resolve(OUT, `${p.id}.json.gz`);
    if (existsSync(file)) continue;
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('pageerror', p.id, e.message));
    await page.route('**/synth-model.glb', r => r.fulfill({ body: MODELS[p.model] ?? glb, contentType: 'model/gltf-binary' }));
    if (BENCH) await page.route('**/bench-pose.task', r => r.fulfill({ body: BENCH, contentType: 'application/octet-stream' }));
    if (LOST) await page.route('**/lost-pose.task', r => r.fulfill({ body: LOST, contentType: 'application/octet-stream' }));
    await page.addInitScript(x => { window.SYNTH = x; }, { ...p, ...(BENCH ? { benchPose: true } : {}), ...(LOST ? { lostPose: true } : {}), ...(LOCK ? { lock: true } : {}), ...(GATE ? { gate: true } : {}) });
    const t0 = Date.now();
    await page.goto(URL, { timeout: 300000 }); // the dev server's first load pre-bundles three.js
    await page.waitForFunction(() => window.RESULT, null, { timeout: 900000 });
    const r = await page.evaluate(() => window.RESULT);
    if (p.shot) { const s = await page.evaluate(() => window.SHOT); writeFileSync(resolve(OUT, `${p.id}.jpg`), Buffer.from(s.split(',')[1], 'base64')); }
    writeFileSync(file, gzipSync(JSON.stringify(r)));
    const seen = r.worldLandmarks.filter(Boolean).length;
    console.log(`${p.id}: ${r.timestamps.length} frames, pose found in ${seen}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    await page.close();
  }
  await browser.close();
} finally { if (server) try { process.kill(-server.pid); } catch {} }
