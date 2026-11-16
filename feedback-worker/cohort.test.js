// Usage per phone (16 November 2026; David: "Yes to the tracking, build it"), against SQLite as D1 runs it.
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './worker.js';
import { COHORT_KEEP_DAYS, parseBatch, readCohorts, storedAid, cohortHtml } from './usage.js';

const SQL = ['0001_usage.sql', '0002_cohort.sql'].map(f => readFileSync(new URL(`./migrations/${f}`, import.meta.url), 'utf8'));
const TOKEN = 'a-long-test-token-0123456789';
const PEPPER = 'a-long-test-pepper-0123456789';
const V = { appVersion: '1.4.0 (366271a)', lang: 'fr' };
const A = 'a'.repeat(32), B = 'b'.repeat(32);

function d1(db) {
  const statement = (sql, args = []) => ({
    bind: (...a) => statement(sql, a),
    first: async () => db.prepare(sql).get(...args) ?? null,
    run: async () => db.prepare(sql).run(...args),
    all: async () => ({ results: db.prepare(sql).all(...args).map(r => ({ ...r })) }),
  });
  return { prepare: sql => statement(sql), batch: async list => { for (const s of list) await s.run(); } };
}
function setup(extra = {}) {
  const db = new DatabaseSync(':memory:');
  for (const s of SQL) db.exec(s);
  return { db, env: { DB: d1(db), STATS_TOKEN: TOKEN, RATE_SALT: 'salt', AID_PEPPER: PEPPER, ...extra } };
}
// A request sent on a given UTC day (the worker stamps the day from its clock: the test sets Date).
async function postOn(env, day, body) {
  const real = Date;
  const fixed = new real(`${day}T12:00:00Z`).getTime();
  globalThis.Date = class extends real { constructor(...a) { super(...(a.length ? a : [fixed])); } static now() { return fixed; } };
  try {
    return await worker.fetch(new Request('https://w.example/event', { method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.7' }, body: JSON.stringify(body) }), env);
  } finally { globalThis.Date = real; }
}
const visit = (aid, sess, events) => ({ aid, sess, events: events.map((e, seq) => ({ ...V, ...(typeof e === 'string' ? { event: e } : e), seq })) });

describe('usage per phone', () => {
  it('stores the phone only as a keyed hash, and no address', async () => {
    const { db, env } = setup();
    expect((await postOn(env, '2026-11-16', visit(A, 1, ['open', 'pro_open']))).status).toBe(204);
    const stored = db.prepare('SELECT * FROM usage_event').all();
    expect(stored).toHaveLength(2);
    expect(stored[0].aid).toBe(await storedAid(env, A));
    expect(stored[0].aid).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(stored)).not.toContain(A);
    expect(JSON.stringify(db.prepare('SELECT * FROM usage_event, usage_device, usage_active').all())).not.toContain('203.0.113.7');
    // The daily totals still count every event.
    expect(db.prepare("SELECT SUM(count) AS n FROM usage_daily").get().n).toBe(2);
  });

  it('stores nothing per phone without a pepper of 16 characters', async () => {
    const { db, env } = setup({ AID_PEPPER: 'short' });
    await postOn(env, '2026-11-16', visit(A, 1, ['open']));
    expect(db.prepare('SELECT COUNT(*) AS n FROM usage_event').get().n).toBe(0);
    expect(db.prepare('SELECT SUM(count) AS n FROM usage_daily').get().n).toBe(1);
  });

  it('never takes the kiné path with the phone\'s id (GDPR art. 9)', async () => {
    const { db, env } = setup();
    expect((await postOn(env, '2026-11-16', { aid: A, sess: 1, events: [{ event: 'kine_open', ...V }] })).status).toBe(422);
    expect((await postOn(env, '2026-11-16', { events: [{ event: 'kine_open', ...V }] })).status).toBe(204);
    expect(db.prepare('SELECT COUNT(*) AS n FROM usage_event').get().n).toBe(0);
    expect(db.prepare("SELECT count FROM usage_daily WHERE event = 'kine_open'").get().count).toBe(1);
    expect(parseBatch({ events: [{ event: 'kine_open', seq: 0, ...V }] })).toBeNull();
  });

  it('refuses a malformed id or visit number', () => {
    for (const bad of [{ aid: 'xyz', sess: 1 }, { aid: A }, { aid: A, sess: 0 }, { aid: A, sess: 1.5 }, { aid: A.toUpperCase(), sess: 1 }, { aid: A, sess: 1, extra: 1 }]) {
      expect(parseBatch({ events: [{ event: 'open', ...V }], ...bad })).toBeNull();
    }
  });

  it('writes a step sent twice once', async () => {
    const { db, env } = setup();
    await postOn(env, '2026-11-16', visit(A, 1, ['open']));
    await postOn(env, '2026-11-16', visit(A, 1, ['open']));
    expect(db.prepare('SELECT COUNT(*) AS n FROM usage_event').get().n).toBe(1);
  });

  it('reads phones active, returns, the funnel in order, where the gone stopped, and Espace pro', async () => {
    const { env } = setup();
    // A: first seen on the 1st, back on the 2nd and the 8th; a full visit, then a visit that stops at the video.
    await postOn(env, '2026-11-01', visit(A, 1, ['open', { event: 'choose_lift', lift: 'squat' }, { event: 'film_start', lift: 'squat' }, { event: 'analysis_done', lift: 'squat' }, { event: 'result_kept', lift: 'squat' }]));
    await postOn(env, '2026-11-02', visit(A, 2, ['open', 'pro_open']));
    await postOn(env, '2026-11-08', visit(A, 3, ['open', { event: 'choose_lift', lift: 'squat' }, { event: 'film_start', lift: 'squat' }]));
    // B: first seen on the 1st, never back; a lift chosen before the opening is not a funnel step in order.
    await postOn(env, '2026-11-01', visit(B, 1, [{ event: 'choose_lift', lift: 'squat' }, 'open']));
    const c = await readCohorts(env, 30, new Date('2026-11-30T12:00:00Z'));
    expect(c.daily.find(r => r.day === '2026-11-01').phones).toBe(2);
    expect(c.retention.find(r => r.cohort === '2026-11-01')).toEqual({ cohort: '2026-11-01', phones: 2, d1: 1, d7: 1, d30: 0 });
    expect(c.funnel).toEqual([['Opened', 4], ['Lift chosen', 2], ['Video chosen', 2], ['Count shown', 1], ['Count kept', 1]]);
    // Both gone 14 days before the 30th: A last did film_start, B last did open.
    expect(c.gone.sort((x, y) => x.event.localeCompare(y.event))).toEqual([{ event: 'film_start', phones: 1 }, { event: 'open', phones: 1 }]);
    expect(c.pro).toBe(1);
    const html = cohortHtml(c);
    expect(html).toContain('Coming back');
    expect(html).toContain('50%');
  });

  it('deletes the rows per phone after 25 months', async () => {
    const { db, env } = setup();
    await postOn(env, '2024-01-01', visit(A, 1, ['open']));
    await postOn(env, '2026-11-16', visit(B, 1, ['open']));
    await worker.scheduled({ scheduledTime: Date.parse('2026-11-16T12:00:00Z') }, env);
    expect(COHORT_KEEP_DAYS).toBe(761);
    expect(db.prepare('SELECT COUNT(*) AS n FROM usage_event').get().n).toBe(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM usage_device').get().n).toBe(1);
  });

  it('shows the phones on the dashboard', async () => {
    const { env } = setup();
    await postOn(env, '2026-11-16', visit(A, 1, ['open']));
    const res = await worker.fetch(new Request('https://w.example/dashboard', { headers: { Authorization: `Bearer ${TOKEN}` } }), env);
    expect(await res.text()).toContain('Phones active');
  });
});
