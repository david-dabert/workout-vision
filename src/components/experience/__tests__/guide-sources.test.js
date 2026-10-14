// The frames the exercise sheet credits to another creator (guide-sources.json) are the guide's manifest's: every frame
// whose attribution names a source, and no other. Regenerate with node scripts/guide-sources.mjs after any update of
// @bryllim/workout-guide. The PDF's credit (pro-copy.js, pdfCredit) names Everkinetic only: a new source fails here
// until its credit is written.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import sources from '../guide-sources.json';

const require = createRequire(import.meta.url);
const manifest = JSON.parse(readFileSync(require.resolve('@bryllim/workout-guide/manifest.json'), 'utf8'));

describe('the guide’s adapted frames', () => {
  it('are the manifest’s, by source, sorted', () => {
    const expected = {};
    for (const e of manifest) for (const f of e.frames) {
      const name = f.attribution?.source?.name;
      if (name) (expected[name] ??= []).push(`${e.slug}/frame-${f.index}`);
    }
    for (const name of Object.keys(expected)) expected[name].sort();
    expect(sources).toEqual(expected);
  });

  it('come from Everkinetic only, 76 first poses under CC BY-SA 4.0, as the PDF credits them', () => {
    expect(Object.keys(sources)).toEqual(['Everkinetic']);
    expect(sources.Everkinetic).toHaveLength(76);
    expect(sources.Everkinetic.every(f => f.endsWith('/frame-1'))).toBe(true);
    for (const e of manifest) for (const f of e.frames) {
      if (f.attribution?.source) expect(f.attribution.source.license, e.slug).toBe('CC BY-SA 4.0');
    }
  });
});
