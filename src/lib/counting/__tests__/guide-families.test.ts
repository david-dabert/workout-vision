import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import catalogue from '../../guide-catalog.json';
import familiesJson from '../guide-families.json';
import * as core from '../core';

const families = familiesJson as Record<string, Record<string, unknown>>;
const catalogueKeys = catalogue.map(exercise => exercise.key);

// Angle choices use the catalogue's equipment, category and muscles together.
// Anatomical reference: Neumann, Kinesiology of the Musculoskeletal System,
// 3rd edition (2017), shoulder, elbow, hip and knee chapters. These mappings
// are exercise-specific interpretations, not measurements validated by the text.
describe('guide counting families', () => {
  it('contains exactly one entry per catalogue key and no additional keys', () => {
    expect(catalogueKeys).toHaveLength(304);
    expect(new Set(catalogueKeys).size).toBe(catalogueKeys.length);
    expect(Object.keys(families).sort()).toEqual([...catalogueKeys].sort());

    // Inspect the source too: JSON imports silently discard duplicate keys.
    const source = readFileSync(new URL('../guide-families.json', import.meta.url), 'utf8');
    const tokens = source.match(/"(?:\\.|[^"\\])*"|[{}[\]:,]/g) ?? [];
    const keys: string[] = [];
    let depth = 0;
    tokens.forEach((token, index) => {
      if (token === '{' || token === '[') depth++;
      else if (token === '}' || token === ']') depth--;
      else if (depth === 1 && token.startsWith('"') && tokens[index + 1] === ':') {
        keys.push(JSON.parse(token));
      }
    });
    expect(keys.sort()).toEqual([...catalogueKeys].sort());
  });

  it.each(catalogueKeys)('%s has only allowed fields and values', key => {
    const entry = families[key];
    expect(entry).toBeDefined();
    expect([null, 'elbow', 'shoulder', 'knee', 'hip']).toContain(entry.joint);
    expect(typeof entry.why).toBe('string');
    expect((entry.why as string).trim().length).toBeGreaterThan(0);

    if (entry.joint === null) {
      expect(Object.keys(entry).sort()).toEqual(['joint', 'why']);
      return;
    }

    expect(['high', 'low']).toContain(entry.rest);
    expect(['concentric', 'eccentric']).toContain(entry.first);
    expect(['side', 'front']).toContain(entry.view);
    const fields = ['joint', 'rest', 'first', 'view', 'why'];
    if (Object.hasOwn(entry, 'bothSides')) {
      expect(entry.bothSides).toBe(true);
      fields.push('bothSides');
    }
    expect(Object.keys(entry).sort()).toEqual(fields.sort());
  });

  it('matches the core LIFTS joint, rest and first for every shared key', () => {
    const lifts = (core as unknown as {
      LIFTS?: Record<string, { joint: string; rest: string; first: string }>;
    }).LIFTS;
    // Fail explicitly rather than silently passing when the expected core is absent.
    expect(lifts, 'core.ts must expose the LIFTS table required by the catalogue contract').toBeDefined();
    if (!lifts) throw new Error('Missing core LIFTS table');
    const sharedKeys = Object.keys(lifts).filter(key => Object.hasOwn(families, key));
    expect(sharedKeys.length).toBeGreaterThan(0);
    for (const key of sharedKeys) {
      const { joint, rest, first } = lifts[key];
      expect(families[key], key).toMatchObject({ joint, rest, first });
    }
  });
});
