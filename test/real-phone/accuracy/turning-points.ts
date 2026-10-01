// A second reading of a joint angle, for diagnosis only: the working-side turning points (minima when the
// lift rests high) whose prominence, how far the signal climbs back on both sides before a deeper point,
// is at least `share` of the angle's own 5th-to-95th percentile range, at least 0.4 s apart. It knows
// nothing of rest or thresholds. Returns their times.
export function turningPoints(a: (number | null)[], ts: number[], restHigh: boolean, share: number): number[] {
  const v: number[] = [], t: number[] = [];
  a.forEach((x, i) => { if (x !== null) { v.push(restHigh ? -x : x); t.push(ts[i]); } });
  if (v.length < 5) return [];
  const sorted = [...v].sort((p, q) => p - q), range = sorted[Math.floor(0.95 * (v.length - 1))] - sorted[Math.floor(0.05 * (v.length - 1))];
  if (!(range > 0)) return [];
  const peaks: { t: number; h: number }[] = [];
  for (let i = 1; i < v.length - 1; i++) {
    if (!(v[i] >= v[i - 1] && v[i] > v[i + 1])) continue;
    let left = v[i], right = v[i];
    for (let j = i - 1; j >= 0 && v[j] <= v[i]; j--) left = Math.min(left, v[j]);
    for (let j = i + 1; j < v.length && v[j] <= v[i]; j++) right = Math.min(right, v[j]);
    if (v[i] - Math.max(left, right) >= share * range) peaks.push({ t: t[i], h: v[i] });
  }
  const kept: { t: number; h: number }[] = [];
  for (const p of peaks) { const last = kept.at(-1); if (last && p.t - last.t < 0.4) { if (p.h > last.h) kept[kept.length - 1] = p; } else kept.push(p); }
  return kept.map(p => p.t);
}
