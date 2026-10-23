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
// moving the pelvis instead. The root moves by the opposite of the mean displacement of the feet planted on both
// samples; while the same feet stay planted this telescopes to root(t) = C - mean of the planted feet(t), so MediaPipe's
// 1 to 5 cm per-sample foot noise does not build into a random walk; at a change of planted feet the foot planted on
// both samples carries the motion across. A foot rising slowly stays planted until it clears liftOut, and the root
// follows it until then.
// Method source: the root displacement taken as the negative displacement of the feet in contact (WHAM, Shin,
// Rajasegaran, Malik et al., CVPR 2024; GVHMR, Shen et al., SIGGRAPH Asia 2024; TransPose, Yi, Zhou, Xu, TOG 2021), read
// in the authors' public code, papers not opened from this container. Status: literature (method), experimental (here).
//
// Visibility is not used for the feet: a point entering or leaving a visibility mask moved a foot's reference by a
// median 30 mm on David's stored sets, and an unread foot made the other read as planted (independent check of 23
// October 2026). Every foot point MediaPipe returns is used.

const SIDES = {
  left: { hip: 23, knee: 25, ankle: 27, heel: 29, toe: 31 },
  right: { hip: 24, knee: 26, ankle: 28, heel: 30, toe: 32 },
};
const FOOT = side => [SIDES[side].heel, SIDES[side].toe, SIDES[side].ankle];

export const DEFAULTS = Object.freeze({
  mode: 'pin',            // 'root': root and contacts only, landmarks unchanged; 'pin': planted feet pinned by leg IK
                          // keeping each frame's own thigh and shin lengths; 'pinFixed': the same with the set's median lengths
  // A foot is a contact candidate while its lowest point is within this height of the lower foot, in leg lengths, with
  // hysteresis (enter below liftIn, leave above liftOut). Source: UNSOURCED (a raised foot clears the floor by more than
  // 10 cm in a step; 0.08 of a 0.9 m leg is 7 cm). Status: experimental, unvalidated starting values (PLAN.md line 16).
  liftIn: 0.08,
  liftOut: 0.12,
  // With image landmarks, a foot is planted only while its image speed (median over 5 samples) stays under imgIn torso
  // lengths per second, and stops being planted above imgOut. Source: UNSOURCED (a swinging foot moves well over 1 m/s,
  // a torso is about 0.5 m: 1 torso/s is about 0.5 m/s). Status: experimental, unvalidated starting values.
  imgIn: 1.0,
  imgOut: 1.5,
  // After both gates, a contact shorter than minContact is dropped and a gap up to fillGap is closed (seconds).
  // Source: UNSOURCED. Status: experimental.
  minContact: 0.2,
  fillGap: 0.14,
  // Planted positions fade in and out over this time at each end of a contact (the pinned target eased toward the
  // unpinned one, as GVHMR's target_t = c * target_(t-1) + (1 - c) * FK_t). Source: GVHMR public code (method);
  // the 0.2 s: UNSOURCED. Status: experimental.
  blend: 0.2,
  // Gaussian smoothing of the root, sigma in seconds (GVHMR smooths its root with sigma 3 samples at 30 fps, 0.1 s).
  // Source: GVHMR public code. Status: literature (the value), experimental (here).
  rootSmooth: 0.1,
  // The root's depth (z, away from the camera) smoothed more: a single camera reads depth least surely, and on the
  // synthetic sets whose root never moves the recovered root wandered 109 mm in z against 51 in x and 66 in y (feet
  // bench, 23 October 2026). Source: UNSOURCED (the axis order: convention for monocular capture). Status: experimental.
  rootSmoothZ: 0.5,
  // A knee read closer than this to its hip-ankle line gives no bending direction of its own; the leg's direction over
  // the set is used instead (a millimetre of noise flipped straight knees, independent check of 23 October 2026).
  // Source: UNSOURCED. Status: experimental.
  poleMin: 0.02,
  // Soft reach: within this share of the leg's full reach the knee straightens gradually and the leg stretches slightly
  // to meet the goal, instead of the knee snapping straight ("knee popping"; Kovar, Schreiner and Gleicher 2002 allow
  // small leg-length changes for the same reason; the eased reach is the "soft IK" of animation rigs). Source: rigging
  // convention, the value UNSOURCED. Status: experimental.
  softReach: 0.03,
});
// The app samples at 15 per second (src/lib/extractionConfig.js TARGET_FPS), the step assumed when timestamps give none.
// Source: extractionConfig.js. Status: convention.
const DEFAULT_DT = 1 / 15;
// A leg length assumed when no frame gives one (an adult leg, hip to ankle, about 0.9 m). Source: UNSOURCED. Status:
// experimental; it only scales liftIn and liftOut on a set with no readable leg.
const DEFAULT_LEG = 0.9;
// Numerical tolerances, in metres: reach slack, the smallest ankle move worth an IK solve. Status: convention.
const REACH_SLACK = 1e-3, MOVE_MIN = 1e-4;
// Gaussian kernels are cut at 3 sigma. Status: convention.
const KERNEL_SIGMAS = 3;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = a => Math.hypot(a[0], a[1], a[2]);
const P = p => [p.x, p.y, p.z];
const finite = p => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
/** The median (the mean of the two middle values for an even count), NaN for none. */
export const median = xs => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b), n = s.length;
  if (!n) return NaN;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const unit = a => { const l = norm(a); return l > 1e-12 ? mul(a, 1 / l) : null; };
