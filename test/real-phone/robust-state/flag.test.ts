// RS_FLAG_OUT=<out.txt> [RS_K=5] npx vitest run --no-cache test/real-phone/robust-state/flag.test.ts
// The core's own moves under the noise proxy as an honesty flag, on the sets the app shows as sure today (bench only;
// the app imports none of it; measured, decides nothing). From the robust-state bench of 22 October 2026: its record
// read the flag against a settings-grid file written before the last counting change (779ebaa) and counted 366 sets
// it never read under the proxy (no signal profile) as still; the independent check of 23 October found both. Here
// the sure set is the scoreboards' own (sure.ts sureRow: the body check, the sensitivity check and a refused head rep
// asking, as the result screen ships), recomputed now, and the core is recounted on K reads of the noise proxy
// (stability/noise.mjs, intensity 0.5) on every one of those sets. "Proxy moves": on at least one read the count
// scored differs or the core refuses. The flag would ask on a sure set whose count moves. Source: UNSOURCED.
// Status: experimental.
import { test } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount, withBodyCheck, withProposal } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { ROOT, benchSets, countInWindow, decides, labelledSets, publicSets, videoSets } from '../accuracy/sets';
import { sureRow } from '../accuracy/sure';
// @ts-expect-error: a JavaScript module without types
import { perturbSet } from '../stability/noise.mjs';

const K = Number(process.env.RS_K || 5);
const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());
type Row = { group: string; name: string; err: number; moves: number };

/** The app's whole path on a stored set, as scoreboard.test.ts reads it (count, proposal on a refused set, body check). */
function appPath(lift: string, wl: any[], ts: number[], il: any[] | null, appRefused = false) {
  const c: any = summarizeCount(wl, ts, lift);
  return withBodyCheck(withProposal({ ...c, refused: c.refused || appRefused, worldLandmarks: wl, timestamps: ts, imageLandmarks: il }, lift), lift);
}

/** How many of K proxy reads move the core's scored count off the shown one (a refusal moves it). */
function proxyMoves(lift: string, wl: any[], ts: number[], il: any[] | null, shown: number, window?: [number, number]) {
  let moves = 0;
  for (let seed = 1; seed <= K; seed++) {
    const p = perturbSet({ worldLandmarks: wl, timestamps: ts, imageLandmarks: il }, { seed });
    const r: any = summarizeCount(p.worldLandmarks, p.timestamps, lift);
    const n = r.refused ? null : window ? countInWindow(r.reps ?? [], window) : r.count;
    if (n !== shown) moves++;
  }
  return moves;
}

test.skipIf(!process.env.RS_FLAG_OUT)('the core moved by the noise proxy, as a flag on the sets shown as sure', () => {
  const rows: Row[] = [], counted: Record<string, number> = {};
  const take = (group: string, name: string, lift: string, label: number, result: any, wl: any[], ts: number[], il: any[] | null, window?: [number, number]) => {
    const countOf = window ? (x: any) => countInWindow(x.reps ?? [], window) : (x: any) => x.count;
    const s = sureRow(result, lift, label, countOf);
    if (s.err === null) return;
    counted[group] = (counted[group] ?? 0) + 1;
    if (s.flagged || s.moved) return;
    rows.push({ group, name, err: s.err, moves: proxyMoves(lift, wl, ts, il, countOf(result), window) });
  };
  for (const s of labelledSets().sets) if (decides(s.lift)) {
    const il = gz(resolve(ROOT, s.name)).imageLandmarks ?? null;
    take('David stored', s.name, s.lift, s.label, appPath(s.lift, s.wl, s.ts, il), s.wl, s.ts, il);
  }
  for (const s of videoSets().sets as any[]) if (decides(s.lift)) take('David video', s.name, s.lift, s.label, appPath(s.lift, s.wl, s.ts, s.il ?? null, s.appRefused), s.wl, s.ts, s.il ?? null);
  // The public sets as public-scoreboard.test.ts reads them: no image landmarks, each count scored inside its window.
  for (const s of publicSets('build').sets) if (decides(s.lift)) {
    const r: any = summarizeCount(s.wl, s.ts, s.lift);
    take('public', s.name, s.lift, s.label, withBodyCheck({ ...r, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: null }, s.lift), s.wl, s.ts, null, s.window);
  }
  // RepCount-A (benchmark only): the classes with a counter, read the same way as the public sets (no image landmarks).
  for (const s of benchSets('repcount', 'build').sets) if (s.lift && liftDefinition(s.lift) && decides(s.lift)) {
    const r: any = summarizeCount(s.wl, s.ts, s.lift);
    take('RepCount-A', s.name, s.lift, s.label, withBodyCheck({ ...r, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: null }, s.lift), s.wl, s.ts, null);
  }
  const pct = (k: number, n: number) => (n ? Math.round((100 * k) / n) : 0);
  const part = (rs: Row[]) => { const ex = rs.filter(r => r.err === 0).length, bad = rs.filter(r => r.err >= 3).length; return `${rs.length} sets, ${ex} exact (${pct(ex, rs.length)} %), ${bad} off by 3 or more`; };
  const out = [
    `Honesty flag, ${new Date().toISOString().slice(0, 10)} (flag.test.ts, K = ${K} reads of the noise proxy at intensity 0.5; measured, decides nothing).`,
    'Sets that decide; shown as sure as the app ships (sure.ts: counted, not flagged by the body check, the sensitivity check or a refused head rep),',
    'then split by whether the core\'s scored count moves on any proxy read. The flag would ask on the sets where it moves.',
  ];
  for (const g of ['public', 'David stored', 'David video', 'RepCount-A']) {
    const rs = rows.filter(r => r.group === g), still = rs.filter(r => r.moves === 0), moved = rs.filter(r => r.moves > 0);
    out.push(`-- ${g}: ${counted[g] ?? 0} counted`, `   shown as sure today:        ${part(rs)}`, `   sure, proxy still (kept):   ${part(still)}`, `   sure, proxy moves (asked):  ${part(moved)}`);
    if (g !== 'public') for (const r of moved) out.push(`      asked: ${r.name.split('/').pop()}  off by ${r.err}  moves ${r.moves} of ${K}`);
  }
  writeFileSync(process.env.RS_FLAG_OUT!, out.join('\n') + '\n');
  process.stdout.write(out.join('\n') + '\n');
}, 7_200_000);
