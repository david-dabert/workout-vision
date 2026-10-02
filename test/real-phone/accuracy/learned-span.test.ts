// FOLDS=<dir of scripts/ml/train.py cv with SAVE_FOLDS> npx vitest run test/real-phone/accuracy/learned-span.test.ts
// The learned counter as the app would run it. A public clip is cut to its labelled window and held still for
// 2 s at each end (train.py, held()): the app has no labelled window. Each clip is read by the fold model that
// never trained on its video. Three readings of the learned density: summed over the whole clip; summed over
// the span where the core finds reps, widened by half a median rep; and the core alone. David's labelled
// sets (never trained on) are read by the app's weights. Writes learned-span.txt. Changes no parameter.
import { test } from 'vitest';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { learnedDensity, type LearnedWeights } from '../../../src/lib/counting/learned';
import type { WorldLandmarkFrame } from '../../../src/lib/counting/core';
import { labelledSets, publicSets } from './sets';

const HOLD_SEC = 2, FPS = 15;

/** A clip as a phone set is filmed: its labelled window, held still at each end. */
function held(wl: WorldLandmarkFrame[], ts: number[], window?: [number, number]) {
  const idx = ts.map((t, i) => i).filter(i => !window || (ts[i] >= window[0] && ts[i] <= window[1]));
  let w = idx.map(i => wl[i]), t = idx.map(i => ts[i]);
  const first = w.findIndex(Boolean), last = w.length - 1 - [...w].reverse().findIndex(Boolean);
  if (first < 0) return { wl: w, ts: t };
  const n = HOLD_SEC * FPS, dt = 1 / FPS;
  const pre = Array.from({ length: n }, () => w[first]), post = Array.from({ length: n }, () => w[last]);
  const t0 = t[0], t1 = t[t.length - 1];
  return {
    wl: [...pre, ...w, ...post],
    ts: [...pre.map((_, i) => t0 - (n - i) * dt), ...t, ...post.map((_, i) => t1 + (i + 1) * dt)].map(x => x - (t0 - n * dt)),
  };
}

/** The learned density summed over the core's reps, widened by half the median rep at each end. */
function spanSum(dens: number[], ts: number[], reps: { startTime: number; endTime: number }[]) {
  if (!reps.length) return 0;
  const d = reps.map(r => r.endTime - r.startTime).sort((a, b) => a - b), m = d[d.length >> 1] / 2;
  const a = reps[0].startTime - m, b = reps[reps.length - 1].endTime + m;
  return dens.reduce((s, v, i) => (ts[i] >= a && ts[i] <= b ? s + v : s), 0);
}

type Row = { name: string; lift: string; label: number; core: number | null; full: number; span: number | null; sum: number };

function read(name: string, lift: string, label: number, wl: WorldLandmarkFrame[], ts: number[], w: LearnedWeights): Row {
  const c = summarizeCount(wl, ts, lift), dens = learnedDensity(wl, w);
  const sum = dens.reduce((a, b) => a + b, 0);
  return { name, lift, label, core: c.refused ? null : c.count, full: Math.round(sum), span: c.refused ? null : Math.round(spanSum(dens, ts, c.reps)), sum };
}

function summary(title: string, rows: Row[]) {
  const out = [title, `| Reading | Answered | Exact | Within one | Off by 3+ | Off by 3+ where the core was not |`, '|---|---:|---:|---:|---:|---:|'];
  const line = (name: string, f: (r: Row) => number | null) => {
    let ans = 0, ex = 0, one = 0, b3 = 0, became = 0;
    for (const r of rows) {
      const v = f(r); if (v === null) continue;
      const e = Math.abs(v - r.label); ans++; ex += +(e === 0); one += +(e <= 1); b3 += +(e >= 3);
      became += +(e >= 3 && r.core !== null && Math.abs(r.core - r.label) < 3);
    }
    out.push(`| ${name} | ${ans} | ${ex} | ${one} | ${b3} | ${became} |`);
  };
  line('core', r => r.core);
  line('learned, whole clip', r => r.full);
  line('learned, whole clip, refused where the core refuses', r => (r.core === null ? null : r.full));
  line('learned, over the core\'s reps', r => r.span);
  return out;
}

test.skipIf(!process.env.FOLDS)('the learned counter as the app would run it', () => {
  const dir = process.env.FOLDS!;
  const pub = new Map(publicSets('build').sets.filter(s => s.dataset === 'countix-whole').map(s => [s.name, s]));
  const rows: Row[] = [];
  for (const f of readdirSync(dir).filter(f => /^fold\d\.json$/.test(f)).sort()) {
    const w = JSON.parse(readFileSync(resolve(dir, f), 'utf8')) as LearnedWeights & { clips: string[] };
    for (const name of w.clips) {
      const s = pub.get(name);
      if (!s) throw new Error(`fold clip not in the build half: ${name}`);
      const h = held(s.wl, s.ts, s.window);
      rows.push(read(name, s.lift, s.label, h.wl, h.ts, w));
    }
  }
  if (rows.length !== pub.size) throw new Error(`${rows.length} clips read of ${pub.size}`);
  const app = JSON.parse(readFileSync(resolve(__dirname, '../../../src/lib/counting/learned-weights.json'), 'utf8')) as LearnedWeights;
  const david = labelledSets().sets.map(s => read(s.name, s.lift, s.label, s.wl, s.ts, app));
  const text = [
    'The learned counter as the app would run it (learned-span.test.ts), 2 October 2026.',
    '',
    ...summary(`Countix whole clips, build half, ${rows.length} clips, each cut to its labelled window and held still 2 s at each end, read by the fold model that never trained on its video:`, rows),
    '',
    ...summary(`David's labelled sets, ${david.length}, whole recordings, the app's weights (never trained on them):`, david),
    '',
    'Each of David\'s sets: label, core, learned over the whole set, learned over the core\'s reps.',
    ...david.map(r => `  ${r.name.padEnd(58)} ${String(r.label).padStart(2)}  core ${String(r.core ?? 'refused').padStart(7)}  whole ${String(r.full).padStart(2)}  span ${String(r.span ?? '-').padStart(2)}`),
  ].join('\n') + '\n';
  writeFileSync(resolve(__dirname, 'learned-span.txt'), text);
  if (process.env.ROWS) writeFileSync(process.env.ROWS, JSON.stringify({ countix: rows, david }));
  process.stdout.write(text);
}, 1_800_000);
