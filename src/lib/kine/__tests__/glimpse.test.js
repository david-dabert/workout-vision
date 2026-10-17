import { afterEach, describe, expect, it, vi } from 'vitest';
import { askGlimpse, exerciseText, isCommentary, videoKind } from '../glimpse.js';
import { exerciseById } from '../library.js';

// The app's side of the AI commentary (glimpse.js): what it uploads and sends to the proxy, and how it fails.

const BASE = 'https://glimpse.example.app';
const commentary = { visible: true, sameExercise: 'yes', reps: 3, holds: [], compensations: [], setup: [], camera: [], advice: ['Gardez les épaules basses.'], summary: 'Trois répétitions.' };
const file = (name = 'IMG_0001.MOV', type = '', size = 1000) => ({ name, type, size });
afterEach(() => { vi.unstubAllGlobals(); });

describe('the AI commentary, app side', () => {
  it('uploads an iPhone video under its own type, even when the phone gives none', () => {
    expect(videoKind(file('IMG_0001.MOV', ''))).toEqual({ ext: 'mov', type: 'video/quicktime' });
    expect(videoKind(file('a.webm', 'video/webm'))).toEqual({ ext: 'webm', type: 'video/webm' });
    expect(videoKind(file('noext', ''))).toEqual({ ext: 'mp4', type: 'video/mp4' });
  });

  it('sends the physiotherapist\'s own text of the exercise and the programme\'s dosage', () => {
    const ex = exerciseById('mains-jointes');
    const t = exerciseText(ex, 'fr', { reps: 8, sets: 2 });
    expect(t).toMatchObject({ lang: 'fr', title: ex.fr.title, steps: ex.fr.steps, reps: 8, sets: 2, holds: [5, 3] });
  });

  it('uploads the video into the attempts folder, then asks the proxy with its address only', async () => {
    const uploader = vi.fn(async () => ({ url: 'https://s.public.blob.vercel-storage.com/attempts/x.mov' }));
    const fetch = vi.fn(async () => new Response(JSON.stringify({ commentary })));
    vi.stubGlobal('fetch', fetch);
    const phases = [];
    const out = await askGlimpse(file(), { id: 'mains-jointes', text: { title: 't', steps: ['s'] } }, { base: BASE, uploader, onProgress: p => phases.push(p) });
    expect(out).toEqual(commentary);
    expect(isCommentary(out)).toBe(true);
    const [path, , opts] = uploader.mock.calls[0];
    expect(path).toBe('attempts/mains-jointes.mov');
    expect(opts).toMatchObject({ access: 'public', handleUploadUrl: `${BASE}/api/upload`, contentType: 'video/quicktime' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${BASE}/api/glimpse`);
    expect(JSON.parse(init.body)).toEqual({ url: 'https://s.public.blob.vercel-storage.com/attempts/x.mov', exercise: { title: 't', steps: ['s'] } });
    expect(init.credentials).toBe('omit');
    expect(phases).toEqual(['upload', 'reading']);
  });

  it('says when the proxy is busy, and when it fails', async () => {
    const uploader = async () => ({ url: 'u' });
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 429 }));
    await expect(askGlimpse(file(), { id: 'a', text: {} }, { base: BASE, uploader })).rejects.toMatchObject({ why: 'busy' });
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 502 }));
    await expect(askGlimpse(file(), { id: 'a', text: {} }, { base: BASE, uploader })).rejects.toMatchObject({ why: 'failed' });
    await expect(askGlimpse(file(), { id: 'a', text: {} }, { base: '' })).rejects.toMatchObject({ why: 'failed' });
  });

  it('stops when cancelled', async () => {
    const ctrl = new AbortController();
    const uploader = async () => { ctrl.abort(); throw new DOMException('aborted', 'AbortError'); };
    await expect(askGlimpse(file(), { id: 'a', text: {} }, { base: BASE, uploader, signal: ctrl.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('takes for a commentary only what the proxy returns', () => {
    expect(isCommentary(null)).toBe(false);
    expect(isCommentary({ summary: 's' })).toBe(false);
  });
});

describe('the commentary kept with its attempt', () => {
  it('joins the report of the attempt logged at that minute, and no other', async () => {
    const store = {};
    vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
    const { attemptsOf, logAttempt, updateAttemptReport } = await import('../store.js');
    logAttempt('p1', { id: 'a', date: 'd1', verdict: 'match', report: { v: 1 } });
    logAttempt('p1', { id: 'a', date: 'd2', verdict: 'revise', report: { v: 1 } });
    expect(updateAttemptReport('p1', 'd2', { v: 1, ai: commentary })).toBe(true);
    expect(attemptsOf('p1').map(e => e.report.ai ?? null)).toEqual([null, commentary]);
    expect(updateAttemptReport('p1', 'nope', {})).toBe(false);
  });
});
