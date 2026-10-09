import { describe, expect, it } from 'vitest';
import { blindAnswer, blindPlan, BLIND_MAX, parseBlind } from '../blind';

// The blind question (blind.js; David's order of 9 October 2026, pillar 1): who is asked, and how an answer is read.
describe('blindPlan', () => {
  it('asks every video set on the phone carrying the #collecte flag', () => {
    expect(blindPlan({ collect: true, video: true })).toEqual({ ask: true, p: 1 });
  });
  it('asks nobody else, and never a set counted live (its count was on the screen during the set)', () => {
    expect(blindPlan({ collect: false, video: true })).toEqual({ ask: false, p: 0 });
    expect(blindPlan({ collect: true, video: false })).toEqual({ ask: false, p: 0 });
    expect(blindPlan()).toEqual({ ask: false, p: 0 });
  });
});

describe('parseBlind', () => {
  it('reads one or two digits from 1 to 99', () => {
    expect(parseBlind('7')).toBe(7);
    expect(parseBlind(' 12 ')).toBe(12);
    expect(parseBlind('99')).toBe(BLIND_MAX);
  });
  it('reads nothing else as a count', () => {
    for (const t of ['', '0', '00', '100', '-3', '4.5', 'a', null, undefined]) expect(parseBlind(t)).toBe(null);
  });
});

describe('blindAnswer', () => {
  it('keeps the count given and the share of sets asked', () => {
    expect(blindAnswer(8, 1)).toEqual({ count: 8, p: 1 });
  });
  it('keeps "Je ne sais pas" as no count, and never a number out of range', () => {
    expect(blindAnswer(null, 1)).toEqual({ count: null, p: 1 });
    expect(blindAnswer(0, 1)).toEqual({ count: null, p: 1 });
    expect(blindAnswer(100, 1)).toEqual({ count: null, p: 1 });
    expect(blindAnswer(2.5, 1)).toEqual({ count: null, p: 1 });
  });
});
