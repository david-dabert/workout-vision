#!/usr/bin/env node
// node scripts/stock/stream-stock.mjs [--queue public/stock/queue.json] [--labels test/real-phone/stock/labels.json]
//   [--out test/real-phone/stock] [--unlabelled-out /tmp/wv-lab/stock-landmarks] [--limit N] [--workers 2] [--split build|holdout]
//
// Streams open-licensed stock videos (Wikimedia Commons CC0/CC-BY/CC-BY-SA/PD, Pexels, Pixabay) one clip at a time into
// the OS temp folder, extracts MediaPipe world + image landmarks through the app's own extraction harness
// (test/real-phone/harness.html + whole-read.mjs), writes gzipped landmark JSON, and deletes both the downloaded video
// and transcoded temporary WebM in `finally` so no video file ever stays on disk.
//
// Discipline (R1, R2, R13):
// - Without `--unlabelled-out`, ONLY clips with an agreed human count in `test/real-phone/stock/labels.json`
//   (`agreedCounts`) are extracted into `test/real-phone/stock/<build|holdout>/<id>.json.gz`, and by default only the
//   `build` half (`--split build`) so the held-out half stays unread until an exam run.
// - With `--unlabelled-out <dir>`, queued clips may be pre-extracted outside the repository (e.g. `/tmp/wv-lab/stock`)
//   with `count: null` for pose/visibility diagnostics, never entering any repository dataset or scoreboard.
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import { splitOf } from '../public/split.mjs';
import { unreadPublic } from '../public/whole-read.mjs';
import { admitted } from '../public/admission.mjs';
import { TARGET_FPS } from '../../src/lib/extractionConfig.js';
import { agreedCounts, disagreements } from './labels.mjs';

const run = promisify(execFile);
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const UA = 'WorkoutVisionLabelQueue/1.0 (https://github.com/david-dabert/workout-vision)';
const round = x => (x == null ? x : Math.round(x * 1e4) / 1e4);
const visible = p => p && p.visibility >= 0.5 && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;

/**
 * Builds the extraction manifest from `queue` and `labelsBook`.
 * In `labelledOnly` mode (default), only agreed human-counted clips (`agreedCounts`) are included; disagreements and
 * unlabelled clips are reported in `skipped`.
 */
export function buildStockManifest(queueClips, labelsBook, { labelledOnly = true, split = 'build' } = {}) {
  const byId = new Map((queueClips || []).map(c => [c.id, c]));
  const agreed = new Map(agreedCounts(labelsBook || { labels: [] }).map(l => [l.id, l]));
  const splitDisagreed = new Set(disagreements(labelsBook || { labels: [] }).map(d => d.id));
  const sets = [];
  const skipped = [];

  if (labelledOnly) {
    for (const id of splitDisagreed) {
      skipped.push({ id, reason: 'disagreed count between labellers (decides nothing until David rules)' });
    }
    for (const [id, l] of agreed) {
      const h = splitOf(id);
      if (split && h !== split) continue;
      const clip = byId.get(id);
      const file = l.file || clip?.file;
      if (!file) {
        skipped.push({ id, reason: 'no file URL in labels.json or queue.json' });
        continue;
      }
      sets.push({
        id,
        dataset: 'stock',
        split: h,
        lift: l.lift || clip?.lift || null,
        count: l.count,
        who: l.who,
        file,
        source: clip?.source || 'stock',
        licence: clip?.licence || null,
        author: clip?.author || null,
      });
    }
  } else {
    for (const clip of queueClips || []) {
      const h = splitOf(clip.id);
      if (split && h !== split) continue;
      const l = agreed.get(clip.id);
      sets.push({
        id: clip.id,
        dataset: 'stock',
        split: h,
        lift: l?.lift || clip.lift || null,
        count: l ? l.count : null,
        who: l?.who || null,
        file: clip.file,
        source: clip.source,
        licence: clip.licence,
        author: clip.author,
      });
    }
  }
  return { sets, skipped };
}

async function resolveFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  for (const bin of ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg']) {
    if (existsSync(bin)) return bin;
  }
  const { stdout } = await run('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']);
  return stdout.trim();
}

async function downloadTemp(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
}

async function fpsOf(ffmpeg, video) {
  const { stderr } = await run(ffmpeg, ['-hide_banner', '-i', video]).catch(e => e);
  const m = /(\d+(?:\.\d+)?) fps/.exec(stderr || '');
  if (!m) throw new Error(`no frame rate in ${video}`);
  return Number(m[1]);
}

async function framesCount(ffmpeg, file) {
  const { stdout } = await run(ffmpeg, ['-hide_banner', '-nostdin', '-v', 'error', '-i', file, '-map', '0:v:0', '-f', 'null', '-progress', 'pipe:1', '-'], { maxBuffer: 1 << 26, timeout: 600000 });
  const all = [...stdout.matchAll(/^frame=(\d+)$/gm)];
  return all.length ? Number(all.at(-1)[1]) : NaN;
}

