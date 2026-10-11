/**
 * The entry's example (feature B): a drawn squat, counted by the real counting core. The number
 * the example shows is the core's count of the committed sequence, never a number typed in.
 */
import { describe, it, expect, vi } from 'vitest';

// The particle body paints sprites when its module loads, which needs a DOM; these tests render the
// screen's markup only and draw nothing.
vi.mock('../entry-scene', () => ({ Body: class { draw() {} }, LITE: false }));
import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { countReps } from '../../../lib/counting/core';
import { demoSet, demoResult, countAt, DEMO_LIFT, DEMO_REPS } from '../demo-set';
import { DemoView } from '../Demo';

describe('the example set', () => {
  it('is sampled at 15 per second, as the app samples a video, from the drawn squat', () => {
    const set = demoSet();
    expect(DEMO_LIFT).toBe('squat');
    expect(set.world.length).toBe(set.timestamps.length);
    expect(set.image.length).toBe(set.timestamps.length);
    expect(set.timestamps[1] - set.timestamps[0]).toBeCloseTo(1 / 15, 9);
    expect(set.world[0]).toHaveLength(33);
  });

  it('is counted by the real core as the number of reps it was drawn with', () => {
    const set = demoSet();
    const counted = countReps(set.world, set.timestamps, DEMO_LIFT);
    expect(counted.count).toBe(DEMO_REPS);
    // What the example shows comes from that same count.
    expect(demoResult().count).toBe(counted.count);
    expect(demoResult().reps.map(r => r.endTime)).toEqual(counted.reps.map(r => r.endTime));
  });

  it('ticks the counter once each rep has ended, from 0 to the full count', () => {
    const { reps } = demoResult(), end = demoSet().duration;
    expect(countAt(reps, 0)).toBe(0);
    expect(countAt(reps, end)).toBe(DEMO_REPS);
    let last = 0;
    for (let t = 0; t <= end; t += 0.1) { const n = countAt(reps, t); expect(n).toBeGreaterThanOrEqual(last); last = n; }
    for (const r of reps) { expect(countAt(reps, r.endTime - 0.01)).toBe(r.index - 1); expect(countAt(reps, r.endTime)).toBe(r.index); }
  });
});

describe('the example screen', () => {
  const view = (lang, t) => renderToString(createElement(DemoView, { lang, t, result: demoResult(), duration: demoSet().duration }));

  it('is labelled as an example from its first frame, with the counter at 0', () => {
    const html = view('fr', 0);
    expect(html).toContain('Exemple');
    expect(html).toMatch(/data-count="0"/);
    expect(html).not.toContain('data-testid="demo-result"');
    expect(view('en', 0)).toContain('Example');
  });

  it('finishes on the core’s count, in both languages', () => {
    const end = demoSet().duration;
    const fr = view('fr', end), en = view('en', end);
    expect(fr).toMatch(new RegExp(`data-count="${DEMO_REPS}"`));
    expect(fr).toContain('data-testid="demo-result"');
    expect(fr).toContain(`${DEMO_REPS} répétitions`);
    expect(en).toContain(`${DEMO_REPS} reps`);
  });
});
