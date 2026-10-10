// Synthetic sets, 7 October: the backward pass on lost frames (src/lib/poseCrop.js BACK_PASS, off in the app) and two
// other ways to fill them, each rendered by test/real-phone/synth/run.mjs through the app's own pose path (README.md
// here): the 8 far-camera sets (dist 9 m, matrix-backward-*.json, matrix-heavy-*.json) and the 20 synthetic sets of
// test/real-phone/synth/sets that hold a frame without a pose (matrix-backward-near-*.json; -a and -b only). Variants, by file suffix: -a today's path (whole frame, then the crop around the last pose; backward pass
// off), -b the backward pass (lost frames kept 1 s), -b3 the backward pass with lost frames kept 3 s (bench hook),
// -c today's path then MediaPipe's heavy pose model on the whole frame of the frames still lost (bench only).
// The files hold landmarks only. BACK_DIR=<folder> reads another folder.
import { expect, test } from 'vitest';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';

const DIR = process.env.BACK_DIR || resolve(__dirname, 'sets-backward');
const read = (f: string) => JSON.parse(gunzipSync(readFileSync(resolve(DIR, f))).toString());
const count = (r: any) => { const c = summarizeCount(r.worldLandmarks, r.timestamps, r.params.exercise); return c.refused ? 'refused' : c.count; };
const err = (c: number | string, truth: number) => (c === 'refused' ? Infinity : Math.abs((c as number) - truth));
const pct = (x: number) => `${Math.round(100 * x)}%`;
const VARIANTS = [['a', "today's crop retry"], ['b', '+ backward pass (1 s)'], ['b3', '+ backward pass (3 s kept)'], ['c', '+ heavy model on lost frames']];

test('the backward pass on far-camera synthetic sets', () => {
  const sets = readdirSync(DIR).filter(f => f.endsWith('-a.json.gz')).map(f => f.replace(/-a\.json\.gz$/, '')).sort();
  expect(sets.length).toBeGreaterThan(0);
  const rows: string[] = [], totals: Record<string, { seen: number; n: number; exact: number; bad: number; ms: number; sec: number; sets: number; refused: number }> = {};
  const errs: Record<string, Record<string, number>> = {};
  for (const s of sets) {
    errs[s] = {};
    const base = read(`${s}-a.json.gz`), truth = base.reps.length;
    const cells: string[] = [];
    for (const [v] of VARIANTS) {
      const f = `${s}-${v}.json.gz`;
      if (!existsSync(resolve(DIR, f))) { cells.push(`${v} -`); continue; }
      const r = v === 'a' ? base : read(f);
      const n = r.timestamps.length, seen = r.worldLandmarks.filter(Boolean).length, c = count(r), e = err(c, truth);
      // Every frame with a pose on today's path is byte-identical in each variant (they only fill lost frames).
      r.worldLandmarks.forEach((w: any, i: number) => { if (base.worldLandmarks[i]) expect(JSON.stringify(w), `${f} frame ${i}`).toBe(JSON.stringify(base.worldLandmarks[i])); });
      errs[s][v] = e;
      const t = (totals[v] ??= { seen: 0, n: 0, exact: 0, bad: 0, ms: 0, sec: 0, sets: 0, refused: 0 });
      t.seen += seen; t.n += n; t.exact += e === 0 ? 1 : 0; t.bad += e >= 3 && c !== 'refused' ? 1 : 0; t.refused += c === 'refused' ? 1 : 0; t.ms += r.detectMs; t.sec += n / 15; t.sets++;
      const filled = (r.poseSources ?? []).filter((x: string | null) => x === 'back' || x === 'lost-model').length;
      cells.push(`${v} ${seen}/${n} (${pct(seen / n)}${filled ? `, ${filled} filled` : ''}) count ${c} ${(r.detectMs / 1000).toFixed(1)} s`);
    }
    rows.push(`${s}  truth ${truth}  ${cells.join('  |  ')}`);
  }
  const head = VARIANTS.filter(([v]) => totals[v]).map(([v, name]) => {
    const t = totals[v];
    return `${v} ${name}: pose ${pct(t.seen / t.n)} of ${t.n} samples; exact ${t.exact} of ${t.sets}; off by 3 or more ${t.bad}; refused ${t.refused}; detection ${((t.ms / 1000 / t.sec) * 60).toFixed(0)} s per minute of video`;
  });
  const text = ['Synthetic sets: 8 far-camera (dist 9 m) and 20 near sets with a lost frame (headless Chromium, SwiftShader, this machine\'s CPU; renders ran two at a time beside other work, so the times compare variants of one set, not runs):', ...head, ...rows].join('\n') + '\n';
  if (!process.env.BACK_DIR) writeFileSync(resolve(__dirname, 'backward.txt'), text);
  process.stdout.write(text);
  // R2 on these synthetic sets for the backward pass (b): no exact count lost, none newly off by 3 or more (or
  // refused), and more of the samples seen. It passes here; it failed on David's real videos (TRIED.md), so the pass
  // stays off in the app.
  expect(totals.b.exact).toBeGreaterThanOrEqual(totals.a.exact);
  for (const s of sets) if (errs[s].a < 3) expect(errs[s].b, s).toBeLessThan(3);
  expect(totals.b.seen).toBeGreaterThan(totals.a.seen);
}, 120_000); // 112 reads counted: past vitest's 5 s default when the whole suite runs at once (10 October 2026)
