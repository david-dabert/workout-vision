// node test/real-phone/sure-model/fit.mjs [rows.json]
// Card 056: the logistic check of plan.md, fitted on public half A, cross-validated by video, its threshold chosen by
// plan.md's rule on half A's out-of-fold probabilities, then judged on every other suite of rows.json. Writes
// model.json (weights, scaling, threshold) and report.txt. Bench only; the app imports none of it.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FEATURES = ['shipped', 'tail', 'whole', 'spread', 'recountRefused', 'agree', 'agreeMissing', 'loopBoth', 'loopSame', 'loopRatio', 'pscSame', 'pscConfirm', 'learnedGap', 'learnedMissing', 'logCount'];

/** plan.md's feature vector of one row, in FEATURES' order. */
export function features(r) {
  const b = x => (x ? 1 : 0);
  return [b(r.shipped), b(r.tail), b(r.whole), r.spread ?? 0, b(r.recountRefused), r.agree ?? 0, b(r.agree === null), b(r.loopSame && r.loopSure), b(r.loopSame),
    r.loopRatio === null ? 0 : Math.log1p(Math.max(0, r.loopRatio)), b(r.pscSame), b(r.pscConfirm), r.learnedGap === null ? 0 : Math.abs(r.learnedGap), b(r.learnedGap === null), Math.log1p(r.count)];
}

/** Means and deviations of each column (a constant column keeps deviation 1). */
export function scaling(X) {
  const d = X[0].length, n = X.length, mu = Array(d).fill(0), sd = Array(d).fill(0);
  for (const x of X) x.forEach((v, j) => (mu[j] += v / n));
  for (const x of X) x.forEach((v, j) => (sd[j] += (v - mu[j]) ** 2 / n));
  return { mu, sd: sd.map(v => (v > 1e-12 ? Math.sqrt(v) : 1)) };
}
const sig = z => 1 / (1 + Math.exp(-z));

/** L2-penalized logistic regression by Newton's method; w[0] is the intercept, not penalized. */
export function fitLogistic(X, y, lambda = 1) {
  const d = X[0].length + 1, A = X.map(x => [1, ...x]);
  let w = Array(d).fill(0);
  for (let it = 0; it < 100; it++) {
    const g = Array(d).fill(0), H = Array.from({ length: d }, () => Array(d).fill(0));
    A.forEach((a, i) => {
      const p = sig(a.reduce((s, v, j) => s + v * w[j], 0)), q = p * (1 - p);
      for (let j = 0; j < d; j++) { g[j] += (p - y[i]) * a[j]; for (let k = 0; k < d; k++) H[j][k] += q * a[j] * a[k]; }
    });
    for (let j = 1; j < d; j++) { g[j] += lambda * w[j]; H[j][j] += lambda; }
    const step = solve(H, g);
    w = w.map((v, j) => v - step[j]);
    if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }
  return w;
}
function solve(M, b) {
  const n = b.length, a = M.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = a[r][c] / a[c][c]; for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k]; }
  }
  return a.map((r, i) => r[n] / r[i]);
}
export const predict = (w, sc, x) => sig(w[0] + x.reduce((s, v, j) => s + w[j + 1] * ((v - sc.mu[j]) / sc.sd[j]), 0));
const z = (sc, X) => X.map(x => x.map((v, j) => (v - sc.mu[j]) / sc.sd[j]));

/** Today's gate and the model's, on a list of {err, shipped, p}. */
export function judge(rows, t) {
  const n = rows.length, part = s => ({ n: s.length, share: n ? s.length / n : 0, exact: s.length ? s.filter(r => r.err === 0).length / s.length : 0, bad: s.filter(r => r.err >= 3).length });
  return { today: part(rows.filter(r => !r.shipped)), model: part(rows.filter(r => r.p >= t)) };
}

/** plan.md's threshold rule. */
export function chooseThreshold(rows) {
  const floor = judge(rows, Infinity).today.share - 0.10;
  const cands = [...new Set(rows.map(r => r.p))].sort((a, b) => a - b).map(t => ({ t, ...judge(rows, t).model })).filter(c => c.share >= floor && c.n > 0);
  const best = list => list.reduce((a, c) => (c.exact > a.exact ? c : a), list[0]);
  const clean = cands.filter(c => c.bad === 0);
  return clean.length ? { ...best(clean), clean: true } : { ...best(cands), clean: false };
}

const fold = v => parseInt(createHash('sha256').update('fold:' + v).digest('hex').slice(0, 8), 16) % 5;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = JSON.parse(readFileSync(resolve(HERE, process.argv[2] ?? 'rows.json'), 'utf8'));
  const A = rows.filter(r => r.suite === 'publicA');
  // Cross-validation by video on half A.
  for (let k = 0; k < 5; k++) {
    const tr = A.filter(r => fold(r.video) !== k), te = A.filter(r => fold(r.video) === k);
    const X = tr.map(features), sc = scaling(X), w = fitLogistic(z(sc, X), tr.map(r => (r.err === 0 ? 1 : 0)));
    for (const r of te) r.p = predict(w, sc, features(r));
  }
  const choice = chooseThreshold(A);
  const X = A.map(features), sc = scaling(X), w = fitLogistic(z(sc, X), A.map(r => (r.err === 0 ? 1 : 0)));
  const pct = x => `${(100 * x).toFixed(1)} %`;
  const say = (name, s, t) => {
    const j = judge(s, t), d = j.model.exact - j.today.exact, cov = j.model.share - j.today.share;
    const pass = d >= 0.05 && cov >= -0.10 && j.model.bad === 0;
    return `${name}: counted ${s.length}; today sure ${j.today.n} (${pct(j.today.share)}), exact ${pct(j.today.exact)}, off by 3+ ${j.today.bad}; `
      + `model sure ${j.model.n} (${pct(j.model.share)}), exact ${pct(j.model.exact)}, off by 3+ ${j.model.bad}; `
      + `exact ${d >= 0 ? '+' : ''}${(100 * d).toFixed(1)} points, sure share ${cov >= 0 ? '+' : ''}${(100 * cov).toFixed(1)} points: ${pass ? 'PASS' : 'FAIL'} by the card's rule`;
  };
  const L = [`# Card 056 (fit.mjs, plan.md): logistic check fitted on public half A (${A.length} counted sets), 5 folds by video`,
    `threshold ${choice.t.toFixed(4)} (${choice.clean ? 'no set off by 3+ among the sure on half A out of fold' : 'NO threshold kept every set off by 3+ out on half A; the share condition alone'})`,
    say('public half A, out of fold (chooses the threshold; decides nothing)', A, choice.t)];
  for (const r of rows) if (r.suite !== 'publicA') r.p = predict(w, sc, features(r));
  for (const [suite, name] of [['publicB', 'public half B (judged once)'], ['repcount', 'RepCount-A build (judged once)'], ['david', "David's sets (judged once)"]])
    L.push(say(name, rows.filter(r => r.suite === suite), choice.t));
  L.push('', 'weights on standardized features (intercept first):', `intercept ${w[0].toFixed(3)}`, ...FEATURES.map((f, j) => `${f} ${w[j + 1].toFixed(3)}`));
  writeFileSync(resolve(HERE, 'model.json'), JSON.stringify({ features: FEATURES, w, sc, threshold: choice.t }, null, 1) + '\n');
  writeFileSync(resolve(HERE, 'report.txt'), L.join('\n') + '\n');
  process.stdout.write(L.join('\n') + '\n');
}
