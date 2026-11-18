// Whole-set lifter track (18 November 2026, bench only; nothing in src/ imports it). Every pose of every frame is linked
// into per-person tracks by torso centre (ByteTrack-style, greedy nearest), then the lifter is chosen once, over the
// whole set, as the track whose joints move the most while it is present most of the set. This answers both reopen
// conditions of TRIED.md (lifter lock, jump gate; 7 October): no box size, no single reference frame.
// Thresholds: experimental, UNSOURCED (R9), chosen before any run on David's clip; to be measured on labelled sets.

const L_SH = 11, R_SH = 12, L_HIP = 23, R_HIP = 24;
// Joint angles read for motion: [a, vertex, b] (MediaPipe pose indices): elbows, shoulders, knees, hips, both sides.
const ANGLES = [[11, 13, 15], [12, 14, 16], [13, 11, 23], [14, 12, 24], [23, 25, 27], [24, 26, 28], [11, 23, 25], [12, 24, 26]];
export const LINK_MAX = 0.6; // torso-centre jump allowed per frame, in torso lengths. experimental, UNSOURCED.
export const TRACK_GAP = 15; // frames a track may miss (1 s at 15 Hz) before it ends. experimental, UNSOURCED.
export const MIN_COVER = 0.5; // the lifter is present in at least half the set's frames. experimental, UNSOURCED.

function centre(p) {
  const pts = [p[L_SH], p[R_SH], p[L_HIP], p[R_HIP]];
  return { x: pts.reduce((s, q) => s + q.x, 0) / 4, y: pts.reduce((s, q) => s + q.y, 0) / 4 };
}
function torso(p) {
  const s = { x: (p[L_SH].x + p[R_SH].x) / 2, y: (p[L_SH].y + p[R_SH].y) / 2 };
  const h = { x: (p[L_HIP].x + p[R_HIP].x) / 2, y: (p[L_HIP].y + p[R_HIP].y) / 2 };
  return Math.max(Math.hypot(s.x - h.x, s.y - h.y), 1e-3);
}
function angle(p, [a, v, b]) {
  const u = [p[a].x - p[v].x, p[a].y - p[v].y, p[a].z - p[v].z], w = [p[b].x - p[v].x, p[b].y - p[v].y, p[b].z - p[v].z];
  const d = Math.hypot(...u) * Math.hypot(...w);
  return d ? Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / d))) : 0;
}
function sd(xs) {
  if (xs.length < 2) return 0;
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
}

// frames: [{ image: [pose (33 landmarks, normalised x/y)], world: [pose (33, metres)] }] in time order.
// Returns tracks: [{ id, at: Map<frame index, pose index> }].
export function linkTracks(frames) {
  const tracks = [], live = [];
  frames.forEach((f, i) => {
    const poses = f.image.map((p, k) => ({ k, c: centre(p), s: torso(p) }));
    const pairs = [];
    for (const t of live) for (const q of poses) {
      const d = Math.hypot(q.c.x - t.c.x, q.c.y - t.c.y) / Math.max(t.s, q.s);
      if (d <= LINK_MAX * (1 + (i - t.last - 1) * 0.25)) pairs.push({ t, q, d });
    }
    pairs.sort((a, b) => a.d - b.d);
    const usedT = new Set(), usedQ = new Set();
    for (const { t, q } of pairs) {
      if (usedT.has(t) || usedQ.has(q.k)) continue;
      usedT.add(t); usedQ.add(q.k);
      t.at.set(i, q.k); t.c = q.c; t.s = q.s; t.last = i;
    }
    for (const q of poses) if (!usedQ.has(q.k)) {
      const t = { id: tracks.length, at: new Map([[i, q.k]]), c: q.c, s: q.s, last: i };
      tracks.push(t); live.push(t);
    }
    for (let j = live.length - 1; j >= 0; j--) if (i - live[j].last > TRACK_GAP) live.splice(j, 1);
  });
  return tracks.map(({ id, at }) => ({ id, at }));
}

// Per track: cover (share of frames present) and motion (largest standard deviation, in degrees, of the joint angles
// above over the frames it is present, world landmarks). The lifter: the most motion among tracks with cover >=
// MIN_COVER; with none, the most covered.
export function scoreTracks(frames, tracks) {
  return tracks.map(t => {
    const series = ANGLES.map(() => []);
    for (const [i, k] of t.at) { const w = frames[i].world[k]; if (w) ANGLES.forEach((a, j) => series[j].push(angle(w, a))); }
    return { id: t.id, cover: t.at.size / frames.length, motion: Math.max(...series.map(s => (sd(s) * 180) / Math.PI)) };
  });
}
export function pickLifterTrack(scores) {
  const ok = scores.filter(s => s.cover >= MIN_COVER);
  const pool = ok.length ? ok : scores;
  return pool.reduce((b, s) => (!b || (ok.length ? s.motion > b.motion : s.cover > b.cover) ? s : b), null);
}

