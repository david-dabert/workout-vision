// Runs tasks one at a time, each only after `quiet` ms without a touch, a scroll, a wheel or a key,
// and each after the one before it has settled. Loading a screen's code takes the main thread for
// a moment; started in the middle of a swipe, it would stall the figure that is animating.
// Returns a function that cancels what has not started. Once every task has run, it stops listening.
const EVENTS = ['pointerdown', 'pointermove', 'touchstart', 'touchmove', 'scroll', 'wheel', 'keydown'];

export function whenQuiet(tasks, quiet = 700, target = globalThis.document) {
  let next = 0, timer = 0, busy = false, done = false;
  const stop = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    for (const type of EVENTS) target?.removeEventListener(type, arm, { capture: true });
  };
  function arm() {
    clearTimeout(timer);
    if (done || busy) return;
    if (next >= tasks.length) { stop(); return; }
    timer = setTimeout(run, quiet);
  }
  function run() {
    busy = true;
    const task = tasks[next++];
    Promise.resolve().then(task).catch(() => {}).finally(() => { busy = false; arm(); });
  }
  for (const type of EVENTS) target?.addEventListener(type, arm, { passive: true, capture: true });
  arm();
  return stop;
}
