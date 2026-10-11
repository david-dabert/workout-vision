// A clock that stands still while it is paused. A drawing that pauses and resumes on it
// moves on from the moment it kept, instead of jumping to where it would have been:
// a lift card becoming the centre of the rail, the dust after a swipe.
// Times are milliseconds on the performance.now() timeline, as requestAnimationFrame gives them.
export function stillClock(start = 0, paused = false) {
  let offset = 0, pausedAt = paused ? start : null;
  return {
    // The clock's time at the real time t.
    at: t => (pausedAt ?? t) - offset,
    pause(t) { if (pausedAt === null) pausedAt = t; },
    resume(t) { if (pausedAt !== null) { offset += Math.max(0, t - pausedAt); pausedAt = null; } },
    get paused() { return pausedAt !== null; },
  };
}
