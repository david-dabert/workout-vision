// What the proxy lets through (api/upload.js, api/glimpse.js): only the app's pages, a few calls per address, only a
// video of the store's own attempts folder. The key never leaves the server; these limits keep someone who copies the
// app's requests from spending it freely.

// The app's origins: the published site (GitHub Pages) and a local build. ALLOWED_ORIGINS (comma-separated) replaces
// them when set.
export const DEFAULT_ORIGINS = Object.freeze(['https://david-dabert.github.io', 'http://localhost:4173', 'http://127.0.0.1:4175']);
export const allowedOrigins = env => (env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_ORIGINS);

/** CORS headers for an allowed origin, or null when the origin is not one of the app's. */
export function corsFor(origin, env) {
  if (!origin || !allowedOrigins(env).includes(origin)) return null;
  return { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600', Vary: 'Origin' };
}

// Calls per address and window (convention, UNSOURCED): two calls an attempt (the upload, the commentary), five attempts. Kept in the
// memory of one function instance, so a limit per instance, not a guarantee; enough against a casual loop.
export const RATE = Object.freeze({ max: 10, windowMs: 10 * 60 * 1000 });

export function rateLimiter({ max, windowMs } = RATE, now = () => Date.now()) {
  const hits = new Map();
  return key => {
    const t = now();
    const recent = (hits.get(key) || []).filter(x => t - x < windowMs);
    if (recent.length >= max) { hits.set(key, recent); return false; }
    recent.push(t);
    hits.set(key, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(x => t - x < windowMs)) hits.delete(k);
    return true;
  };
}

// The Blob access the attempt videos are stored under: public since 17 October 2026, so anyone holding an address could
// read the video until it was deleted (state map of 21 October 2026, defect 1). David, 24 October 2026: the upload stays
// off "until private storage is proven on CI". No upload token is given while this is 'public' (handlers.js); it turns
// 'private' only in the change that stores the attempts privately, with its test. The app holds the same rule
// (src/lib/kine/attemptStorage.js).
export const ATTEMPT_ACCESS = 'public';

// The folder of the attempts in the store; nothing else is read or deleted.
export const FOLDER = 'attempts/';
// The largest video taken (convention, UNSOURCED): a minute of iPhone 4K is about 400 MB; 1080p about 130 MB.
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const VIDEO_TYPES = Object.freeze(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']);

/** Whether a URL is a public Vercel Blob URL in the attempts folder. */
export function isAttemptUrl(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  return u.protocol === 'https:' && /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/i.test(u.hostname) && u.pathname.startsWith(`/${FOLDER}`) && !u.search && !u.hash;
}

/** Whether a pathname the app asks to upload to is one of the attempts folder, with a video extension. */
export const isAttemptPath = p => typeof p === 'string' && p.length <= 120 && new RegExp(`^${FOLDER}[A-Za-z0-9_-]+\\.(mp4|mov|webm|m4v)$`).test(p);

/** The caller's address, as Vercel passes it. */
export const clientIp = headers => String(headers['x-real-ip'] || headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
