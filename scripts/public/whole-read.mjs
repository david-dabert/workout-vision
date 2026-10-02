/**
 * Whether a public video was read whole, by the rule the app applies before it counts (src/lib/coreAnalysis.js,
 * unreadSamples): exactly floor(duration x fps) samples, each after the last. Null when whole, else why not.
 * A set read in part is not written: its label counts the whole clip (Astra's audit, 2 October). Status: convention.
 */
export function unreadPublic({ timestamps, duration, fps }) {
  const expected = Math.floor(duration * fps);
  if (!Number.isFinite(expected) || expected <= 0) return 'the video reports no length';
  if (!timestamps.every((t, i) => i === 0 || t > timestamps[i - 1])) return 'samples out of time order';
  return timestamps.length === expected ? null : `read ${timestamps.length} samples of the ${expected} the video holds`;
}
