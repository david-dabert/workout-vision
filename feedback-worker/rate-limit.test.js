// The dormant feedback worker's rate limit against SQLite, as D1 runs it (Astra's audit, FINDING-030).
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { isRateLimited } from './worker.js';

// The part of D1's interface the worker uses, over SQLite.
const d1 = db => ({ prepare: sql => ({ bind: (...args) => ({ first: async () => db.prepare(sql).get(...args), run: async () => db.prepare(sql).run(...args) }) }) });

describe('feedback rate limit', () => {
  it('counts the rows inserted in the last minute, as the worker inserts them', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE feedback (ip_hash TEXT, created_at TEXT)');
    const env = { DB: d1(db) };
    expect(await isRateLimited(env, 'a')).toBe(false);
    for (let i = 0; i < 20; i++) db.prepare("INSERT INTO feedback VALUES ('a', datetime('now'))").run();
    expect(await isRateLimited(env, 'a')).toBe(true);
    expect(await isRateLimited(env, 'b')).toBe(false);
  });
  it('lets through rows older than the window', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE feedback (ip_hash TEXT, created_at TEXT)');
    for (let i = 0; i < 20; i++) db.prepare("INSERT INTO feedback VALUES ('a', datetime('now', '-2 minutes'))").run();
    expect(await isRateLimited({ DB: d1(db) }, 'a')).toBe(false);
  });
});
