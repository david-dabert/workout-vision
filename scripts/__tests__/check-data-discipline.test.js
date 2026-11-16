// The data rules of PLAN.md's amendment of 15 November 2026, as CI checks them (scripts/check-data-discipline.mjs).
import { describe, expect, it } from 'vitest';
import { countingDataErrors, sealedReaders } from '../check-data-discipline.mjs';

describe('a counting change names its data in TRIED.md', () => {
  const counting = ['src/lib/counting/core.ts', 'TRIED.md'];
  it('passes a change outside src/lib/counting/ with nothing in TRIED.md', () => {
    expect(countingDataErrors(['src/components/experience/Film.jsx'], '')).toEqual([]);
  });
  it('passes when both lines name different data', () => {
    expect(countingDataErrors(counting, '+- Chosen on: public half A.\n+- Confirmed on: public half B, RepCount-A.')).toEqual([]);
  });
  it('fails with no "Chosen on:" line', () => {
    expect(countingDataErrors(counting, '+- Confirmed on: public half B.')).toHaveLength(1);
  });
  it('fails with no "Confirmed on:" line', () => {
    expect(countingDataErrors(counting, '+- Chosen on: public half A.')).toHaveLength(1);
  });
  it('fails with neither line', () => {
    expect(countingDataErrors(counting, '+An entry with no data named.')).toHaveLength(2);
  });
  it('fails when both lines name the same data', () => {
    expect(countingDataErrors(counting, '+Chosen on: public half A\n+Confirmed on: Public half A.')).toHaveLength(1);
  });
});

describe('the sealed folder is named only by its readers', () => {
  it('flags a test that reads it', () => {
    expect(sealedReaders([{ path: 'test/real-phone/accuracy/sets.ts', text: "readdirSync('test/real-phone/sealed')" }])).toEqual(['test/real-phone/accuracy/sets.ts']);
  });
  it('passes the checker itself, Markdown, and code that does not name it', () => {
    expect(sealedReaders([
      { path: 'scripts/check-data-discipline.mjs', text: 'real-phone/sealed' },
      { path: 'test/real-phone/sealed/README.md', text: 'real-phone/sealed' },
      { path: 'src/lib/counting/core.ts', text: 'export const x = 1;' },
    ])).toEqual([]);
  });
});
