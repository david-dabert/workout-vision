import { describe, expect, it } from 'vitest';
import { summarizeCount, withBodyCheck, withProposal } from '../../../src/lib/coreAnalysis';
import { labelledSets } from './sets';
import { FIRST_WORDS, firstWord, wordFacts } from '../../../src/components/experience/first-word';

// Card 010, part (1): the one thing said about a set after the first try. On each of David's labelled sets the word
// is one of a closed list, built from tempo and range per rep only, and true of that set by the rule recomputed here,
// with no shared code: the rule is written twice so that a slip in one is caught by the other.
const sets = (labelledSets().sets as any[]).map(s => {
  const c: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
  const r: any = withBodyCheck(withProposal({ ...c, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: s.il ?? null }, s.lift), s.lift);
  return { name: s.name, lift: s.lift, reps: (r.reps || []) as any[] };
});

const median = (xs: number[]) => { const a = [...xs].sort((p, q) => p - q), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
// The rules, as the card states them, written again from the reps.
function holds(key: string, reps: any[]): boolean {
  const whole = reps.filter(r => !r.clipped && r.concentricSec >= 0.2 && r.eccentricSec >= 0.2);
  if (whole.length < 4) return key === 'measured';
  const rom = whole.map(r => r.romDegrees), mid = median(rom);
  const third = Math.max(1, Math.floor(whole.length / 3));
  const first = mean(rom.slice(0, third)), last = mean(rom.slice(-third));
  const dur = whole.map(r => r.endTime - r.startTime), cv = Math.sqrt(mean(dur.map(d => (d - mean(dur)) ** 2))) / mean(dur);
  switch (key) {
    case 'one_short': return rom.filter(x => x < 0.75 * mid).length === 1;
    case 'range_fell': return last < 0.85 * first;
    case 'lowering_quick': return median(whole.map(r => r.eccentricSec)) < 0.7 * median(whole.map(r => r.concentricSec));
    case 'range_held': return last >= 0.95 * first;
    case 'steady': return cv < 0.15;
    case 'measured': return true;
    default: return false;
  }
}

describe('card 010: the first word after a set', () => {
  it('reads David\'s labelled sets', () => {
    expect(sets.length).toBeGreaterThanOrEqual(15);
  });

  it('says one word of the closed list, true of each set by the rule recomputed', () => {
    const keys = FIRST_WORDS.map(w => w.key);
    for (const s of sets) {
      const w = firstWord(s.reps);
      expect(keys, s.name).toContain(w.key);
      expect(holds(w.key, s.reps), `${s.name}: ${w.key}`).toBe(true);
      // The first true word in the list's order is the one said.
      for (const k of keys.slice(0, keys.indexOf(w.key))) expect(holds(k, s.reps), `${s.name}: ${k} holds and comes first`).toBe(false);
    }
  });

  it('says nothing of posture, risk, load or effort', () => {
    const banned = /posture|dos|genou|risque|blessure|charge|poids|fatigue|effort|danger|valgus|back|knee|risk|injur|load|weight/i;
    for (const w of FIRST_WORDS) for (const t of [w.fr({ rep: 3 }), w.en({ rep: 3 })]) expect(t, w.key).not.toMatch(banned);
  });

  it('is not the same word on nearly every set (gate 7: under 80 % of the sets)', () => {
    const tally = new Map<string, number>();
    for (const s of sets) { const k = firstWord(s.reps).key; tally.set(k, (tally.get(k) ?? 0) + 1); }
    if (process.env.WORD_TALLY) console.log('WORDS', JSON.stringify(Object.fromEntries(tally)), sets.map(s => `${s.name}=${firstWord(s.reps).key}`).join(' '));
    const top = Math.max(...tally.values());
    expect(top / sets.length, JSON.stringify(Object.fromEntries(tally))).toBeLessThan(0.8);
  });

  it('says only what it measured when no other word holds', () => {
    expect(firstWord([]).key).toBe('measured');
    expect(wordFacts([]).whole).toBe(0);
  });
});
