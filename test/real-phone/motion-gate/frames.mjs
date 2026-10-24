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
import { motionCount, shrinkRegion, ROI_PAD } from '../../../src/lib/counting/motionRhythm.js';

const run = promisify(execFile);
const [, , manifestPath, outPath, ...rest] = process.argv;
const WORKERS = rest.includes('--workers') ? Number(rest[rest.indexOf('--workers') + 1]) : 4;
// --roi variance (plan.md, attempt 2): the region is the box around the cells that vary most over the set; else the whole frame.
const ROI = rest.includes('--roi') ? rest[rest.indexOf('--roi') + 1] : 'whole';
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
// The box around the cells (32 x 32) whose standard deviation over the set is at or above its 80th percentile, widened
// by ROI_PAD: where the pixels move most. Label-free, no skeleton (plan.md, attempt 2). Status: experimental, UNSOURCED.
function varianceRoi(frames, g = 32, q = 0.8) {
  if (ROI !== 'variance' || frames.length < 8) return [0, 0, 1, 1];
  const vecs = frames.map(f => shrinkRegion(f, W, H, [0, 0, 1, 1], g)), T = vecs.length, sd = new Float64Array(g * g);
  for (let c = 0; c < g * g; c++) { let m = 0; for (const v of vecs) m += v[c]; m /= T; let s = 0; for (const v of vecs) s += (v[c] - m) ** 2; sd[c] = Math.sqrt(s / T); }
  const thr = [...sd].sort((a, b) => a - b)[Math.floor(q * (g * g - 1))];
  let x0 = g, y0 = g, x1 = -1, y1 = -1;
  for (let c = 0; c < g * g; c++) if (sd[c] >= thr) { const x = c % g, y = Math.floor(c / g); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
  if (x1 < 0) return [0, 0, 1, 1];
  const [a, b, c2, d] = [x0 / g, y0 / g, x1 / g, y1 / g], pw = (c2 - a) * ROI_PAD, ph = (d - b) * ROI_PAD;
  return [Math.max(0, a - pw), Math.max(0, b - ph), Math.min(1, c2 + pw), Math.min(1, d + ph)];
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
      const wholeRoi = varianceRoi(frames);
      const whole = motionCount({ frames, w: W, h: H, timestamps: ts }, { roi: wholeRoi });
      for (const s of byVideo.get(video)) {
        const opts = { alternating: ALTERNATING.has(s.lift) };
        const [a, b] = s.trimSeconds ?? [0, ts[ts.length - 1]];
        const idx = ts.map((t, k) => (t >= a - 1e-6 && t <= b + 1e-6 ? k : -1)).filter(k => k >= 0);
        const tf = idx.map(k => frames[k]);
        const trim = motionCount({ frames: tf, w: W, h: H, timestamps: idx.map(k => ts[k] - a) }, { ...opts, roi: varianceRoi(tf) });
        out[s.id] = { lift: s.lift, label: s.count, trimSeconds: [a, b], trim: pick(trim), whole: pick(opts.alternating ? motionCount({ frames, w: W, h: H, timestamps: ts }, { ...opts, roi: wholeRoi }) : whole) };
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
