// Card 063, track A (16 November 2026): the kiné comparison (src/lib/reference/compare.js, as the app ships it) against
// the correctness labels of IntelliRehabDS (Miron et al., Data 2021, doi 10.3390/data6050046; Zenodo 4610859, CC BY 4.0).
// The data stays outside the repository: IRDS_DIR=<folder holding SkeletonData/Simplified> node test/real-phone/kine-labels/irds.mjs
//
// Protocol, fixed in cards/063 before any read: per person, movement and position, the first repetition labelled
// correct is the reference; every other repetition of that group is an attempt. The app's verdict ('match' = correct,
// 'revise' = incorrect, 'refused' = no verdict) is set against the label (1 correct; 2 and 3 incorrect). Cohen's kappa
// with a 95 % interval bootstrapped by person; pass at a lower bound of 0.40. Shipped tolerances, nothing tuned.
// Also printed: the separation an ideal threshold could reach (AUC of the worst joint's share within tolerance),
// to tell "the tolerance is wrong" from "the measure carries no signal".
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildReference, compareAttempt } from '../../../src/lib/reference/compare.js';

const DIR = join(process.env.IRDS_DIR ?? '', 'SkeletonData', 'Simplified');
const FPS = 30; // Kinect v2 skeleton stream (IntelliRehabDS paper); compare.js takes timestamps in seconds
// Kinect v2 joints to the MediaPipe indices compare.js reads: shoulders, elbows, wrists, hips.
const MAP = { 11: 4, 13: 5, 15: 6, 12: 8, 14: 9, 16: 10, 23: 12, 24: 16 };

function landmarksOf(text) {
  return text.trim().split('\n').map(line => {
    const v = line.split(',').map(Number);
    const frame = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
    for (const [mp, k] of Object.entries(MAP)) frame[mp] = { x: v[3 * k], y: -v[3 * k + 1], z: v[3 * k + 2], visibility: 1 };
    return frame;
  });
}

const files = readdirSync(DIR).filter(f => f.endsWith('.txt')).map(f => {
  const [subject, , gesture, rep, label, position] = f.replace('.txt', '').split('_');
  return { f, subject, gesture, rep: Number(rep), correct: label === '1', position };
});
const groups = new Map();
for (const x of files) { const k = `${x.subject}|${x.gesture}|${x.position}`; (groups.get(k) ?? groups.set(k, []).get(k)).push(x); }

const rows = [];
for (const list of groups.values()) {
  list.sort((a, b) => a.rep - b.rep);
  const ref = list.find(x => x.correct);
  if (!ref) continue;
  const rl = landmarksOf(readFileSync(join(DIR, ref.f), 'utf8'));
  const reference = buildReference(rl, rl.map((_, i) => i / FPS));
  for (const a of list) {
    if (a === ref) continue;
    const al = landmarksOf(readFileSync(join(DIR, a.f), 'utf8'));
    const r = compareAttempt(reference, al, al.map((_, i) => i / FPS));
    const moving = (r.joints ?? []).filter(j => j.kind === 'moving' || j.within != null);
    const score = moving.length ? Math.min(...moving.map(j => j.within ?? 1)) : null;
    rows.push({ subject: a.subject, gesture: a.gesture, correct: a.correct, verdict: r.verdict, score });
  }
}

function kappa(rs) {
  const j = rs.filter(r => r.verdict !== 'refused');
  if (!j.length) return NaN;
  const n = j.length, pc = j.filter(r => r.correct).length / n, pm = j.filter(r => r.verdict === 'match').length / n;
  const po = j.filter(r => (r.verdict === 'match') === r.correct).length / n;
  const pe = pc * pm + (1 - pc) * (1 - pm);
  return pe === 1 ? NaN : (po - pe) / (1 - pe);
}
function boot(rs, B = 1000) {
  const subjects = [...new Set(rs.map(r => r.subject))], by = new Map(subjects.map(s => [s, rs.filter(r => r.subject === s)]));
  let seed = 63; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const ks = [];
  for (let b = 0; b < B; b++) { const pick = subjects.flatMap(() => by.get(subjects[Math.floor(rnd() * subjects.length)])); const k = kappa(pick); if (Number.isFinite(k)) ks.push(k); }
  ks.sort((a, b) => a - b);
  return [ks[Math.floor(0.025 * ks.length)], ks[Math.floor(0.975 * ks.length)]];
}
function auc(rs) {
  const s = rs.filter(r => r.score != null), pos = s.filter(r => r.correct).map(r => r.score), neg = s.filter(r => !r.correct).map(r => r.score);
  if (!pos.length || !neg.length) return NaN;
  let w = 0; for (const p of pos) for (const q of neg) w += p > q ? 1 : p === q ? 0.5 : 0;
  return w / (pos.length * neg.length);
}
const line = (name, rs) => {
  const j = rs.filter(r => r.verdict !== 'refused');
  const tp = j.filter(r => !r.correct && r.verdict === 'revise').length, inc = j.filter(r => !r.correct).length;
  const fp = j.filter(r => r.correct && r.verdict === 'revise').length, cor = j.filter(r => r.correct).length;
  const [lo, hi] = boot(rs);
  return `${name}: attempts ${rs.length}, refused ${rs.length - j.length}; judged ${j.length} (correct ${cor}, incorrect ${inc}); ` +
    `"À revoir" on incorrect ${tp}/${inc}, on correct ${fp}/${cor}; kappa ${kappa(rs).toFixed(2)} [${lo?.toFixed(2)}, ${hi?.toFixed(2)}]; ideal-threshold AUC ${auc(rs).toFixed(2)}`;
};
console.log(line('All movements', rows));
for (const g of [...new Set(rows.map(r => r.gesture))].sort()) console.log('  ' + line(`movement ${g}`, rows.filter(r => r.gesture === g)));

// Step 2 of the protocol: the tolerance set on half of the people, judged once on the other half. The score is the
// worst moving joint's share of moments within tolerance; "Conforme" when it reaches the threshold. People split by the
// parity of their place in the sorted list of subject ids, fixed before the read.
const people = [...new Set(rows.map(r => r.subject))].sort();
const half = new Map(people.map((p, i) => [p, i % 2 ? 'judged' : 'build']));
const withScore = rows.filter(r => r.score != null);
const at = (rs, t) => rs.map(r => ({ ...r, verdict: r.score >= t ? 'match' : 'revise' }));
const build = withScore.filter(r => half.get(r.subject) === 'build'), judged = withScore.filter(r => half.get(r.subject) === 'judged');
let best = { t: 0, k: -1 };
for (let t = 0; t <= 1.0001; t += 0.02) { const k = kappa(at(build, t)); if (k > best.k) best = { t, k }; }
console.log(`\nTolerance set on the build half (${build.length} attempts, ${people.length / 2} people): threshold ${best.t.toFixed(2)}, kappa there ${best.k.toFixed(2)}`);
console.log(line('Judged half, once, at that threshold', at(judged, best.t)));
