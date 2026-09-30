#!/usr/bin/env node
// node scripts/public/run-public.mjs <manifest.json> [--workers 4] [--limit N]
// Public labelled videos to landmark files, through the app's own extraction (test/real-phone/harness.js,
// the modules and settings the app runs), in the Chromium installed here. A manifest ({ sets, skipped },
// scripts/public/manifest.mjs) holds sets { id, group, dataset, video, lift, count, repFrames:
// [[start, end], ...], trimFrames?: [start, end] }. Each set is written once, to
// test/real-phone/public/<dataset>/<build|holdout>/<id>.json.gz, in the half of its video's group
// (scripts/public/split.mjs), with its labels unchanged, the rep marks in seconds, and the world landmarks
// and timestamps the core counts. No video or frame is kept. Every set of the manifest, written, failed or
// left out, is recorded with its reason in <dataset>/sets.json, so none is dropped quietly. Resumable.
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { admitted } from './admission.mjs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import { splitOf } from './split.mjs';

const run = promisify(execFile);
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = process.env.WV_PUBLIC_OUT ? resolve(process.env.WV_PUBLIC_OUT) : join(REPO, 'test', 'real-phone', 'public');
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : fallback);
const { sets: manifest, skipped = [] } = JSON.parse(readFileSync(args[0], 'utf8'));
const WORKERS = opt('--workers', 4), LIMIT = opt('--limit', Infinity), PORT = opt('--port', 5189);
const FFMPEG = process.env.FFMPEG || (await run('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'])).stdout.trim();
const CHROMIUM = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const round = x => (x == null ? x : Math.round(x * 1e4) / 1e4);
const visible = p => p && p.visibility >= 0.5 && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
// The frames a video holds, counted by decoding it (ffmpeg's progress report on stdout).
const frames = async file => {
  const { stdout } = await run(FFMPEG, ['-hide_banner', '-nostdin', '-v', 'error', '-i', file, '-map', '0:v:0', '-f', 'null', '-progress', 'pipe:1', '-'], { maxBuffer: 1 << 26, timeout: 1800000 });
  const all = [...stdout.matchAll(/^frame=(\d+)$/gm)];
  return all.length ? Number(all.at(-1)[1]) : NaN;
};

async function fpsOf(video) {
  const { stderr } = await run(FFMPEG, ['-hide_banner', '-i', video]).catch(e => e);
  const m = /(\d+(?:\.\d+)?) fps/.exec(stderr || '');
  if (!m) throw new Error(`no frame rate in ${video}`);
  return Number(m[1]);
}

// VP9 in WebM, which Chromium decodes without the proprietary codecs, at the source's size and near
// lossless (CRF 18, as scripts/run-mmfit.mjs used for H.264): the app's own extraction then scales it, as it
// scales a phone's video. Every frame is kept at its own time, and the frame count is checked.
async function transcode(set, fps, clip) {
  const trim = set.trimFrames ? ['-ss', String(set.trimFrames[0] / fps), '-frames:v', String(set.trimFrames[1] - set.trimFrames[0])] : [];
  await run(FFMPEG, ['-v', 'error', '-nostdin', '-y', ...trim.slice(0, 2), '-i', set.video, ...trim.slice(2), '-map', '0:v:0', '-an',
    '-c:v', 'libvpx-vp9', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-b:v', '0', '-crf', '18', '-fps_mode', 'passthrough', clip], { timeout: 1800000 });
  const expected = set.trimFrames ? set.trimFrames[1] - set.trimFrames[0] : await frames(set.video);
  const got = await frames(clip);
  if (got !== expected) throw new Error(`transcoded ${got} frames where the source holds ${expected}`);
}

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: REPO, stdio: 'ignore' });
const base = `http://127.0.0.1:${PORT}/workout-vision`;
for (let i = 0; ; i++) {
  if (await fetch(`${base}/test/real-phone/harness.html`).then(r => r.ok, () => false)) break;
  if (i > 120) { server.kill(); throw new Error('the harness server did not start'); }
  await new Promise(r => setTimeout(r, 500));
}
const browser = await chromium.launch({ executablePath: CHROMIUM });
const half = s => splitOf(s.group ?? s.id);
const pending = manifest.filter(s => !existsSync(join(OUT, s.dataset, half(s), `${s.id}.json.gz`))).slice(0, LIMIT);
const log = [];
let next = 0;

