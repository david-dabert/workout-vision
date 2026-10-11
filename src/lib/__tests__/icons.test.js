import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';

// The app's icons (28 September 2026) are drawn by scripts/make-icons.mjs with the app's own particle
// figure. Before, the home screen showed a green and red stick figure, iOS had no apple-touch-icon to
// use, and the maskable icons were the plain ones, so a round launcher mask cut into the figure.
const pub = path => new URL(`../../../public/${path}`, import.meta.url);
const size = path => { const b = readFileSync(pub(path)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const manifest = JSON.parse(readFileSync(pub('manifest.json'), 'utf8'));
const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');

describe('the app icons', () => {
  it('gives iOS an apple-touch-icon of 180 px', () => {
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
    expect(size('apple-touch-icon.png')).toEqual([180, 180]);
  });

  it('gives the launchers maskable icons of their own, at the sizes the manifest states', () => {
    for (const icon of manifest.icons.filter(i => i.type === 'image/png')) {
      const file = icon.src.replace(manifest.scope, '');
      expect(existsSync(pub(file)), file).toBe(true);
      expect(size(file).join('x')).toBe(icon.sizes);
    }
    const maskable = manifest.icons.filter(i => i.purpose === 'maskable').map(i => i.src);
    const plain = manifest.icons.filter(i => i.purpose !== 'maskable').map(i => i.src);
    expect(maskable.length).toBe(2);
    for (const src of maskable) expect(plain).not.toContain(src);
  });

  it('draws the favicon from the same figure', () => {
    expect(readFileSync(pub('favicon.svg'), 'utf8')).toMatch(/data:image\/png;base64,/);
  });
});
