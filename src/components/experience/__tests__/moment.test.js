import { describe, expect, it } from 'vitest';
import { momentLine } from '../moment';

const set = (reps, corrected = false) => ({ reps, corrected, source: 'counter-core' });

describe('the line said once a set is saved', () => {
  it('names a record beaten, against confirmed sets only', () => {
    expect(momentLine({ n: 12, before: [set(10), set(11), { reps: 30, source: 'counter-core' }], fr: true }))
      .toEqual({ kind: 'record', text: 'Record : 12. Votre meilleur était 11.' });
  });
  it('names a record equalled', () => {
    expect(momentLine({ n: 10, before: [set(10)], fr: false })).toEqual({ kind: 'equal', text: '10, your best equalled.' });
  });
  it('greets the first set of a lift', () => {
    expect(momentLine({ n: 8, before: [], fr: true }).kind).toBe('first');
  });
  it('otherwise gives a coach line, the same for the same rank', () => {
    const a = momentLine({ n: 6, before: [set(10)], nth: 2, fr: true });
    expect(a.kind).toBe('coach');
    expect(momentLine({ n: 6, before: [set(10)], nth: 2, fr: true })).toEqual(a);
  });
  it('says nothing for a count not kept, a zero, or before the sets are read (R8)', () => {
    expect(momentLine({ n: 8, before: [], kept: false })).toBeNull();
    expect(momentLine({ n: 0, before: [] })).toBeNull();
    expect(momentLine({ n: 8, before: null })).toBeNull();
  });
});
