#!/usr/bin/env node
// SYNTH_MODEL=<glb> node test/real-phone/synth/motions/preview.mjs <out folder> [key or spec file ...]
// The motion library's check (README.md): each spec (motions/<key>.json, all without keys; an argument ending in .json is
// a spec file read from its path, keyed by its name) rendered at rest, halfway and at its working end, from its view and
// from the other one (front 0, side 90), each still read by the app's pose model. An alternating spec moves as on its
// first rep (alternate true: its left side only; "mirror": unswapped); PREVIEW_SIDE=right shows its second rep instead
// (the right side alone; the mirrored pose). Writes <out>/<key>.jpg (a contact sheet, 2 views x 3 stills, with the
// catalogue joint's truth and measured angles) and <out>/checks.json (per view and still, also every joint's angle on
// the skeleton and the trunk's to the vertical: fk-parity.mjs reads them); prints one line per exercise (the checks
// below). An exercise the catalogue counts with no joint is checked for the pose only.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const OUT = resolve(process.argv[2]), MODEL = process.env.SYNTH_MODEL;
if (!process.argv[2] || !MODEL) throw new Error('usage: SYNTH_MODEL=<glb> node preview.mjs <out folder> [key ...]');
mkdirSync(OUT, { recursive: true });
const FAMILIES = JSON.parse(readFileSync(resolve(ROOT, 'src/lib/counting/guide-families.json'), 'utf8'));
const args = process.argv.length > 3 ? process.argv.slice(3) : readdirSync(HERE).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort();
const fileOf = a => (a.endsWith('.json') ? resolve(a) : resolve(HERE, `${a}.json`)), keys = args.map(a => basename(a, '.json'));
// MediaPipe's world landmark indices of the counter's three-point angles (core.ts JOINT_POINTS).
const JP = { elbow: { left: [11, 13, 15], right: [12, 14, 16] }, shoulder: { left: [23, 11, 13], right: [24, 12, 14] },
  knee: { left: [23, 25, 27], right: [24, 26, 28] }, hip: { left: [11, 23, 25], right: [12, 24, 26] } };
