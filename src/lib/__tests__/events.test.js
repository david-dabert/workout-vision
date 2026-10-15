// The anonymous usage counts the app sends (src/lib/events.js; analytics, 3 October 2026).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { USAGE_EVENTS, COMMON_FIELDS, validEvent } from '../../../feedback-worker/usage-schema.js';

const URL_ = 'https://events.example.workers.dev/event';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); vi.resetModules(); });

// A phone: storage, a navigator with a beacon, and the page's listeners. Every write to storage is recorded.
function phone({ url = URL_, nav = {}, store = {}, keepalive = true } = {}) {
  vi.useFakeTimers();
  if (url !== null) vi.stubEnv('VITE_EVENTS_URL', url);
  else vi.stubEnv('VITE_EVENTS_URL', '');
  const writes = [];
  const beacons = [];
  const fetches = [];
  const listeners = {};
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { writes.push(k); store[k] = String(v); },
    removeItem: k => { writes.push(k); delete store[k]; },
  });
  vi.stubGlobal('navigator', { language: 'fr-FR', sendBeacon: (u, body) => { beacons.push({ u, body }); return true; }, ...nav });
  if (keepalive !== null) {
    vi.stubGlobal('fetch', (u, init) => { if (keepalive === 'throws') throw new TypeError('keepalive refused'); fetches.push({ u, init }); return Promise.resolve(new Response(null, { status: 204 })); });
    // A Request whose prototype knows keepalive, or not (an older Firefox).
    vi.stubGlobal('Request', keepalive === false ? class {} : class { get keepalive() { return true; } });
  } else vi.stubGlobal('fetch', undefined);
  vi.stubGlobal('addEventListener', (type, fn) => { (listeners[type] ||= []).push(fn); });
  vi.stubGlobal('document', { visibilityState: 'visible', cookie: '', addEventListener: (type, fn) => { (listeners[`doc:${type}`] ||= []).push(fn); } });
  const fire = type => (listeners[type] || []).forEach(fn => fn());
  const sent = () => [...beacons.map(b => b.body), ...fetches.map(f => f.init.body)].flatMap(b => JSON.parse(b).events);
  // Every request sent, by whichever way (fetch first, beacon as fallback): { u, body }.
  const all = () => [...beacons, ...fetches.map(f => ({ u: f.u, body: f.init.body }))];
  return { writes, beacons, fetches, fire, sent, store, get posts() { return all(); } };
}
// The module, with the language the app shows set as App.jsx sets it from React state (null: not yet rendered).
const load = async (lang = 'fr') => { const ev = await import('../events.js'); if (lang) ev.setEventsLang(lang); return ev; };

