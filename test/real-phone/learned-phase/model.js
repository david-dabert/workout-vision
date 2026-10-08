// Learned phase counter, bench only (the app imports none of it): plain-JS inference of the model train.py writes
// (model-<fold>.json: float16 weights in base64). No runtime dependency. Forward pass identical to train.py forward():
// 1x1 input layer + ReLU, then residual blocks of a dilated 3-tap convolution (zero padding) + ReLU + 1x1, then a 1x1
// head of 4 outputs per 15 Hz frame: rep-rate logit, sin, cos of the phase, inside-a-rep logit. Readouts as train.py
// readouts(). Status: experimental (TRIED.md, 8 October).
import { features, resampleJoints, HZ } from './data.js';

function f16(h) {
  const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}

/** Weights from the JSON train.py writes. */
export function loadModel(json) {
  const t = {};
  for (const [k, v] of Object.entries(json.tensors)) {
    const b = Buffer.from(v.f16, 'base64');
    const a = new Float32Array(b.length / 2);
    for (let i = 0; i < a.length; i++) a[i] = f16(b[2 * i] | (b[2 * i + 1] << 8));
    t[k] = { shape: v.shape, data: a };
  }
  return { dil: json.dil, C: json.C, F: json.F, t, meta: json.meta, bytes: Object.values(t).reduce((s, x) => s + 2 * x.data.length, 0) };
}

// y (T x out) = x (T x inp) W (inp x out) + b
function dense(x, T, inp, W, b, out) {
  const y = new Float32Array(T * out);
  for (let t = 0; t < T; t++) {
    const yo = t * out, xo = t * inp;
    for (let o = 0; o < out; o++) y[yo + o] = b[o];
    for (let i = 0; i < inp; i++) {
      const v = x[xo + i];
      if (v === 0) continue;
      const wo = i * out;
      for (let o = 0; o < out; o++) y[yo + o] += v * W[wo + o];
    }
  }
  return y;
}

/** Raw outputs, T x 4. */
export function forward(model, X, T) {
  const { C, F, dil, t: P } = model;
  let h = dense(X, T, F, P.Win.data, P.bin.data, C);
  for (let i = 0; i < h.length; i++) if (h[i] < 0) h[i] = 0;
  const xc = new Float32Array(T * 3 * C);
  for (let l = 0; l < dil.length; l++) {
    const d = dil[l];
    xc.fill(0);
    for (let t = 0; t < T; t++) {
      const o = t * 3 * C;
      if (t - d >= 0) xc.set(h.subarray((t - d) * C, (t - d + 1) * C), o);
      xc.set(h.subarray(t * C, (t + 1) * C), o + C);
      if (t + d < T) xc.set(h.subarray((t + d) * C, (t + d + 1) * C), o + 2 * C);
    }
    const a = dense(xc, T, 3 * C, P[`Wd${l}`].data, P[`bd${l}`].data, C);
    for (let i = 0; i < a.length; i++) if (a[i] < 0) a[i] = 0;
    const r = dense(a, T, C, P[`Wp${l}`].data, P[`bp${l}`].data, C);
    for (let i = 0; i < h.length; i++) h[i] += r[i];
  }
  return dense(h, T, C, P.Wh.data, P.bh.data, 4);
}

const softplus = x => (x > 0 ? x + Math.log1p(Math.exp(-x)) : Math.log1p(Math.exp(x)));
const sigmoid = x => 1 / (1 + Math.exp(-x));

/** Readouts of the raw outputs: density (round of the summed rate / 15), phase (reps whose middle, phase 0.5, is
 *  passed inside an active stretch), and the numbers a confidence could read. */
export function readouts(o, T) {
  let dens = 0, total = 0, active = 0, u = null, start = 0, prev = 0, margin = 0;
  const close = () => { if (u !== null) total += Math.floor(u - 0.5) - Math.floor(start - 0.5); u = null; };
  for (let t = 0; t < T; t++) {
    dens += softplus(o[t * 4]) / HZ;
    const p = sigmoid(o[t * 4 + 3]);
    margin += Math.abs(p - 0.5) * 2;
    let ang = Math.atan2(o[t * 4 + 1], o[t * 4 + 2]) / (2 * Math.PI);
    ang -= Math.floor(ang);
    if (p > 0.5) {
      active++;
      if (u === null) { u = ang; start = ang; } else { let dl = ang - prev; dl -= Math.round(dl); u += dl; }
      prev = ang;
    } else close();
  }
  close();
  return { density: Math.round(dens), densityRaw: dens, phase: Math.max(0, total), activeShare: active / Math.max(1, T), activeMargin: margin / Math.max(1, T) };
}

/** Count of one set (world landmarks, timestamps in seconds) with one model, or the mean outputs of several. */
export function learnedCount(models, wl, ts) {
  const r = resampleJoints(wl, ts);
  if (r.T < 15) return null;
  const X = features(r.joints, r.T);
  const ms = Array.isArray(models) ? models : [models];
  let o = null;
  for (const m of ms) {
    const y = forward(m, X, r.T);
    if (!o) o = y; else for (let i = 0; i < o.length; i++) o[i] += y[i];
  }
  if (ms.length > 1) for (let i = 0; i < o.length; i++) o[i] /= ms.length;
  return { T: r.T, ...readouts(o, r.T) };
}