const angle = (w, [a, b, c]) => {
  const x = [w[a].x - w[b].x, w[a].y - w[b].y, w[a].z - w[b].z], y = [w[c].x - w[b].x, w[c].y - w[b].y, w[c].z - w[b].z];
  const d = x[0] * y[0] + x[1] * y[1] + x[2] * y[2], n = Math.hypot(...x) * Math.hypot(...y);
  return (Math.acos(Math.max(-1, Math.min(1, d / n))) * 180) / Math.PI;
};
const BUSY = process.env.PREVIEW_SIDE === 'right' ? 'right' : 'left';
const PORT = Number(process.env.SYNTH_PORT || 5192), URL = `http://localhost:${PORT}/workout-vision/test/real-phone/synth/synth.html`;
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: true });
const glb = readFileSync(MODEL);
const checks = {};
try {
  for (let i = 0; i < 60; i++) { try { await fetch(URL); break; } catch { await new Promise(r => setTimeout(r, 1000)); } }
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [n, key] of keys.entries()) {
    const file = fileOf(args[n]), spec = JSON.parse(readFileSync(file, 'utf8'));
    const fam = FAMILIES[key] || {}, joint = fam.joint || null;
    const own = spec.view ?? (fam.view === 'front' ? 0 : 90), views = [own, own === 0 ? 90 : 0];
    const sides = spec.side ? [spec.side] : ['left', 'right'];
    const shots = [], res = { key, file, joint, rest: fam.rest ?? null, busy: spec.alternate ? BUSY : null, views: {} };
    for (const view of views) {
      const page = await browser.newPage();
      page.on('pageerror', e => console.log('pageerror', key, e.message));
      await page.route('**/synth-model.glb', r => r.fulfill({ body: glb, contentType: 'model/gltf-binary' }));
      await page.addInitScript(x => { window.SYNTH = x; }, { spec, view, preview: [0, 0.5, 1], reps: 1, seed: 1, previewBusy: spec.alternate ? BUSY : null });
      await page.goto(URL, { timeout: 300000 });
      await page.waitForFunction(() => window.PREVIEW, null, { timeout: 300000 });
      const stills = await page.evaluate(() => window.PREVIEW);
      await page.close();
      const r = { found: stills.map(s => !!s.pose) };
      // Every angle on the skeleton, to 0.1 degree: { trunk, elbow: { left, right }, ... } per still.
      r.skeleton = stills.map(s => Object.fromEntries(Object.entries(s.truth).map(([j, a]) => [j, typeof a === 'number' ? +a.toFixed(1) : { left: +a.left.toFixed(1), right: +a.right.toFixed(1) }])));
      if (joint) for (const side of sides) {
        const t = stills.map(s => s.truth[joint][side]), m = stills.map(s => (s.pose ? angle(s.pose, JP[joint][side]) : null));
        r[side] = { truth: t.map(Math.round), measured: m.map(x => (x == null ? null : Math.round(x))) };
      }
      res.views[view] = r;
      shots.push(...stills.map((s, k) => ({ jpeg: s.jpeg, label: `${view === 0 ? 'front' : 'side'} u=${s.u}${joint ? ` ${joint} ${sides.map(sd => `${sd[0].toUpperCase()} ${r[sd].truth[k]}/${r[sd].measured[k] ?? '-'}`).join(' ')}` : ''}${s.pose ? '' : ' NO POSE'}` })));
    }
    // The checks, from the spec's own view. FAIL: the spec is wrong (the body lost by the pose model at rest, halfway or at
    // the working end; the catalogue joint swinging under 30 degrees on the skeleton, or towards its rest side). WARN:
    // the pose model measures, on its better side, under 20 degrees (the core's floor) or a third of the true swing.
    const o = res.views[own], why = [], warn = [];
    if (!o.found.every(Boolean)) why.push('pose lost');
    if (joint) {
      const swings = sides.map(side => o[side].truth[2] - o[side].truth[0]), best = swings.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a));
      const want = fam.rest === 'high' ? -1 : 1;
      if (Math.abs(best) < 30) why.push(`swing ${best}`);
      else if (Math.sign(best) !== want) why.push(`moves away from rest ${fam.rest}`);
      const meas = sides.map(side => { const m = o[side].measured; return m[0] == null || m[2] == null ? 0 : (m[2] - m[0]) * want; });
      if (Math.max(...meas) < Math.max(20, Math.abs(best) / 3)) warn.push(`measured swing ${Math.round(Math.max(...meas))} of ${Math.abs(best)}`);
    }
    res.warn = warn;
    res.pass = !why.length; res.why = why;
    checks[key] = res;
    console.log(`${res.pass ? (warn.length ? 'WARN' : 'PASS') : 'FAIL'} ${key}${why.length || warn.length ? `: ${[...why, ...warn].join('; ')}` : ''}`);
    // The contact sheet, drawn in a blank page.
    const page = await browser.newPage();
    const sheet = await page.evaluate(async shots => {
      const imgs = await Promise.all(shots.map(s => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = s.jpeg; })));
      const w = imgs[0].width / 2, h = imgs[0].height / 2, c = document.createElement('canvas');
      c.width = w * 3; c.height = (h + 18) * 2;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.font = '11px sans-serif'; g.fillStyle = '#000';
      imgs.forEach((im, k) => { const x = (k % 3) * w, y = Math.floor(k / 3) * (h + 18); g.drawImage(im, x, y + 18, w, h); g.fillText(shots[k].label, x + 3, y + 13); });
      return c.toDataURL('image/jpeg', 0.85);
    }, shots);
    await page.close();
    writeFileSync(resolve(OUT, `${key}.jpg`), Buffer.from(sheet.split(',')[1], 'base64'));
  }
  await browser.close();
} finally { try { process.kill(-server.pid); } catch {} }
writeFileSync(resolve(OUT, 'checks.json'), JSON.stringify(checks, null, 1));
const n = Object.values(checks).filter(c => c.pass).length;
console.log(`${n} of ${keys.length} pass`);
