// Card 011 (cards/011-you-against-your-best-set.md), lab lane: today's set beside the person's best set of the same
// exercise, both ranges and tempos, from what a saved set keeps (repDetails). Off in production (BEST_SET_SHOWN).
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import BestSet, { bestOf } from '../BestSet';
import { BEST_SET_SHOWN } from '../measures';

const rep = (start, rom, up, down) => ({ startTime: start, endTime: start + up + down + 0.2, romDegrees: rom, concentricSec: up, eccentricSec: down });
const reps = (n, rom, up, down) => Array.from({ length: n }, (_, i) => rep(i * 3, rom, up, down));
const saved = (n, rom, up, down, date) => ({ exercise: 'bicep_curl', reps: n, repDetails: reps(n, rom, up, down), repDetailsVersion: 2, date });

describe('card 011: today against your best set', () => {
  const before = [saved(8, 110, 1.0, 1.5, '2026-11-10'), saved(10, 100, 0.9, 1.2, '2026-11-11'), saved(6, 120, 1.2, 2.0, '2026-11-12')];

  it('takes the set with the most reps as the best one', () => {
    expect(bestOf(before).reps).toBe(10);
  });

  it('shows the two ranges and the two tempos, today first', () => {
    const html = renderToStaticMarkup(<BestSet before={before} reps={reps(9, 95, 0.8, 1.0)} count={9} fr />);
    expect(html).toContain('data-testid="best-set"');
    expect(html).toContain('Aujourd’hui');
    expect(html).toContain('Votre meilleure série');
    expect(html).toContain('95 °');
    expect(html).toContain('100 °');
    expect(html).toMatch(/1-\d-1-\d/);
    expect(html).toContain('10 rép.');
  });

  it('says nothing without an earlier set of the exercise that kept its reps', () => {
    expect(renderToStaticMarkup(<BestSet before={[]} reps={reps(5, 90, 1, 1)} count={5} fr />)).toBe('');
    expect(renderToStaticMarkup(<BestSet before={[{ exercise: 'bicep_curl', reps: 7, repDetails: [] }]} reps={reps(5, 90, 1, 1)} count={5} fr />)).toBe('');
  });

  it('is off in production, and the result screen shows it only behind the switch', () => {
    expect(BEST_SET_SHOWN).toBe(false);
    const result = readFileSync(resolve(__dirname, '../Result.jsx'), 'utf8');
    expect(result).toMatch(/BEST_SET_SHOWN && [^\n]*<BestSet /);
  });
});
