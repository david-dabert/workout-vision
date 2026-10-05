// The plain-words key to the measures (David's demo to a physiotherapist, 5 October), in the user's language.
import { describe, it, expect } from 'vitest';
import { measureLegend } from '../report-sheet';

describe('measureLegend', () => {
  it('explains each column and the time under tension in French', () => {
    const l = measureLegend(true);
    expect(l.map(x => x.split(' :')[0])).toEqual(['Tempo', 'Amplitude', 'Pic', 'Moy.', 'Temps sous tension']);
    expect(l[0]).toContain('descente, pause en bas, montée, pause en haut');
  });
  it('and in English', () => {
    expect(measureLegend(false).map(x => x.split(':')[0])).toEqual(['Tempo', 'Range', 'Peak', 'Mean', 'Time under tension']);
  });
  it('describes without judging (R8)', () => {
    for (const line of [...measureLegend(true), ...measureLegend(false)]) expect(line).not.toMatch(/bon|mauvais|good|bad|mieux|better/i);
  });
});
