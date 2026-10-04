// POST /ingest is gone (WP0.4, docs/SPEC-production.md, 3 October 2026): it answers 404 and writes nothing, whatever
// the body; the feedback table is left as it is (D24 is David's); the usage endpoints answer as before.
// This file held the old /ingest rate limit's test (Astra's audit, FINDING-030) until that code was removed with it.
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './worker.js';

const SCHEMA = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
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

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  return { db, env: { DB: d1(db), STATS_TOKEN: TOKEN, RATE_SALT: 'test-salt' } };
}

// A body the removed endpoint accepted (schema v1, a valid kind, free text).
const OLD_BODY = JSON.stringify({ v: 1, kind: 'feedback', message: 'free text', detected: 'squat', appVersion: '1.4.0' });
const call = (env, method, path, init = {}) => worker.fetch(new Request(`https://w.example${path}`, { method, ...init }), env);
const count = (db, table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

describe('POST /ingest is removed', () => {
  it('answers 404 to a body it used to store, and writes nothing', async () => {
    const { db, env } = setup();
    for (const type of ['application/json', 'text/plain;charset=UTF-8']) {
      const res = await call(env, 'POST', '/ingest', { headers: { 'Content-Type': type, 'CF-Connecting-IP': '203.0.113.7' }, body: OLD_BODY });
      expect(res.status).toBe(404);
    }
    expect(count(db, 'feedback')).toBe(0);
    expect(count(db, 'usage_daily')).toBe(0);
    expect(count(db, 'usage_rate')).toBe(0);
  });

  it('answers 404 to every method on /ingest, and to the old path with a trailing slash', async () => {
    const { env } = setup();
    for (const [method, path] of [['GET', '/ingest'], ['PUT', '/ingest'], ['DELETE', '/ingest'], ['POST', '/ingest/']]) {
      expect((await call(env, method, path, method === 'GET' || method === 'DELETE' ? {} : { body: OLD_BODY })).status).toBe(404);
    }
  });

  it('keeps the feedback table and its rows: dropping them is D24, David\'s decision', async () => {
    const { db, env } = setup();
    db.prepare("INSERT INTO feedback (kind, message, created_at) VALUES ('rating', 'up', datetime('now'))").run();
    await call(env, 'POST', '/ingest', { body: OLD_BODY });
    expect(count(db, 'feedback')).toBe(1);
    expect(SCHEMA).toMatch(/CREATE TABLE IF NOT EXISTS feedback \(/);
  });

  it('no longer holds the IP hashing with a constant salt', () => {
    const source = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
    expect(source).not.toMatch(/wv-salt-2026/);
    expect(source).not.toMatch(/INSERT INTO feedback/);
    expect(source).not.toMatch(/pathname === '\/ingest'/);
  });
});

describe('the usage endpoints are unaffected', () => {
  it('POST /event still counts', async () => {
    const { db, env } = setup();
    const res = await call(env, 'POST', '/event', { headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'CF-Connecting-IP': '203.0.113.7' }, body: JSON.stringify({ event: 'open', appVersion: '1.4.0', lang: 'fr' }) });
    expect(res.status).toBe(204);
    expect(count(db, 'usage_daily')).toBe(1);
  });

  it('GET /stats, GET /dashboard and GET /feedback still answer with the token, and 401 without it', async () => {
    const { env } = setup();
    const auth = { headers: { Authorization: `Bearer ${TOKEN}` } };
    for (const path of ['/stats?days=1', '/dashboard?days=1', '/feedback']) {
      expect((await call(env, 'GET', path, auth)).status).toBe(200);
      expect((await call(env, 'GET', path)).status).toBe(401);
    }
  });

  it('the preflight still answers', async () => {
    const { env } = setup();
    const res = await call(env, 'OPTIONS', '/event');
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
