// No new raw colour in the experience (C8, design review of 7 October 2026): its styles name a colour by a token
// (--c-surface, --c-fg, --c-fg-muted, --c-rule, --c-accent, --c-on-accent and the swatches of Entry.css), its drawing
// code by the palette (palette.js). The literals written before the check are listed, file by file and with their
// count, in raw-colours-allowlist.json (113 in the CSS on 7 October, the token blocks among them; none in the JS once
// its 25 moved to palette.js). A literal not listed, or one more than listed, fails; one fewer fails too, so the list
// is lowered with the code and never hides a literal that came back.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { colourLiterals } from '../raw-colours';
import { RGB, HEX, PAPER, rgba } from '../palette';

const DIR = resolve(__dirname, '..');
const ALLOW = JSON.parse(readFileSync(resolve(DIR, 'raw-colours-allowlist.json'), 'utf8'));
// The palette is where the drawing code's colours live; the scanner is this check's own code.
const OWN = new Set(['palette.js', 'raw-colours.js']);
const files = readdirSync(DIR).filter(f => /\.(css|js|jsx)$/.test(f) && !OWN.has(f)).sort();

describe('raw colour literals in the experience', () => {
  it('reads the files of the experience', () => {
    expect(files.filter(f => f.endsWith('.css')).length).toBeGreaterThanOrEqual(14);
    expect(files).toContain('entry-scene.js');
  });

  for (const f of files) {
    it(`${f} holds no colour literal beyond its allowlist`, () => {
      const found = colourLiterals(readFileSync(resolve(DIR, f), 'utf8'), f.endsWith('.css'));
      expect(found, `${f}: use a token (_tokens.css, Entry.css) or palette.js; a literal removed lowers raw-colours-allowlist.json`).toEqual(ALLOW[f] || {});
    });
  }

  it('lists no file that is gone', () => {
    for (const f of Object.keys(ALLOW)) expect(files, f).toContain(f);
  });
});

describe('the scanner', () => {
  it('finds hex and functional colours, not comments, ids or the palette helper', () => {
    const css = '/* #fff rgba(0,0,0,1) */ .a { color: #EFE8DC; background: rgba(8, 7, 6, 0.4); border-color: #000 }';
    expect(colourLiterals(css, true)).toEqual({ '#EFE8DC': 1, 'rgba(8, 7, 6, 0.4)': 1, '#000': 1 });
    const js = "// '#fff'\nconst a = '#F7DCAE', b = `rgba(${r},${g},${b},0)`, c = rgba(RGB.lamp, 0.5), d = 'https://x.y/#about';";
    expect(colourLiterals(js, false)).toEqual({ '#F7DCAE': 1, 'rgba(${r},${g},${b},0)': 1 });
  });
});

describe('the palette', () => {
  // The values the drawing code held before they moved here (7 October), so the move changed no pixel.
  it('keeps the swatches the drawing code drew with', () => {
    expect(rgba(RGB.bone, 0.85)).toBe('rgba(239,232,220,0.85)');
    expect(rgba(RGB.void, 0.4)).toBe('rgba(8,7,6,0.4)');
    expect(rgba(RGB.lampHi, 0.75)).toBe('rgba(247,220,174,0.75)');
    expect(rgba(RGB.lamp, 0)).toBe('rgba(232,189,126,0)');
    expect(rgba(RGB.glint, 0)).toBe('rgba(255,240,215,0)');
    expect(rgba(RGB.spark, 1)).toBe('rgba(255,251,242,1)');
    expect([RGB.dustLight, RGB.dustMid, RGB.dustDeep]).toEqual([[255, 238, 208], [242, 198, 134], [214, 150, 76]]);
    expect(HEX).toEqual({ lamp: '#E8BD7E', lampHi: '#F7DCAE' });
    expect(PAPER).toEqual({ paper: '#FBF7EF', ink: '#1D1812', ash: '#6B6256', rule: '#E4DCCD', rowRule: '#F0EADF', count: '#8A6630', waveBack: '#CDB68E' });
  });

  it('matches the CSS swatches of the same name', () => {
    const tokens = readFileSync(resolve(DIR, 'Entry.css'), 'utf8');
    const hex = name => tokens.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))[1].toUpperCase();
    const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    expect(toHex(RGB.bone)).toBe(hex('bone'));
    expect(toHex(RGB.void)).toBe(hex('void'));
    expect(toHex(RGB.lamp)).toBe(hex('lamp'));
    expect(HEX.lamp).toBe(hex('lamp'));
    expect(HEX.lampHi).toBe(hex('lamp-hi'));
    expect(PAPER.paper).toBe(hex('paper'));
    expect(PAPER.ink).toBe(hex('paper-ink'));
    expect(PAPER.ash).toBe(hex('paper-ash'));
    expect(PAPER.rule).toBe(hex('paper-rule'));
    expect(PAPER.rowRule).toBe(hex('paper-rule-2'));
    expect(PAPER.count).toBe(hex('paper-gold'));
  });
});

describe('the colour roles', () => {
  it('point at the swatches they replaced, inside the experience', () => {
    const t = readFileSync(resolve(DIR, '../../styles/_tokens.css'), 'utf8');
    const block = t.slice(t.lastIndexOf('.wv-experience {'));
    const roles = Object.fromEntries([...block.matchAll(/(--c-[a-z-]+):\s*var\((--[a-z0-9-]+)\)/g)].map(m => [m[1], m[2]]));
    expect(roles).toEqual({ '--c-surface': '--void', '--c-fg': '--bone', '--c-fg-muted': '--ash', '--c-rule': '--hair', '--c-accent': '--lamp', '--c-on-accent': '--ink' });
  });
});
