// A second signal for diagnosis only: the set's main direction of movement across the joints of the upper
// and lower body, both sides (PCA of their positions relative to the mid-hip, in torso lengths), signed
// so that it moves with the lift's own joint angle. It does not depend on which arm is seen or on the
// camera's angle. Not used by the app.
const JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

export function pcaSignal(wl: any[], angle: (number | null)[]): (number | null)[] {
  const rows: (number[] | null)[] = wl.map(f => {
    if (!f) return null;
    const hip = [0, 1, 2].map(k => ((f[23] ? [f[23].x, f[23].y, f[23].z][k] : 0) + (f[24] ? [f[24].x, f[24].y, f[24].z][k] : 0)) / 2);
    const sh = [0, 1, 2].map(k => ((f[11] ? [f[11].x, f[11].y, f[11].z][k] : 0) + (f[12] ? [f[12].x, f[12].y, f[12].z][k] : 0)) / 2);
    const torso = Math.hypot(sh[0] - hip[0], sh[1] - hip[1], sh[2] - hip[2]) || 1;
    const out: number[] = [];
    for (const j of JOINTS) { const p = f[j]; if (!p) return null; out.push((p.x - hip[0]) / torso, (p.y - hip[1]) / torso, (p.z - hip[2]) / torso); }
    return out;
  });
  const ok = rows.filter((r): r is number[] => !!r);
  if (ok.length < 10) return rows.map(() => null);
  const d = ok[0].length, mean = Array(d).fill(0);
  for (const r of ok) r.forEach((x, k) => (mean[k] += x / ok.length));
  // First principal component by power iteration on the covariance.
  const cov = Array.from({ length: d }, () => Array(d).fill(0));
  for (const r of ok) for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) cov[i][j] += ((r[i] - mean[i]) * (r[j] - mean[j])) / ok.length;
  let v = Array(d).fill(1 / Math.sqrt(d));
  for (let it = 0; it < 100; it++) { const w = cov.map(row => row.reduce((a, x, k) => a + x * v[k], 0)); const n = Math.hypot(...w) || 1; v = w.map(x => x / n); }
  const raw = rows.map(r => (r ? r.reduce((a, x, k) => a + (x - mean[k]) * v[k], 0) : null));
  // Smoothed over five samples (a third of a second), then signed to move with the joint angle.
  const sm = raw.map((_, i) => { const w = raw.slice(Math.max(0, i - 2), i + 3).filter((x): x is number => x !== null); return raw[i] === null || !w.length ? null : w.reduce((a, b) => a + b, 0) / w.length; });
  // The sign from the covariance over the frames both hold, each series centred there: an uncentred sum
  // follows the angle's mean and which frames are missing, not the movement (review, 30 September).
  const both = sm.map((x, i) => [x, angle[i]] as const).filter((p): p is readonly [number, number] => p[0] !== null && p[1] !== null);
  const mx = both.reduce((t, p) => t + p[0], 0) / (both.length || 1), ma = both.reduce((t, p) => t + p[1], 0) / (both.length || 1);
  const c = both.reduce((t, [x, a]) => t + (x - mx) * (a - ma), 0);
  return c < 0 ? sm.map(x => (x === null ? null : -x)) : sm;
}
