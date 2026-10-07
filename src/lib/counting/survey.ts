// Five counting techniques from a research survey (7 October 2026), each behind its own constant and measured on its
// own (TRIED.md, 7 October). Pure helpers here; core.ts calls them where each applies. A technique is on only when
// its constant says so; the benches may override any of them (globalThis.__WV_CORE_BENCH__, e.g. { zWeight: 0.5 },
// set by variant-eval.test.ts and occlusion.test.ts from WV_CORE_BENCH); the app never sets it.

// T3. Depth (z) weight in a joint angle. MediaPipe's world z is its least reliable axis; ML Kit's pose classifier
// sample weights the axes (1, 1, 0.2) when it compares poses (googlesamples/mlkit, android/vision-quickstart,
// posedetector/classification/PoseClassifier.java, AXES_WEIGHTS; Apache 2.0, 2020); there it weights landmark
// distances for classification, not joint angles. Applied only to sets read as filmed from the side, where the joints this
// app counts bend mostly in the image plane; from the front a squat or curl bends in depth, so W stays 1 there.
// Source: ML Kit's sample above (the weight transferred to angles is ours). Status: experimental, measured here
// (TRIED.md); off.
export const Z_WEIGHT = 1;
// A set reads as side view when, by median over its seen samples, the shoulder line points this share or more into
// depth: |dz| / hypot(dx, dz) of left to right shoulder. Source: UNSOURCED (geometry: 0 facing the camera, 1 side
// on). Status: experimental.
export const SIDE_VIEW_DEPTH_SHARE = 0.6;

// T2. Inner dropouts up to the bridge's 0.5 s filled by a straight line between the samples on either side, not by
// the last value repeated (the trailing edge of a set keeps the repeat: nothing after it to aim at).
// Source: convention (linear interpolation of short gaps). Status: experimental; off.
export const BRIDGE_INTERPOLATE = false;

// T1. A missing sample of the counted angle filled from the other side's same angle, scaled by a straight line fitted
// on the samples where both are seen, when the two correlate at |r| >= FILL_MIN_R on this set. Filled samples do not
// count as seen (coverage, pose doubt, speeds). Not for lifts counted on both sides (each side is its own count).
// Source: UNSOURCED (the survey's cross-signal imputation). Status: experimental; off.
export const FILL_FROM_PARTNER = false;
export const FILL_MIN_R = 0.8;
// At least this many samples seen on both sides to fit the line. Source: UNSOURCED. Status: experimental.
export const FILL_MIN_PAIRS = 15;

// T4. A doubtful edge or split candidate counts when its shape matches the set's own reps: template = the median of
// the accepted reps resampled to SHAPE_POINTS (oriented and normalised by the set's threshold span), dynamic time
// warping with a Sakoe-Chiba band of SHAPE_BAND, accepted at a distance of at most SHAPE_SLACK x the largest accepted
// rep's own distance; at least SHAPE_MIN_REPS accepted reps. Candidates: a last rep cut short of the cut rule
// (CUT_RETURN_SHARE; compared with the start of the template on the same time scale), a first rep whose return the
// head rule refused (the end of the template), an overlong rep whose in-set return fell short of the split rule (both
// pieces whole). Source: Sakoe & Chiba 1978 (DTW with a band); the values UNSOURCED (the survey's). Status:
// experimental. Measured 7 October (TRIED.md): all three candidates together lose 2 exact on the public half B
// (235 -> 233); the head alone loses 2 on B, the split alone 1 on A; the cut alone passes (David 12 -> 14, A 255 ->
// 258, B 235 -> 235, synthetic 74 -> 74, none newly off by 3), but it breaks two pinned unit tests (context.test.ts:
// a press's softer last lockouts read 11 for 10; lunge-together.test.ts: knees in opposition read 7 for 6) and moves
// two synthetic occlusion sets off exact (25 against 27). Off. The per-part split was chosen after reading both
// halves (disclosed in TRIED.md).
export const SHAPE_EDGES = false;
export const SHAPE_HEAD = false;
export const SHAPE_CUT = true;
export const SHAPE_SPLIT = false;
export const SHAPE_POINTS = 24;
export const SHAPE_BAND = 4;
export const SHAPE_SLACK = 1.2;
export const SHAPE_MIN_REPS = 3;

// T5. Alternating lifts: on a both-sides lift whose two sides' smoothed angles correlate below ALT_MAX_R (one bends
// while the other rests), the reps are counted on the left minus right difference, each excursion one rep (one full
// cycle of the difference is two reps). Source: UNSOURCED (the survey). Status: experimental; off.
export const ALT_DIFF = false;
export const ALT_MAX_R = -0.3;

