/**
 * Compares the readings of safari-readings.mjs: per clip, the count each browser's landmarks give (summarizeCount,
 * as the scoreboard counts), whether Safari repeats itself, how many sampled frames reach the pose model with the
 * same pixels in both browsers (SHA-256 of the buffer, harness pixelHashes), and the median landmark gap.
 * Prints a Markdown table (CI appends it to the job summary).
 *
 *   npx tsx scripts/benchmarks/safari-compare.ts readings
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { summarizeCount } from '../../src/lib/coreAnalysis';

const dir = process.argv[2] ?? 'readings';
const files = readdirSync(dir).filter(f => f.endsWith('.json'));
const read = (f: string) => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const byClip = new Map<string, any[]>();
for (const f of files) { const r = read(f); byClip.set(r.clip, [...(byClip.get(r.clip) ?? []), r]); }

const countOf = (r: any) => {
  if (!r || r.error) return 'error';
  const s: any = summarizeCount(r.worldLandmarks, r.timestamps, r.lift);
  return s.refused ? 'refused' : s.count;
};
const median = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : NaN; };
const gap = (a: any, b: any) => {
  const d: number[] = [];
  const n = Math.min(a.worldLandmarks.length, b.worldLandmarks.length);
  for (let i = 0; i < n; i++) {
    const fa = a.worldLandmarks[i], fb = b.worldLandmarks[i];
    if (!fa || !fb) continue;
    for (let j = 11; j <= 28; j++) d.push(Math.hypot(fa[j].x - fb[j].x, fa[j].y - fb[j].y, fa[j].z - fb[j].z));
  }
  return median(d);
};

const ua = files.map(read).find(r => r.browser === 'safari' && r.userAgent)?.userAgent ?? '';
const rows: string[] = [];
let exactS = 0, exactC = 0, disagree = 0, n = 0;
for (const [clip, rs] of [...byClip].sort()) {
  const s1 = rs.find(r => r.browser === 'safari' && r.run === 1), s2 = rs.find(r => r.browser === 'safari' && r.run === 2);
  const c1 = rs.find(r => r.browser === 'chromium' && r.run === 1);
  const label = (s1 ?? c1).label;
  const cs1 = countOf(s1), cs2 = countOf(s2), cc = countOf(c1);
  n++; if (cs1 === label) exactS++; if (cc === label) exactC++; if (cs1 !== cc) disagree++;
  const ok = s1 && c1 && !s1.error && !c1.error;
  const same = ok ? s1.pixelHashes.filter((h: string, i: number) => h === c1.pixelHashes[i]).length : NaN;
  const frames = ok ? `${same} / ${Math.min(s1.pixelHashes.length, c1.pixelHashes.length)}` : 'n/a';
  const g = ok ? `${(gap(s1, c1) * 100).toFixed(1)} cm` : 'n/a';
  rows.push(`| ${clip} | ${label} | ${cs1} | ${cs2 ?? ''} | ${cc} | ${frames} | ${g} | ${s1?.seconds?.toFixed(1) ?? ''} | ${c1?.seconds?.toFixed(1) ?? ''} |`);
}
console.log(`### Real Safari against Chromium, the five demo clips\n\nSafari: \`${ua}\`\n`);
console.log('| Clip | David\'s count | Safari run 1 | Safari run 2 | Chromium | Same pixels (frames) | Median landmark gap | Safari s | Chromium s |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(r);
console.log(`\nExact: Safari ${exactS} of ${n}, Chromium ${exactC} of ${n}. Clips where the two browsers count differently: ${disagree}.`);

// The same browser on the same clip as stored three ways (14 November 2026): Safari's count on the MP4, on the iPhone
// format upright, and on the iPhone format stored sideways with a display rotation, with the samples read and the
// decoder's rotation decision. A clip whose count moves between these is read differently by its storage alone.
const base = [...new Set([...byClip.keys()].map(k => k.replace(/-iphone(-rot)?$/, '')))].sort();
const s1Of = (k: string) => byClip.get(k)?.find(r => r.browser === 'safari' && r.run === 1);
const cov = (r: any) => typeof r.metadata?.poseCoverage === 'number' ? `, pose ${Math.round(100 * (r.metadata.poseCoverage > 1 ? r.metadata.poseCoverage / 100 : r.metadata.poseCoverage))} %` : '';
const cell = (r: any) => !r ? '' : r.error ? 'error' : `${countOf(r)} (${r.timestamps.length} samples${cov(r)})`;
console.log('\n### Safari, one clip stored three ways\n');
console.log('| Clip | David\'s count | MP4 | iPhone format | iPhone format, rotated | Rotation decision (rotated) |');
console.log('|---|---|---|---|---|---|');
for (const k of base) {
  const m = s1Of(k), i = s1Of(`${k}-iphone`), r = s1Of(`${k}-iphone-rot`);
  const label = (m ?? i ?? r)?.label ?? '';
  console.log(`| ${k} | ${label} | ${cell(m)} | ${cell(i)} | ${cell(r)} | ${r?.metadata?.rotationDecision ?? (r?.error ? String(r.error).split(' | ')[0] : '')} |`);
}