async function worker() {
  while (next < pending.length) {
    const set = pending[next++], split = half(set);
    const dest = join(OUT, set.dataset, split, `${set.id}.json.gz`);
    const clip = join(tmpdir(), `wv-public-${createHash('sha256').update(set.id).digest('hex').slice(0, 12)}.webm`);
    const context = await browser.newContext();
    const errors = [];
    try {
      const fps = await fpsOf(set.video);
      await transcode(set, fps, clip);
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/public-sample.webm', route => route.fulfill({ path: clip, contentType: 'video/webm' }));
      await page.goto(`${base}/test/real-phone/harness.html`);
      await page.waitForFunction(() => window._harnessReady, null, { timeout: 120000 });
      let timer;
      const data = await Promise.race([
        page.evaluate(() => window._fetchAndProcess('/workout-vision/public-sample.webm')),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('extraction took over 20 minutes')), 1200000); }),
      ]).finally(() => clearTimeout(timer));
      const shift = set.trimFrames ? set.trimFrames[0] : 0;
      const samples = data.imageLandmarks.length;
      // PLAN.md's rule for MM-Fit: both wrists and both ankles (15, 16, 27, 28) seen together.
      const seen = data.imageLandmarks.filter(lm => lm && [15, 16, 27, 28].every(i => visible(lm[i]))).length;
      const out = {
        dataset: set.dataset, id: set.id, split, lift: set.lift, count: set.count,
        reps: set.repFrames.map(([a, b]) => [round((a - shift) / fps), round((b - shift) / fps)]),
        fps, samples, visibleShare: samples ? round(seen / samples) : 0,
        admitted: admitted(set.dataset, samples ? seen / samples : 0),
        worldLandmarks: data.worldLandmarks.map(f => f && f.map(p => ({ x: round(p.x), y: round(p.y), z: round(p.z), visibility: round(p.visibility) }))),
        timestamps: data.timestamps.map(round),
      };
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, gzipSync(JSON.stringify(out)));
      log.push({ id: set.id, split, samples, visibleShare: out.visibleShare, errors });
      console.log(`${log.length}/${pending.length} ${set.dataset}/${split}/${set.id} ${samples} samples`);
    } catch (err) {
      log.push({ id: set.id, split, error: err.message, errors });
      console.log(`${log.length}/${pending.length} ${set.id} FAILED: ${err.message}`);
    } finally {
      await context.close();
      rmSync(clip, { force: true });
    }
  }
}
try { await Promise.all(Array.from({ length: WORKERS }, worker)); }
finally { await browser.close(); server.kill(); }
// The record of every set of the manifest, per dataset, joined with earlier runs: written, failed or left
// out, and why. The scoreboard reads it, so a set with no file is never silent.
for (const ds of new Set([...manifest.map(s => s.dataset), ...skipped.map(s => s.dataset)])) {
  const file = join(OUT, ds, 'sets.json');
  const record = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  for (const s of manifest.filter(m => m.dataset === ds)) {
    const l = log.find(x => x.id === s.id);
    if (l) record[s.id] = { split: half(s), status: l.error ? 'failed' : 'written', ...(l.error ? { reason: l.error } : {}) };
    else record[s.id] ??= { split: half(s), status: 'written' };
  }
  for (const s of skipped.filter(m => m.dataset === ds)) record[s.id] = { status: 'left out', reason: s.reason };
  mkdirSync(join(OUT, ds), { recursive: true });
  writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
}
const failed = log.filter(l => l.error);
writeFileSync(join(OUT, `run-${new Date().toISOString().replace(/[:.]/g, '-')}.json`), JSON.stringify({ manifest: args[0], sets: pending.length, failed: failed.length, log }, null, 2));
console.log(`${pending.length - failed.length} written, ${failed.length} failed.`);
if (failed.length) process.exit(1);