// Rhythm rule (pre-registered in TRIED.md, 18 November 2026, before any run). Constants experimental, UNSOURCED.
export const RHYTHM = { cover: 0.5, gapSec: 0.5, hz: 10, lagMin: 0.8, lagMax: 6, minP: 0.3, tie: 0.1 };
const JOINT_TRIPLES = { elbow: [[11, 13, 15], [12, 14, 16]], knee: [[23, 25, 27], [24, 26, 28]], hip: [[11, 23, 25], [12, 24, 26]], shoulder: [[13, 11, 23], [14, 12, 24]] };
function quantile(xs, q) { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] : 0; }
function series(frames, t, ts, triple) {
  const pts = [];
  for (const [i, k] of t.at) { const w = frames[i].world[k]; if (w) pts.push([ts[i], (angle(w, triple) * 180) / Math.PI, Math.min(...triple.map(j => frames[i].image[k][j].visibility ?? 1))]); }
  return pts.sort((a, b) => a[0] - b[0]);
}
function periodicity(pts) {
  if (pts.length < 4) return 0;
  const dt = 1 / RHYTHM.hz, out = [];
  for (let x = pts[0][0], j = 0; x <= pts.at(-1)[0]; x += dt) {
    while (j < pts.length - 2 && pts[j + 1][0] < x) j++;
    const [t0, a0] = pts[j], [t1, a1] = pts[j + 1];
    out.push(t1 - t0 > RHYTHM.gapSec ? NaN : a0 + ((a1 - a0) * (x - t0)) / Math.max(t1 - t0, 1e-6));
  }
  const n = out.length, xs = out.map((y, i) => [i, y]).filter(([, y]) => !Number.isNaN(y));
  const mx = xs.reduce((s, [i]) => s + i, 0) / xs.length, my = xs.reduce((s, [, y]) => s + y, 0) / xs.length;
  const b = xs.reduce((s, [i, y]) => s + (i - mx) * (y - my), 0) / Math.max(xs.reduce((s, [i]) => s + (i - mx) ** 2, 0), 1e-9);
  const d = out.map((y, i) => (Number.isNaN(y) ? NaN : y - my - b * (i - mx)));
  const ac = lag => { let num = 0, d0 = 0, d1 = 0; for (let i = 0; i + lag < n; i++) { const u = d[i], w = d[i + lag]; if (Number.isNaN(u) || Number.isNaN(w)) continue; num += u * w; d0 += u * u; d1 += w * w; } return d0 && d1 ? num / Math.sqrt(d0 * d1) : 0; };
  let best = 0;
  for (let lag = Math.round(RHYTHM.lagMin * RHYTHM.hz); lag <= Math.round(RHYTHM.lagMax * RHYTHM.hz) && lag < n - 2; lag++) best = Math.max(best, ac(lag));
  return best;
}
// joint: 'elbow' | 'knee' | 'hip' | 'shoulder' (liftDefinition(lift).joint). ts: seconds per frame.
export function pickByRhythm(frames, tracks, ts, joint) {
  const scores = tracks.map(t => {
    const cover = t.at.size / frames.length;
    if (cover < RHYTHM.cover) return { id: t.id, cover, score: 0 };
    const sides = JOINT_TRIPLES[joint].map(tr => series(frames, t, ts, tr));
    const pts = sides[0].length >= sides[1].length ? sides[0] : sides[1];
    const P = periodicity(pts), V = quantile(pts.map(p => p[2]), 0.5);
    const lens = [...t.at].map(([i, k]) => torso(frames[i].image[k]));
    const S = Math.max(0, 1 - (quantile(lens, 0.75) - quantile(lens, 0.25)) / Math.max(quantile(lens, 0.5), 1e-6));
    return { id: t.id, cover, P, V, S, score: P * V * S * cover };
  }).sort((a, b) => b.score - a.score);
  const [a, b] = scores;
  const refused = !a || (a.P ?? 0) < RHYTHM.minP || (b && b.score > 0 && (a.score - b.score) / a.score < RHYTHM.tie);
  return { lifter: refused ? null : a, scores };
}
