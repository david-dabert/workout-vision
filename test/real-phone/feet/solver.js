// The foot solver (bench only; the app imports none of it). David's decision of 23 October 2026 ("Reverse engineer it
// for free with no server", issue #190): video-to-skeleton tools let planted feet slide; this rebuilds, clean-room and
// for the phone, the parts that keep them planted. No code is copied from any tool or paper; the methods are cited.
//
// Input: MediaPipe world landmarks (33 points per sample, metres, centred on the hips: the mid-hip sits at the origin on
// every frame, +y down, z away from the camera), optional image landmarks, timestamps in seconds. Output: the same
// landmarks with planted feet held still, the root (pelvis) path the planted feet imply, per-foot contacts, the floor.
//
// Why the root first: in a frame pinned at the hips a planted foot carries the opposite of the pelvis motion (a squat
// moves the heels 0.35 to 0.51 m in this frame, feet-understand reading of 23 October). Holding the feet still means
// moving the pelvis instead. The root is anchored to the planted feet, root(t) = C - mean of the planted feet(t), with
// C set once per run of the same planted feet so the path stays continuous: integrating frame differences instead
// would turn MediaPipe's 1 to 5 cm per-sample foot noise into a random walk.
// Method source: the root displacement taken as the negative displacement of the feet in contact, weighted by contact
// (WHAM, Shin, Rajasegaran, Malik et al., CVPR 2024; GVHMR, Shen et al., SIGGRAPH Asia 2024; TransPose, Yi, Zhou, Xu,
// TOG 2021), read in the authors' public code, papers not opened from this container. Status: literature (method),
// experimental (here, on MediaPipe input).

const SIDES = {
  left: { hip: 23, knee: 25, ankle: 27, heel: 29, toe: 31 },
  right: { hip: 24, knee: 26, ankle: 28, heel: 30, toe: 32 },
};
const FOOT = side => [SIDES[side].heel, SIDES[side].toe, SIDES[side].ankle];

export const DEFAULTS = Object.freeze({
  mode: 'pin',            // 'root': root and contacts only, landmarks unchanged; 'pin': planted feet pinned by leg IK
                          // keeping each frame's own thigh and shin lengths; 'pinFixed': the same with the set's median lengths
  // A foot point read below this visibility does not vote. Source: UNSOURCED (the core uses 0.5 for its joints, core.ts
  // VIS_THRESHOLD; feet are often read lower). Status: experimental, an unvalidated starting value (PLAN.md line 16).
  visMin: 0.3,
  // A foot is a contact candidate while its lowest point is within this height of the lower foot, in leg lengths, with
  // hysteresis (enter below liftIn, leave above liftOut). Source: UNSOURCED (a raised foot clears the floor by more than
  // 10 cm in a step; 0.08 of a 0.9 m leg is 7 cm). Status: experimental, unvalidated starting values.
  liftIn: 0.08,
  liftOut: 0.12,
  // With image landmarks, a foot is planted only while its image speed (median over 5 samples) stays under imgIn torso
  // lengths per second, and stops being planted above imgOut. Source: UNSOURCED (a swinging foot moves well over 1 m/s,
  // a torso is about 0.5 m: 1 torso/s is about 0.5 m/s). Status: experimental, unvalidated starting values.
  imgIn: 1.0,
  imgOut: 1.5,
  // A contact shorter than this is dropped, a gap shorter than fillGap is closed. Source: UNSOURCED. Status: experimental.
  minContact: 0.2,
  fillGap: 0.14,
  // Planted positions fade in and out over this time at each end of a contact (the pinned target eased toward the
  // unpinned one, as GVHMR's target_t = c * target_(t-1) + (1 - c) * FK_t). Source: GVHMR public code (method);
  // the 0.2 s: UNSOURCED. Status: experimental.
  blend: 0.2,
  // Gaussian smoothing of the root, in samples (GVHMR smooths its root with sigma 3 at 30 fps; 1.5 at our 15 Hz is the
  // same 0.1 s). Source: GVHMR public code. Status: literature (the value), experimental (here).
  rootSigma: 1.5,
  // The root's depth (z, away from the camera) smoothed more: a single camera reads depth least surely, and on the
  // synthetic sets whose root never moves the recovered root wandered 109 mm in z against 51 in x and 66 in y (feet
  // bench, 23 October 2026). 0.5 s. Source: UNSOURCED (the axis order: convention for monocular capture). Status:
  // experimental.
  rootSigmaZ: 7.5,
});

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = a => Math.hypot(a[0], a[1], a[2]);
const P = p => [p.x, p.y, p.z];
const median = xs => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

