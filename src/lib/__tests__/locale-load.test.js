// The French strings load on demand (LanguageContext.jsx). A load that fails, offline after an update
// above all, falls back to English without an unhandled rejection, and the next attempt loads again
// (Astra's audit, FINDING-034).
import { describe, it, expect } from 'vitest';
import { loadLocale } from '../LanguageContext';
import en from '../../locales/en.json';

describe('loading the French strings', () => {
  it('falls back to English when the load fails, and loads on the next attempt', async () => {
    let calls = 0;
    const flaky = () => { calls += 1; return calls === 1 ? Promise.reject(new TypeError('Failed to fetch dynamically imported module')) : Promise.resolve({ default: { hello: 'bonjour' } }); };
    await expect(loadLocale('fr', flaky)).resolves.toBe(en);
    await expect(loadLocale('fr', flaky)).resolves.toEqual({ hello: 'bonjour' });
    expect(calls).toBe(2);
  });
});
