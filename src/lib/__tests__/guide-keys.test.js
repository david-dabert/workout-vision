// The key list the programme reads (guide-keys.json) is the guide's catalogue's, sorted: regenerate it with
// node scripts/guide-keys.mjs after any change to the catalogue.
import { describe, expect, it } from 'vitest';
import catalogue from '../guide-catalog.json';
import keys from '../guide-keys.json';
import { isGuideKey } from '../guide-keys';

describe('the guide’s keys', () => {
  it('are the catalogue’s keys, sorted, each once', () => {
    expect(keys).toEqual([...new Set(catalogue.map(e => e.key))].sort());
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('name catalogue entries only: no alias, nothing of an object’s own', () => {
    expect(isGuideKey('plank')).toBe(true);
    expect(isGuideKey('machine_seated_back_extension')).toBe(true);
    for (const k of ['lunge', '__proto__', 'constructor', 'toString', '', null, undefined, 42]) expect(isGuideKey(k), String(k)).toBe(false);
  });
});
