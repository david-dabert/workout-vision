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
