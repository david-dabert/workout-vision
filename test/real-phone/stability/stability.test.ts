// STABILITY=1 npx vitest run --no-cache test/real-phone/stability/stability.test.ts
// [STABILITY_READS=<folder of re-encoded reads>] [STABILITY_K=5]
// How stable the counter is under re-encoding (stability study of 10 October 2026: David's 14 videos read by the app
// from six encodings of the same originals were exact on 6, 5, 3, 1, 2 and 3; exact on all six: 1 of 14). A count
// that moves when an invisible re-encoding moves the landmarks is a count the app cannot measure reliably (R8).
// Four measures, reported beside R2 (npm run scoreboard), deciding nothing:
//  1. The noise proxy (noise.mjs, fitted on the 14 videos; intensity 0.5 reproduces the spread of counts between real
//     reads) on David's stored sets and the public build sets, seeds 1..K: the exact count that decides on the clean
//     read and on each seed, the sets whose count moves on any seed, and how many sets are exact on every seed.
//  2. With STABILITY_READS: the real re-encodings, one subfolder per encoding (the committed reads in
//     test/real-phone/sets-07oct-video/ are always the first column): each video's outcome per encoding.
//  3. The sensitivity check (coreAnalysis.js withSensitivity): on the public counted sets that decide, how many it marks,
//     how many of those are wrong and exact, and how many of the counts off by 3 or more it catches; on the real
//     re-encodings, how many reads show a wrong count as sure with it and without it.
//  4. With STABILITY_READS, the gate read as a measuring instrument (research of 10 October 2026, after Hopkins 2000,
//     "Measures of reliability in sports medicine and science", Sports Med 30:1-15; status: literature): the encodings
//     are repeated trials of the same sets. Typical error = the within-video standard deviation of the counts, pooled
//     over the videos counted on every encoding; MDC95 = 1.96 x sqrt(2) x typical error, the smallest change of one
//     set's count the gate can tell from encoding noise; pairwise agreement = the share of pairs of encodings giving a
//     video the same outcome (two identical wrist counters on one wrist agreed on 59.6 % of sets: core.ac.uk 66904384).
// Writes stability.txt. Research tool: it changes nothing and gates nothing.
import { test } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount, withProposal, withSensitivity } from '../../../src/lib/coreAnalysis';
import { countInWindow, decides, labelledSets, publicSets, ROOT } from '../accuracy/sets';
// @ts-expect-error: a JavaScript test module without types
import { perturbSet } from './noise.mjs';

const K = Number(process.env.STABILITY_K || 5);
type Item = { name: string; lift: string; label: number; wl: any[]; ts: number[]; window?: [number, number] };
const outcome = (it: Item, wl: any[], ts: number[]): number | 'R' => {
  const c: any = summarizeCount(wl, ts, it.lift);
  if (c.refused) return 'R';
  return it.window ? countInWindow(c.reps ?? [], it.window) : c.count;
};

function proxy(title: string, items: Item[]) {
  const rows = items.map(it => {
    const clean = outcome(it, it.wl, it.ts);
    const pert = Array.from({ length: K }, (_, s) => { const p = perturbSet({ worldLandmarks: it.wl, timestamps: it.ts }, { seed: s + 1 }); return outcome(it, p.worldLandmarks, p.timestamps); });
    return { it, clean, pert };
  });
  const dec = rows.filter(r => decides(r.it.lift));
  const ex = (x: number | 'R', l: number) => x === l;
  const perSeed = Array.from({ length: K }, (_, s) => dec.filter(r => ex(r.pert[s], r.it.label)).length);
  const moved = dec.filter(r => r.pert.some(x => x !== r.clean));
  const exactAll = dec.filter(r => ex(r.clean, r.it.label) && r.pert.every(x => ex(x, r.it.label))).length;
  const lines = [`${title}: ${dec.length} sets that decide; exact on the clean read ${dec.filter(r => ex(r.clean, r.it.label)).length}; per seed ${perSeed.join(', ')} (mean ${(perSeed.reduce((a, b) => a + b, 0) / K).toFixed(1)}); exact on the clean read and every seed ${exactAll}; count moves on some seed ${moved.length} (${(100 * moved.length / Math.max(1, dec.length)).toFixed(1)} %).`];
  for (const r of moved.slice(0, 40)) lines.push(`  ${r.it.name}  label ${r.it.label}  clean ${r.clean}  seeds ${r.pert.join(' ')}`);
  if (moved.length > 40) lines.push(`  ... and ${moved.length - 40} more`);
  return lines;
}

// The sensitivity check on counted sets: marked, wrong and exact among the marked, off by 3 or more caught.
function sensitivityLines(items: Item[]) {
  let n = 0, marked = 0, wrongMarked = 0, exactMarked = 0, far = 0, farMarked = 0;
  for (const it of items) {
    if (!decides(it.lift)) continue;
    const r: any = summarizeCount(it.wl, it.ts, it.lift);
    if (r.refused || !(r.count > 0)) continue;
    const now = it.window ? countInWindow(r.reps ?? [], it.window) : r.count;
    const s: any = withSensitivity({ ...r, worldLandmarks: it.wl, timestamps: it.ts }, it.lift);
    const m = !!s.sensitivity?.moved;
    n++; if (m) marked++;
    if (now === it.label) { if (m) exactMarked++; } else if (m) wrongMarked++;
    if (Math.abs(now - it.label) >= 3) { far++; if (m) farMarked++; }
  }
  return `Sensitivity check on the public counted sets that decide: marks ${marked} of ${n} (${wrongMarked} wrong, ${exactMarked} exact); catches ${farMarked} of the ${far} counts off by 3 or more.`;
}

