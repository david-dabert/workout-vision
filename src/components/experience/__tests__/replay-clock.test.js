// The clock a live set's replay plays on, without a video (replay-clock.js): it behaves as the <video> the replay
// reads, so the skeleton, the line and the buttons work the same.
import { describe, it, expect } from 'vitest';
import { replayClock } from '../replay-clock';

function fakeTime() {
  let t = 0, queued = null;
  return {
    now: () => t,
    raf: cb => { queued = cb; return 1; },
    cancelRaf: () => { queued = null; },
    advance(ms) { t += ms; const cb = queued; queued = null; cb?.(); },
  };
}

describe('replay clock', () => {
  it('plays, pauses, seeks and ends as a video does', async () => {
    const time = fakeTime();
    const c = replayClock(2, { width: 360, height: 640, ...time });
    const seen = [];
    for (const e of ['play', 'pause', 'seeking', 'seeked', 'ended', 'loadeddata']) c.addEventListener(e, () => seen.push(e));
    expect(c.paused).toBe(true);
    expect([c.videoWidth, c.videoHeight]).toEqual([360, 640]);
    c.loaded();
    await c.play();
    time.advance(500);
    expect(c.currentTime).toBeCloseTo(0.5, 6);
    c.playbackRate = 0.5;
    time.advance(1000);
    expect(c.currentTime).toBeCloseTo(1, 6);
    c.pause();
    time.advance(1000);
    expect(c.currentTime).toBeCloseTo(1, 6);
    c.currentTime = 1.9;
    c.playbackRate = 1;
    await c.play();
    time.advance(500);
    expect(c.currentTime).toBe(2);
    expect(c.ended).toBe(true);
    expect(c.paused).toBe(true);
    // Played again from the end, it starts over.
    await c.play();
    expect(c.currentTime).toBe(0);
    c.currentTime = 99;
    expect(c.currentTime).toBe(2);
    expect(seen).toEqual(['loadeddata', 'play', 'pause', 'seeking', 'seeked', 'play', 'pause', 'ended', 'play', 'seeking', 'seeked']);
    c.dispose();
  });
});