async function transcodeVp9(ffmpeg, src, dst) {
  const expected = await framesCount(ffmpeg, src);
  await run(ffmpeg, ['-v', 'error', '-nostdin', '-y', '-i', src, '-map', '0:v:0', '-an',
    '-c:v', 'libvpx-vp9', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1', '-b:v', '0', '-crf', '18', '-fps_mode', 'passthrough', dst], { timeout: 600000 });
  const got = await framesCount(ffmpeg, dst);
  if (Math.abs(got - expected) > 1) throw new Error(`transcoded ${got} frames where source holds ${expected}`);
}

export async function runStreamStock(argv = process.argv.slice(2)) {
  const opt = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
  const queuePath = resolve(opt('--queue', 'public/stock/queue.json'));
  const labelsPath = resolve(opt('--labels', 'test/real-phone/stock/labels.json'));
  const unlabelledOut = opt('--unlabelled-out', null);
  const outRoot = resolve(unlabelledOut || opt('--out', 'test/real-phone/stock'));
  const split = opt('--split', 'build');
  if (split !== 'build' && split !== 'holdout') throw new Error(`--split takes build or holdout, not ${split}`);
  if (split === 'holdout' && !process.env.HOLDOUT) throw new Error('The held-out half is read only by its own run (HOLDOUT=1).');
  const limit = Number(opt('--limit', Infinity));
  const workers = Number(opt('--workers', 2));
  const port = Number(opt('--port', 5191));

  const queue = existsSync(queuePath) ? JSON.parse(readFileSync(queuePath, 'utf8')).clips ?? [] : [];
  const book = existsSync(labelsPath) ? JSON.parse(readFileSync(labelsPath, 'utf8')) : { labels: [] };
  const { sets: manifest, skipped } = buildStockManifest(queue, book, { labelledOnly: !unlabelledOut, split });

  mkdirSync(outRoot, { recursive: true });
  const setsFile = join(outRoot, 'sets.json');
  const record = (id, entry) => {
    const all = existsSync(setsFile) ? JSON.parse(readFileSync(setsFile, 'utf8')) : {};
    all[id] = entry;
    writeFileSync(setsFile, `${JSON.stringify(all, null, 2)}\n`);
  };
  for (const s of skipped) record(s.id, { status: 'left out', reason: s.reason });

  const pending = manifest.filter(s => !existsSync(join(outRoot, s.split, `${s.id}.json.gz`))).slice(0, limit);
  if (!pending.length) {
    console.log(`0 pending clips to stream (manifest: ${manifest.length}, skipped: ${skipped.length}).`);
    return { written: 0, failed: 0 };
  }

  const ffmpeg = await resolveFfmpeg();
  const server = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: REPO, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}/workout-vision`;
  for (let i = 0; ; i++) {
    if (await fetch(`${base}/test/real-phone/harness.html`).then(r => r.ok, () => false)) break;
    if (i > 120) { server.kill(); throw new Error('the harness server did not start'); }
    await new Promise(r => setTimeout(r, 500));
  }

  const launchOpts = process.env.PW_CHROMIUM && existsSync(process.env.PW_CHROMIUM)
    ? { executablePath: process.env.PW_CHROMIUM }
    : {};
  const browser = await chromium.launch(launchOpts);
  let next = 0, written = 0, failed = 0;

  async function worker() {
    while (next < pending.length) {
      const set = pending[next++];
      const tag = createHash('sha256').update(set.id).digest('hex').slice(0, 12);
      const ext = extname(new URL(set.file).pathname) || '.webm';
      const rawClip = join(tmpdir(), `wv-stock-src-${tag}${ext}`);
      const webmClip = join(tmpdir(), `wv-stock-vp9-${tag}.webm`);
      const dest = join(outRoot, set.split, `${set.id}.json.gz`);
      const context = await browser.newContext();
      try {
        await downloadTemp(set.file, rawClip);
        const fps = await fpsOf(ffmpeg, rawClip);
        await transcodeVp9(ffmpeg, rawClip, webmClip);
        const page = await context.newPage();
        await page.route('**/public-sample.webm', route => route.fulfill({ path: webmClip, contentType: 'video/webm' }));
        await page.goto(`${base}/test/real-phone/harness.html`);
        await page.waitForFunction(() => window._harnessReady, null, { timeout: 120000 });
        const data = await page.evaluate(() => window._fetchAndProcess('/workout-vision/public-sample.webm'));
        const unread = unreadPublic({ timestamps: data.timestamps, duration: data.metadata?.duration, fps: TARGET_FPS });
        if (unread) throw new Error(`not read whole: ${unread}`);
        const samples = data.imageLandmarks.length;
        const seen = data.imageLandmarks.filter(lm => lm && [15, 16, 27, 28].every(i => visible(lm[i]))).length;
        const out = {
          dataset: 'stock',
          id: set.id,
          split: set.split,
          lift: set.lift,
          count: set.count,
          who: set.who,
          source: set.source,
          licence: set.licence,
          author: set.author,
          fps,
          samples,
          visibleShare: samples ? round(seen / samples) : 0,
          admitted: admitted('stock', samples ? seen / samples : 0),
          worldLandmarks: data.worldLandmarks.map(f => f && f.map(p => ({ x: round(p.x), y: round(p.y), z: round(p.z), visibility: round(p.visibility) }))),
          timestamps: data.timestamps.map(round),
          imageXY: data.imageLandmarks.map(f => f && f.flatMap(p => [Math.round(p.x * 1e3) / 1e3, Math.round(p.y * 1e3) / 1e3])),
        };
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, gzipSync(JSON.stringify(out)));
        record(set.id, { split: set.split, status: 'written', samples });
        written++;
        console.log(`${written + failed}/${pending.length} stock/${set.split}/${set.id} (${set.lift}) ${samples} samples`);
      } catch (err) {
        failed++;
        record(set.id, { split: set.split, status: 'failed', reason: err.message });
        console.log(`${written + failed}/${pending.length} ${set.id} FAILED: ${err.message}`);
      } finally {
        await context.close();
        rmSync(rawClip, { force: true });
        rmSync(webmClip, { force: true });
      }
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(workers, pending.length) }, worker));
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(`Stock stream done: ${written} written, ${failed} failed (all temporary videos deleted).`);
  return { written, failed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runStreamStock();
}
