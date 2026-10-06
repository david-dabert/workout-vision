import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// What a phone shows when the app is installed must say what the page says (28 September 2026):
// the manifest described "workout form analysis", which the app does not do, painted the launch
// screen black instead of the page's #080706, and offered two shortcuts to routes that no longer
// exist (?action=analyze, ?tab=history), which open the choice of lift.
const manifest = JSON.parse(readFileSync(new URL('../../../public/manifest.json', import.meta.url), 'utf8'));
const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
const meta = name => html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`))[1];

describe('the install manifest', () => {
  it('describes the app as the page does', () => {
    expect(manifest.description).toBe(meta('description'));
    expect(manifest.description).not.toMatch(/form analysis|AI-powered/i);
  });

  it('paints the launch screen and the bars in the page colour', () => {
    expect(manifest.background_color).toBe(meta('theme-color'));
    expect(manifest.theme_color).toBe(meta('theme-color'));
  });

  // Wellness positioning (audit of 6 October): the app does not present itself as a health or medical product.
  it('declares the fitness category only, not health', () => {
    expect(manifest.categories).toEqual(['fitness']);
  });

  it('offers only shortcuts to screens the app opens', () => {
    for (const s of manifest.shortcuts || []) {
      expect(s.url.startsWith(manifest.scope)).toBe(true);
      expect(['#exercises', '#history']).toContain(s.url.slice(manifest.scope.length));
    }
  });
});
