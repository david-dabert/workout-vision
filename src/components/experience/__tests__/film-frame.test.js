import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Playwright cannot emulate env(safe-area-inset-*), so the frame's width rule is checked in its source
// (review 06 of step 2, 29 September).
const css = readFileSync(new URL('../Film.css', import.meta.url), 'utf8');
const jsx = readFileSync(new URL('../Film.jsx', import.meta.url), 'utf8');
const rule = css.split('\n').filter(l => /\.frame \{ width: max\(/.test(l));

describe('the filming frame takes the height left to it', () => {
  it('has one width rule, built on the measured rest of the screen', () => {
    expect(rule).toHaveLength(1);
    expect(rule[0]).toContain('var(--rest-h');
    expect(jsx).toContain("setProperty('--rest-h'");
  });

  it('does not subtract the top safe area, already in the rest measured from the top of the page', () => {
    expect(rule[0]).not.toContain('safe-area-inset-top');
  });

  it('still subtracts the bottom safe area, below the button and outside the rest', () => {
    expect(rule[0]).toContain('env(safe-area-inset-bottom');
  });
});