/** The mean position of a foot's visible points on one frame (world, hip-centred), or null. */
function footRef(frame, side, visMin) {
  const pts = FOOT(side).map(i => frame[i]).filter(p => p && (p.visibility ?? 1) >= visMin);
  if (!pts.length) return null;
  return [0, 1, 2].map(k => pts.reduce((s, p) => s + P(p)[k], 0) / pts.length);
}

/** The lowest point of a foot (largest y, as y points down) among its visible heel and toe, else its ankle. */
function footLow(frame, side, visMin) {
  const s = SIDES[side];
  const ys = [s.heel, s.toe].map(i => frame[i]).filter(p => p && (p.visibility ?? 1) >= visMin).map(p => p.y);
  if (ys.length) return Math.max(...ys);
  const a = frame[s.ankle];
  return a && (a.visibility ?? 1) >= visMin ? a.y : null;
}

/** Hysteresis on a series (null = unknown, kept as the last state), then drop runs shorter than minLen, fill gaps up to gapLen. */
function hysteresis(values, enter, leave, minLen, gapLen) {
  const out = new Array(values.length).fill(false);
  let on = false;
  for (let t = 0; t < values.length; t++) {
    const v = values[t];
    if (v != null) on = on ? v <= leave : v <= enter;
    out[t] = on;
  }
  // close short gaps between contacts, then drop short contacts
  for (let t = 0; t < out.length;) {
    if (out[t]) { t++; continue; }
    let e = t; while (e < out.length && !out[e]) e++;
    if (t > 0 && e < out.length && e - t <= gapLen) for (let k = t; k < e; k++) out[k] = true;
    t = e;
  }
  for (let t = 0; t < out.length;) {
    if (!out[t]) { t++; continue; }
    let e = t; while (e < out.length && out[e]) e++;
    if (e - t < minLen) for (let k = t; k < e; k++) out[k] = false;
    t = e;
  }
  return out;
}

/** Gaussian smoothing of a series of points, one sigma (in samples) per axis; 0 leaves that axis as it is. */
function gaussianSmooth(series, sigmas) {
  const kernels = sigmas.map(sigma => {
    if (!(sigma > 0)) return null;
    const r = Math.ceil(3 * sigma), w = []; for (let k = -r; k <= r; k++) w.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
    return { r, w };
  });
  return series.map((v, t) => {
    if (!v) return v;
    return [0, 1, 2].map(axis => {
      const K = kernels[axis]; if (!K) return v[axis];
      let s = 0, ws = 0;
      for (let k = -K.r; k <= K.r; k++) { const u = series[t + k]; if (!u) continue; s += u[axis] * K.w[k + K.r]; ws += K.w[k + K.r]; }
      return s / ws;
    });
  });
}

/** Median image torso length in pixels (shoulder midpoint to hip midpoint), or NaN. */
function torsoPx(image, W, H) {
  return median(image.map(f => {
    if (!f) return NaN;
    const g = i => f[i] && [f[i].x * W, f[i].y * H];
    const ls = g(11), rs = g(12), lh = g(23), rh = g(24);
    if (!ls || !rs || !lh || !rh) return NaN;
    return Math.hypot((ls[0] + rs[0]) / 2 - (lh[0] + rh[0]) / 2, (ls[1] + rs[1]) / 2 - (lh[1] + rh[1]) / 2);
  }));
}

