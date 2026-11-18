// The exercises added after the guide (figureOnly, 18 November 2026) have no drawing of the guide: no frame URL may
// point at public/guide/, which holds none for them, and each has its animated figure and its still SVG instead.
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import catalogue from '../guide-catalog.json';
import families from '../counting/guide-families.json';
import figureKeys from '../../components/experience/guide-figure-keys.json';
import svgKeys from '../../components/experience/guide-svg-keys.json';
import { getGuideExercise } from '../exerciseGuide';
import { sheetFrames } from '../../components/experience/sheet-drawings';

const added = catalogue.filter(e => e.figureOnly);
const at = p => new URL(`../../../${p}`, import.meta.url);

describe('the exercises added after the guide', () => {
  it('are 75 (38 in batch 1, 37 in batch 2), each with a French name, a family, a motion spec, an animated figure and a still SVG', () => {
    expect(added).toHaveLength(75);
    for (const e of added) {
      expect(e.fr, e.key).toBeTruthy();
      expect(families[e.key], e.key).toBeTruthy();
      expect(existsSync(at(`test/real-phone/synth/motions/${e.key}.json`)), e.key).toBe(true);
      expect(figureKeys, e.key).toContain(e.key);
      expect(svgKeys, e.key).toContain(e.key);
      expect(existsSync(at(`public/guide-svg/${e.key}.svg`)), e.key).toBe(true);
    }
  });

  it('ask for no drawing of the guide, on screen or on the exercise sheet', () => {
    for (const e of added) {
      expect(existsSync(at(`public/guide/${e.slug}`)), e.key).toBe(false);
      expect(getGuideExercise(e.key).frames, e.key).toEqual([]);
      expect(sheetFrames(e.key), e.key).toBeNull();
    }
  });
});
