// The proxy's three routes, with what they depend on passed in (env, fetch, the Blob functions), so the tests run them
// without the network (handlers.test.js). api/*.js bind them to Vercel.
//
// The patient's video goes from the phone straight to the Blob store (POST /api/upload gives the phone a token for one
// upload into attempts/), then POST /api/glimpse hands its address to Elorian, and deletes it once Elorian has answered
// or failed. GET /api/sweep, run by Vercel's cron, deletes any attempt left behind (a phone closed mid-call).
import { commentaryOf, cleanExercise, ELORIAN_URL, requestBody } from './commentary.js';
import { clientIp, corsFor, FOLDER, isAttemptPath, isAttemptUrl, MAX_VIDEO_BYTES, rateLimiter, VIDEO_TYPES } from './guard.js';

// How long Elorian is given (the function's own limit is 300 s, vercel.json).
export const ELORIAN_TIMEOUT_MS = 270_000;
// An attempt older than this is deleted by the sweep (convention, UNSOURCED): longer than any call.
export const SWEEP_AGE_MS = 30 * 60 * 1000;

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
const headersOf = request => Object.fromEntries(request.headers.entries());

/** The store id of a Blob read-write token (vercel_blob_rw_<storeId>_<secret>), or null. */
export const storeIdOf = token => (/^vercel_blob_rw_([a-z0-9]+)_/i.exec(token || '') || [])[1]?.toLowerCase() || null;

export function makeHandlers({ env, fetch: fetchFn = fetch, blob, limiter = rateLimiter(), now = () => Date.now() }) {
  const preflight = request => {
    const cors = corsFor(request.headers.get('origin'), env);
    return cors ? new Response(null, { status: 204, headers: cors }) : new Response(null, { status: 403 });
  };
  // The origin and rate checks of both POST routes: the CORS headers, or the response refusing the call.
  const admit = request => {
    const cors = corsFor(request.headers.get('origin'), env);
    if (!cors) return { refused: json(403, { error: 'origin' }) };
    if (!limiter(clientIp(headersOf(request)))) return { refused: json(429, { error: 'busy' }, cors) };
    return { cors };
  };

  async function upload(request) {
    const { cors, refused } = admit(request);
    if (refused) return refused;
    let body;
    try { body = await request.json(); } catch { return json(400, { error: 'body' }, cors); }
    try {
      const out = await blob.handleUpload({
        body, request, token: env.BLOB_READ_WRITE_TOKEN,
        onBeforeGenerateToken: async pathname => {
          if (!isAttemptPath(pathname)) throw new Error('pathname');
          return { allowedContentTypes: [...VIDEO_TYPES], maximumSizeInBytes: MAX_VIDEO_BYTES, addRandomSuffix: true, validUntil: now() + 10 * 60 * 1000 };
        },
      });
      return json(200, out, cors);
    } catch {
      return json(400, { error: 'upload' }, cors);
    }
  }

  async function glimpse(request) {
    const { cors, refused } = admit(request);
    if (refused) return refused;
    let body;
    try { body = await request.json(); } catch { return json(400, { error: 'body' }, cors); }
    const url = body?.url;
    const store = storeIdOf(env.BLOB_READ_WRITE_TOKEN);
    // Only a video this store holds, in its attempts folder: the proxy never fetches or deletes anything else.
    if (!isAttemptUrl(url) || !store || new URL(url).hostname.split('.')[0].toLowerCase() !== store) return json(400, { error: 'url' }, cors);
    const ex = cleanExercise(body.exercise);
    if (!ex) { await blob.del(url, { token: env.BLOB_READ_WRITE_TOKEN }).catch(() => {}); return json(400, { error: 'exercise' }, cors); }
    if (!env.ELORIAN_API_KEY) { await blob.del(url, { token: env.BLOB_READ_WRITE_TOKEN }).catch(() => {}); return json(503, { error: 'unconfigured' }, cors); }
    try {
      const res = await fetchFn(ELORIAN_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.ELORIAN_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody(ex, url)),
        signal: AbortSignal.timeout(ELORIAN_TIMEOUT_MS),
      });
      if (!res.ok) return json(502, { error: 'upstream', status: res.status }, cors);
      const commentary = commentaryOf(await res.json());
      if (!commentary) return json(502, { error: 'unreadable' }, cors);
      return json(200, { commentary, model: 'elorian-1-agent' }, cors);
    } catch (e) {
      return json(e?.name === 'TimeoutError' ? 504 : 502, { error: e?.name === 'TimeoutError' ? 'timeout' : 'upstream' }, cors);
    } finally {
      // The video is deleted whatever Elorian answered.
      await blob.del(url, { token: env.BLOB_READ_WRITE_TOKEN }).catch(() => {});
    }
  }

  async function sweep(request) {
    // Vercel's cron sends the project's CRON_SECRET; without one set, the sweep answers no one.
    if (!env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) return json(401, { error: 'auth' });
    let cursor, deleted = 0;
    do {
      const page = await blob.list({ prefix: FOLDER, cursor, token: env.BLOB_READ_WRITE_TOKEN });
      const old = page.blobs.filter(b => now() - new Date(b.uploadedAt).getTime() > SWEEP_AGE_MS).map(b => b.url);
      if (old.length) { await blob.del(old, { token: env.BLOB_READ_WRITE_TOKEN }); deleted += old.length; }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return json(200, { deleted });
  }

  return { preflight, upload, glimpse, sweep };
}
