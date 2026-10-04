// A set counted live has no video (LiveSession.jsx): its replay plays the skeleton alone, on this clock. It stands in
// for the <video> element where the replay reads one (Replay.jsx): currentTime, paused, ended, playbackRate, play(),
// pause(), and the events play, pause, seeking, seeked, ended and loadeddata. Nothing is drawn here.

export function replayClock(duration, { width = 9, height = 16, now = () => performance.now(), raf = cb => requestAnimationFrame(cb), cancelRaf = h => cancelAnimationFrame(h) } = {}) {
  const target = new EventTarget();
  const fire = type => target.dispatchEvent(new Event(type));
  let time = 0, paused = true, ended = false, rate = 1, handle = 0, last = 0;
  const length = Number.isFinite(duration) && duration > 0 ? duration : 0;

  function step() {
    if (paused) return;
    const at = now();
    time = Math.min(length, time + ((at - last) / 1000) * rate);
    last = at;
    if (time >= length) { paused = true; ended = true; handle = 0; fire('pause'); fire('ended'); return; }
    handle = raf(step);
  }

  // Accessors are copied as accessors (Object.assign would read each once).
  return Object.defineProperties(target, Object.getOwnPropertyDescriptors({
    duration: length,
    videoWidth: width,
    videoHeight: height,
    readyState: 4,
    get currentTime() { return time; },
    set currentTime(t) {
      fire('seeking');
      time = Math.max(0, Math.min(length, Number(t) || 0));
      if (time < length) ended = false;
      last = now();
      fire('seeked');
    },
    get paused() { return paused; },
    get ended() { return ended; },
    get playbackRate() { return rate; },
    set playbackRate(r) { rate = r > 0 ? r : 1; },
    play() {
      if (!paused) return Promise.resolve();
      if (ended || time >= length) { time = 0; ended = false; }
      paused = false; last = now();
      fire('play');
      handle = raf(step);
      return Promise.resolve();
    },
    pause() {
      if (paused) return;
      paused = true;
      if (handle) cancelRaf(handle);
      handle = 0;
      fire('pause');
    },
    /** Tells the replay the "video" is ready, once its listeners are in place. */
    loaded() { fire('loadeddata'); },
    dispose() { paused = true; if (handle) cancelRaf(handle); handle = 0; },
  }));
}