describe('track', () => {
  it('sends nothing, and stores nothing, when the build names no server', async () => {
    const p = phone({ url: null });
    const ev = await load();
    expect(ev.eventsConfigured()).toBe(false);
    expect(ev.track('open')).toBe(false);
    expect(ev.track('choose_lift', { lift: 'squat' })).toBe(false);
    ev.startEvents();
    p.fire('pagehide');
    vi.runAllTimers();
    ev.flushEvents();
    expect(p.posts).toEqual([]);
    expect(p.fetches).toEqual([]);
    expect(p.writes).toEqual([]);
  });

  it('sends only the listed events, with only their listed fields', async () => {
    const p = phone();
    const ev = await load();
    expect(ev.track('choose_lift', { lift: 'squat', count: 9, userId: 'u1', video: 'blob:x', tier: 'gold', durationBucket: '<1' })).toBe(true);
    expect(ev.track('open', { lift: 'squat', name: 'David' })).toBe(true);
    expect(ev.track('login')).toBe(false);
    expect(ev.track('__proto__')).toBe(false);
    expect(ev.track('toString')).toBe(false);
    expect(ev.track('choose_lift', { lift: 'Not A Key!' })).toBe(false);
    ev.flushEvents();
    const got = p.sent();
    expect(got.map(e => e.event)).toEqual(['choose_lift', 'open']);
    // The tier is the lift's own (offer.js), never the caller's.
    expect(got[0]).toEqual({ event: 'choose_lift', lift: 'squat', tier: 'beta', appVersion: expect.any(String), lang: 'fr' });
    expect(got[1]).toEqual({ event: 'open', appVersion: expect.any(String), lang: 'fr' });
    for (const e of got) {
      expect(validEvent(e)).not.toBe(null);
      for (const k of Object.keys(e)) expect(['event', ...COMMON_FIELDS, ...USAGE_EVENTS[e.event]]).toContain(k);
    }
    // The request is the batch alone: no other key beside the events.
    expect(Object.keys(JSON.parse(p.posts[0].body))).toEqual(['events']);
    expect(p.posts[0].u).toBe(URL_);
  });

  it('stores no identifier: no write to storage, no cookie', async () => {
    const p = phone();
    const ev = await load();
    ev.startEvents();
    ev.track('choose_lift', { lift: 'bicep_curl' });
    p.fire('pagehide');
    expect(p.writes).toEqual([]);
    expect(document.cookie).toBe('');
    expect(p.sent().length).toBe(3);
  });

  it('waits to send events together, and sends at once when the page is hidden or the batch is full', async () => {
    const p = phone();
    const ev = await load();
    ev.startEvents();
    ev.track('history_open');
    expect(p.posts).toHaveLength(0);
    vi.advanceTimersByTime(4000);
    expect(p.posts).toHaveLength(1);
    expect(p.sent().map(e => e.event)).toEqual(['open', 'history_open']);
    ev.track('guide_open');
    document.visibilityState = 'hidden';
    p.fire('doc:visibilitychange');
    expect(p.posts).toHaveLength(2);
    for (let i = 0; i < 20; i++) ev.track('guide_open');
    expect(p.posts).toHaveLength(3);
    expect(JSON.parse(p.posts[2].body).events).toHaveLength(20);
  });

  it('stops after 200 events in a visit', async () => {
    const p = phone();
    const ev = await load();
    let n = 0;
    for (let i = 0; i < 250; i++) if (ev.track('guide_open')) n++;
    ev.flushEvents();
    expect(n).toBe(200);
    expect(p.sent()).toHaveLength(200);
  });

  it('counts the visit length in a bucket at the end, once', async () => {
    const p = phone();
    const ev = await load();
    let t = 0;
    ev.startEvents(() => t);
    t = 6 * 60000;
    p.fire('pagehide');
    p.fire('pagehide');
    const ends = p.sent().filter(e => e.event === 'session_end');
    expect(ends).toEqual([{ event: 'session_end', durationBucket: '5-15', appVersion: expect.any(String), lang: 'fr' }]);
  });

  it('sends by a keepalive fetch without credentials first, never by the beacon, which carries cookies (N7)', async () => {
    const p = phone();
    const ev = await load();
    ev.track('open');
    ev.flushEvents();
    expect(p.fetches).toHaveLength(1);
    expect(p.fetches[0].u).toBe(URL_);
    expect(p.fetches[0].init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'omit', referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'text/plain;charset=UTF-8' } });
    expect(p.beacons).toEqual([]);
    expect(p.sent().map(e => e.event)).toEqual(['open']);
  });

  it('falls back to the beacon only where fetch cannot keep the request alive, or throws at once', async () => {
    for (const keepalive of [false, null, 'throws']) {
      vi.resetModules();
      const p = phone({ keepalive });
      const ev = await load();
      ev.track('open');
      ev.flushEvents();
      expect(p.fetches, String(keepalive)).toEqual([]);
      expect(p.beacons.map(b => JSON.parse(b.body).events.map(e => e.event)), String(keepalive)).toEqual([['open']]);
    }
  });

  it('sends nothing when the browser asks not to be tracked', async () => {
    for (const nav of [{ globalPrivacyControl: true }, { doNotTrack: '1' }]) {
      vi.resetModules();
      const p = phone({ nav });
      const ev = await load();
      ev.startEvents();
      expect(ev.track('choose_lift', { lift: 'squat' })).toBe(false);
      p.fire('pagehide');
      expect(p.posts).toEqual([]);
    }
  });

  it('sends nothing once the person turns it off, drops what waits, and starts again when turned back on', async () => {
    const p = phone();
    const ev = await load();
    ev.track('open');
    ev.setCountingOff(true);
    expect(p.store.wv_count_off).toBe('1');
    expect(ev.track('history_open')).toBe(false);
    vi.runAllTimers();
    ev.flushEvents();
    expect(p.posts).toEqual([]);
    ev.setCountingOff(false);
    expect(p.store.wv_count_off).toBeUndefined();
    expect(ev.track('history_open')).toBe(true);
    ev.flushEvents();
    expect(p.sent().map(e => e.event)).toEqual(['history_open']);
  });

  it('reads the choice made in an earlier visit', async () => {
    const p = phone({ store: { wv_count_off: '1' } });
    const ev = await load();
    ev.startEvents();
    p.fire('pagehide');
    expect(p.posts).toEqual([]);
  });

  it('counts in the language the app shows, from its state, never from wv_lang (PRIV-4)', async () => {
    const p = phone({ store: { wv_lang: 'fr' } });
    const ev = await load('en');
    ev.track('open');
    ev.setEventsLang('fr');
    ev.track('guide_open');
    ev.setEventsLang('de');
    ev.track('history_open');
    ev.flushEvents();
    expect(p.sent().map(e => [e.event, e.lang])).toEqual([['open', 'en'], ['guide_open', 'fr'], ['history_open', 'fr']]);
  });

  it('counts nothing before the app has shown its language; the opening waits for it, once', async () => {
    const p = phone({ store: { wv_lang: 'fr' } });
    const ev = await load(null);
    expect(ev.track('guide_open')).toBe(false);
    ev.startEvents();
    vi.runAllTimers();
    ev.flushEvents();
    expect(p.posts).toEqual([]);
    ev.setEventsLang('en');
    ev.setEventsLang('en');
    ev.flushEvents();
    expect(p.sent()).toEqual([{ event: 'open', appVersion: expect.any(String), lang: 'en' }]);
  });
});

