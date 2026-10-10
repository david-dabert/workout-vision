/**
 * A screen whose code failed to download once (a weak signal in the gym, a deploy that changed the chunk names) is
 * downloaded again on the next try: "Réessayer" on the error screen, or the next tap that opens it. Before this, the
 * failure was kept for the whole visit and the only ways out reloaded the page, losing the video just filmed
 * (live-app audit, 10 October 2026).
 */
import { describe, it, expect, vi } from 'vitest';
import { createElement, Suspense } from 'react';
import { prerender } from 'react-dom/static';
import { lazyScreen, retryFailedScreens } from '../lazyScreen';

async function render(Screen) {
  const errors = [];
  let html = '';
  try {
    const { prelude } = await prerender(createElement(Suspense, { fallback: null }, createElement(Screen)), { onError: e => { errors.push(e); } });
    html = await new Response(prelude).text();
  } catch (e) { errors.push(e); }
  return { errors, html };
}

describe('a screen whose download failed once', () => {
  const flaky = () => {
    let calls = 0;
    const load = () => { calls += 1; return calls === 1 ? Promise.reject(new TypeError('Load failed')) : Promise.resolve({ default: () => createElement('p', null, 'analysis') }); };
    return { load, calls: () => calls };
  };

  it('is downloaded again when warmed again after the warm-up failed', async () => {
    const f = flaky(), Screen = lazyScreen(f.load);
    await Screen.warm();
    expect(Screen.loaded()).toBe(false);
    await Screen.warm();
    expect(f.calls()).toBe(2);
    expect(Screen.loaded()).toBe(true);
    expect((await render(Screen)).html).toContain('analysis');
  });

  it('shows the error, never downloads again from a render, and renders after "Réessayer"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const f = flaky(), Screen = lazyScreen(f.load);
      const first = await render(Screen);
      expect(first.errors.some(e => /Load failed/.test(e.message))).toBe(true);
      // React renders again after an error: that render keeps the failure (no loop), and downloads nothing.
      const again = await render(Screen);
      expect(again.errors.some(e => /Load failed/.test(e.message))).toBe(true);
      expect(f.calls()).toBe(1);
      retryFailedScreens();
      const retry = await render(Screen);
      expect(retry.errors).toEqual([]);
      expect(retry.html).toContain('analysis');
      expect(f.calls()).toBe(2);
    } finally { vi.restoreAllMocks(); }
  });
});
