#!/usr/bin/env node
// node test/real-phone/synth/run-video.mjs <out.mp4> '<params json>' — renders one synthetic set (synth.js,
// P.video) and encodes it with ffmpeg (FFMPEG) as an H.264 MP4 a phone could have filmed (or VP9 for .webm), for driving the
// app end to end (smoke.mjs). The set's truth is written beside it as <out>.truth.json.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..');
const [out, json] = process.argv.slice(2);
const p = { video: { w: 720, h: 1280, fps: 30 }, ...JSON.parse(json) };
const PORT = 5193, URL = `http://localhost:${PORT}/workout-vision/test/real-phone/synth/synth.html`;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
const glb = readFileSync(process.env.SYNTH_MODEL);
try {
  for (let i = 0; i < 60; i++) { try { await fetch(URL); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  await page.route('**/synth-model.glb', r => r.fulfill({ body: glb, contentType: 'model/gltf-binary' }));
  await page.addInitScript(x => { window.SYNTH = x; }, p);
  await page.goto(URL);
  await page.waitForFunction(() => window.RESULT, null, { timeout: 900000 });
  const n = await page.evaluate(() => window.JPEGS.length);
  const dir = mkdtempSync(join(tmpdir(), 'synthv-'));
  for (let i = 0; i < n; i++) {
    const d = await page.evaluate(k => window.JPEGS[k], i);
    writeFileSync(join(dir, `f${String(i).padStart(5, '0')}.jpg`), Buffer.from(d.split(',')[1], 'base64'));
  }
  const r = await page.evaluate(() => { const { truth, ...rest } = window.RESULT; return rest; });
  writeFileSync(`${out}.truth.json`, JSON.stringify(r));
  await browser.close();
  // H.264 in an MP4 as a phone films it; a .webm out is VP9, which the test Chromium decodes (it has no H.264).
  const codec = out.endsWith('.webm') ? ['-c:v', 'libvpx-vp9', '-b:v', '2M', '-row-mt', '1'] : ['-c:v', 'libx264', '-movflags', '+faststart'];
  const ff = spawnSync(process.env.FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(p.video.fps), '-i', join(dir, 'f%05d.jpg'), ...codec, '-pix_fmt', 'yuv420p', out]);
  if (ff.status !== 0) throw new Error(String(ff.stderr));
  rmSync(dir, { recursive: true, force: true });
  console.log(`${out}: ${n} frames, ${r.reps.length} reps`);
} finally { try { process.kill(-server.pid); } catch {} }