/** Per-foot image speed in torso lengths per second, median over 5 samples (null where unread). */
function imageSpeed(image, ts, side, W, H, torso, visMin) {
  const s = SIDES[side], pos = image.map(f => {
    if (!f) return null;
    const pts = [s.heel, s.toe].map(i => f[i]).filter(p => p && (p.visibility ?? 1) >= visMin);
    if (!pts.length) return null;
    return [pts.reduce((a, p) => a + p.x * W, 0) / pts.length, pts.reduce((a, p) => a + p.y * H, 0) / pts.length];
  });
  const raw = pos.map((p, t) => {
    const q = pos[t - 1];
    if (!p || !q || !(ts[t] > ts[t - 1])) return null;
    return Math.hypot(p[0] - q[0], p[1] - q[1]) / (ts[t] - ts[t - 1]) / torso;
  });
  return raw.map((_, t) => { const w = raw.slice(Math.max(0, t - 2), t + 3).filter(v => v != null); return w.length ? median(w) : null; });
}

/**
 * Analytic two-bone IK: the knee placed so the thigh (length a) and shin (length b) join the hip H to the ankle target A,
 * bending toward the original knee K0 (its pole). Returns the knee, the reached ankle and whether the target was reached.
 * Source: the law of cosines (convention). Status: convention.
 */
export function twoBoneIK(H, K0, A, a, b) {
  let d = sub(A, H), dl = norm(d);
  const reach = a + b - 1e-6, shortest = Math.abs(a - b) + 1e-6;
  const reached = dl <= reach && dl >= shortest;
  const u = dl > 1e-9 ? mul(d, 1 / dl) : [0, 1, 0];
  dl = Math.min(Math.max(dl, shortest), reach);
  const Ar = add(H, mul(u, dl));
  const cosH = Math.min(1, Math.max(-1, (a * a + dl * dl - b * b) / (2 * a * dl)));
  const k0 = sub(K0, H), along = dot(k0, u);
  let n = sub(k0, mul(u, along));
  if (norm(n) < 1e-9) n = Math.abs(u[2]) < 0.9 ? [-u[1], u[0], 0] : [0, -u[2], u[1]];
  n = mul(n, 1 / norm(n));
  const K = add(H, add(mul(u, a * cosH), mul(n, a * Math.sqrt(1 - cosH * cosH))));
  return { K, A: Ar, reached };
}

/**
 * Solve a set. wl: world landmarks per sample (array of 33 {x,y,z,visibility} or null); ts: seconds; image (optional):
 * image landmarks per sample (normalized x, y) with frame { width, height }.
 */
