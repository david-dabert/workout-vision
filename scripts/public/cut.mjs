/**
 * Where a set is cut from its video, in frames: from the label's frames (MM-Fit), or from its seconds
 * (Countix) at the video's frame rate; null for a whole video. `exact` says whether the transcoded frame
 * count must equal the cut exactly (frames), or may differ by one frame (seconds, rounded to frames).
 */
export function cutOf(set, fps) {
  if (set.trimFrames) return { from: set.trimFrames[0], to: set.trimFrames[1], exact: true };
  if (set.trimSeconds) return { from: Math.round(set.trimSeconds[0] * fps), to: Math.round(set.trimSeconds[1] * fps), exact: false };
  return null;
}
