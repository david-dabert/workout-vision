// Paired statistics for a scoreboard section that compares the live core with the counts last accepted (baseline):
// each set is exact before or not, and exact now or not. Pure functions, no file and no clock. Printed only, decides
// nothing: the R2 gate (CLAUDE.md) and its exit code are unchanged. Two outside reviews found that gate alone cannot
// tell a real gain from noise at 14 sets, and recommended these two.
//
// McNemar's test. Source: McNemar Q, "Note on the sampling error of the difference between correlated proportions or
// percentages", Psychometrika 1947;12(2):153-157. Status: literature. Only the sets that changed outcome count:
// b gained (exact now, not before) and c lost (exact before, not now). With no real change each of those b + c sets
// is a gain or a loss with probability 1/2, so the exact (binomial) form is p = min(1, 2 P(X <= min(b, c))),
// X ~ Bin(b + c, 1/2), and p = 1 when b + c = 0. This exact form is conservative on few changed sets (Fagerland MW,
// Lydersen S, Laake P, "The McNemar test for binary matched-pairs data: mid-p and asymptotic are better than exact
// conditional", BMC Med Res Methodol 2013;13:91; status: literature).
//
// Paired bootstrap interval for the change in exact rate. Source: Efron B, Tibshirani RJ, An Introduction to the
// Bootstrap, Chapman & Hall 1993, chapter 13 (percentile interval). Status: literature. The sets are resampled with
// replacement, each keeping its own (before, now) pair, and exact-now minus exact-before is recomputed on each
// resample; the interval is the 2.5th and 97.5th percentiles (nearest rank) of RESAMPLES resamples. On 14 or 15 sets it
// moves in steps of 1/n and is approximate. The 95 % level is a convention (UNSOURCED as a choice).
//
// The generator is mulberry32 (Tommy Ettinger, 2017, public domain), the same as seeded() in
// src/lib/counting/__tests__/synthetic.ts, with a fixed seed: the line is identical on every run. It is a generator, not
// a threshold, and carries no status.

export type Pair = { before: boolean; now: boolean };

export const RESAMPLES = 10_000;
export const SEED = 1;

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Two-sided exact McNemar p for b gained and c lost (non-negative integers). The binomial terms are summed in logs so
// that a section of a thousand sets does not overflow.
export function mcnemarExact(b: number, c: number): number {
  const n = b + c, k = Math.min(b, c);
  if (n === 0) return 1;
  const ln2n = n * Math.LN2;
  let logChoose = 0, tail = 0;
  for (let i = 0; i <= k; i++) {
    if (i > 0) logChoose += Math.log(n - i + 1) - Math.log(i);
    tail += Math.exp(logChoose - ln2n);
  }
  return Math.min(1, 2 * tail);
}

// 95 % paired bootstrap interval for exact-now minus exact-before, as a fraction of the sets: [low, high].
export function bootstrapExactChange(pairs: Pair[], { resamples = RESAMPLES, seed = SEED } = {}): [number, number] {
  const n = pairs.length;
  if (!n) return [0, 0];
  const d = pairs.map(p => Number(p.now) - Number(p.before));
  const rng = mulberry32(seed), sums = new Int32Array(resamples);
  for (let r = 0; r < resamples; r++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += d[Math.floor(rng() * n)];
    sums[r] = s;
  }
  sums.sort();
  // Nearest rank, in whole numbers per thousand so no rounding moves the rank.
  const at = (perMille: number) => sums[Math.min(resamples - 1, Math.max(0, Math.ceil((resamples * perMille) / 1000) - 1))] / n;
  return [at(25), at(975)];
}

// A fraction as signed percentage points, one decimal: +7.1, -3.6, 0.0.
const points = (x: number) => {
  const r = Math.round(x * 1000) / 10;
  return r > 0 ? `+${r.toFixed(1)}` : r < 0 ? r.toFixed(1) : '0.0';
};
const pValue = (p: number) => (p >= 0.01 ? `= ${p.toFixed(2)}` : p >= 0.001 ? `= ${p.toFixed(3)}` : '< 0.001');

// The section's one paired line. `note` says anything particular about the sets paired (printed in the parenthesis).
export function pairedLine(pairs: Pair[], note = ''): string {
  const n = pairs.length;
  const b = pairs.filter(p => p.now && !p.before).length, c = pairs.filter(p => p.before && !p.now).length;
  const [lo, hi] = bootstrapExactChange(pairs);
  return `Paired (paired.ts: exact McNemar test, McNemar 1947; percentile bootstrap of the ${n} sets, ${RESAMPLES} resamples, seed ${SEED}, Efron and Tibshirani 1993${note ? `; ${note}` : ''}; measured, decides nothing): ${b} gained, ${c} lost, McNemar p ${pValue(mcnemarExact(b, c))}; exact-rate change ${points(n ? (b - c) / n : 0)} points, 95 % interval [${points(lo)}, ${points(hi)}].`;
}
