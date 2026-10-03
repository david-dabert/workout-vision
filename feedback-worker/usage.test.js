// The usage counts against SQLite, as D1 runs them (analytics, 3 October 2026).
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './worker.js';
import { USAGE_RATE_MAX, rateKey, dashboardHtml } from './usage.js';
import { durationBucket, validEvent, EVENT_NAMES, MAX_BATCH } from './usage-schema.js';

const MIGRATION = readFileSync(new URL('./migrations/0001_usage.sql', import.meta.url), 'utf8');
const TOKEN = 'a-long-test-token-0123456789';

// The part of D1's interface the worker uses, over SQLite.
function d1(db) {
  const statement = (sql, args = []) => ({
    bind: (...a) => statement(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => db.prepare(sql).run(...args),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
  });
  return { prepare: sql => statement(sql), batch: async list => { for (const s of list) await s.run(); } };
}

function setup(extra = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(MIGRATION);
  return { db, env: { DB: d1(db), STATS_TOKEN: TOKEN, RATE_SALT: 'test-salt', ...extra } };
}

const V = { appVersion: '1.4.0 (366271a)', lang: 'fr' };
const post = (env, body, ip = '203.0.113.7') => worker.fetch(new Request('https://w.example/event', {
  method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'CF-Connecting-IP': ip }, body: typeof body === 'string' ? body : JSON.stringify(body),
}), env);
const rows = db => db.prepare('SELECT * FROM usage_daily ORDER BY event, lift').all().map(r => ({ ...r }));

describe('POST /event', () => {
  it('adds the events to daily counts, and keeps nothing else', async () => {
    const { db, env } = setup();
    const res = await post(env, { events: [
      { event: 'open', ...V },
      { event: 'choose_lift', lift: 'squat', tier: 'beta', ...V },
      { event: 'choose_lift', lift: 'squat', tier: 'beta', ...V },
      { event: 'session_end', durationBucket: '1-5', ...V },
    ] });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const day = new Date().toISOString().slice(0, 10);
    expect(rows(db)).toEqual([
      { day, event: 'choose_lift', lift: 'squat', tier: 'beta', duration_bucket: '', app_version: V.appVersion, lang: 'fr', count: 2 },
      { day, event: 'open', lift: '', tier: '', duration_bucket: '', app_version: V.appVersion, lang: 'fr', count: 1 },
      { day, event: 'session_end', lift: '', tier: '', duration_bucket: '1-5', app_version: V.appVersion, lang: 'fr', count: 1 },
    ]);
    // A second request adds to the same rows.
    await post(env, { event: 'open', ...V });
    expect(db.prepare("SELECT count FROM usage_daily WHERE event = 'open'").get().count).toBe(2);
  });

  it('accepts a single event as the body', async () => {
    const { db, env } = setup();
    expect((await post(env, { event: 'history_open', lang: 'en', appVersion: '1.4.0' })).status).toBe(204);
    expect(rows(db)).toHaveLength(1);
  });

  const bad = {
    'an unknown event': { event: 'login', ...V },
    'a field outside the list': { event: 'open', userId: 'u1', ...V },
    'a lift on an event that carries none': { event: 'open', lift: 'squat', ...V },
    'a duration on an event that carries none': { event: 'open', durationBucket: '<1', ...V },
    'a duration bucket not listed': { event: 'session_end', durationBucket: '3', ...V },
    'a tier without a lift': { event: 'choose_lift', tier: 'beta', ...V },
    'a tier not listed': { event: 'choose_lift', lift: 'squat', tier: 'gold', ...V },
    'a lift that is not a catalogue key': { event: 'choose_lift', lift: 'Squat <b>', ...V },
    'a language not listed': { event: 'open', appVersion: V.appVersion, lang: 'de' },
    'no version': { event: 'open', lang: 'fr' },
    'a version of free text': { event: 'open', appVersion: 'x'.repeat(33), lang: 'fr' },
    'a number as the lift': { event: 'film_start', lift: 3, ...V },
    'a nested object': { event: 'open', ...V, lang: { fr: 1 } },
    'an array at the top': [{ event: 'open', ...V }],
    'a batch with a key beside events': { events: [{ event: 'open', ...V }], sid: 'x' },
    'an empty batch': { events: [] },
    'a batch over the limit': { events: Array.from({ length: MAX_BATCH + 1 }, () => ({ event: 'open', ...V })) },
    'one bad event in a batch': { events: [{ event: 'open', ...V }, { event: 'open', ip: '1.2.3.4', ...V }] },
  };
  for (const [name, body] of Object.entries(bad)) {
    it(`refuses ${name}, and stores nothing`, async () => {
      const { db, env } = setup();
      expect((await post(env, body)).status).toBe(422);
      expect(rows(db)).toEqual([]);
    });
  }

  it('refuses a body that is not JSON, or too large', async () => {
    const { db, env } = setup();
    expect((await post(env, 'not json')).status).toBe(400);
    expect((await post(env, JSON.stringify({ event: 'open', ...V, pad: 'x'.repeat(5000) }))).status).toBe(413);
    expect(rows(db)).toEqual([]);
  });

  it('limits the events per IP per minute, without storing the IP', async () => {
    const { db, env } = setup();
    const batch = { events: Array.from({ length: MAX_BATCH }, () => ({ event: 'open', ...V })) };
    let status = 204, sent = 0;
    while (status === 204 && sent < 1000) { status = (await post(env, batch)).status; sent += MAX_BATCH; }
    expect(status).toBe(429);
    expect(sent).toBe(Math.ceil((USAGE_RATE_MAX + 1) / MAX_BATCH) * MAX_BATCH);
    // Another IP is not held back.
    expect((await post(env, { event: 'open', ...V }, '198.51.100.2')).status).toBe(204);
    // The rate table holds hashes, never the IP; the counts table holds no trace of either.
    const keys = db.prepare('SELECT key FROM usage_rate').all().map(r => r.key);
    expect(keys.some(k => k.includes('203.0.113.7'))).toBe(false);
    const dump = JSON.stringify(rows(db));
    expect(dump).not.toContain('203.0.113');
    for (const k of keys) expect(dump).not.toContain(k);
    expect(db.prepare('PRAGMA table_info(usage_daily)').all().map(c => c.name))
      .toEqual(['day', 'event', 'lift', 'tier', 'duration_bucket', 'app_version', 'lang', 'count']);
  });

  it('forgets the rate keys after two minutes, and hashes an IP differently every day', async () => {
    const { db, env } = setup();
    const { overRate } = await import('./usage.js');
    const t = Date.UTC(2026, 9, 3, 12, 0, 0);
    await overRate(env, 'k', 1, t);
    await overRate(env, 'k', 1, t + 60000);
    expect(db.prepare('SELECT COUNT(*) AS n FROM usage_rate').get().n).toBe(2);
    await overRate(env, 'k', 1, t + 180000);
    expect(db.prepare('SELECT COUNT(*) AS n FROM usage_rate').get().n).toBe(1);
    expect(await rateKey(env, '203.0.113.7', '2026-10-03')).not.toBe(await rateKey(env, '203.0.113.7', '2026-10-04'));
    expect(await rateKey(env, '203.0.113.7', '2026-10-03')).not.toBe(await rateKey({ RATE_SALT: 'other' }, '203.0.113.7', '2026-10-03'));
  });
});

