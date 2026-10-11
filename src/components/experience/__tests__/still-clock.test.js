import { describe, it, expect } from 'vitest';
import { stillClock } from '../still-clock';

// A lift card that becomes the centre, and the dust after a swipe, move on from the frame they
// kept; with the real time they jumped to where their loop would have been (28 September 2026).
describe('stillClock', () => {
  it('runs with the real time until it is paused', () => {
    const clock = stillClock(0);
    expect(clock.paused).toBe(false);
    expect(clock.at(1234)).toBe(1234);
  });

  it('stands still while paused and moves on from there, with no jump', () => {
    const clock = stillClock(0);
    clock.pause(1000);
    expect(clock.at(1500)).toBe(1000);
    expect(clock.at(9000)).toBe(1000);
    clock.resume(9000);
    expect(clock.at(9000)).toBe(1000);
    expect(clock.at(9016)).toBe(1016);
  });

  it('made paused, it waits at its start and then moves on from it', () => {
    const clock = stillClock(200, true);
    expect(clock.paused).toBe(true);
    expect(clock.at(5000)).toBe(200);
    clock.resume(5000);
    expect(clock.at(5010)).toBe(210);
  });

  it('a second pause or a second resume changes nothing', () => {
    const clock = stillClock(0);
    clock.pause(100); clock.pause(300);
    clock.resume(400); clock.resume(900);
    expect(clock.at(1000)).toBe(700);
  });
});
