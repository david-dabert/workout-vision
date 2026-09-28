import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

// On iOS Safari a native switch input takes horizontal drags for its thumb, so a drag that
// begins on one (a swipe of the lift cards, a scroll of a screen) never reaches the page.
// Every screen scrolls, so no screen of the app may use one (28 September 2026).
describe('no switch input on any screen', () => {
  it('has no input switch in the experience screens or the analysis screen', () => {
    const dir = new URL('../../components/experience/', import.meta.url);
    const files = readdirSync(dir).filter(f => f.endsWith('.jsx')).map(f => new URL(f, dir));
    files.push(new URL('../../components/CoreUpload.jsx', import.meta.url));
    const found = files.filter(f => /switch:\s*''|\bswitch\b\s*=|<input[^>]*\bswitch\b/.test(readFileSync(f, 'utf8'))).map(f => f.pathname.split('/').pop());
    expect(found).toEqual([]);
  });
});
