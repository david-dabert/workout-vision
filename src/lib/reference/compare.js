// A patient's attempt compared with a physiotherapist's reference video (Olivier's exercises, 15 October 2026).
// The reference is a sequence of positions with holds, not a set of repetitions: the counter does not apply. Both
// videos become joint-angle curves; the attempt is aligned in time to the reference (dynamic time warping, so the
// patient need not move at the reference's speed, and may start and stop filming whenever); then each joint is
// compared at every moment of the reference.
//
// R8: a joint the attempt does not show well enough gives no verdict (refused), never a guess.
// R9: every tolerance below is experimental and UNSOURCED until measured on patients' attempts; the clinical tolerance
// is the physiotherapist's to set (15 October 2026), not ours.

// Joints read, by MediaPipe Pose index (11/12 shoulders, 13/14 elbows, 15/16 wrists, 23/24 hips): the angle at the
// middle point. Shoulder: hip-shoulder-elbow (flexion or abduction of the arm against the trunk). Elbow:
// shoulder-elbow-wrist (straight = 180 degrees).
export const JOINTS = Object.freeze({
  leftShoulder: [23, 11, 13],
  rightShoulder: [24, 12, 14],
  leftElbow: [11, 13, 15],
  rightElbow: [12, 14, 16],
});

// A landmark is seen at the counting core's floor (core.ts VIS_THRESHOLD). Source: the core's rule. Status: convention.
export const SEEN_VISIBILITY = 0.5;
// The curves are compared at 10 samples a second: holds and slow raises (the reference's fastest move takes about
// 1 s) keep their shape, and the alignment table stays small (a 60 s reference against a 90 s attempt: 600 x 900).
// Source: the four reference videos' pace. Status: convention.
export const SAMPLE_HZ = 10;
// A reference joint is used only if seen on this share of the reference: below, its curve is the pose model's
// guess (the far arm of video 1 jumps from 17 to 133 degrees in one second). Status: experimental, UNSOURCED.
export const REFERENCE_SEEN_SHARE = 0.8;
// The attempt must show each used joint on this share of its matched stretch, or no verdict. Status: experimental,
// UNSOURCED (the core's own refusal floor is one half; a verdict on form asks more).
export const ATTEMPT_SEEN_SHARE = 0.7;
// A joint that moves through at least this range in the reference is "moving"; under it, "held" (an elbow kept
// straight). Status: experimental, UNSOURCED.
export const MOVING_RANGE_DEG = 20;
// Verdict tolerances: 90 % of the moments within this many degrees of the reference, and the moving range reached
// to this share. Status: experimental, UNSOURCED; to be set with the physiotherapist.
export const TOLERANCE_DEG = 15;
export const TOLERANCE_SHARE = 0.9;
export const MIN_RANGE_SHARE = 0.85;

