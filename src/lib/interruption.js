// An analysis runs only while the page is visible. When the screen locks or the
// visitor leaves the app, iOS Safari suspends the page and may freeze the decoder
// or the worker mid-set, so a count finished after that is not trusted: the run
// is aborted and the visitor is asked to keep the screen on and start again.

/**
 * The mark on the abort reason of a run stopped by the page being hidden. The reason
 * itself stays an AbortError, so the decoder treats it as a cancel, not a failure.
 */
export const INTERRUPTED = 'interrupted';

/**
 * Aborts `controller` when the page is hidden (visibilitychange) or unloaded
 * (pagehide), including when it is already hidden as the run starts.
 * Returns a function that stops watching; call it as soon as the run ends.
 */
export function watchInterruption(controller, { doc = document, win = window } = {}) {
  const stop = () => {
    if (controller.signal.aborted) return;
    const reason = new DOMException('The page was hidden during the analysis', 'AbortError');
    reason[INTERRUPTED] = true;
    controller.abort(reason);
  };
  const onVisibility = () => { if (doc.visibilityState === 'hidden') stop(); };
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('pagehide', stop);
  onVisibility();
  return () => {
    doc.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener('pagehide', stop);
  };
}

/** True when an error or abort reason comes from an interruption. */
export const isInterruption = e => e?.[INTERRUPTED] === true;

/**
 * Resolves once the page is visible. A run chosen while the page is still hidden
 * (returning from the camera, a screen code that loaded while the phone was locked)
 * waits for it instead of being reported as interrupted. Rejects if `signal` aborts.
 */
export function whenVisible({ doc = document, signal } = {}) {
  if (doc.visibilityState !== 'hidden') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = () => { doc.removeEventListener('visibilitychange', onChange); signal?.removeEventListener('abort', onAbort); };
    const onChange = () => { if (doc.visibilityState !== 'hidden') { done(); resolve(); } };
    const onAbort = () => { done(); reject(signal.reason ?? new DOMException('Cancelled', 'AbortError')); };
    doc.addEventListener('visibilitychange', onChange);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * The last step before a count is shown: a short beat (the prototype's pause at
 * 100 %), then the output only if the run was not stopped meanwhile. A run hidden
 * at any moment before this returns throws its abort reason, never the count.
 */
export async function settleRun(signal, output, beatMs = 0) {
  if (beatMs > 0) await new Promise(r => setTimeout(r, beatMs));
  signal.throwIfAborted();
  return output;
}

/**
 * Asks the browser to keep the screen on while an analysis runs (Screen Wake Lock
 * API, iOS Safari 16.4 and later), so auto-lock does not interrupt a long set.
 * Where the API is missing or refused, the run still works, and the Watch screen
 * asks the visitor to keep the screen on until the result. Returns an async function that releases the lock.
 */
export function holdScreenAwake({ nav = typeof navigator === 'undefined' ? {} : navigator } = {}) {
  let lock = null, released = false;
  const pending = nav.wakeLock?.request
    ? nav.wakeLock.request('screen').then(l => { lock = l; if (released) return l.release(); }).catch(() => {})
    : Promise.resolve();
  return async () => {
    released = true;
    await pending;
    if (lock && !lock.released) { try { await lock.release(); } catch { /* already released by the browser */ } }
  };
}
