/**
 * The learned counter (scripts/ml/train.py): a small temporal network over the pose sequence that gives
 * each sample a rep density; the count is their sum. It reads the same features as its training
 * (scripts/ml/data.py): the 12 joints of the shoulders, elbows, wrists, hips, knees and ankles, relative
 * to the mid-hip in torso lengths, each channel centred and scaled over the set, and a mask of the samples
 * with a pose. It counts no rep boundary: the rep details of the app still come from the core.
 * Status: experimental; trained on the Countix build half, measured by cross-validation on it and on David's
 * sets (test/real-phone/accuracy/learned-cv.txt, learned-david.txt); not yet run on the held-out half, and
 * not used by the app.
 */
import type { WorldLandmarkFrame } from './core';

const JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

type Block = { w: number[][][]; b: number[]; w2: number[][][]; b2: number[] };
export type LearnedWeights = {
  kernel: number; dilations: number[]; inputs: number; channels: number;
  params: { in_w: number[][][]; in_b: number[]; blocks: Block[]; out_w: number[][][]; out_b: number[] };
};

/** (T, 37) features, as scripts/ml/data.py computes them. */
export function learnedFeatures(frames: WorldLandmarkFrame[]): number[][] {
  const T = frames.length, pos: number[][] = [], seen: number[] = [];
  let last: number[] | null = null;
  for (let i = 0; i < T; i++) {
    const f = frames[i];
    if (f && JOINTS.every(j => f[j])) {
      const p = JOINTS.map(j => [f[j].x, f[j].y, f[j].z]);
      const hip = [0, 1, 2].map(k => (p[6][k] + p[7][k]) / 2), sh = [0, 1, 2].map(k => (p[0][k] + p[1][k]) / 2);
      const torso = Math.hypot(sh[0] - hip[0], sh[1] - hip[1], sh[2] - hip[2]) || 1;
      last = p.flatMap(q => [0, 1, 2].map(k => (q[k] - hip[k]) / torso));
      seen.push(1);
    } else seen.push(0);
    pos.push(last ? [...last] : []);
  }
  const first = seen.indexOf(1);
  for (let i = 0; i < T; i++) if (!pos[i].length) pos[i] = first >= 0 ? [...pos[first]] : Array(36).fill(0);
  const ref = seen.some(Boolean) ? pos.filter((_, i) => seen[i]) : pos;
  const mu = Array(36).fill(0), sd = Array(36).fill(0);
  for (const r of ref) r.forEach((v, k) => (mu[k] += v / ref.length));
  for (const r of ref) r.forEach((v, k) => (sd[k] += (v - mu[k]) ** 2 / ref.length));
  for (let k = 0; k < 36; k++) sd[k] = Math.sqrt(sd[k]) + 1e-3;
  return pos.map((r, i) => [...r.map((v, k) => (v - mu[k]) / sd[k]), seen[i]]);
}

// A 'same' 1D convolution with dilation, as jax.lax.conv_general_dilated with padding 'SAME'.
function conv(x: number[][], w: number[][][], b: number[], dil = 1): number[][] {
  const T = x.length, K = w.length, cin = w[0].length, cout = w[0][0].length;
  const span = (K - 1) * dil, left = Math.floor(span / 2);
  const y: number[][] = [];
  for (let t = 0; t < T; t++) {
    const o = [...b];
    for (let k = 0; k < K; k++) {
      const s = t - left + k * dil;
      if (s < 0 || s >= T) continue;
      const xs = x[s], wk = w[k];
      for (let i = 0; i < cin; i++) { const v = xs[i]; if (v === 0) continue; const wi = wk[i]; for (let j = 0; j < cout; j++) o[j] += v * wi[j]; }
    }
    y.push(o);
  }
  return y;
}
const gelu = (v: number) => 0.5 * v * (1 + Math.tanh(0.7978845608028654 * (v + 0.044715 * v * v * v)));
const softplus = (v: number) => (v > 20 ? v : Math.log1p(Math.exp(v)));

/** Each sample's rep density. */
export function learnedDensity(frames: WorldLandmarkFrame[], weights: LearnedWeights): number[] {
  if (!frames.length) return [];
  const p = weights.params;
  let h = conv(learnedFeatures(frames), p.in_w, p.in_b);
  p.blocks.forEach((blk, i) => {
    const r = conv(h, blk.w, blk.b, weights.dilations[i]).map(row => row.map(gelu));
    const add = conv(r, blk.w2, blk.b2);
    h = h.map((row, t) => row.map((v, j) => v + add[t][j]));
  });
  return conv(h.map(row => row.map(gelu)), p.out_w, p.out_b).map(row => softplus(row[0]));
}

/** The learned count: the density summed over the set, rounded, and the unrounded sum. */
export function learnedCount(frames: WorldLandmarkFrame[], weights: LearnedWeights) {
  const sum = learnedDensity(frames, weights).reduce((a, b) => a + b, 0);
  return { count: Math.round(sum), sum };
}
