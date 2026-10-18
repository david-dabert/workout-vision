import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import catalogue from '../../../lib/guide-catalog.json';
import poses from '../guide-poses.json';
import keys from '../guide-figure-keys.json';
import lift from '../lift-poses.json';

// The guide's animated figures (scripts/make-guide-figures.mjs, 18 October 2026): every exercise of the guide with a
// motion spec gets one, unless it has a card figure of its own or the script's SKIP list says why it cannot be drawn.
const DIG = '0123456789abcdefghijklmnopqrstuvwxyz';
const motion = key => new URL(`../../../../test/real-phone/synth/motions/${key}.json`, import.meta.url);
const script = readFileSync(new URL('../../../../scripts/make-guide-figures.mjs', import.meta.url), 'utf8');
const skipped = new Set([...(script.match(/export const SKIP = \{([^}]*)\}/)?.[1] ?? '').matchAll(/(\w+):/g)].map(m => m[1]));

describe('the guide figures', () => {
  it('cover every guide exercise with a motion spec, but the card lifts and the listed exceptions', () => {
    const want = catalogue.filter(e => existsSync(motion(e.key)) && !Object.hasOwn(lift, e.key) && !skipped.has(e.key)).map(e => e.key);
    expect(want.length).toBeGreaterThan(250);
    expect(Object.keys(poses).sort()).toEqual([...want].sort());
    expect([...keys].sort()).toEqual(Object.keys(poses).sort());
  });

  it('leave the nine card figures to lift-poses.json', () => {
    for (const k of Object.keys(lift)) expect(Object.hasOwn(poses, k)).toBe(false);
  });

  it('hold loops of 24 to 48 frames of 33 points, inside their box, with no lost point', () => {
    const bad = [];
    for (const [key, d] of Object.entries(poses)) {
      if (!['front', 'side', 'oblique'].includes(d.view)) bad.push(`${key}: view ${d.view}`);
      if (d.loop.vb[0] !== 770 || d.loop.vb[1] !== 1000) bad.push(`${key}: box ${d.loop.vb}`);
      if (d.loop.f.length < 24 || d.loop.f.length > 48) bad.push(`${key}: ${d.loop.f.length} frames`);
      if (!(d.still >= 0 && d.still < d.loop.f.length)) bad.push(`${key}: still ${d.still}`);
      d.loop.f.forEach((f, n) => {
        if (f.length !== 33 * 4) return bad.push(`${key} frame ${n}: ${f.length} characters`);
        for (let i = 0; i < 33; i++) {
          const q = f.slice(i * 4, i * 4 + 4);
          if ([...q].some(c => !DIG.includes(c)) || q.startsWith('zz') || q.endsWith('zz')) { bad.push(`${key} frame ${n} point ${i}: ${q}`); continue; }
          const x = DIG.indexOf(q[0]) * 36 + DIG.indexOf(q[1]), y = DIG.indexOf(q[2]) * 36 + DIG.indexOf(q[3]);
          if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 770 || y < 0 || y > 1000) bad.push(`${key} frame ${n} point ${i} at ${x},${y}`);
        }
      });
    }
    expect(bad).toEqual([]);
  });

  it('move: each loop passes through more than one pose, but for a hold', () => {
    for (const [key, d] of Object.entries(poses)) {
      const spec = JSON.parse(readFileSync(motion(key), 'utf8'));
      if (JSON.stringify(spec.start) === JSON.stringify(spec.end) && !spec.mid) continue;
      expect(new Set(d.loop.f).size, key).toBeGreaterThan(1);
    }
  });

  it('are what the script makes from the specs today (regenerate: node scripts/make-guide-figures.mjs)', async () => {
    const { makeFigure } = await import('../../../../scripts/make-guide-figures.mjs');
    for (const key of ['push_up', 'forward_lunge', 'fire_hydrant', 'machine_seated_back_extension', 'arnold_press']) {
      expect(makeFigure(key, JSON.parse(readFileSync(motion(key), 'utf8'))), key).toEqual(poses[key]);
    }
  });

  it('stay out of the main bundle: a file of their own, loaded by import()', () => {
    const src = readFileSync(new URL('../guide-figure.js', import.meta.url), 'utf8');
    expect(src).toContain("import('./guide-poses.json')");
    expect(src).not.toMatch(/import\s+\w+\s+from\s+'\.\/guide-poses\.json'/);
    expect(statSync(new URL('../guide-poses.json', import.meta.url)).size).toBeLessThan(1.5e6);
  });
});
