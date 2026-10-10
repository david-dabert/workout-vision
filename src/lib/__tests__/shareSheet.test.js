/**
 * A share sheet asked inside a tap (shareSheet.js). WebKit leaves a sheet that was never answered (the person left for
 * another app, locked the phone) pending for good and refuses every later share with InvalidStateError. Report and
 * Replay waited for the share to settle and took that refusal for a second sheet: "Partager le PDF" and "Partager la
 * vidéo" then did nothing, and said nothing, until the app was reloaded (live-app audit, 10 October 2026).
 */
import { describe, it, expect } from 'vitest';
import { shareSheet } from '../shareSheet';

const named = name => Object.assign(new Error(name), { name });

describe('a share sheet', () => {
  it('takes one tap at a time, without waiting for the sheet to answer', () => {
    let t = 0;
    const s = shareSheet({ now: () => t });
    expect(s.begin()).toBe(true);
    t = 400;
    expect(s.begin()).toBe(false);
    t = 1500;
    expect(s.begin()).toBe(true);
  });

  it('downloads on the next tap after any refusal but the person’s own cancel, a never-answered sheet included', () => {
    const s = shareSheet({ now: () => 0, windowMs: 0 });
    expect(s.shares(true)).toBe(true);
    expect(s.failed(named('AbortError'))).toBe(false);
    expect(s.shares(true)).toBe(true);
    expect(s.failed(named('InvalidStateError'))).toBe(true);
    expect(s.shares(true)).toBe(false);
    // Once downloaded, the next tap tries the sheet again.
    expect(s.shares(true)).toBe(true);
    expect(s.failed(named('NotAllowedError'))).toBe(true);
    expect(s.shares(true)).toBe(false);
  });

  it('downloads when the phone cannot share the file', () => {
    expect(shareSheet().shares(false)).toBe(false);
  });
});