describe('no event at all, the first opening included, when the person or the browser refuses (PRIV-4)', () => {
  const refusals = [
    ['Global Privacy Control', { nav: { globalPrivacyControl: true } }],
    ['Do Not Track', { nav: { doNotTrack: '1' } }],
    ['the opt-out of an earlier visit', { store: { wv_count_off: '1' } }],
  ];
  for (const [name, opts] of refusals) {
    for (const langFirst of [true, false]) {
      it(`${name}, the language known ${langFirst ? 'before' : 'after'} the start: no opening, no listener, nothing sent`, async () => {
        const p = phone(opts);
        const ev = await load(langFirst ? 'fr' : null);
        ev.startEvents();
        if (!langFirst) ev.setEventsLang('fr');
        ev.track('choose_lift', { lift: 'squat' });
        p.fire('pagehide');
        p.fire('doc:visibilitychange');
        vi.runAllTimers();
        ev.flushEvents();
        expect(p.posts).toEqual([]);
        expect(p.writes).toEqual([]);
      });
    }
  }

  it('the opt-out tapped before the app shows its language drops the waiting opening', async () => {
    const p = phone();
    const ev = await load(null);
    ev.startEvents();
    ev.setCountingOff(true);
    ev.setEventsLang('fr');
    p.fire('pagehide');
    vi.runAllTimers();
    expect(p.posts).toEqual([]);
  });

  it('names the host the counts go to, and none when the build names no server', async () => {
    phone();
    const ev = await load();
    expect(ev.eventsHost()).toBe('events.example.workers.dev');
    expect(ev.eventsHost('')).toBe('');
    expect(ev.eventsHost('not a url')).toBe('');
  });
});
