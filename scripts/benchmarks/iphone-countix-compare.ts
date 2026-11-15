/**
 * Scores the WebKit readings of Countix clips stored three ways (scripts/benchmarks/iphone-countix-prepare.sh, read by
 * safari-readings.mjs --list on macOS), 15 November 2026. Per set: the human label, the count of the stored Chromium
 * reading of the same whole clip (test/real-phone/public/countix-whole/build, recounted here by the same code), and
 * WebKit's count on the MP4, on the MP4 read a second time, on the iPhone format and on the iPhone format stored
 * sideways. Each count is summarizeCount's reps inside the labelled window (countInWindow), as the public scoreboard
 * counts countix-whole. Measures, decides nothing. Prints Markdown (CI appends it to the job summary).
 *
 *   npx tsx scripts/benchmarks/iphone-countix-compare.ts readings
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { summarizeCount } from '../../src/lib/coreAnalysis';

// countInWindow of test/real-phone/accuracy/sets.ts, which needs vitest's __dirname to load: the reps whose middle
// falls inside the labelled window.
const countInWindow = (reps: { startTime: number; endTime: number }[], w: [number, number]) =>
  reps.filter(r => { const m = (r.startTime + r.endTime) / 2; return m >= w[0] && m <= w[1]; }).length;

type Count = number | 'refused' | 'error' | null;
const dir = process.argv[2] ?? 'readings';
const walk = (d: string): string[] => readdirSync(d).flatMap(f => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const readings = walk(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(f, 'utf8')));

const countOf = (wl: any[], ts: number[], lift: string, window: [number, number]): Count => {
  const s: any = summarizeCount(wl, ts, lift);
  return s.refused ? 'refused' : countInWindow(s.reps, window);
};
const webkit = (r: any): Count => (!r ? null : r.error ? 'error' : countOf(r.worldLandmarks, r.timestamps, r.lift, r.window));
const STORED = resolve(dirname(fileURLToPath(import.meta.url)), '../../test/real-phone/public/countix-whole/build');
const chromium = (id: string): Count => {
  const f = join(STORED, `${id}.json.gz`);
  if (!existsSync(f)) return null;
  const d = JSON.parse(gunzipSync(readFileSync(f)).toString());
  return countOf(d.worldLandmarks, d.timestamps, d.lift, d.window);
};

const ids = [...new Set(readings.map(r => String(r.clip).replace(/-iphone(-rot)?$/, '')))].sort();
const get = (clip: string, run = 1) => readings.find(r => r.clip === clip && r.run === run);
type Row = { id: string; lift: string; label: number; chromium: Count; mp4: Count; mp4b: Count; iphone: Count; rot: Count; rotation: string };
const rows: Row[] = ids.map(id => {
  const m = get(id), i = get(`${id}-iphone`), r = get(`${id}-iphone-rot`), any = m ?? i ?? r;
  return {
    id, lift: any.lift, label: any.label, chromium: chromium(id), mp4: webkit(m), mp4b: webkit(get(id, 2)), iphone: webkit(i), rot: webkit(r),
    rotation: r?.error ? String(r.error).split(' | ')[0] : r?.metadata?.rotationDecision ?? '',
  };
});

const num = (c: Count): c is number => typeof c === 'number';
const err = (c: Count, label: number) => (num(c) ? Math.abs(c - label) : Infinity);
type Col = 'chromium' | 'mp4' | 'iphone' | 'rot';
const COLS: [Col, string][] = [['chromium', 'Chromium (stored)'], ['mp4', 'WebKit, MP4'], ['iphone', 'WebKit, iPhone format'], ['rot', 'WebKit, iPhone format rotated']];
// Only the sets every column read, so each share has the same denominator.
const full = rows.filter(r => COLS.every(([c]) => r[c] !== null && r[c] !== 'error'));
const pct = (k: number, n: number) => (n ? `${Math.round((100 * k) / n)} %` : 'n/a');

console.log(`### Countix clips read as an iPhone reads them (WebKit on macOS, iPhone 13 profile)\n`);
console.log(`${rows.length} sets read; ${full.length} read in every way (the shares below); not read in every way: ${rows.length - full.length}.\n`);
console.log('| Reading | Exact | Off by 1 | Off by 3 or more | Refused | Total reps off |');
console.log('|---|---|---|---|---|---|');
for (const [c, name] of COLS) {
  const e = full.map(r => err(r[c], r.label));
  const total = full.reduce((s, r) => s + (num(r[c]) ? Math.abs((r[c] as number) - r.label) : 0), 0);
  console.log(`| ${name} | ${e.filter(x => x === 0).length} (${pct(e.filter(x => x === 0).length, full.length)}) | ${e.filter(x => x === 1).length} | ${e.filter(x => x >= 3 && x !== Infinity).length} | ${full.filter(r => r[c] === 'refused').length} | ${total} |`);
}

// What moves the count: the browser (Chromium to WebKit, same file), WebKit itself (the same file read twice), the
// storage (MP4 to iPhone format, same browser), the rotation (iPhone format upright to sideways, same browser).
const moved = (a: Col | 'mp4b', b: Col | 'mp4b', set = full) => {
  const pairs = set.filter(r => r[a] !== null && r[a] !== 'error' && r[b] !== null && r[b] !== 'error');
  const d = pairs.filter(r => r[a] !== r[b]);
  const big = d.filter(r => num(r[a]) && num(r[b]) && Math.abs((r[a] as number) - (r[b] as number)) >= 3).length;
  const better = d.filter(r => err(r[b], r.label) < err(r[a], r.label)).length, worse = d.filter(r => err(r[b], r.label) > err(r[a], r.label)).length;
  return `${d.length} of ${pairs.length} (${pct(d.length, pairs.length)}); by 3 or more: ${big}; nearer the label: ${better}, further: ${worse}`;
};
console.log('\n**What changes the count**\n');
console.log(`- WebKit against itself, the same MP4 read twice: ${moved('mp4', 'mp4b', rows)}`);
console.log(`- Browser, Chromium to WebKit on the same MP4: ${moved('chromium', 'mp4')}`);
console.log(`- Storage, MP4 to iPhone format in WebKit: ${moved('mp4', 'iphone')}`);
console.log(`- Rotation, iPhone format upright to sideways in WebKit: ${moved('iphone', 'rot')}`);
console.log(`- The whole phone path, Chromium MP4 to WebKit iPhone format rotated: ${moved('chromium', 'rot')}`);
const decisions = [...new Set(rows.map(r => r.rotation))];
console.log(`- Rotation decisions on the sideways files: ${decisions.map(d => `"${d}" (${rows.filter(r => r.rotation === d).length})`).join(', ')}`);

console.log('\n**Exact per lift** (Chromium stored / WebKit MP4 / iPhone format / rotated, of n)\n');
console.log('| Lift | n | Chromium | MP4 | iPhone | Rotated |');
console.log('|---|---|---|---|---|---|');
for (const lift of [...new Set(full.map(r => r.lift))].sort()) {
  const g = full.filter(r => r.lift === lift), ex = (c: Col) => g.filter(r => r[c] === r.label).length;
  console.log(`| ${lift} | ${g.length} | ${ex('chromium')} | ${ex('mp4')} | ${ex('iphone')} | ${ex('rot')} |`);
}

// A collapse: the phone path counts a third of the label or less where Chromium is within one (the hip thrust read on
// David's iPhone, 1 for 12, 14 November 2026).
const collapse = rows.filter(r => r.label >= 3 && err(r.chromium, r.label) <= 1 && [r.iphone, r.rot].some(c => c === 'refused' || (num(c) && c <= r.label / 3)));
console.log(`\n**Collapses** (iPhone format at a third of the label or less, or refused, where Chromium is within one): ${collapse.length}${collapse.length ? ': ' + collapse.map(r => `${r.id} (${r.lift}, label ${r.label}, Chromium ${r.chromium}, iPhone ${r.iphone}, rotated ${r.rot})`).join('; ') : ''}`);

console.log('\n<details><summary>Every set</summary>\n');
console.log('| Set | Lift | Label | Chromium | MP4 | MP4 again | iPhone | Rotated |');
console.log('|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.id} | ${r.lift} | ${r.label} | ${r.chromium ?? ''} | ${r.mp4 ?? ''} | ${r.mp4b ?? ''} | ${r.iphone ?? ''} | ${r.rot ?? ''} |`);
console.log('\n</details>');
for (const r of readings.filter(x => x.error)) console.log(`\nError ${r.clip} run ${r.run}: ${String(r.error).slice(0, 300)}`);
