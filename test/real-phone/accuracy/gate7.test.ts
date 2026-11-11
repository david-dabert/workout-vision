import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { summarizeCount, withBodyCheck, withProposal } from '../../../src/lib/coreAnalysis';
import { labelledSets } from './sets';
import { EXEMPT, READINGS, judge, type GateSet, type Reading } from './gate7';

// Gate 7 (METHOD.md, card 002): a reading production shows must separate David's labelled sets, and a screen cannot
// import an analyzer this gate does not know.
const sets: GateSet[] = (labelledSets().sets as any[]).map(s => {
  const c: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
  const r: any = withBodyCheck(withProposal({ ...c, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: s.il ?? null }, s.lift), s.lift);
  return { lift: s.lift, reps: r.reps || [], world: s.wl, image: s.il ?? s.wl, ts: s.ts };
});
const judged = READINGS.map(r => ({ shown: r.shown(), ...judge(r, sets) }));

describe('gate 7: a reading on a screen separates the labelled sets', () => {
  it('judges on David\'s stored sets', () => {
    expect(sets.length).toBeGreaterThanOrEqual(15);
  });

  it('fails a reading that says the same thing on nearly every set, and passes one that splits them', () => {
    const always: Reading = { name: 'always', shown: () => true, verdict: () => 'critical' };
    const never: Reading = { name: 'never', shown: () => true, verdict: () => null };
    const split: Reading = { name: 'split', shown: () => true, verdict: s => (s.reps.length % 2 ? 'a' : 'b') };
    expect(judge(always, sets).pass).toBe(false);
    expect(judge(never, sets).pass).toBe(false);
    const alternating = sets.map((s, i) => ({ ...s, reps: Array(i % 2 ? 3 : 4).fill({}) }));
    expect(judge(split, alternating).pass).toBe(true);
  });

  it('every reading production shows passes', () => {
    const failing = judged.filter(j => j.shown && !j.pass).map(j => `${j.name}: ${j.why}`);
    expect(failing, 'shown in production without separating the sets (METHOD.md, gate 7)').toEqual([]);
  });

  it('a screen imports no analyzer this gate does not know', () => {
    const files: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== '__tests__') walk(p); } else if (/\.jsx?$/.test(f) && !/\.test\./.test(f)) files.push(p); } };
    walk(resolve(__dirname, '../../../src/components'));
    const known = new Set([...READINGS.map(r => r.name), ...Object.keys(EXEMPT)]);
    const unknown = new Set<string>();
    for (const f of files) {
      for (const m of readFileSync(f, 'utf8').matchAll(/import\s*\{([^}]+)\}\s*from\s*'[^']*lib\/(?:biomechanics|coaching|kine)[^']*'/g)) {
        for (const name of m[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0])) if (/^(analyze|calculate|detect|predict|evaluate)[A-Z]/.test(name) && !known.has(name)) unknown.add(`${name} (${f.replace(/^.*src\//, 'src/')})`);
      }
    }
    expect([...unknown], 'add the analyzer to READINGS in gate7.ts with its verdict, or to EXEMPT with its reason').toEqual([]);
  });

  it('records what each reading says today', () => {
    const lines = [`# Gate 7 on David's ${sets.length} stored sets (gate7.test.ts; SCOREBOARD=1 rewrites this file)`, '# Varying is necessary, not sufficient: no reading here has been held against a reference yet.', ...judged.map(j => `${j.name}: ${j.pass ? 'varies across the sets' : 'fails'} (${j.why}); shown in production: ${j.shown ? 'yes' : 'no'}`)];
    if (process.env.SCOREBOARD) writeFileSync(resolve(__dirname, 'gate7.txt'), lines.join('\n') + '\n');
    expect(judged).toHaveLength(READINGS.length);
  });
});
