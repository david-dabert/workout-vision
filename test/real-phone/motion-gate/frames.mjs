#!/usr/bin/env node
// node test/real-phone/motion-gate/frames.mjs <countix manifest.json> <out.json> [--workers 4]
// The image-motion count (src/lib/counting/motionRhythm.js) of every set of a Countix manifest (scripts/public/manifest.mjs),
// label-free: each clip decoded once with ffmpeg at the app's 15 samples per second, 128 x 128 grey; a trimmed set counted
// on its labelled window (trimSeconds), the whole clip counted whole (its peaks are scored against a countix-whole
// window by gate.test.ts). The region is the whole frame: the public landmark files keep no image points. No frame is
// kept. Writes { [id]: { trim: {...}, whole: {...} } } with each count, confidence, period and peak times.
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { motionCount } from '../../../src/lib/counting/motionRhythm.js';

const run = promisify(execFile);
const [, , manifestPath, outPath, ...rest] = process.argv;
const WORKERS = rest.includes('--workers') ? Number(rest[rest.indexOf('--workers') + 1]) : 4;
const FS = 15, W = 128, H = 128;
const FFMPEG = process.env.FFMPEG || (await run('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'])).stdout.trim();
const { sets } = JSON.parse(readFileSync(manifestPath, 'utf8'));
// The catalogue's alternating lifts (core.ts liftDefinition bothSides): none of Countix's seven classes is one.
const ALTERNATING = new Set(['bicep_curl_alternating', 'walking_lunge', 'dead_bug']);

async function decode(video) {
  const { stdout } = await run(FFMPEG, ['-v', 'error', '-nostdin', '-i', video, '-vf', `fps=${FS},scale=${W}:${H},format=gray`, '-f', 'rawvideo', '-'],
    { encoding: 'buffer', maxBuffer: 1 << 30, timeout: 600000 });
  const n = Math.floor(stdout.length / (W * H));
  return Array.from({ length: n }, (_, k) => new Uint8Array(stdout.buffer, stdout.byteOffset + k * W * H, W * H));
}
const pick = r => ({ count: r.count, confidence: r.confidence, period: r.period, peaksAt: r.peaksAt });

const out = {}, byVideo = new Map();
for (const s of sets) { if (!byVideo.has(s.video)) byVideo.set(s.video, []); byVideo.get(s.video).push(s); }
const videos = [...byVideo.keys()];
let next = 0, done = 0, failed = 0;
async function worker() {
  while (next < videos.length) {
    const video = videos[next++];
    try {
      const frames = await decode(video);
      const ts = frames.map((_, k) => k / FS);
      const whole = motionCount({ frames, w: W, h: H, timestamps: ts });
      for (const s of byVideo.get(video)) {
        const opts = { alternating: ALTERNATING.has(s.lift) };
        const [a, b] = s.trimSeconds ?? [0, ts[ts.length - 1]];
        const idx = ts.map((t, k) => (t >= a - 1e-6 && t <= b + 1e-6 ? k : -1)).filter(k => k >= 0);
        const trim = motionCount({ frames: idx.map(k => frames[k]), w: W, h: H, timestamps: idx.map(k => ts[k] - a) }, opts);
        out[s.id] = { lift: s.lift, label: s.count, trimSeconds: [a, b], trim: pick(trim), whole: pick(opts.alternating ? motionCount({ frames, w: W, h: H, timestamps: ts }, opts) : whole) };
      }
    } catch (e) {
      failed++;
      for (const s of byVideo.get(video)) out[s.id] = { lift: s.lift, label: s.count, error: String(e.message || e).slice(0, 200) };
    }
    if (++done % 50 === 0) process.stdout.write(`${done}/${videos.length} clips (${failed} failed)\n`);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
writeFileSync(outPath, JSON.stringify(out) + '\n');
process.stdout.write(`done: ${Object.keys(out).length} sets from ${videos.length} clips, ${failed} clips failed\n`);
