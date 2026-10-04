// BENCH_OUT=<dir> BENCH_LABELS=<video_config.csv> npx vitest run test/real-phone/pose-bench/score.test.ts
// Scores the landmarks run.mjs wrote, per pose model, with the app's own counter (summarizeCount: count and refusal)
// against a dataset's human labels. For CFRep (judge-labelled CrossFit sets) the label is every attempt the judge
// marked, valid or not: the app counts movements, not judged reps. Prints one table per model and writes
// BENCH_OUT/score.txt. Skips unless BENCH_OUT is set; changes no count and no parameter.
import { expect, test } from 'vitest';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';

const OUT = process.env.BENCH_OUT, LABELS = process.env.BENCH_LABELS;
const LIFT: Record<string, string> = { squat: 'squat', deadlift: 'deadlift' };

test.skipIf(!OUT || !LABELS)('pose models scored against human labels', () => {
  const labels = new Map<string, { lift: string; attempts: number; valid: number; view: string }>();
  for (const line of readFileSync(LABELS!, 'utf8').trim().split('\n').slice(1)) {
    const [path, type, , bin] = line.split(',');
    if (!LIFT[type]) continue;
    const name = path.replace(/\.mp4$/, '');
    labels.set(name, { lift: LIFT[type], attempts: bin.length, valid: [...bin].filter(c => c === '1').length, view: name.split('_')[1] });
  }
  const models = readdirSync(OUT!).filter(d => existsSync(resolve(OUT!, d)) && !d.includes('.')).sort();
  const lines: string[] = [];
  for (const model of models) {
    const rows: { name: string; lift: string; view: string; label: number; count: number | null; seen: number }[] = [];
    for (const f of readdirSync(resolve(OUT!, model)).filter(f => f.endsWith('.json.gz')).sort()) {
      const name = f.replace(/\.json\.gz$/, ''), lab = labels.get(name);
      if (!lab) continue;
      const d = JSON.parse(gunzipSync(readFileSync(resolve(OUT!, model, f))).toString());
      const r = summarizeCount(d.worldLandmarks, d.timestamps, lab.lift);
      const seen = d.worldLandmarks.filter(Boolean).length / Math.max(1, d.timestamps.length);
      rows.push({ name, lift: lab.lift, view: lab.view, label: lab.attempts, count: r.refused ? null : r.count, seen });
    }
    const sum = (sel: typeof rows) => {
      const counted = sel.filter(r => r.count !== null);
      const exact = counted.filter(r => r.count === r.label).length;
      const near = counted.filter(r => Math.abs(r.count! - r.label) <= 1).length;
      const mae = counted.length ? counted.reduce((a, r) => a + Math.abs(r.count! - r.label), 0) / counted.length : NaN;
      const seen = sel.reduce((a, r) => a + r.seen, 0) / Math.max(1, sel.length);
      return `${sel.length} sets: ${exact} exact, ${near} within 1, ${sel.length - counted.length} refused, mean error ${mae.toFixed(2)}, pose found in ${(100 * seen).toFixed(0)} % of samples`;
    };
    lines.push(`${model}: ${sum(rows)}`);
    for (const lift of [...new Set(rows.map(r => r.lift))]) {
      lines.push(`  ${lift}: ${sum(rows.filter(r => r.lift === lift))}`);
      for (const view of ['front', 'diag', 'side']) {
        const v = rows.filter(r => r.lift === lift && r.view === view);
        if (v.length) lines.push(`    ${view}: ${sum(v)}`);
      }
    }
    for (const r of rows) lines.push(`    ${r.name}  label ${r.label}  count ${r.count ?? 'refused'}${r.count === r.label ? '' : '  <-'}`);
  }
  writeFileSync(resolve(OUT!, 'score.txt'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  expect(models.length).toBeGreaterThan(0);
});
