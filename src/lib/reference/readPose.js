// The pose of every sample of a video, read by the app's own pipeline (coreAnalysis.js, analyzeCoreVideo: the same
// decoder, 15 samples a second, the same pose worker and model), for the reference comparison (compare.js).
// analyzeCoreVideo also counts the set of the lift it is given; here the count is discarded: only the landmarks are
// kept. Reusing it, rather than a second path, keeps one way of reading a video in the app (the harness's rule,
// test/real-phone/harness.js) and leaves the counting code untouched (R2).
import { analyzeCoreVideo } from '../coreAnalysis';
import { OFFERED } from '../offer';

// Any offered lift: its count is not read. Status: convention.
const POSE_ONLY = OFFERED.includes('squat') ? 'squat' : OFFERED[0];

/**
 * Resolves { imageLandmarks, timestamps, aspect, width, height, model } for a video file. model 'heavy': read with
 * MediaPipe's larger pose model (KinePatient.jsx, the deeper analysis); else the app's.
 */
export async function readPose(file, { signal, onProgress, model } = {}) {
  const r = await analyzeCoreVideo(file, POSE_ONLY, { signal, onProgress, ...(model === 'heavy' ? { model: 'heavy' } : {}) });
  const width = r.metadata?.extractedWidth ?? r.metadata?.width;
  const height = r.metadata?.extractedHeight ?? r.metadata?.height;
  return { imageLandmarks: r.imageLandmarks, timestamps: r.timestamps, width, height, aspect: width && height ? width / height : 1, model: model === 'heavy' ? 'heavy' : 'full' };
}