function realReads(dir: string) {
  const committed = resolve(ROOT, 'sets-07oct-video');
  const encodings = readdirSync(dir).filter(d => statSync(resolve(dir, d)).isDirectory()).sort();
  const gz = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString());
  const names = readdirSync(committed).filter(f => f.endsWith('.json.gz')).sort();
  const cols = ['committed', ...encodings];
  const lines = [`Real re-encodings (${dir}): ${cols.join(', ')}.`];
  const exact: Record<string, number> = {};
  let allExact = 0, same = 0, wrongSure = 0, wrongSureChecked = 0, rightSure = 0, rightSureChecked = 0;
  let pairs = 0, agree = 0, ssWithin = 0, dfWithin = 0;
  for (const f of names) {
    const c = gz(resolve(committed, f));
    const outs = cols.map(col => {
      const p = col === 'committed' ? resolve(committed, f) : resolve(dir, col, f);
      if (!existsSync(p)) return '-';
      const d = gz(p);
      if (d.read?.partial) return 'partial';
      const r: any = summarizeCount(d.worldLandmarks, d.timestamps, c.lift);
      if (!r.refused) {
        // Shown as sure: counted, not flagged by the body check (as the app shows it), with and without this check.
        {
          const moved = !!(withSensitivity({ ...r, worldLandmarks: d.worldLandmarks, timestamps: d.timestamps }, c.lift) as any).sensitivity?.moved;
          if (r.count > 0) {
            if (r.count === c.count) { rightSure++; if (!moved) rightSureChecked++; } else { wrongSure++; if (!moved) wrongSureChecked++; }
          }
        }
        return r.count;
      }
      const pr: any = withProposal({ ...r, worldLandmarks: d.worldLandmarks, timestamps: d.timestamps, imageLandmarks: d.imageLandmarks ?? null }, c.lift);
      return pr.proposal ? `R(p${pr.proposal.count})` : 'R';
    });
    cols.forEach((col, i) => { if (outs[i] === c.count) exact[col] = (exact[col] || 0) + 1; });
    const read = outs.filter(o => o !== '-');
    for (let i = 0; i < read.length; i++) for (let j = i + 1; j < read.length; j++) { pairs++; if (read[i] === read[j]) agree++; }
    if (read.length > 1 && read.every(o => typeof o === 'number')) {
      const xs = read as number[], m = xs.reduce((a, b) => a + b, 0) / xs.length;
      ssWithin += xs.reduce((a, x) => a + (x - m) ** 2, 0); dfWithin += xs.length - 1;
    }
    const present = outs.filter(o => o !== '-');
    if (present.every(o => o === c.count)) allExact++;
    if (new Set(present.map(String)).size === 1) same++;
    lines.push(`  ${f.replace('.json.gz', '')}  label ${c.count}  ${outs.join(' | ')}`);
  }
  lines.push(`  exact per encoding: ${cols.map(c => `${c} ${exact[c] || 0}`).join(', ')}; exact on every encoding ${allExact} of ${names.length}; the same outcome on every encoding ${same} of ${names.length}.`);
  const te = dfWithin ? Math.sqrt(ssWithin / dfWithin) : NaN;
  lines.push(`  the gate as an instrument: pairs of encodings giving a video the same outcome ${agree} of ${pairs} (${(100 * agree / Math.max(1, pairs)).toFixed(1)} %); typical error ${te.toFixed(2)} reps (videos counted on every encoding); MDC95 ${(1.96 * Math.SQRT2 * te).toFixed(1)} reps.`);
  lines.push(`  counted reads shown as sure (body check aside): wrong ${wrongSure}, right ${rightSure}; with the sensitivity check: wrong ${wrongSureChecked}, right ${rightSureChecked}.`);
  return lines;
}

test.skipIf(!process.env.STABILITY)('the counter under re-encoding noise', () => {
  const L = [`Stability ${new Date().toISOString().slice(0, 10)}: the noise proxy (noise.mjs, intensity 0.5, seeds 1-${K}); measured, decides nothing.`];
  L.push(...proxy('David\'s stored sets', labelledSets().sets.map(s => ({ name: s.name, lift: s.lift, label: s.label, wl: s.wl, ts: s.ts }))), '');
  const pub = publicSets('build').sets.map(s => ({ name: s.name, lift: s.lift, label: s.label, wl: s.wl, ts: s.ts, window: s.window }));
  L.push(...proxy('Public build sets', pub), '', sensitivityLines(pub));
  if (process.env.STABILITY_READS) L.push('', ...realReads(process.env.STABILITY_READS));
  const text = L.join('\n') + '\n';
  writeFileSync(resolve(__dirname, 'stability.txt'), text);
  process.stdout.write(text.split('\n').filter(l => !l.startsWith('  ') || l.includes('exact per encoding') || l.includes('shown as sure') || l.includes('as an instrument')).join('\n') + '\n');
}, 3_600_000);
