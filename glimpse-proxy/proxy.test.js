import { describe, expect, it, vi } from 'vitest';
import { buildMessages, cleanCommentary, cleanExercise, commentaryOf, firstJson, requestBody } from './lib/commentary.js';
import { corsFor, isAttemptPath, isAttemptUrl, rateLimiter } from './lib/guard.js';
import { makeHandlers, storeIdOf, SWEEP_AGE_MS } from './lib/handlers.js';

// The Glimpse proxy (glimpse-proxy/): what it asks Elorian, what of the answer reaches the app, and what it lets
// through. No network: Elorian and the Blob store are stand-ins.

const ORIGIN = 'https://david-dabert.github.io';
const STORE = 'abc123';
const env = { BLOB_READ_WRITE_TOKEN: `vercel_blob_rw_${STORE}_secret`, ELORIAN_API_KEY: 'elor_sk_test', CRON_SECRET: 'cron-secret-value' };
const VIDEO = `https://${STORE}.public.blob.vercel-storage.com/attempts/mains-jointes-x1y2.mp4`;
const exercise = { lang: 'fr', title: 'Élévation mains jointes', position: 'Couché sur le dos.', steps: ['Élever les bras à la verticale.', 'Maintenir 5 secondes.'], reps: 10, sets: 5, holds: [5, 3] };
const answer = { visible: true, same_exercise: 'yes', reps: 4, holds: [{ rep: 1, seconds: 4.6 }], compensations: ['Les épaules montent vers les oreilles.'], setup: [], camera: ['Filmez de profil.'], advice: ['Gardez les épaules basses.', 'b', 'c', 'd'], summary: 'Quatre répétitions, bien conduites.' };
const completion = content => ({ choices: [{ message: { role: 'assistant', content } }] });

const post = (path, body, { origin = ORIGIN, ip = '1.2.3.4' } = {}) => new Request(`https://proxy.example${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { origin } : {}), 'x-real-ip': ip }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
const blobStub = () => ({ del: vi.fn(async () => {}), list: vi.fn(), handleUpload: vi.fn(async ({ onBeforeGenerateToken }) => ({ type: 'blob.generate-client-token', options: await onBeforeGenerateToken('attempts/a.mp4', null, false) })) });

describe('what is asked of Elorian', () => {
  it('sends the physiotherapist\'s exercise and the video, and the fixed instructions, nothing else', () => {
    const ex = cleanExercise(exercise);
    const [msg] = buildMessages(ex, VIDEO);
    const text = msg.content[0].text;
    expect(text).toContain('Élever les bras à la verticale.');
    expect(text).toContain('Prescribed: 5 sets of 10 repetitions.');
    expect(text).toContain('Positions to hold: 5 s, 3 s.');
    expect(text).toContain('Do not diagnose');
    expect(text).toContain('"vous"');
    expect(msg.content[1]).toEqual({ type: 'video_url', video_url: { url: VIDEO } });
    expect(requestBody(ex, VIDEO)).toMatchObject({ model: 'elorian-1-agent', max_completion_tokens: 8000 });
  });

  it('refuses an exercise without a title or steps, and cuts what is too long', () => {
    expect(cleanExercise({ title: 'x' })).toBeNull();
    expect(cleanExercise({ steps: ['a'] })).toBeNull();
    const long = cleanExercise({ title: 'T'.repeat(500), steps: Array.from({ length: 40 }, () => 's'.repeat(900)), holds: [5, 'x', -1, 9999] });
    expect(long.title).toHaveLength(160);
    expect(long.steps).toHaveLength(16);
    expect(long.steps[0]).toHaveLength(400);
    expect(long.holds).toEqual([5]);
  });
});

describe('what of the answer reaches the app', () => {
  it('reads the JSON inside a code fence or a sentence', () => {
    expect(firstJson('Voici :\n```json\n{"a": {"b": "}"}}\n```')).toEqual({ a: { b: '}' } });
    expect(firstJson('rien')).toBeNull();
    expect(firstJson('{ cassé')).toBeNull();
  });

  it('keeps the listed fields, at most three pieces of advice, and drops the rest', () => {
    const c = commentaryOf(completion(`\`\`\`json\n${JSON.stringify({ ...answer, extra: 'x' })}\n\`\`\``));
    expect(c).toEqual({ visible: true, sameExercise: 'yes', reps: 4, holds: [{ rep: 1, seconds: 4.6 }], compensations: answer.compensations, setup: [], camera: answer.camera, advice: ['Gardez les épaules basses.', 'b', 'c'], summary: answer.summary });
  });

  it('refuses an answer without a summary, and numbers out of range', () => {
    expect(cleanCommentary({ reps: 3 })).toBeNull();
    const c = cleanCommentary({ summary: 's', reps: -2, holds: [{ rep: 1, seconds: 'long' }, { seconds: 3 }], same_exercise: 'maybe' });
    expect(c.reps).toBeNull();
    expect(c.holds).toEqual([{ rep: null, seconds: 3 }]);
    expect(c.sameExercise).toBeNull();
  });
});

