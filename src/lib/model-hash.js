// The pose model's fingerprint, one for the whole app: the build checks the file against it (copy-models.js), the
// service worker refuses a download that differs (sw.js, injected at build), and the analysis refuses a cached or
// downloaded copy that differs (poseAnalysis.js; audit FINDING-018).
import hash from './model-hash.json';

export const MODEL_SHA256 = hash.sha256;
// The heavy pose model (float16/1), read only for a physiotherapy attempt the patient asks to analyse again
// (KinePatient.jsx, deeper analysis); the counting app never loads it.
export const HEAVY_MODEL_SHA256 = hash.heavySha256;

const sha256 = async buffer => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(b => b.toString(16).padStart(2, '0')).join('');

/** True when the bytes are exactly the model the app was built with. */
export async function isTheModel(buffer) {
  try { return await sha256(buffer) === MODEL_SHA256; } catch { return false; }
}

/** True when the bytes are exactly the heavy model the app was built with. */
export async function isTheHeavyModel(buffer) {
  try { return await sha256(buffer) === HEAVY_MODEL_SHA256; } catch { return false; }
}
