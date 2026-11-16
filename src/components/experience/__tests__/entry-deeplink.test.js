import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Entry.jsx draws its particles on canvases made when its module loads: a stand-in canvas, enough to import it here.
let shouldShowEntry;
beforeAll(async () => {
  const ctx = new Proxy({}, { get: () => () => ({ addColorStop: () => {} }) });
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ctx }) });
  ({ shouldShowEntry } = await import('../Entry'));
});

// Think tank of 16 November 2026: a patient tapping a physiotherapist's programme link met the welcome screen first.
const at = (hash, seen = null) => {
  vi.stubGlobal('location', { search: '', hash });
  vi.stubGlobal('localStorage', { getItem: k => (k === 'wv_seen_entry' ? seen : null), setItem: () => {} });
};

describe('the welcome screen', () => {
  afterEach(() => { vi.stubGlobal('location', undefined); vi.stubGlobal('localStorage', undefined); });

  it('opens a programme or a result link on what it carries, on a first visit', () => {
    at('#kine-p=zH4sIAAAA');
    expect(shouldShowEntry()).toBe(false);
    at('#kine-r=zH4sIAAAA');
    expect(shouldShowEntry()).toBe(false);
  });

  it('still welcomes a first visit to the app itself', () => {
    at('');
    expect(shouldShowEntry()).toBe(true);
    at('#kine');
    expect(shouldShowEntry()).toBe(true);
    at('', 'true');
    expect(shouldShowEntry()).toBe(false);
  });
});
