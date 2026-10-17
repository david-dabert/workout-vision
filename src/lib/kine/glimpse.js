// The AI commentary on a patient's attempt (David, 17 October 2026: "Can we implement their API?"), through the
// proxy that holds Elorian's key (glimpse-proxy/). On the patient's tap only, after a notice that the video leaves the
// phone (KinePatient.jsx): the video goes to the proxy's Blob store, the proxy hands its address to Elorian's model and
// deletes it once answered. What comes back is a description, labelled as an AI's, never a measure of the app (R8).
//
// Off unless the build names the proxy (VITE_GLIMPSE_URL, .github/workflows/deploy.yml); the page's policy then
// allows that origin and Vercel Blob's upload address, and no other (vite.config.js, glimpseCspPlugin).

export const GLIMPSE_URL = (import.meta.env.VITE_GLIMPSE_URL || '').replace(/\/+$/, '');
export const glimpseOn = () => !!GLIMPSE_URL;

const EXT = { 'video/quicktime': 'mov', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/x-m4v': 'm4v' };
const TYPE = { mov: 'video/quicktime', mp4: 'video/mp4', webm: 'video/webm', m4v: 'video/x-m4v' };

/** The extension and type the attempt is uploaded under (an iPhone's .mov may come with no type). */
export function videoKind(file) {
  const fromName = /\.([a-z0-9]+)$/i.exec(file?.name || '')?.[1]?.toLowerCase();
  const ext = EXT[file?.type] || (TYPE[fromName] ? fromName : 'mp4');
  return { ext, type: TYPE[ext] };
}

/** The exercise's own text, as the proxy takes it: the physiotherapist's title, position, steps, dosage and holds. */
export function exerciseText(ex, lang, dosage = ex.dosage) {
  const t = ex[lang === 'en' ? 'en' : 'fr'];
  return { lang: lang === 'en' ? 'en' : 'fr', title: t.title, position: t.position || '', steps: [...t.steps], reps: dosage?.reps ?? null, sets: dosage?.sets ?? null, holds: (ex.holds || []).map(h => h.sec) };
}

/** Why a commentary failed, for the screen: 'busy' (too many calls), 'offline', or 'failed'. */
const reason = e => (e?.status === 429 ? 'busy' : typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'failed');

/**
 * Uploads the attempt's video and returns the commentary (glimpse-proxy/lib/commentary.js cleanCommentary).
 * onProgress(phase, share): 'upload' with the share sent, then 'reading'. Rejects with { name: 'AbortError' } on
 * signal, or an Error whose `why` is 'busy', 'offline' or 'failed'.
 */
export async function askGlimpse(file, exercise, { signal, onProgress = () => {}, base = GLIMPSE_URL, uploader } = {}) {
  if (!base) throw Object.assign(new Error('glimpse-off'), { why: 'failed' });
  const { ext, type } = videoKind(file);
  try {
    const upload = uploader || (await import('@vercel/blob/client')).upload;
    onProgress('upload', 0);
    const blob = await upload(`attempts/${exercise.id}.${ext}`, file, {
      access: 'public', handleUploadUrl: `${base}/api/upload`, contentType: type, multipart: file.size > 50 * 1024 * 1024,
      abortSignal: signal, onUploadProgress: p => onProgress('upload', Math.min(1, (p.percentage || 0) / 100)),
    });
    onProgress('reading', 0);
    const res = await fetch(`${base}/api/glimpse`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', referrerPolicy: 'no-referrer',
      body: JSON.stringify({ url: blob.url, exercise: exercise.text }), signal,
    });
    if (!res.ok) throw Object.assign(new Error(`glimpse-${res.status}`), { status: res.status });
    const out = await res.json();
    if (!out?.commentary?.summary) throw new Error('glimpse-empty');
    return out.commentary;
  } catch (e) {
    if (e?.name === 'AbortError' || signal?.aborted) throw new DOMException('aborted', 'AbortError');
    throw Object.assign(new Error(e?.message || 'glimpse-failed'), { why: reason(e) });
  }
}

/** Whether a stored value is a commentary this module returned (an attempt's report keeps it, report.js). */
export const isCommentary = c => !!c && typeof c === 'object' && typeof c.summary === 'string' && ['compensations', 'setup', 'camera', 'advice', 'holds'].every(k => Array.isArray(c[k]));