// Angles in the picture plane (image landmarks, x scaled by the picture's width over its height), not in MediaPipe's
// 3D world space: for a person lying down its depth is unreliable (video 4's arms overhead read 155 degrees in 3D,
// about 178 in the picture, which shows them flat on the table). The patient films from the reference's angle, so
// the two pictures' angles compare. Source: the four reference videos, read frame by frame on 15 October 2026.
// Status: experimental. Without an aspect, world landmarks and 3D angles (for callers that hold only those).
function angleAt(a, b, c, aspect) {
  const z = aspect ? 0 : 1, k = aspect ?? 1;
  const v1 = [(a.x - b.x) * k, a.y - b.y, (a.z - b.z) * z];
  const v2 = [(c.x - b.x) * k, c.y - b.y, (c.z - b.z) * z];
  const n = Math.hypot(...v1) * Math.hypot(...v2);
  if (!n) return null;
  const cos = (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / n;
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/** Raw angle of each joint per sample, null where a point of it is unseen; `aspect` = width / height of the picture. */
export function jointAngles(landmarks, { joints = JOINTS, aspect } = {}) {
  const out = {};
  for (const [name, [a, b, c]] of Object.entries(joints)) {
    out[name] = landmarks.map(lm => {
      if (!lm || [a, b, c].some(i => (lm[i]?.visibility ?? 0) < SEEN_VISIBILITY)) return null;
      return angleAt(lm[a], lm[b], lm[c], aspect);
    });
  }
  return out;
}

/** Values at SAMPLE_HZ from (time, value|null) samples; a gap over 0.5 s stays null. */
export function resample(timestamps, values, hz = SAMPLE_HZ) {
  if (!timestamps.length) return [];
  const t0 = timestamps[0];
  const n = Math.floor((timestamps.at(-1) - t0) * hz) + 1;
  const out = new Array(n).fill(null);
  let j = 0;
  for (let k = 0; k < n; k++) {
    const t = t0 + k / hz;
    while (j < timestamps.length - 2 && timestamps[j + 1] <= t) j++;
    const ta = timestamps[j], tb = timestamps[j + 1] ?? ta;
    const va = values[j], vb = values[j + 1] ?? va;
    if (va == null || vb == null || tb - ta > 0.5) out[k] = va ?? vb ?? null;
    else out[k] = tb === ta ? va : va + ((vb - va) * (t - ta)) / (tb - ta);
  }
  return out;
}

/** Median of 5 over seen values (removes one-sample jumps of the pose model). */
export function median5(values) {
  return values.map((v, i) => {
    if (v == null) return null;
    const w = values.slice(Math.max(0, i - 2), i + 3).filter(x => x != null).sort((a, b) => a - b);
    return w[Math.floor(w.length / 2)];
  });
}

const seenShare = values => (values.length ? values.filter(v => v != null).length / values.length : 0);

/** Unseen samples filled by a straight line between the seen ones around them (the ends repeat the nearest seen). */
export function fillGaps(values) {
  const seen = [];
  values.forEach((v, i) => { if (v != null) seen.push(i); });
  if (!seen.length) return values.slice();
  return values.map((v, i) => {
    if (v != null) return v;
    const after = seen.findIndex(s => s > i);
    if (after === -1) return values[seen.at(-1)];
    if (after === 0) return values[seen[0]];
    const a = seen[after - 1], b = seen[after];
    return values[a] + ((values[b] - values[a]) * (i - a)) / (b - a);
  });
}

function percentile(values, p) {
  const s = values.filter(v => v != null).sort((a, b) => a - b);
  if (!s.length) return null;
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
}

const range = values => percentile(values, 0.95) - percentile(values, 0.05);

/** Smoothed curves at SAMPLE_HZ of every joint, from a video's landmarks (see jointAngles for the options). */
export function curves(landmarks, timestamps, options = {}) {
  const raw = jointAngles(landmarks, options);
  const out = {};
  for (const [name, values] of Object.entries(raw)) out[name] = median5(resample(timestamps, values));
  return out;
}

/**
 * The reference model: the joints the reference shows well enough, each "moving" or "held", with its curve.
 * Returns { joints: [{ name, kind, range, curve }], duration, unused: [{ name, seenShare }] }.
 */
export function buildReference(landmarks, timestamps, options = {}) {
  return referenceFromCurves(curves(landmarks, timestamps, options));
}

export function referenceFromCurves(curveByJoint) {
  const used = [], unused = [];
  let length = 0;
  for (const [name, curve] of Object.entries(curveByJoint)) {
    length = Math.max(length, curve.length);
    const share = seenShare(curve);
    if (share < REFERENCE_SEEN_SHARE) { unused.push({ name, seenShare: share }); continue; }
    const r = range(curve);
    used.push({ name, kind: r >= MOVING_RANGE_DEG ? 'moving' : 'held', range: r, curve: fillGaps(curve) });
  }
  return { joints: used, duration: length / SAMPLE_HZ, unused };
}

/**
 * Subsequence dynamic time warping: the whole reference against any stretch of the attempt (the attempt may hold
 * extra footage before and after). Cost: mean absolute angle difference over the joints. Returns the path as
 * [refIndex, attemptIndex] pairs.
 */
export function align(refCurves, attCurves) {
  const n = refCurves[0].length, m = attCurves[0].length, J = refCurves.length;
  const cost = (i, j) => {
    let s = 0;
    for (let k = 0; k < J; k++) s += Math.abs(refCurves[k][i] - attCurves[k][j]);
    return s / J;
  };
  const D = Array.from({ length: n }, () => new Float64Array(m));
  const B = Array.from({ length: n }, () => new Uint8Array(m)); // 0 diagonal, 1 from above, 2 from left
  for (let j = 0; j < m; j++) D[0][j] = cost(0, j);
  for (let i = 1; i < n; i++) {
    D[i][0] = D[i - 1][0] + cost(i, 0); B[i][0] = 1;
    for (let j = 1; j < m; j++) {
      const d = D[i - 1][j - 1], u = D[i - 1][j], l = D[i][j - 1];
      if (d <= u && d <= l) { D[i][j] = d + cost(i, j); B[i][j] = 0; }
      else if (u <= l) { D[i][j] = u + cost(i, j); B[i][j] = 1; }
      else { D[i][j] = l + cost(i, j); B[i][j] = 2; }
    }
  }
  let j = 0;
  for (let k = 1; k < m; k++) if (D[n - 1][k] < D[n - 1][j]) j = k;
  const path = [];
  let i = n - 1;
  while (i >= 0) {
    path.push([i, j]);
    if (i === 0) break;
    const b = B[i][j];
    if (b === 0) { i--; j--; } else if (b === 1) i--; else j--;
  }
  return path.reverse();
}

/**
 * Compares an attempt's curves with the reference model.
 * Returns { verdict: 'match' | 'revise' | 'refused', reasons, joints, start, end, tempo } where joints holds, per
 * joint, the share of moments within tolerance, the 90th percentile gap, the range reached, and the moment of the
 * reference where the gap is largest.
 */
export function compareCurves(reference, attemptCurves) {
  const reasons = [];
  if (!reference.joints.length) return { verdict: 'refused', reasons: ['reference-unseen'], joints: [] };
  for (const j of reference.joints) {
    if (!attemptCurves[j.name] || seenShare(attemptCurves[j.name]) < ATTEMPT_SEEN_SHARE) reasons.push(`unseen:${j.name}`);
  }
  if (reasons.length) return { verdict: 'refused', reasons, joints: [] };
  const ref = reference.joints.map(j => j.curve);
  const att = reference.joints.map(j => fillGaps(attemptCurves[j.name]));
  const path = align(ref, att);
  const start = path[0][1], end = path.at(-1)[1];
  // The attempt's value at each moment of the reference: the mean of the attempt samples matched to it.
  const matchedByJoint = ref.map((curve, k) => {
    const sums = new Float64Array(curve.length), counts = new Uint16Array(curve.length);
    for (const [ri, ai] of path) { sums[ri] += att[k][ai]; counts[ri]++; }
    return Array.from(sums, (s, i) => s / counts[i]);
  });
  const joints = reference.joints.map((j, k) => {
    const matched = matchedByJoint[k];
    const gaps = matched.map((v, i) => Math.abs(v - ref[k][i]));
    const within = gaps.filter(g => g <= TOLERANCE_DEG).length / gaps.length;
    let worst = 0;
    for (let i = 1; i < gaps.length; i++) if (gaps[i] > gaps[worst]) worst = i;
    const rangeShare = j.kind === 'moving' ? range(matched) / j.range : null;
    return {
      name: j.name, kind: j.kind, within, gapP90: percentile(gaps, 0.9), rangeShare,
      worst: { atSec: worst / SAMPLE_HZ, reference: ref[k][worst], attempt: matched[worst] },
    };
  });
  for (const j of joints) {
    if (j.within < TOLERANCE_SHARE) reasons.push(`off:${j.name}`);
    if (j.kind === 'moving' && j.rangeShare < MIN_RANGE_SHARE) reasons.push(`range:${j.name}`);
  }
  return {
    verdict: reasons.length ? 'revise' : 'match', reasons, joints,
    start: start / SAMPLE_HZ, end: end / SAMPLE_HZ,
    tempo: (end - start + 1) / ref[0].length,
    path,
    reference: reference.joints.map(j => j.curve),
    matched: matchedByJoint,
    holds: holds(reference, att, path),
  };
}

// A hold: the reference's main joint (its largest range) moving under this speed for at least this long. Source: the
// four reference videos (their holds last 2 to 5 s, their raises 1 to 3 s). Status: experimental, UNSOURCED.
export const HOLD_SPEED_DEG_S = 10;
export const HOLD_MIN_SEC = 1;
// A hold is kept when the attempt's angle is within TOLERANCE_DEG of the reference's and it lasts this share of the
// reference's time. Status: experimental, UNSOURCED; to be set with the physiotherapist.
export const HOLD_TIME_SHARE = 0.8;

/**
 * The positions the reference holds, each with what the attempt did at the same moment: the reference's angle and
 * time held, the attempt's mean angle and the time its matched samples span.
 */
export function holds(reference, attCurves, path) {
  const moving = reference.joints.map((j, k) => [j, k]).filter(([j]) => j.kind === 'moving');
  if (!moving.length) return [];
  const [main, k] = moving.reduce((a, b) => (b[0].range > a[0].range ? b : a));
  const c = main.curve, a = attCurves[k];
  // Speed over 0.6 s, centred: one-sample jitter of the pose model is not movement.
  const h = 3;
  const stillOf = curve => curve.map((_, i) => {
    const x = curve[Math.max(0, i - h)], y = curve[Math.min(curve.length - 1, i + h)];
    return (Math.abs(y - x) * SAMPLE_HZ) / (2 * h) < HOLD_SPEED_DEG_S;
  });
  const still = stillOf(c), attStill = stillOf(a);
  const out = [];
  for (let i = 0; i < c.length;) {
    if (!still[i]) { i++; continue; }
    let e = i;
    while (e + 1 < c.length && still[e + 1]) e++;
    if ((e - i + 1) / SAMPLE_HZ >= HOLD_MIN_SEC) {
      const ai = path.filter(([ri]) => ri >= i && ri <= e).map(([, x]) => x).sort((x, y) => x - y);
      const attAngle = ai.reduce((sum, x) => sum + a[x], 0) / ai.length;
      // The attempt's own hold: from the middle of its matched samples, as far as it stays still. The alignment
      // gives a long hold's extra samples to the reference's moments around it, so its span alone would hide them.
      let lo = ai[Math.floor(ai.length / 2)], hi = lo;
      if (attStill[lo]) {
        while (lo > 0 && attStill[lo - 1]) lo--;
        while (hi + 1 < a.length && attStill[hi + 1]) hi++;
      }
      out.push({
        joint: main.name,
        startSec: i / SAMPLE_HZ,
        refSec: (e - i + 1) / SAMPLE_HZ,
        refAngle: c.slice(i, e + 1).reduce((sum, v) => sum + v, 0) / (e - i + 1),
        attSec: attStill[lo] ? (hi - lo + 1) / SAMPLE_HZ : 0,
        attAngle,
      });
      const hold = out.at(-1);
      hold.status = Math.abs(hold.attAngle - hold.refAngle) > TOLERANCE_DEG ? 'angle'
        : hold.attSec < hold.refSec * HOLD_TIME_SHARE ? 'short' : 'held';
    }
    i = e + 1;
  }
  return out;
}

/** Attempt landmarks against a reference model (the same kind of landmarks and options as the reference's). */
export function compareAttempt(reference, landmarks, timestamps, options = {}) {
  return compareCurves(reference, curves(landmarks, timestamps, options));
}
