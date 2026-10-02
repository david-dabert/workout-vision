// The pose model's fingerprint, one for the whole app: the build checks the file against it (copy-models.js), the
// service worker refuses a download that differs (sw.js, injected at build), and the analysis refuses a cached or
// downloaded copy that differs (poseAnalysis.js; audit FINDING-018).
import hash from './model-hash.json';

export const MODEL_SHA256 = hash.sha256;

/** True when the bytes are exactly the model the app was built with. */
export async function isTheModel(buffer) {
  try {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
    return [...digest].map(b => b.toString(16).padStart(2, '0')).join('') === MODEL_SHA256;
  } catch { return false; }
}
