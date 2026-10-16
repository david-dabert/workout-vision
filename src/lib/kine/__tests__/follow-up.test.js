import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The follow-up kept on the physiotherapist's phone (store.js), with localStorage stubbed.
let store;
beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
  vi.stubGlobal('sessionStorage', { getItem: k => store[`s:${k}`] ?? null, setItem: (k, v) => { store[`s:${k}`] = String(v); }, removeItem: k => { delete store[`s:${k}`]; } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

const result = (patient, id, date, within, verdict = within >= 0.9 ? 'match' : 'revise') => ({
  id, patient, date, verdict, tempo: 1,
  joints: [{ name: 'rightShoulder', within, range: 1 }, { name: 'rightElbow', within: Math.min(1, within + 0.05), range: 1 }],
  holds: [{ ref: 90, att: 88, refSec: 3, attSec: 3, status: 'held' }, { ref: 170, att: 150, refSec: 3, attSec: 1, status: 'angle' }],
});

describe('the follow-up', () => {
  it('keeps each result once, and groups them by patient and exercise in date order', async () => {
    const { keepResult, followUp, hasResult } = await import('../store.js');
    expect(keepResult(result('Christophe', 'mains-jointes', '2026-10-20T09:00', 0.62))).toBe('kept');
    expect(keepResult(result(' christophe ', 'mains-jointes', '2026-10-16T09:00', 0.4))).toBe('kept');
    expect(keepResult(result('Christophe', 'mains-jointes', '2026-10-20T09:00', 0.62))).toBe('already');
    expect(hasResult(result('Christophe', 'mains-jointes', '2026-10-20T09:00', 0.62))).toBe(true);
    keepResult(result('Anne', 'elevation-paliers', '2026-10-18T10:00', 0.95));
    const f = followUp();
    expect(f.map(p => [p.key, p.count])).toEqual([['christophe', 2], ['anne', 1]]);
    expect(f[0].exercises[0].sessions.map(s => s.date)).toEqual(['2026-10-16T09:00', '2026-10-20T09:00']);
  });

  it('refuses what is not a result', async () => {
    const { keepResult, readResults } = await import('../store.js');
    expect(keepResult({ id: 'nope' })).toBe('invalid');
    expect(keepResult(null)).toBe('invalid');
    expect(readResults()).toEqual([]);
  });

  it('says so when the storage is blocked or full, instead of claiming the result was kept', async () => {
    localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    const { keepResult } = await import('../store.js');
    expect(keepResult(result('Christophe', 'mains-jointes', '2026-10-16T09:00', 0.5))).toBe('failed');
  });

  it('keeps two patients with no name apart, by their programme', async () => {
    const { keepResult, followUp } = await import('../store.js');
    keepResult({ ...result('', 'mains-jointes', '2026-10-16T09:00', 0.5), prog: 'abc1' });
    keepResult({ ...result('', 'mains-jointes', '2026-10-16T09:00', 0.5), prog: 'xyz2' });
    expect(followUp().map(p => p.key).sort()).toEqual(['#abc1', '#xyz2']);
  });

  it('takes the share within tolerance of a session from its measure furthest from the reference', async () => {
    const { sessionWithin } = await import('../store.js');
    expect(sessionWithin(result('C', 'mains-jointes', '', 0.7))).toBe(0.7);
    expect(sessionWithin({ joints: [] })).toBeNull();
  });

  it('removes one patient, and only that one', async () => {
    const { keepResult, forgetPatient, followUp } = await import('../store.js');
    keepResult(result('Christophe', 'mains-jointes', '2026-10-16T09:00', 0.5));
    keepResult(result('Anne', 'mains-jointes', '2026-10-16T09:00', 0.5));
    forgetPatient('christophe');
    expect(followUp().map(p => p.key)).toEqual(['anne']);
  });

  it('hands a patient from the result screen to the workspace, once', async () => {
    const { requestFollowUp, takeFollowUpRequest } = await import('../store.js');
    requestFollowUp('christophe');
    expect(takeFollowUpRequest()).toBe('christophe');
    expect(takeFollowUpRequest()).toBeNull();
  });

  it('prints a patient\'s follow-up sheet', async () => {
    const { keepResult, followUp } = await import('../store.js');
    keepResult(result('Christophe', 'mains-jointes', '2026-10-16T09:00', 0.5));
    keepResult(result('Christophe', 'mains-jointes', '2026-10-20T09:00', 0.92));
    const { followUpPdf } = await import('../pdf.js');
    const doc = followUpPdf(followUp()[0], { lang: 'fr', practitioner: { name: 'Olivier' } });
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
  });
});
