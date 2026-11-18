// Variants in the one catalogue (David, 18 November 2026: "we need just one exercises list not two"): a variant
// ("bicep_curl--cable", variant-key.js) is counted, offered, filmed and drawn as its base, earns no tier of its own,
// and never enters the tables that load with the first screen.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import catalogue from '../guide-catalog.json';
import guideKeys from '../guide-keys.json';
import patterns from '../counting/guide-patterns.json';
import families from '../counting/guide-families.json';
import legacy from '../exercises/legacy-ids.json';
import { baseKey, isVariantKey } from '../variant-key';
import { isOffered, isKnownExercise, tierOf } from '../offer';
import { isGuideKey } from '../guide-keys';
import { liftDefinition, VARIANT_COUNT_AS } from '../counting/core';
import { signalProfile } from '../counting/bodyCheck';
import { makeVariants } from '../../../scripts/make-variants.mjs';
import svgKeys from '../../components/experience/guide-svg-keys.json';
import { hasGuideFigure } from '../../components/experience/guide-figure';
// The nine card lifts' scenes (lift-scenes.js hasFigure, which needs a document): their poses' keys.
import liftPoses from '../../components/experience/lift-poses.json';
import { getGuideExercise } from '../exerciseGuide';

const variants = catalogue.filter(e => e.key.includes('--'));
const byKey = new Map(catalogue.map(e => [e.key, e]));

describe('variant keys', () => {
  it('read their base from the key', () => {
    expect(baseKey('bicep_curl--machine')).toBe('bicep_curl');
    expect(baseKey('squat')).toBe('squat');
    expect(isVariantKey('squat--box')).toBe(true);
    for (const k of ['squat', '--box', 'squat--', 'squat--Box', 'squat--box--x', 'squat--box-x', null, 3]) expect(isVariantKey(k), String(k)).toBe(false);
  });
});

describe('the variants of the catalogue', () => {
  it('each follow their base, with their own names, the base\'s category and muscles, and no family or pattern of their own', () => {
    expect(variants.length).toBeGreaterThan(0);
    for (const v of variants) {
      const base = byKey.get(baseKey(v.key));
      expect(base, v.key).toBeTruthy();
      expect(isVariantKey(base.key), v.key).toBe(false);
      expect(v.base).toBe(base.key);
      expect(v.category).toBe(base.category);
      expect(v.fr && v.name && v.fr !== base.fr && v.name !== base.name, v.key).toBe(true);
      expect(Object.hasOwn(families, v.key) || Object.hasOwn(patterns, v.key) || guideKeys.includes(v.key), v.key).toBe(false);
      // Placed after its base in the list.
      expect(catalogue.indexOf(v), v.key).toBeGreaterThan(catalogue.indexOf(base));
    }
  });

  it('are counted, offered and checked as their base, and are experimental whatever the base\'s tier', () => {
    for (const v of variants) {
      const b = baseKey(v.key);
      // A variant named in VARIANT_COUNT_AS is counted by the definition it names (tested below), every other by its base's.
      expect(liftDefinition(v.key), v.key).toEqual(liftDefinition(VARIANT_COUNT_AS[v.key] ?? b));
      expect(isOffered(v.key), v.key).toBe(isOffered(b));
      expect(isKnownExercise(v.key), v.key).toBe(isKnownExercise(b));
      expect(isGuideKey(v.key), v.key).toBe(true);
      expect(tierOf(v.key), v.key).toBe(isOffered(b) ? 'experimental' : null);
      expect(signalProfile(v.key), v.key).toEqual(signalProfile(b));
    }
    // A Beta base's variant is experimental: Beta is evidence on that exercise only.
    expect(tierOf('squat')).toBe('beta');
    expect(tierOf('squat--box')).toBe('experimental');
    // A variant of a base the app does not offer is not offered.
    expect(isOffered('walking_lunge--barbell')).toBe(false);
  });

  it('each show a pictograph: their own figure and still, else their base\'s', () => {
    for (const v of variants) {
      // The guide's animated figure, or the card scene of a card lift's variant, or the base's drawings (similar).
      expect(hasGuideFigure(v.key) || Object.hasOwn(liftPoses, baseKey(v.key)) || getGuideExercise(v.key).frames.length > 0, v.key).toBe(true);
      if (!hasGuideFigure(v.key)) expect(getGuideExercise(v.key).similar, v.key).toBe(true);
      expect(svgKeys.includes(v.key) || svgKeys.includes(baseKey(v.key)), v.key).toBe(true);
    }
  });

  it('carry no name another exercise holds', () => {
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const holder = new Map();
    for (const e of catalogue) for (const n of new Set([e.name, e.fr, ...e.aliases].map(norm))) {
      expect(holder.get(n) ?? e.key, `"${n}" names ${holder.get(n)} and ${e.key}`).toBe(e.key);
      holder.set(n, e.key);
    }
  });

  it('are the generator\'s output (node scripts/make-variants.mjs)', () => {
    const registry = JSON.parse(readFileSync(new URL('../exercises/exercises.json', import.meta.url), 'utf8'));
    const { catalogue: out, legacy: map, errors } = makeVariants(catalogue, registry);
    expect(errors).toEqual([]);
    expect(out).toEqual(catalogue);
    expect(map).toEqual(legacy);
  });
});

describe('the former registry\'s ids', () => {
  it('each name a catalogue exercise: all 1,296, the 9 techniques of a movement to the same one', () => {
    expect(Object.keys(legacy)).toHaveLength(1296);
    for (const [id, key] of Object.entries(legacy)) expect(byKey.has(key), `${id} -> ${key}`).toBe(true);
    expect(legacy.barbell_back_squat_drop_set).toBe('squat');
    expect(legacy.pendulum_squat_tempo).toBe('hack_squat--pendulum');
  });
});

describe('a variant counted by another definition than its base (VARIANT_COUNT_AS, 18 November 2026)', () => {
  it('counts the alternating curl variant with both arms joined', () => {
    expect(liftDefinition('bicep_curl--alternating')).toEqual(liftDefinition('bicep_curl_alternating'));
    expect(liftDefinition('bicep_curl--alternating').bothSides).toBe(true);
    expect(liftDefinition('bicep_curl--cable')).toEqual(liftDefinition('bicep_curl'));
  });
});
