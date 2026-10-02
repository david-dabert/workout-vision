import { describe, expect, it, vi } from 'vitest';
import { LEVELS, LEVEL_KEY, readLevel, writeLevel, levelAsked, markLevelAsked, shouldAskLevel, levelView, resultBlocks, GUIDED_SETS } from '../level';
import { reportSheet, repTable, speedChangeLine } from '../report-sheet';
import { setAccount } from '../set-account';

// A storage like localStorage, or one that throws as Safari's private mode may.
const memory = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };

const rep = (i, s, rom, conc) => ({ index: i, startTime: s, endTime: s + conc + 2, romDegrees: rom, concentricSec: conc, eccentricSec: 2, peakSpeed: 100 + i, meanSpeed: 50 + i });
const eight = Array.from({ length: 8 }, (_, k) => rep(k + 1, k * 4, k === 2 ? 70 : 100, k >= 6 ? 1.25 : 1));

describe('the level store (wv_level, per phone)', () => {
  it('knows three levels, under the key wv_level', () => {
    expect(LEVELS).toEqual(['beginner', 'intermediate', 'expert']);
    expect(LEVEL_KEY).toBe('wv_level');
  });
  it('reads nothing on a new phone, and nothing from a value it does not know', () => {
    expect(readLevel(memory())).toBe('');
    expect(readLevel(memory({ wv_level: 'pro' }))).toBe('');
  });
  it('reads what was written', () => {
    const s = memory();
    for (const l of LEVELS) { expect(writeLevel(l, s)).toBe(true); expect(readLevel(s)).toBe(l); }
  });
  it('refuses a level it does not know, and keeps the one stored', () => {
    const s = memory({ wv_level: 'expert' });
    expect(writeLevel('pro', s)).toBe(false);
    expect(readLevel(s)).toBe('expert');
  });
  it('never throws when the storage does', () => {
    expect(readLevel(broken)).toBe('');
    expect(writeLevel('beginner', broken)).toBe(false);
    expect(levelAsked(broken)).toBe(false);
    expect(() => markLevelAsked(broken)).not.toThrow();
    expect(readLevel(null)).toBe('');
  });
  it('remembers that the question was offered, and a chosen level counts as answered', () => {
    const s = memory();
    expect(levelAsked(s)).toBe(false);
    markLevelAsked(s);
    expect(levelAsked(s)).toBe(true);
    const t = memory();
    writeLevel('expert', t);
    expect(levelAsked(t)).toBe(true);
  });
});

describe('the question on the result screen: once, after a saved set, never blocking', () => {
  it('is asked only once the set is saved, with no level and never offered before', () => {
    expect(shouldAskLevel({ step: 'saved', level: '', asked: false })).toBe(true);
    expect(shouldAskLevel({ step: 'ask', level: '', asked: false })).toBe(false);
    expect(shouldAskLevel({ step: 'fix', level: '', asked: false })).toBe(false);
    expect(shouldAskLevel({ step: 'saved', level: 'beginner', asked: false })).toBe(false);
    expect(shouldAskLevel({ step: 'saved', level: '', asked: true })).toBe(false);
  });
});

describe('what each level shows, from the same measures', () => {
  it('an unknown level is today\'s app, the intermediate one', () => {
    expect(levelView('')).toEqual(levelView('intermediate'));
    expect(levelView('intermediate')).toEqual({ level: 'intermediate', plainFirst: false, notesOpen: false, guideFirst: false, perRep: false });
  });
  it('a beginner reads the words first, with the notes open, and the guide before filming until three sets are saved', () => {
    expect(GUIDED_SETS).toBe(3);
    expect(levelView('beginner', { saved: 0 })).toEqual({ level: 'beginner', plainFirst: true, notesOpen: true, guideFirst: true, perRep: false });
    expect(levelView('beginner', { saved: 2 }).guideFirst).toBe(true);
    expect(levelView('beginner', { saved: 3 }).guideFirst).toBe(false);
  });
  it('an expert gets the per-rep table on the result screen', () => {
    expect(levelView('expert', { saved: 0 })).toEqual({ level: 'expert', plainFirst: false, notesOpen: false, guideFirst: false, perRep: true });
  });
  it('orders the result screen: today\'s order for the intermediate', () => {
    expect(resultBlocks('intermediate')).toEqual(['count', 'bars', 'card', 'strips', 'account']);
    expect(resultBlocks('')).toEqual(resultBlocks('intermediate'));
  });
  it('the beginner: the account and the tip lead, the numbers follow the question', () => {
    expect(resultBlocks('beginner')).toEqual(['plain', 'count', 'card', 'bars', 'more']);
  });
  it('the expert: the speed change under the bars, the table under the question', () => {
    expect(resultBlocks('expert')).toEqual(['count', 'bars', 'speed', 'card', 'strips', 'table', 'account']);
  });
  it('every level keeps the question: "Oui, c\'est juste" is on every screen', () => {
    for (const l of LEVELS) expect(resultBlocks(l)).toContain('card');
  });
});

describe('the expert\'s table and speed line are the report\'s own, never a new measure', () => {
  for (const fr of [true, false]) {
    const sheet = reportSheet({ lang: fr ? 'fr' : 'en', date: new Date(2026, 8, 30), notes: '', liftName: 'Curl', count: 8, reps: eight, first: 'concentric' });
    it(`gives the report's columns and rows (${fr ? 'fr' : 'en'})`, () => {
      const t = repTable({ reps: eight, first: 'concentric', fr });
      expect(t.columns).toEqual(sheet.columns);
      expect(t.rows).toEqual(sheet.rows);
    });
    // The speed change is not stated while SPEED_CHANGE_SHOWN is off (measures.js, 2 October): the line
    // still derives, but neither the report nor the expert screen shows it.
    it(`keeps the concentric speed line out of the report (${fr ? 'fr' : 'en'})`, () => {
      const line = speedChangeLine(eight, fr);
      expect(line).toBeTruthy();
      expect(sheet.summary).not.toContain(line);
    });
  }
  it('gives no speed line under four whole reps', () => {
    expect(speedChangeLine(eight.slice(0, 3), true)).toBe('');
  });
  it('marks a short rep in the table as the account names it', () => {
    const t = repTable({ reps: eight, first: 'concentric', fr: true });
    const acc = setAccount({ reps: eight, first: 'concentric', fr: true, name: 'Curl', count: 8, previous: null, nth: null });
    expect(acc.short).toEqual([3]);
    expect(t.rows[2][2]).toMatch(/▾$/);
  });
});

// Review, 30 September: a count of saved sets that is not known yet (the sets still being read, or
// storage failing) is not zero: the guide is not forced on a beginner who may have many sets.
describe('the guide before filming, with the saved sets unknown', () => {
  it('does not open the guide while the count is unknown', () => {
    expect(levelView('beginner', { saved: null }).guideFirst).toBe(false);
    expect(levelView('beginner', { saved: 2 }).guideFirst).toBe(true);
    expect(levelView('beginner', { saved: 3 }).guideFirst).toBe(false);
  });
});
