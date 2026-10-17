// Geometry of the comparison screen (ReferenceCompare.jsx): which moment of the reference goes with a moment of the
// patient's video, and where the reference's skeleton falls on the patient's body. Presentation only: no value here
// enters the verdict (compare.js). Status: convention.
import { SAMPLE_HZ } from './compare';

// The body's lines drawn: shoulders, arms, trunk, legs (MediaPipe Pose indices).
export const EDGES = Object.freeze([
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
]);

/** Index of the sample nearest to time t in increasing timestamps. */
export function nearestIndex(timestamps, t) {
  let lo = 0, hi = timestamps.length - 1;
  if (hi < 0) return -1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (timestamps[mid] < t) lo = mid + 1; else hi = mid;
  }
  return lo > 0 && Math.abs(timestamps[lo - 1] - t) <= Math.abs(timestamps[lo] - t) ? lo - 1 : lo;
}

/**
 * From the alignment path ([refIndex, attemptIndex] at SAMPLE_HZ), the reference index for every attempt index
 * (before the matched stretch: the first; after it: the last) and the first attempt index for every reference index.
 */
export function pathMaps(path, attLength) {
  const refOfAtt = new Array(attLength).fill(-1), attOfRef = [];
  for (const [ri, ai] of path) {
    if (refOfAtt[ai] === -1 || ri < refOfAtt[ai]) refOfAtt[ai] = ri;
    if (attOfRef[ri] === undefined) attOfRef[ri] = ai;
  }
  const first = path[0], last = path.at(-1);
  for (let a = 0; a < attLength; a++) {
    if (refOfAtt[a] !== -1) continue;
    refOfAtt[a] = a < first[1] ? first[0] : a > last[1] ? last[0] : refOfAtt[a - 1];
  }
  return { refOfAtt, attOfRef };
}

/** The reference's time for the patient's video time, both on their own clocks. */
export function refTimeFor(tAtt, { attT0, refT0, refOfAtt }) {
  const a = Math.max(0, Math.min(refOfAtt.length - 1, Math.round((tAtt - attT0) * SAMPLE_HZ)));
  return refT0 + refOfAtt[a] / SAMPLE_HZ;
}

const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
const seen = (lm, i) => lm?.[i] && (lm[i].visibility ?? 0) >= 0.3;

/**
 * The reference's skeleton laid on the patient's body, in the patient's pixels: the trunk (mid-shoulders to mid-hips)
 * of each matched by a rotation, a scale and, where it fits the shoulders and hips better, a mirror. When either trunk
 * is seen end-on (shorter than the shoulders are wide: filmed from behind the head, as video 3 and a patient on the
 * floor), its line is too short to turn the skeleton by, and the shoulders are matched instead: the measured arms
 * start there. Null when either trunk is not seen. Status: convention (presentation only).
 */
export function ghostPoints(refLm, refSize, attLm, attSize) {
  if (![11, 12, 23, 24].every(i => seen(refLm, i) && seen(attLm, i))) return null;
  const R = refLm.map(p => ({ x: p.x * refSize.w, y: p.y * refSize.h }));
  const P = attLm.map(p => ({ x: p.x * attSize.w, y: p.y * attSize.h }));
  const len = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
  const endOn = pts => len(mid(pts[11], pts[12]), mid(pts[23], pts[24])) < len(pts[11], pts[12]);
  const [ra, rb, pa, pb] = endOn(R) || endOn(P)
    ? [R[11], R[12], P[11], P[12]]
    : [mid(R[11], R[12]), mid(R[23], R[24]), mid(P[11], P[12]), mid(P[23], P[24])];
  const rl = len(ra, rb), pl = len(pa, pb);
  if (!rl || !pl) return null;
  const s = pl / rl;
  const theta = Math.atan2(pb.y - pa.y, pb.x - pa.x) - Math.atan2(rb.y - ra.y, rb.x - ra.x);
  // Mirror across the anchoring line, for a patient filmed from the other side.
  const ux = (rb.x - ra.x) / rl, uy = (rb.y - ra.y) / rl;
  const mirror = p => {
    const dx = p.x - ra.x, dy = p.y - ra.y, d = dx * ux + dy * uy;
    return { x: ra.x + 2 * d * ux - dx, y: ra.y + 2 * d * uy - dy };
  };
  const place = p => {
    const dx = (p.x - ra.x) * s, dy = (p.y - ra.y) * s;
    return { x: pa.x + dx * Math.cos(theta) - dy * Math.sin(theta), y: pa.y + dx * Math.sin(theta) + dy * Math.cos(theta) };
  };
  const plain = R.map(place), mirrored = R.map(p => place(mirror(p)));
  const misfit = pts => [11, 12, 23, 24].reduce((sum, i) => sum + Math.hypot(pts[i].x - P[i].x, pts[i].y - P[i].y), 0);
  return misfit(mirrored) < misfit(plain) ? mirrored : plain;
}
