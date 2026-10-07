// The rest clock after a set: it counts the rest up and prescribes no length, since how long to rest
// is the user's call (the "Learn more" notes give the literature). It keeps only its start time and
// reads the wall clock each time it is drawn: a phone that sleeps or a tab in the background holds the
// page's timers back, and a clock that added a second per tick would wake late.

export function restClock() {
  let startedAt = null;
  return {
    // From now, or from a given moment.
    start(at = Date.now()) { startedAt = at; },
    stop() { startedAt = null; },
    get running() { return startedAt !== null; },
    // Whole seconds since the start; never negative, should the phone's clock be set back.
    seconds() { return startedAt === null ? 0 : Math.max(0, Math.floor((Date.now() - startedAt) / 1000)); },
    ms() { return startedAt === null ? 0 : Math.max(0, Date.now() - startedAt); },
  };
}

// Milliseconds until the clock reaches its next whole second, so it is drawn when the digit changes.
export function nextTick(clock) {
  return 1000 - (clock.ms() % 1000);
}

// 0:09, 1:30, 1:01:02.
export function restText(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// The same time in words, for screen readers: "1 minute 30 secondes". French keeps zero and one singular.
export function restSpoken(s, fr) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const unit = (n, one) => `${n} ${one}${(fr ? n > 1 : n !== 1) ? 's' : ''}`;
  const parts = [];
  if (h) parts.push(unit(h, fr ? 'heure' : 'hour'));
  if (m) parts.push(unit(m, 'minute'));
  if (sec || !parts.length) parts.push(unit(sec, fr ? 'seconde' : 'second'));
  return parts.slice(0, 2).join(' ');
}

// The screen kept awake while the rest runs (C9, design review of 7 October 2026), so the clock is still in view when
// the phone is picked up for the next set. Held from the start of the rest for at most REST_AWAKE_CAP_MS, then let go,
// so a phone left on the bench goes to sleep; released when the rest stops or the clock leaves the screen. iOS drops
// the lock when the page is hidden: it is taken again when the page shows, while the rest is under the cap. No promise
// is made that the screen stays on: iOS before 18.4 ignores the lock in an installed web app.
// Status of the 10 minutes: experimental (UNSOURCED: longer than a usual rest between sets, short enough not to drain
// the battery; to be measured on the iPhone).
export const REST_AWAKE_CAP_MS = 10 * 60 * 1000;

/** Holds the screen awake for a running rest clock; returns the release. `hold` is holdScreenAwake (interruption.js). */
export function keepAwakeDuringRest(clock, { hold, doc = document, cap = REST_AWAKE_CAP_MS, setT = setTimeout, clearT = clearTimeout }) {
  let release = null, done = false;
  const under = () => clock.running && clock.ms() < cap;
  const take = () => { if (!done && !release && under()) release = hold(); };
  const drop = () => { if (release) { release(); release = null; } };
  const timer = setT(() => { drop(); }, Math.max(0, cap - clock.ms()));
  const shown = () => {
    if (doc.visibilityState !== 'visible') return;
    drop(); // the browser let it go while hidden
    take();
  };
  take();
  doc.addEventListener('visibilitychange', shown);
  return () => { done = true; clearT(timer); doc.removeEventListener('visibilitychange', shown); drop(); };
}
