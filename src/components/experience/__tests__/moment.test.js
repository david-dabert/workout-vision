import { describe, expect, it } from 'vitest';
import { momentLine } from '../moment';

const set = (reps, corrected = false) => ({ reps, corrected, source: 'counter-core' });

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
});