export function solveFeet(wl, ts, { image = null, frame = null, ...opts } = {}) {
  const o = { ...DEFAULTS, ...opts };
  const n = wl.length, dt = median(ts.slice(1).map((t, i) => t - ts[i])) || 1 / 15;
  const samples = sec => Math.max(1, Math.round(sec / dt));
  // Leg length: the median over frames of thigh + shin, both sides.
  const legOf = side => median(wl.map(f => {
    if (!f) return NaN; const s = SIDES[side];
    return norm(sub(P(f[s.knee]), P(f[s.hip]))) + norm(sub(P(f[s.ankle]), P(f[s.knee])));
  }));
  const leg = median([legOf('left'), legOf('right')]) || 0.9;

  // 1. Contacts: the lower foot, and any foot within liftIn of it; with image landmarks, also slow in the image.
  const lows = { left: wl.map(f => (f ? footLow(f, 'left', o.visMin) : null)), right: wl.map(f => (f ? footLow(f, 'right', o.visMin) : null)) };
  const W = frame?.width, Hh = frame?.height;
  const useImage = !!(image && W && Hh);
  const torso = useImage ? torsoPx(image, W, Hh) : NaN;
  const contact = {};
  for (const side of ['left', 'right']) {
    const other = side === 'left' ? 'right' : 'left';
    const height = lows[side].map((y, t) => {
      const yo = lows[other][t];
      if (y == null) return null;
      return yo == null ? 0 : Math.max(0, Math.max(y, yo) - y) / leg;
    });
    let c = hysteresis(height, o.liftIn, o.liftOut, samples(o.minContact), samples(o.fillGap));
    if (useImage && torso > 0) {
      const sp = imageSpeed(image, ts, side, W, Hh, torso, o.visMin);
      const slow = hysteresis(sp, o.imgIn, o.imgOut, samples(o.minContact), samples(o.fillGap));
      c = c.map((v, t) => v && slow[t]);
    }
    contact[side] = c.map((v, t) => v && !!wl[t]);
  }

  // 2. Root: anchored to the planted feet, continuous across changes of which feet are planted, then smoothed.
  const refs = { left: wl.map(f => (f ? footRef(f, 'left', o.visMin) : null)), right: wl.map(f => (f ? footRef(f, 'right', o.visMin) : null)) };
  const rootRaw = new Array(n).fill(null);
  let C = null, prevSet = '', prevRoot = [0, 0, 0];
  for (let t = 0; t < n; t++) {
    if (!wl[t]) continue;
    const planted = ['left', 'right'].filter(s => contact[s][t] && refs[s][t]);
    const key = planted.join(',');
    if (!planted.length) { rootRaw[t] = prevRoot.slice(); prevSet = ''; C = null; continue; }
    const mean = [0, 1, 2].map(k => planted.reduce((a, s) => a + refs[s][t][k], 0) / planted.length);
    if (key !== prevSet || !C) C = add(prevRoot, mean); // continuity: root(t) = prevRoot at the switch
    rootRaw[t] = sub(C, mean);
    prevRoot = rootRaw[t]; prevSet = key;
  }
  const root = gaussianSmooth(rootRaw, [o.rootSigma, o.rootSigma, o.rootSigmaZ ?? o.rootSigma]);

  // Global positions (world + root) and the floor: the median lowest point of planted feet.
  const glob = wl.map((f, t) => (f ? f.map(p => ({ ...p, x: p.x + root[t][0], y: p.y + root[t][1], z: p.z + root[t][2] })) : null));
  const plantedLows = [];
  for (let t = 0; t < n; t++) for (const s of ['left', 'right']) if (contact[s][t] && glob[t]) { const y = footLow(glob[t], s, o.visMin); if (y != null) plantedLows.push(y); }
  const floor = median(plantedLows);

  const out = { contact, root, floor: Number.isFinite(floor) ? floor : null, leg, usedImage: useImage, unreached: 0, pinned: 0 };
  if (o.mode === 'root' || !Number.isFinite(floor)) return { ...out, world: wl, global: glob };

  // 3. Plants: one position per contact run (the median of the ankle's global positions), set on the floor, with a
  //    weight that fades in and out over `blend` at each end of the run.
  const B = samples(o.blend);
  const targets = { left: new Array(n).fill(null), right: new Array(n).fill(null) };
  const shapes = { left: new Array(n).fill(null), right: new Array(n).fill(null) }; // heel and toe offsets from the ankle
  const weight = { left: new Array(n).fill(0), right: new Array(n).fill(0) };
  for (const side of ['left', 'right']) {
    const s = SIDES[side];
    for (let t = 0; t < n;) {
      if (!contact[side][t]) { t++; continue; }
      let e = t; while (e < n && contact[side][e]) e++;
      const ank = [], heel = [], toe = [];
      for (let k = t; k < e; k++) {
        const g = glob[k]; if (!g) continue;
        const A = P(g[s.ankle]);
        ank.push(A); heel.push(sub(P(g[s.heel]), A)); toe.push(sub(P(g[s.toe]), A));
      }
      if (ank.length) {
        // One rigid foot per plant: the ankle at its median position, heel and toe at their median offsets from it,
        // lowered or raised so the foot's lowest point sits on the floor.
        const plant = [0, 1, 2].map(k => median(ank.map(a => a[k])));
        const shape = { heel: [0, 1, 2].map(k => median(heel.map(a => a[k]))), toe: [0, 1, 2].map(k => median(toe.map(a => a[k]))) };
        plant[1] = floor - Math.max(shape.heel[1], shape.toe[1]);
        for (let k = t; k < e; k++) {
          targets[side][k] = plant; shapes[side][k] = shape;
          weight[side][k] = Math.min(1, (k - t + 1) / B, (e - k) / B);
        }
      }
      t = e;
    }
  }

  // 4. IK: each leg's ankle moved to its target (or lifted out of the floor when unplanted), the knee re-placed, the
  //    heel and toe carried with the ankle. The hips do not move, so the root and the hip-centred frame are kept.
  const lens = {};
  for (const side of ['left', 'right']) {
    const s = SIDES[side];
    lens[side] = {
      a: median(wl.map(f => (f ? norm(sub(P(f[s.knee]), P(f[s.hip]))) : NaN))),
      b: median(wl.map(f => (f ? norm(sub(P(f[s.ankle]), P(f[s.knee]))) : NaN))),
    };
  }
  const solved = glob.map(f => (f ? f.map(p => ({ ...p })) : null));
  const finalRoot = root.map(r => r && r.slice());
  for (let t = 0; t < n; t++) {
    const g = solved[t]; if (!g) continue;
    // The ankle goal of each leg: its plant, faded in and out, or lifted out of the floor when unplanted.
    const goal = {}, len = {};
    for (const side of ['left', 'right']) {
      const s = SIDES[side], A0 = P(g[s.ankle]), w = weight[side][t];
      let A = A0;
      if (w > 0 && targets[side][t]) A = add(mul(targets[side][t], w), mul(A0, 1 - w));
      else {
        const y = footLow(g, side, o.visMin);
        if (y != null && y > floor) A = [A0[0], A0[1] - (y - floor), A0[2]]; // no foot below the floor
      }
      const K0 = P(g[s.knee]), H = P(g[s.hip]);
      len[side] = o.mode === 'pinFixed' ? lens[side] : { a: norm(sub(K0, H)), b: norm(sub(A0, K0)) };
      goal[side] = A;
    }
    // A goal beyond the leg's reach moves the pelvis toward it (the body, not the foot, gives way; Motion2MixamoRig's
    // public README describes the same: "the hips move"). Source: that README (method). Status: experimental.
    let shiftRoot = [0, 0, 0], short = 0;
    for (const side of ['left', 'right']) {
      const s = SIDES[side], H = P(g[s.hip]), d = sub(goal[side], H), dl = norm(d), reach = len[side].a + len[side].b - 1e-3;
      if (dl > reach && dl > 0) { shiftRoot = add(shiftRoot, mul(d, (dl - reach) / dl)); short++; }
    }
    if (short) {
      shiftRoot = mul(shiftRoot, 1 / short);
      for (let i = 0; i < 33; i++) g[i] = { ...g[i], x: g[i].x + shiftRoot[0], y: g[i].y + shiftRoot[1], z: g[i].z + shiftRoot[2] };
      finalRoot[t] = add(finalRoot[t], shiftRoot);
    }
    for (const side of ['left', 'right']) {
      const s = SIDES[side], A0 = P(g[s.ankle]), A = goal[side];
      if (norm(sub(A, A0)) < 1e-4) continue;
      const H = P(g[s.hip]), K0 = P(g[s.knee]);
      const r = twoBoneIK(H, K0, A, len[side].a, len[side].b);
      if (!r.reached) out.unreached++;
      out.pinned++;
      g[s.knee] = { ...g[s.knee], x: r.K[0], y: r.K[1], z: r.K[2] };
      // The foot: rigid at its plant shape while planted (faded), else carried with the ankle.
      const shift = sub(r.A, A0), w = weight[side][t], sh = shapes[side][t];
      for (const [i, key] of [[s.heel, 'heel'], [s.toe, 'toe']]) {
        const carried = add(P(g[i]), shift);
        const placed = w > 0 && sh ? add(mul(add(r.A, sh[key]), w), mul(carried, 1 - w)) : carried;
        g[i] = { ...g[i], x: placed[0], y: placed[1], z: placed[2] };
      }
      g[s.ankle] = { ...g[s.ankle], x: r.A[0], y: r.A[1], z: r.A[2] };
    }
  }
  const world = solved.map((f, t) => (f ? f.map(p => ({ ...p, x: p.x - finalRoot[t][0], y: p.y - finalRoot[t][1], z: p.z - finalRoot[t][2] })) : null));
  return { ...out, root: finalRoot, world, global: solved };
}
