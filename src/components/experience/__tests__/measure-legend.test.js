// The key to the measures (David's demo to a physiotherapist, 5 October; his iPhone the same day: "this boring"):
// a glossary whose terms are the table's own headings, and the tempo shown as its four phases, in the user's language.
import { describe, it, expect } from 'vitest';
import { measureGuide, measureLegend, repTable } from '../report-sheet';

describe('measureGuide', () => {
  it('names each column of the table by its own heading, in French and in English', () => {
    for (const fr of [true, false]) {
      const g = measureGuide(fr), cols = repTable({ reps: [], fr }).columns;
      expect([g.tempo.term, ...g.items.filter(i => !i.tut).map(i => i.term)]).toEqual(cols.slice(1));
    }
  });
  it('shows the tempo as four phases with their seconds', () => {
    expect(measureGuide(true).tempo.example).toEqual([['2', 'descente'], ['1', 'en bas'], ['1', 'montée'], ['0', 'en haut']]);
    expect(measureGuide(false).tempo.example.map(([, l]) => l)).toEqual(['down', 'bottom', 'up', 'top']);
  });
  it('describes without judging (R8)', () => {
    for (const line of [...measureLegend(true), ...measureLegend(false)]) expect(line).not.toMatch(/bon|mauvais|good|bad|mieux|better/i);
  });
});