const orth = (a, u) => sub(a, mul(u, dot(a, u)));

/** The mean of a foot's heel, toe and ankle on one frame (world, hip-centred), or null when one is not finite. */
function footRef(frame, side) {
  const pts = FOOT(side).map(i => frame[i]);
  if (!pts.every(finite)) return null;
  return [0, 1, 2].map(k => pts.reduce((s, p) => s + P(p)[k], 0) / pts.length);
}

/** The lowest point of a foot (the larger y of heel and toe, as y points down), or null. */
function footLow(frame, side) {
  const s = SIDES[side], ys = [frame[s.heel], frame[s.toe]].filter(finite).map(p => p.y);
  return ys.length ? Math.max(...ys) : null;
}

/** Hysteresis on a series (null = unknown: the last state is kept). */
function hysteresis(values, enter, leave) {
  const out = new Array(values.length).fill(false);
  let on = false;
  for (let t = 0; t < values.length; t++) {
    const v = values[t];
    if (v != null && Number.isFinite(v)) on = on ? v <= leave : v <= enter;
    out[t] = on;
  }
  return out;
}

/** Close gaps up to gapLen between runs, then drop runs shorter than minLen. */
function filterRuns(mask, minLen, gapLen) {
  const out = mask.slice();
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
    const r = Math.ceil(KERNEL_SIGMAS * sigma), w = []; for (let k = -r; k <= r; k++) w.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
    return { r, w };
  });
  return series.map((v, t) => {
    if (!v) return v;
    return [0, 1, 2].map(axis => {
      const K = kernels[axis]; if (!K) return v[axis];
      let s = 0, ws = 0;
      for (let k = -K.r; k <= K.r; k++) { const u = series[t + k]; if (!u || !Number.isFinite(u[axis])) continue; s += u[axis] * K.w[k + K.r]; ws += K.w[k + K.r]; }
      return ws > 0 ? s / ws : v[axis];
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

/** Per-foot image speed (heel and toe midpoint) in torso lengths per second, median over 5 samples (null where unread). */
function imageSpeed(image, ts, side, W, H, torso) {
  const s = SIDES[side], pos = image.map(f => {
    if (!f || !f[s.heel] || !f[s.toe]) return null;
    return [((f[s.heel].x + f[s.toe].x) / 2) * W, ((f[s.heel].y + f[s.toe].y) / 2) * H];
  });
  const raw = pos.map((p, t) => {
    const q = pos[t - 1];
    if (!p || !q || !(ts[t] > ts[t - 1])) return null;
    return Math.hypot(p[0] - q[0], p[1] - q[1]) / (ts[t] - ts[t - 1]) / torso;
  });
  return raw.map((_, t) => { const w = raw.slice(Math.max(0, t - 2), t + 3).filter(v => v != null); return w.length ? median(w) : null; });
}

/**
 * Analytic two-bone IK: the knee placed so the thigh (length a) and shin (length b) join the hip H to the ankle target A.
 * The knee bends toward its own read offset from the hip-ankle line, biased by poleMin toward `pole` (the leg's
 * direction over the set), so a knee read on the line takes the leg's direction and a bent knee keeps its own. With
 * soft > 0, the last `soft` share of the reach is eased: the knee straightens gradually and the bones stretch, by at
 * most that share, to meet the goal. Returns the knee, the reached ankle and whether the goal was reached.
 * Source: the law of cosines (convention); the soft reach: rigging convention (see DEFAULTS.softReach). Status: convention.
 */
export function twoBoneIK(H, K0, A, a, b, pole = null, poleMin = DEFAULTS.poleMin, soft = 0) {
  const d = sub(A, H), want = norm(d);
  const R = a + b - 1e-6, shortest = Math.abs(a - b) + 1e-6, s = soft * R;
  const u = unit(d) ?? [0, 1, 0];
  // The eased distance the bones bend for, and the stretch that then meets the goal.
  let dl = Math.max(want, shortest), k = 1;
  if (s > 0 && dl > R - s) {
    const eased = R - s * Math.exp(-(dl - (R - s)) / s);
    k = Math.min(dl / eased, 1 + soft); dl = eased;
  } else dl = Math.min(dl, R);
  const reached = want >= shortest && dl * k >= want - 1e-6;
  const cosH = Math.min(1, Math.max(-1, (a * a + dl * dl - b * b) / (2 * a * dl)));
  const own = orth(sub(K0, H), u), hint = pole ? unit(orth(pole, u)) : null;
  const n = unit(hint ? add(own, mul(hint, poleMin)) : own) ?? unit(Math.abs(u[2]) < 0.9 ? [-u[1], u[0], 0] : [0, -u[2], u[1]]);
  const K = add(H, mul(add(mul(u, a * cosH), mul(n, a * Math.sqrt(1 - cosH * cosH))), k));
  return { K, A: add(H, mul(u, dl * k)), reached };
}

/** The farthest goal the soft IK meets for bones of total length R: x with x = eased(x) * (1 + soft) (fixed point). */
function softReachMax(R, soft) {
  if (!(soft > 0)) return R;
  const s = soft * R; let x = R * (1 + soft);
  for (let i = 0; i < 30; i++) x = (R - s * Math.exp(-(x - (R - s)) / s)) * (1 + soft);
  return x;
}

/** The smallest downward (+y) pelvis move that brings goal G within reach R of hip H, Infinity if no vertical move can. */
function dropToReach(H, G, R) {
  const h = Math.hypot(G[0] - H[0], G[2] - H[2]);
  if (h > R) return Infinity;
  return Math.max(0, G[1] - H[1] - Math.sqrt(R * R - h * h));
}

/**
 * Solve a set. wl: world landmarks per sample (array of 33 {x,y,z,visibility} or null); ts: seconds; image (optional):
 * image landmarks per sample (normalized x, y) with frame { width, height }.
 */
export function solveFeet(wl, ts, { image = null, frame = null, ...opts } = {}) {
  const o = { ...DEFAULTS, ...opts };
  const n = wl.length, dt = median(ts.slice(1).map((t, i) => t - ts[i])) || DEFAULT_DT;
  const samples = sec => Math.max(1, Math.round(sec / dt));
  const posed = wl.map(f => !!f && [23, 24, 25, 26, 27, 28, 29, 30, 31, 32].every(i => finite(f[i])));
  // Leg length: the mean of the two legs' median thigh + shin.
  const legOf = side => median(wl.map((f, t) => {
    if (!posed[t]) return NaN; const s = SIDES[side];
    return norm(sub(P(f[s.knee]), P(f[s.hip]))) + norm(sub(P(f[s.ankle]), P(f[s.knee])));
  }));
  const legs = [legOf('left'), legOf('right')].filter(Number.isFinite);
  const leg = legs.length ? legs.reduce((a, b) => a + b, 0) / legs.length : DEFAULT_LEG;

  // 1. Contacts: the lower foot, and any foot within liftIn of it; with image landmarks, also slow in the image. The two
  //    gates are combined first, then short gaps closed and short contacts dropped; frames with no pose keep the
  //    current state, so one lost frame does not split a plant.
  const lows = { left: wl.map((f, t) => (posed[t] ? footLow(f, 'left') : null)), right: wl.map((f, t) => (posed[t] ? footLow(f, 'right') : null)) };
  const W = frame?.width, Hh = frame?.height;
  const useImage = !!(image && W && Hh);
  const torso = useImage ? torsoPx(image, W, Hh) : NaN;
  const runs = {};
  for (const side of ['left', 'right']) {
    const other = side === 'left' ? 'right' : 'left';
    const height = lows[side].map((y, t) => (y == null || lows[other][t] == null ? null : Math.max(0, Math.max(y, lows[other][t]) - y) / leg));
    let c = hysteresis(height, o.liftIn, o.liftOut);
    if (useImage && torso > 0) {
      const slow = hysteresis(imageSpeed(image, ts, side, W, Hh, torso), o.imgIn, o.imgOut);
      c = c.map((v, t) => v && slow[t]);
    }
    runs[side] = filterRuns(c, samples(o.minContact), samples(o.fillGap));
  }
  const contact = { left: runs.left.map((v, t) => v && posed[t]), right: runs.right.map((v, t) => v && posed[t]) };

  // 2. Root: moved by the opposite of the mean displacement of the feet planted on both samples, then smoothed.
  const refs = { left: wl.map((f, t) => (posed[t] ? footRef(f, 'left') : null)), right: wl.map((f, t) => (posed[t] ? footRef(f, 'right') : null)) };
  const rootRaw = new Array(n).fill(null);
  let prev = -1;
  for (let t = 0; t < n; t++) {
    if (!posed[t]) continue;
    if (prev < 0) { rootRaw[t] = [0, 0, 0]; prev = t; continue; }
    const both = ['left', 'right'].filter(s => contact[s][t] && contact[s][prev] && refs[s][t] && refs[s][prev]);
    let r = rootRaw[prev];
    if (both.length) r = sub(r, [0, 1, 2].map(k => both.reduce((a, s) => a + refs[s][t][k] - refs[s][prev][k], 0) / both.length));
    rootRaw[t] = r; prev = t;
  }
  const root = gaussianSmooth(rootRaw, [o.rootSmooth / dt, o.rootSmooth / dt, o.rootSmoothZ / dt]);

  // Global positions (world + root) and the floor: the median lowest point of planted feet.
  const glob = wl.map((f, t) => (posed[t] ? f.map(p => ({ ...p, x: p.x + root[t][0], y: p.y + root[t][1], z: p.z + root[t][2] })) : f));
  const plantedLows = [];
  for (let t = 0; t < n; t++) for (const s of ['left', 'right']) if (contact[s][t]) { const y = footLow(glob[t], s); if (y != null) plantedLows.push(y); }
  const floor = median(plantedLows);

  const out = { contact, root, floor: Number.isFinite(floor) ? floor : null, leg, usedImage: useImage, unreached: 0, pinned: 0 };
  if (o.mode === 'root' || !Number.isFinite(floor)) return { ...out, world: wl, global: glob };

  // 3. Plants: one rigid foot per contact run (the ankle at its median global position, heel and toe at their median
  //    offsets from it), set so its lowest point is on the floor, with a weight that fades in and out over `blend`.
  const B = samples(o.blend);
  const targets = { left: new Array(n).fill(null), right: new Array(n).fill(null) };
  const shapes = { left: new Array(n).fill(null), right: new Array(n).fill(null) };
  const weight = { left: new Array(n).fill(0), right: new Array(n).fill(0) };
  for (const side of ['left', 'right']) {
    const s = SIDES[side];
    for (let t = 0; t < n;) {
      if (!runs[side][t]) { t++; continue; }
      let e = t; while (e < n && runs[side][e]) e++;
      const ank = [], heel = [], toe = [];
      for (let k = t; k < e; k++) {
        if (!posed[k]) continue;
        const g = glob[k], A = P(g[s.ankle]);
        ank.push(A); heel.push(sub(P(g[s.heel]), A)); toe.push(sub(P(g[s.toe]), A));
      }
      if (ank.length) {
        const plant = [0, 1, 2].map(k => median(ank.map(a => a[k])));
        const shape = { heel: [0, 1, 2].map(k => median(heel.map(a => a[k]))), toe: [0, 1, 2].map(k => median(toe.map(a => a[k]))) };
        plant[1] = floor - Math.max(shape.heel[1], shape.toe[1]);
        for (let k = t; k < e; k++) { targets[side][k] = plant; shapes[side][k] = shape; weight[side][k] = Math.min(1, (k - t + 1) / B, (e - k) / B); }
      }
      t = e;
    }
  }

  // Each leg's bending direction over the set: the median of its knee's offset from the hip-ankle line where the knee
  // is clearly off the line, else the foot's forward direction (heel to toe): knees bend over the toes.
  const poles = {};
  for (const side of ['left', 'right']) {
    const s = SIDES[side], offs = [], fwd = [];
    for (let t = 0; t < n; t++) {
      if (!posed[t]) continue;
      const f = wl[t], H = P(f[s.hip]), u = unit(sub(P(f[s.ankle]), H));
      if (u) { const v = orth(sub(P(f[s.knee]), H), u); if (norm(v) >= o.poleMin) offs.push(unit(v)); }
      fwd.push(sub(P(f[s.toe]), P(f[s.heel])));
    }
    const pick = xs => (xs.length ? unit([0, 1, 2].map(k => median(xs.map(v => v[k])))) : null);
    poles[side] = pick(offs) ?? pick(fwd);
  }

  // 4. IK: each leg's ankle moved to its goal (its plant, faded; or lifted out of the floor when unplanted), the knee
  //    re-placed, the foot rigid at its plant shape (faded) or carried with the ankle. A goal out of reach lowers the
  //    pelvis first (the body gives way, not the foot; Motion2MixamoRig's public README describes the same, "the hips
  //    move"), and moves it toward the foot only where lowering cannot reach. Source: that README (method). Status:
  //    experimental.
  const lens = {};
  for (const side of ['left', 'right']) {
    const s = SIDES[side];
    lens[side] = {
      a: median(wl.map((f, t) => (posed[t] ? norm(sub(P(f[s.knee]), P(f[s.hip]))) : NaN))),
      b: median(wl.map((f, t) => (posed[t] ? norm(sub(P(f[s.ankle]), P(f[s.knee]))) : NaN))),
    };
  }
  const solved = glob.map((f, t) => (posed[t] ? f.map(p => ({ ...p })) : f));
  const finalRoot = root.map(r => r && r.slice());
  const shiftAll = (g, t, v) => { for (let i = 0; i < g.length; i++) g[i] = { ...g[i], x: g[i].x + v[0], y: g[i].y + v[1], z: g[i].z + v[2] }; finalRoot[t] = add(finalRoot[t], v); };
  for (let t = 0; t < n; t++) {
    if (!posed[t]) continue;
    const g = solved[t], len = {};
    for (const side of ['left', 'right']) {
      const s = SIDES[side];
      len[side] = o.mode === 'pinFixed' ? lens[side] : { a: norm(sub(P(g[s.knee]), P(g[s.hip]))), b: norm(sub(P(g[s.ankle]), P(g[s.knee]))) };
    }
    const goalOf = side => {
      const s = SIDES[side], A0 = P(g[s.ankle]), w = weight[side][t];
      if (w > 0 && targets[side][t]) {
        // A faded plant: the ankle eased toward its plant, the heel and toe between the plant's shape and the carried
        // foot; the whole is raised if its lowest point would fall below the floor.
        const goal = add(mul(targets[side][t], w), mul(A0, 1 - w)), sh = shapes[side][t];
        const low = Math.max(...[[s.heel, 'heel'], [s.toe, 'toe']].map(([i, key]) => goal[1] + w * sh[key][1] + (1 - w) * (g[i].y - A0[1])));
        return low > floor ? [goal[0], goal[1] - (low - floor), goal[2]] : goal;
      }
      const y = footLow(g, side);
      return y != null && y > floor ? [A0[0], A0[1] - (y - floor), A0[2]] : A0; // no foot below the floor
    };
    // Lower the pelvis until every goal is in reach, then move it toward a goal no lowering can reach.
    const reachOf = side => softReachMax(len[side].a + len[side].b, o.softReach) - REACH_SLACK;
    const drop = Math.max(...['left', 'right'].map(side => { const d = dropToReach(P(g[SIDES[side].hip]), goalOf(side), reachOf(side)); return Number.isFinite(d) ? d : 0; }));
    if (drop > 0) shiftAll(g, t, [0, drop, 0]);
    for (let iter = 0; iter < 4; iter++) {
      let worst = null, excess = 0;
      for (const side of ['left', 'right']) {
        const d = sub(goalOf(side), P(g[SIDES[side].hip])), e = norm(d) - reachOf(side);
        if (e > excess) { excess = e; worst = d; }
      }
      if (!worst) break;
      shiftAll(g, t, mul(unit(worst), excess));
    }
    for (const side of ['left', 'right']) {
      const s = SIDES[side], A0 = P(g[s.ankle]), A = goalOf(side);
      if (norm(sub(A, A0)) < MOVE_MIN) continue;
      const H = P(g[s.hip]), K0 = P(g[s.knee]);
      const r = twoBoneIK(H, K0, A, len[side].a, len[side].b, poles[side], o.poleMin, o.softReach);
      if (!r.reached) out.unreached++;
      out.pinned++;
      g[s.knee] = { ...g[s.knee], x: r.K[0], y: r.K[1], z: r.K[2] };
      const shift = sub(r.A, A0), w = weight[side][t], sh = shapes[side][t];
      for (const [i, key] of [[s.heel, 'heel'], [s.toe, 'toe']]) {
        const carried = add(P(g[i]), shift);
        const placed = w > 0 && sh ? add(mul(add(r.A, sh[key]), w), mul(carried, 1 - w)) : carried;
        g[i] = { ...g[i], x: placed[0], y: placed[1], z: placed[2] };
      }
      g[s.ankle] = { ...g[s.ankle], x: r.A[0], y: r.A[1], z: r.A[2] };
    }
  }
  const world = solved.map((f, t) => (posed[t] ? f.map(p => ({ ...p, x: p.x - finalRoot[t][0], y: p.y - finalRoot[t][1], z: p.z - finalRoot[t][2] })) : f));
  return { ...out, root: finalRoot, world, global: solved };
}
