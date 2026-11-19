// Card 065's rule, failed on 19 November 2026 (TRIED.md): kept here as the bench's, read by no screen.
// Card 065 (19 November 2026): the share of the median counted rep's range that a cycle outside the counted reps must
// rise and return by. Source: card 039's prominence for shallow cycles before the first rep (TRIED.md, 15 November
// 2026), taken as it is. Status: experimental.
export const UNCOUNTED_CYCLE_SHARE = 0.4;
// The cycles outside the counted reps from which the result screen asks. One can be the set-up or the rack.
// Source: UNSOURCED. Status: convention (card 065, fixed before its first run).
export const UNCOUNTED_CYCLES_ASK = 2;

/**
 * Full cycles of the counted joint angle outside every counted rep (card 065): on the core's smoothed angle, with at
 * least 2 counted reps, R is the median range of a counted rep, the rep's direction away from rest is read from the
 * reps, and in each run of samples outside the reps a cycle is a rise of UNCOUNTED_CYCLE_SHARE x R from the running low
 * and a return of as much from the running high (lost samples skipped; a cycle cut by the run's edge does not count).
 * Two kinds of error show it on the public build sets (card 065's diagnosis): a shallow dip between deep ones left out (Countix
 * push-up, 5 for 11) and cycles before the first counted rep (MM-Fit dumbbell row, 6 for 10). It asks, never counts:
 * counting such cycles was closed twice (TRIED.md, cards 003 and 039). Returns 0 when it cannot be read.
 */
export function uncountedCycles(angles, timestamps, reps) {
  if (!Array.isArray(angles) || !Array.isArray(timestamps) || !Array.isArray(reps) || reps.length < 2 || angles.length !== timestamps.length) return 0;
  const median = xs => { const v = [...xs].sort((a, b) => a - b); const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const ranges = [], down = [], up = [];
  for (const r of reps) {
    let lo = Infinity, hi = -Infinity, start = null;
    for (let i = 0; i < angles.length; i++) {
      if (timestamps[i] < r.startTime || timestamps[i] > r.endTime || angles[i] === null) continue;
      if (start === null) start = angles[i];
      lo = Math.min(lo, angles[i]); hi = Math.max(hi, angles[i]);
    }
    if (start === null) continue;
    ranges.push(hi - lo); down.push(start - lo); up.push(hi - start);
  }
  if (ranges.length < 2) return 0;
  const step = UNCOUNTED_CYCLE_SHARE * median(ranges);
  if (!(step > 0)) return 0;
  const sign = median(down) >= median(up) ? -1 : 1;  // deeper is higher on the oriented angle
  const inRep = t => reps.some(r => t >= r.startTime && t <= r.endTime);
  let cycles = 0, high = false, low = null, peak = null;
  for (let i = 0; i <= angles.length; i++) {
    if (i === angles.length || inRep(timestamps[i])) { high = false; low = null; peak = null; continue; }  // a run ends
    if (angles[i] === null) continue;
    const v = sign * angles[i];
    if (!high) { if (low === null || v < low) low = v; else if (v - low >= step) { high = true; peak = v; } }
    else if (v > peak) peak = v;
    else if (peak - v >= step) { cycles++; high = false; low = v; }
  }
  return cycles;
}