describe('what the proxy lets through', () => {
  it('answers only the app\'s origins', () => {
    expect(corsFor(ORIGIN, {})).toMatchObject({ 'Access-Control-Allow-Origin': ORIGIN });
    expect(corsFor('https://evil.example', {})).toBeNull();
    expect(corsFor(null, {})).toBeNull();
    expect(corsFor('https://other.example', { ALLOWED_ORIGINS: 'https://other.example' })).not.toBeNull();
  });

  it('takes only a video of the store\'s attempts folder', () => {
    expect(isAttemptUrl(VIDEO)).toBe(true);
    expect(isAttemptUrl(`https://${STORE}.public.blob.vercel-storage.com/other/a.mp4`)).toBe(false);
    expect(isAttemptUrl('https://example.com/attempts/a.mp4')).toBe(false);
    expect(isAttemptUrl(`${VIDEO}?x=1`)).toBe(false);
    expect(isAttemptPath('attempts/mains-jointes.mp4')).toBe(true);
    expect(isAttemptPath('attempts/../secret.mp4')).toBe(false);
    expect(isAttemptPath('attempts/a.exe')).toBe(false);
    expect(storeIdOf(env.BLOB_READ_WRITE_TOKEN)).toBe(STORE);
  });

  it('limits the calls of one address in a window', () => {
    let t = 0;
    const ok = rateLimiter({ max: 2, windowMs: 1000 }, () => t);
    expect([ok('a'), ok('a'), ok('a'), ok('b')]).toEqual([true, true, false, true]);
    t = 1001;
    expect(ok('a')).toBe(true);
  });
});

describe('the routes', () => {
  it('returns the commentary and deletes the video', async () => {
    const blob = blobStub();
    const fetch = vi.fn(async () => new Response(JSON.stringify(completion(JSON.stringify(answer))), { status: 200 }));
    const h = makeHandlers({ env, fetch, blob });
    const res = await h.glimpse(post('/api/glimpse', { url: VIDEO, exercise }));
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.commentary.reps).toBe(4);
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.elorian.ai/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer elor_sk_test');
    // The key is sent to Elorian only, never back to the app.
    expect(JSON.stringify(out)).not.toContain('elor_sk');
    expect(blob.del).toHaveBeenCalledWith(VIDEO, expect.anything());
  });

  it('deletes the video when Elorian fails, and says so', async () => {
    const blob = blobStub();
    const h = makeHandlers({ env, fetch: vi.fn(async () => new Response('no', { status: 500 })), blob });
    const res = await h.glimpse(post('/api/glimpse', { url: VIDEO, exercise }));
    expect(res.status).toBe(502);
    expect(blob.del).toHaveBeenCalled();
    const unreadable = makeHandlers({ env, fetch: vi.fn(async () => new Response(JSON.stringify(completion('pas de JSON')))), blob: blobStub() });
    expect((await (await unreadable.glimpse(post('/api/glimpse', { url: VIDEO, exercise }))).json()).error).toBe('unreadable');
  });

  it('refuses another origin, another store\'s video, and too many calls, without calling Elorian', async () => {
    const fetch = vi.fn();
    const h = makeHandlers({ env, fetch, blob: blobStub(), limiter: rateLimiter({ max: 1, windowMs: 1e6 }) });
    expect((await h.glimpse(post('/api/glimpse', { url: VIDEO, exercise }, { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await h.glimpse(post('/api/glimpse', { url: VIDEO.replace(STORE, 'zzz999'), exercise }))).status).toBe(400);
    expect((await h.glimpse(post('/api/glimpse', { url: VIDEO, exercise }))).status).toBe(429);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('gives an upload token only for the attempts folder, a video, of bounded size', async () => {
    const blob = blobStub();
    const h = makeHandlers({ env, blob, now: () => 0 });
    const res = await h.upload(post('/api/upload', { type: 'blob.generate-client-token', payload: { pathname: 'attempts/a.mp4' } }));
    expect(res.status).toBe(200);
    expect((await res.json()).options).toMatchObject({ allowedContentTypes: expect.arrayContaining(['video/mp4', 'video/quicktime']), addRandomSuffix: true, validUntil: 600000 });
    blob.handleUpload.mockImplementationOnce(async ({ onBeforeGenerateToken }) => onBeforeGenerateToken('secrets/a.txt'));
    expect((await h.upload(post('/api/upload', { type: 'blob.generate-client-token' }))).status).toBe(400);
  });

  it('sweeps only attempts older than half an hour, for the cron only', async () => {
    const blob = blobStub();
    const now = 10 * SWEEP_AGE_MS;
    blob.list.mockResolvedValueOnce({ blobs: [{ url: 'old', uploadedAt: new Date(0).toISOString() }, { url: 'new', uploadedAt: new Date(now - 1000).toISOString() }], hasMore: false });
    const h = makeHandlers({ env, blob, now: () => now });
    expect((await h.sweep(new Request('https://proxy.example/api/sweep'))).status).toBe(401);
    const res = await h.sweep(new Request('https://proxy.example/api/sweep', { headers: { authorization: 'Bearer cron-secret-value' } }));
    expect(await res.json()).toEqual({ deleted: 1 });
    expect(blob.del).toHaveBeenCalledWith(['old'], expect.anything());
    expect(blob.list).toHaveBeenCalledWith(expect.objectContaining({ prefix: 'attempts/' }));
  });
});
