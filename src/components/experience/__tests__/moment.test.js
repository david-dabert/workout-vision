import { describe, expect, it } from 'vitest';
import { momentLine } from '../moment';

const set = (reps, corrected = false) => ({ reps, corrected, source: 'counter-core' });
const weighted = (reps, weight, corrected = false) => ({ reps, weight, corrected, source: 'counter-core' });

describe('the line said once a set is saved', () => {
  it('names a record beaten, against confirmed sets only', () => {
    expect(momentLine({ n: 12, before: [set(10), set(11), { reps: 30, source: 'counter-core' }], fr: true }))
      .toEqual({ kind: 'record', text: 'Nouveau record : 12. L’ancien était 11.' });
  });
  it('names a record equalled', () => {
    expect(momentLine({ n: 10, before: [set(10)], fr: false })).toEqual({ kind: 'equal', text: '10, your best equalled.' });
  });
  it('greets the first set of a lift', () => {
    expect(momentLine({ n: 8, before: [], fr: true }).kind).toBe('first');
  });
  // Card 011 (14 November 2026, David: "Tackle all five"): under the record, the record to beat, a count and nothing
  // else; no line judges the execution, which the app does not measure (R8).
  it('under the record, names the record to beat, counts only', () => {
    expect(momentLine({ n: 6, before: [set(10), set(8)], fr: true })).toEqual({ kind: 'below', text: 'Votre record\u00a0: 10. À battre à la prochaine série.' });
    expect(momentLine({ n: 6, before: [set(10)], fr: false })).toEqual({ kind: 'below', text: 'Your best: 10. One to beat next set.' });
  });
  it('under the record, counts only sets someone confirmed', () => {
    expect(momentLine({ n: 6, before: [set(8), { reps: 30, source: 'counter-core' }], fr: false }).text).toBe('Your best: 8. One to beat next set.');
  });
  it('says nothing for a count not kept, a zero, or before the sets are read (R8)', () => {
    expect(momentLine({ n: 8, before: [], kept: false })).toBeNull();
    expect(momentLine({ n: 0, before: [] })).toBeNull();
    expect(momentLine({ n: 8, before: null })).toBeNull();
  });
  // Card 033 (15 November 2026): next set to beat by load and reps (double progression 8..12, +2.5 kg step, UNSOURCED conventions).
  it('names +1 rep at the same load when best at 60 kg is 9 reps', () => {
    expect(momentLine({ n: 7, before: [weighted(9, 60)], load: 60, fr: true }))
      .toEqual({ kind: 'goal', text: 'Objectif\u00a0: 10 répétitions à 60\u00a0kg' });
    expect(momentLine({ n: 7, before: [weighted(9, 60)], load: 60, fr: false }))
      .toEqual({ kind: 'goal', text: 'Target: 10 reps at 60\u00a0kg' });
  });
  it('names 8 reps at +2.5 kg when best at 60 kg reaches 12 reps', () => {
    expect(momentLine({ n: 10, before: [weighted(12, 60)], load: 60, fr: true }))
      .toEqual({ kind: 'goal', text: 'Objectif\u00a0: 8 répétitions à 62,5\u00a0kg' });
    expect(momentLine({ n: 12, before: [weighted(10, 60)], load: 60, fr: false }))
      .toEqual({ kind: 'goal', text: 'Target: 8 reps at 62.5\u00a0kg' });
  });
  it('on a single weighted set, adds one rep at that load', () => {
    expect(momentLine({ n: 9, before: [], load: 60, fr: true }))
      .toEqual({ kind: 'goal', text: 'Objectif\u00a0: 10 répétitions à 60\u00a0kg' });
    expect(momentLine({ n: 12, before: [], load: 60, fr: true }))
      .toEqual({ kind: 'goal', text: 'Objectif\u00a0: 8 répétitions à 62,5\u00a0kg' });
  });
  it('leaves card 011 unchanged when no load was saved on this set and never invents a weight', () => {
    expect(momentLine({ n: 6, before: [set(10), set(8)], fr: true }))
      .toEqual({ kind: 'below', text: 'Votre record\u00a0: 10. À battre à la prochaine série.' });
    expect(momentLine({ n: 6, before: [weighted(10, 60)], load: null, fr: true }))
      .toEqual({ kind: 'below', text: 'Votre record\u00a0: 10. À battre à la prochaine série.' });
    expect(momentLine({ n: 6, before: [weighted(10, 60)], load: 0, fr: true }))
      .toEqual({ kind: 'below', text: 'Votre record\u00a0: 10. À battre à la prochaine série.' });
  });
  it('reads only confirmed sets at the same load and returns nothing for refused or unconfirmed sets (R8)', () => {
    expect(momentLine({ n: 7, before: [{ reps: 30, weight: 60, source: 'counter-core' }, weighted(15, 40)], load: 60, fr: true }))
      .toEqual({ kind: 'goal', text: 'Objectif\u00a0: 8 répétitions à 60\u00a0kg' });
    expect(momentLine({ n: 8, before: [], load: 60, kept: false, fr: true })).toBeNull();
    expect(momentLine({ n: 8, before: [], load: 60, refused: true, fr: true })).toBeNull();
  });
});
