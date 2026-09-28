/** True when the page was opened with ?perf=1 (the on-device instrument, PerfOverlay). */
export const perfRequested = () => {
  try { return new URLSearchParams(window.location.search).get('perf') === '1'; } catch { return false; }
};
