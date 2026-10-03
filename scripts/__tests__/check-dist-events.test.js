// The deploy check that no events URL ships while VITE_EVENTS_URL is pinned empty (scripts/check-dist-events.mjs,
// deploy.yml; WP0.3 of docs/SPEC-production.md).
import { afterAll, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findEventsUrls } from '../check-dist-events.mjs';

const made = [];
afterAll(() => { for (const d of made) rmSync(d, { recursive: true, force: true }); });
const CSP = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; connect-src 'self' blob:; img-src 'self'\" />";
function site(files) {
  const dir = mkdtempSync(join(tmpdir(), 'wv-dist-'));
  made.push(dir);
  for (const [name, text] of Object.entries(files)) { mkdirSync(join(dir, name, '..'), { recursive: true }); writeFileSync(join(dir, name), text); }
  return dir;
}

describe('a build pinned off', () => {
  it('passes with no events URL and the policy as written', async () => {
    const dir = site({ 'index.html': CSP, 'assets/a.js': 'const ENDPOINT="";fetch("https://example.org/data.json")' });
    expect(await findEventsUrls(dir)).toEqual([]);
  });
  it('fails on a worker address, a URL ending in /event, or a widened connect-src', async () => {
    const dir = site({
      'index.html': CSP.replace("blob:;", 'blob: https://x.y.workers.dev;'),
      'assets/a.js': 'const E="https://x.y.workers.dev/event";',
      'assets/b.js': 'const E="https://counts.example.com/event";',
    });
    const found = await findEventsUrls(dir);
    expect(found).toContainEqual({ file: 'assets/a.js', found: 'https://x.y.workers.dev/event' });
    expect(found).toContainEqual({ file: 'assets/b.js', found: 'https://counts.example.com/event' });
    expect(found).toContainEqual({ file: 'index.html', found: "connect-src 'self' blob: https://x.y.workers.dev" });
  });
  it('fails on the repository variable found verbatim, whatever its shape', async () => {
    const dir = site({ 'assets/a.js': 'const E="https://stats.example.net/v1/hit";' });
    expect(await findEventsUrls(dir, { known: ['https://stats.example.net/v1/hit'] })).toEqual([{ file: 'assets/a.js', found: 'https://stats.example.net/v1/hit' }]);
  });
});

describe('a build given an events URL (after D6)', () => {
  it('allows that origin only', async () => {
    const url = 'https://wv.dd.workers.dev/event';
    const ok = site({ 'index.html': CSP.replace("blob:;", 'blob: https://wv.dd.workers.dev;'), 'assets/a.js': `const E="${url}";` });
    expect(await findEventsUrls(ok, { url })).toEqual([]);
    const other = site({ 'assets/a.js': `const E="${url}";const F="https://other.dd.workers.dev/event";` });
    expect(await findEventsUrls(other, { url })).toEqual([{ file: 'assets/a.js', found: 'https://other.dd.workers.dev/event' }]);
  });
});