type Bench = { zWeight?: number; interpolate?: boolean; fill?: boolean; shape?: boolean; altDiff?: boolean; sideShare?: number; fillR?: number; shapeSlack?: number; altR?: number; zAll?: boolean; shapeParts?: string };
const bench = (): Bench => ((globalThis as unknown as { __WV_CORE_BENCH__?: Bench }).__WV_CORE_BENCH__ ?? {});
export const zWeight = () => bench().zWeight ?? Z_WEIGHT;
export const zAllViews = () => bench().zAll ?? false;
export const sideShare = () => bench().sideShare ?? SIDE_VIEW_DEPTH_SHARE;
export const interpolateOn = () => bench().interpolate ?? BRIDGE_INTERPOLATE;
export const fillOn = () => bench().fill ?? FILL_FROM_PARTNER;
export const fillMinR = () => bench().fillR ?? FILL_MIN_R;
export const shapeOn = () => bench().shape ?? SHAPE_EDGES;
export const shapeSlack = () => bench().shapeSlack ?? SHAPE_SLACK;
// Which T4 candidates are judged: h (head), c (cut), s (split); a bench may name them (shapeParts: 'hcs').
const SHAPE_PARTS = `${SHAPE_HEAD ? 'h' : ''}${SHAPE_CUT ? 'c' : ''}${SHAPE_SPLIT ? 's' : ''}`;
export const shapePart = (k: 'h' | 'c' | 's') => (bench().shapeParts ?? SHAPE_PARTS).includes(k);
export const altDiffOn = () => bench().altDiff ?? ALT_DIFF;
export const altMaxR = () => bench().altR ?? ALT_MAX_R;

type P = { x: number; y: number; z: number } | null | undefined;
/** Median share of the shoulder line pointing into depth over the seen samples (0 facing the camera, 1 side on); NaN when never seen. */
export function depthShare(frames: ({ x: number; y: number; z: number }[] | null)[]): number {
  const xs: number[] = [];
  for (const f of frames) {
    const a: P = f?.[11], b: P = f?.[12];
    if (!a || !b) continue;
    const dx = b.x - a.x, dz = b.z - a.z, h = Math.hypot(dx, dz);
    if (h > 1e-6) xs.push(Math.abs(dz) / h);
  }
  if (!xs.length) return NaN;
  xs.sort((p, q) => p - q);
  return xs[Math.floor(xs.length / 2)];
}

/** Least-squares line y = a + b x and Pearson r over the indices where both are numbers. */
export function fitLine(x: (number | null)[], y: (number | null)[]): { a: number; b: number; r: number; n: number } {
  let n = 0, sx = 0, sy = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== null && y[i] !== null) { n++; sx += x[i]!; sy += y[i]!; }
  if (n < 3) return { a: 0, b: 0, r: 0, n };
  const mx = sx / n, my = sy / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== null && y[i] !== null) { const dx = x[i]! - mx, dy = y[i]! - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  if (!(sxx > 0) || !(syy > 0)) return { a: my, b: 0, r: 0, n };
  const b = sxy / sxx;
  return { a: my - b * mx, b, r: sxy / Math.sqrt(sxx * syy), n };
}

/** values[from..to] (nulls skipped) resampled by time to `points` values, linearly; null when under two values. */
export function resample(values: (number | null)[], timestamps: number[], from: number, to: number, points: number): number[] | null {
  const t: number[] = [], v: number[] = [];
  for (let i = from; i <= to; i++) if (values[i] !== null) { t.push(timestamps[i]); v.push(values[i]!); }
  if (t.length < 2 || !(t[t.length - 1] > t[0])) return null;
  const out: number[] = [];
  let k = 0;
  for (let p = 0; p < points; p++) {
    const tt = t[0] + ((t[t.length - 1] - t[0]) * p) / Math.max(1, points - 1);
    while (k < t.length - 2 && t[k + 1] < tt) k++;
    const f = t[k + 1] > t[k] ? (tt - t[k]) / (t[k + 1] - t[k]) : 0;
    out.push(v[k] + Math.max(0, Math.min(1, f)) * (v[k + 1] - v[k]));
  }
  return out;
}

/** DTW distance (absolute differences, mean per step of the path's length bound) with a Sakoe-Chiba band; Infinity if the band cannot join the ends. */
export function dtw(a: number[], b: number[], band: number): number {
  const n = a.length, m = b.length;
  const w = Math.max(band, Math.abs(n - m));
  const D: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(Infinity));
  D[0][0] = 0;
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(1, i - w); j <= Math.min(m, i + w); j++) {
      const c = Math.abs(a[i - 1] - b[j - 1]);
      D[i][j] = c + Math.min(D[i - 1][j], D[i][j - 1], D[i - 1][j - 1]);
    }
  }
  return D[n][m] / Math.max(n, m);
}

/** Pointwise median of equal-length series. */
export function medianSeries(series: number[][]): number[] {
  const len = series[0].length, out: number[] = [];
  for (let p = 0; p < len; p++) {
    const col = series.map(s => s[p]).sort((x, y) => x - y), m = Math.floor(col.length / 2);
    out.push(col.length % 2 ? col[m] : (col[m - 1] + col[m]) / 2);
  }
  return out;
}