describe('GET /stats and /dashboard', () => {
  const get = (env, path, headers = {}) => worker.fetch(new Request(`https://w.example${path}`, { headers }), env);

  it('answer only with the token', async () => {
    const { env } = setup();
    for (const path of ['/stats', '/dashboard', '/feedback']) {
      expect((await get(env, path)).status).toBe(401);
      expect((await get(env, `${path}?token=wrong-token-0123456789`)).status).toBe(401);
      expect((await get(env, path, { Authorization: 'Bearer nope' })).status).toBe(401);
    }
    // No token set, or one too short to be a secret: closed.
    expect((await get({ ...env, STATS_TOKEN: undefined }, '/stats?token=')).status).toBe(401);
    expect((await get({ ...env, STATS_TOKEN: 'short' }, '/stats?token=short')).status).toBe(401);
  });

  it('return the counts of the period', async () => {
    const { db, env } = setup();
    await post(env, { events: [{ event: 'open', ...V }, { event: 'analysis_done', lift: 'bicep_curl', tier: 'beta', ...V }] });
    db.prepare("INSERT INTO usage_daily VALUES ('2020-01-01', 'open', '', '', '', '1.0.0', 'en', 5)").run();
    const res = await get(env, '/stats?days=7', { Authorization: `Bearer ${TOKEN}` });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const data = await res.json();
    expect(data.rows.map(r => [r.event, r.lift, r.count])).toEqual([['analysis_done', 'bicep_curl', 1], ['open', '', 1]]);
    const html = await (await get(env, `/dashboard?token=${TOKEN}`)).text();
    expect(html).toContain('<td>bicep_curl</td>');
    expect(html).toContain('By day');
  });

  it('escape what the table shows', () => {
    const html = dashboardHtml({ from: '2026-10-01', to: '2026-10-03', rows: [{ day: '2026-10-03', event: 'choose_lift', lift: '<script>', tier: 'beta', durationBucket: '', appVersion: '1', lang: 'fr', count: 1 }] });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('the schema', () => {
  it('holds the migration, so a new database and a migrated one are the same', () => {
    const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
    const body = MIGRATION.slice(MIGRATION.indexOf('CREATE TABLE'));
    expect(schema).toContain(body.trim());
  });
});

describe('the events', () => {
  it('bucket a visit in minutes', () => {
    expect([0, 59999, 60000, 299999, 300000, 899999, 900000, 7200000].map(durationBucket)).toEqual(['<1', '<1', '1-5', '1-5', '5-15', '5-15', '>15', '>15']);
    expect(durationBucket(NaN)).toBe(null);
    expect(durationBucket(-1)).toBe(null);
  });
  it('are the list the dashboard reads', () => {
    expect(EVENT_NAMES).toContain('analysis_refused');
    expect(validEvent({ event: 'toString', ...V })).toBe(null);
    expect(validEvent({ event: '__proto__', ...V })).toBe(null);
  });
});
