// A share sheet asked inside a tap, for one button (Report.jsx, Replay.jsx, CollectHistory.jsx, ContributeHistory.jsx;
// ExportSets.jsx keeps its own, the first).
// WebKit leaves a sheet that was never answered (the person left for another app, locked the phone) pending for good
// and refuses every later share with InvalidStateError. So nothing waits for a share to settle: a second tap within
// windowMs is the same tap, and any refusal but the person's own cancel (AbortError) makes the next tap, a gesture of
// its own, download instead. Before, Report and Replay waited for the share and took InvalidStateError for a second
// sheet: their buttons did nothing, and said nothing, until the app was reloaded (live-app audit, 10 October 2026);
// the history's Send buttons (CollectHistory, ContributeHistory) did the same until 11 October.
// windowMs: convention, UNSOURCED (a double tap is well under a second).

export function shareSheet({ windowMs = 1000, now = () => Date.now() } = {}) {
  let last = -Infinity, downloadNext = false;
  return {
    /** False for a second tap within windowMs: the first one is under way. */
    begin() { const t = now(); if (t - last < windowMs) return false; last = t; return true; },
    /** Whether this tap opens the sheet (the phone can share the file and no share failed since); else it downloads. */
    shares(canShareFile) {
      if (canShareFile && !downloadNext) return true;
      downloadNext = false;
      return false;
    },
    /** Takes a share's refusal; true when it failed (not the person's cancel), and the next tap then downloads. */
    failed(e) { if (e?.name === 'AbortError') return false; downloadNext = true; return true; },
  };
}
