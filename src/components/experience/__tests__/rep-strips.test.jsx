import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RepStrips, { GAP_FULL, TEMPO_FULL_SEC, repGap } from '../RepStrips';

const rep = (index, extra = {}) => ({ index, startTime: index * 3, endTime: index * 3 + 2, romDegrees: 80, concentricSec: 1, eccentricSec: 2, ...extra });
const render = props => renderToStaticMarkup(<RepStrips sel={-1} shown={9} sides={null} fr {...props} />);
const heights = (html, cls) => [...html.matchAll(new RegExp(`class="${cls}[^"]*" style="height:([0-9.]+)px`, 'g'))].map(m => Number(m[1]));

describe('per-rep strips', () => {
  it('draws each phase on a fixed scale, the same height for the same time on any set', () => {
    const a = render({ reps: [rep(1, { eccentricSec: 1.2 }), rep(2, { eccentricSec: 0.6 })] });
    const b = render({ reps: [rep(1, { eccentricSec: 1.2 })] });
    expect(heights(a, 't-down')[0]).toBe(heights(b, 't-down')[0]);
    expect(heights(a, 't-down')[0]).toBe(2 * heights(a, 't-down')[1]);
    expect(render({ reps: [rep(1, { eccentricSec: TEMPO_FULL_SEC + 3 })] })).toContain('t-down capped');
  });
  it('prints no number on the tempo strip, and nothing when no rep is whole', () => {
    expect(render({ reps: [rep(1), rep(2)] }).replace(/<[^>]+>/g, '')).not.toMatch(/\d/);
    expect(render({ reps: [rep(1)], sel: 0, sides: [{ at: 0, left: 90, right: 90.5 }] }).replace(/<[^>]+>/g, '')).toContain('côtés\u00A0égaux');
    expect(render({ reps: [rep(1, { clipped: true })] })).toBe('');
  });
  it('draws a side gap up for the right, down for the left, none for no gap, every bar of one weight', () => {
    const reps = [rep(1), rep(2), rep(3), rep(4)];
    const sides = [{ at: 0, left: 80, right: 80 }, { at: 1, left: 70, right: 90 }, { at: 2, left: 90, right: 70 }, { at: 3, left: 80, right: 84 }];
    const html = render({ reps, sides });
    expect(html.match(/g-bar up/g)).toHaveLength(2);
    expect(html.match(/g-bar down/g)).toHaveLength(1);
    expect(html).not.toMatch(/in-band/);
    expect(repGap(sides[1])).toBeCloseTo(25, 6);
    expect(heights(html, 'g-bar up')[0]).toBeCloseTo((28 * 25) / GAP_FULL, 6);
  });
  it('captions the chosen rep with its phase times and its gap', () => {
    const reps = [rep(1), rep(2, { concentricSec: 0.6, eccentricSec: 0.9 })];
    const html = render({ reps, sel: 1, sides: [{ at: 1, left: 90, right: 70 }] });
    expect(html.replace(/<[^>]+>/g, '')).toContain('Rép.\u00A02\u00A0· conc.\u00A00,6\u00A0s\u00A0· exc.\u00A00,9\u00A0s\u00A0· gauche\u00A0+25\u00A0%');
    // With no rep chosen the caption is present and empty, so choosing one moves nothing below it.
    expect(render({ reps }).match(/<p class="strip-caption"[^>]*><\/p>/)).not.toBeNull();
    // After a correction the column is named as the app's mark.
    expect(render({ reps: [rep(1, { clipped: true }), rep(2)], sel: 0, markName: i => `Repère ${i + 1}` }).replace(/<[^>]+>/g, '')).toContain('Repère 1\u00A0· filmé en partie');
  });
  it('leaves a rep that was not compared blank', () => {
    const html = render({ reps: [rep(1), rep(2)], sides: [{ at: 1, left: 70, right: 90 }] });
    const cols = html.split('data-testid="strip-sides"')[1];
    expect((cols.match(/class="strip-col[ "]/g) || []).length).toBe(2);
    expect((cols.match(/g-bar/g) || []).length).toBe(1);
  });
});
