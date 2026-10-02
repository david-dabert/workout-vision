#!/usr/bin/env node
// node test/real-phone/synth/run.mjs [matrix.json] — renders each synthetic set in Chromium (synth.js) and
// writes its landmarks with its truth to OUT (default: the scratch folder given by SYNTH_OUT). Vite on 5191.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../..');
const OUT = process.env.SYNTH_OUT, MODEL = process.env.SYNTH_MODEL;
if (!OUT || !MODEL) throw new Error('SYNTH_OUT and SYNTH_MODEL are required');
mkdirSync(OUT, { recursive: true });
const sets = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const PORT = 5191, URL = `http://localhost:${PORT}/workout-vision/test/real-phone/synth/synth.html`;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
const glb = readFileSync(MODEL);
try {
  for (let i = 0; i < 60; i++) { try { await fetch(URL); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const p of sets) {
    const file = resolve(OUT, `${p.id}.json.gz`);
    if (existsSync(file)) continue;
    const page = await browser.newPage();
    page.on('pageerror', e => console.log('pageerror', p.id, e.message));
    await page.route('**/synth-model.glb', r => r.fulfill({ body: glb, contentType: 'model/gltf-binary' }));
    await page.addInitScript(x => { window.SYNTH = x; }, p);
    const t0 = Date.now();
    await page.goto(URL);
    await page.waitForFunction(() => window.RESULT, null, { timeout: 900000 });
    const r = await page.evaluate(() => window.RESULT);
    if (p.shot) { const s = await page.evaluate(() => window.SHOT); writeFileSync(resolve(OUT, `${p.id}.jpg`), Buffer.from(s.split(',')[1], 'base64')); }
    writeFileSync(file, gzipSync(JSON.stringify(r)));
    const seen = r.worldLandmarks.filter(Boolean).length;
    console.log(`${p.id}: ${r.timestamps.length} frames, pose found in ${seen}, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    await page.close();
  }
  await browser.close();
} finally { try { process.kill(-server.pid); } catch {} }
