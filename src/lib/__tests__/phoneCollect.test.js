// Collecting David's sets from the result screen (phoneCollect.js): the switch only the address sets, the file in the
// collector's format that the scoreboard reads (test/real-phone/accuracy/sets.ts), the after-app mark, and nothing
// stored, hashed or read without the flag.
import { describe, expect, it, vi } from 'vitest';
import { gunzipSync } from 'node:zlib';

const mem = new Map();
vi.mock('localforage', () => ({
  default: {
    createInstance: () => ({
      setItem: async (k, v) => { mem.set(k, v); return v; },
      getItem: async k => mem.get(k) ?? null,
      removeItem: async k => { mem.delete(k); },
      iterate: async fn => { for (const [k, v] of mem) fn(v, k); },
      length: async () => mem.size,
      clear: async () => mem.clear(),
    }),
  },
}));

const { COLLECT_KEY, collectOn, collectAsked, applyCollectSwitch, collectedPayload, collectThisSet, collectedFiles, collectedCount, forgetCollected, landmarksSha256, collectSessionId, newSessionId } = await import('../phoneCollect');
const { blind } = await import('../../../test/real-phone/accuracy/sets');

function storage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m };
}
const loc = (hash = '', search = '') => ({ hash, search, pathname: '/workout-vision/' });
const hist = () => ({ state: null, calls: [], replaceState(s, t, u) { this.calls.push(u); } });

const lm = (x) => Array.from({ length: 33 }, (_, i) => ({ x: x + i / 100, y: 0.5, z: 0, visibility: 0.9 }));
const result = { count: 7, worldLandmarks: [lm(0), lm(0.1), lm(0.2)], imageLandmarks: [lm(0.3), lm(0.4), lm(0.5)], timestamps: [0, 66.7, 133.3], metadata: { method: 'webcodecs', width: 360, height: 640, duration: 0.2, frameCount: 3, rotationDecision: 'none' } };

describe('the switch', () => {
  it('reads only the exact words', () => {
    expect(collectAsked('#collecte', '')).toBe('on');
    expect(collectAsked('#collecte-off', '')).toBe('off');
    expect(collectAsked('', '?collecte=1')).toBe('on');
    expect(collectAsked('', '?collecte=0')).toBe('off');
    for (const [h, q] of [['', ''], ['#film', ''], ['#collect', ''], ['#collectes', ''], ['', '?collecte=yes'], ['#history', '?x=1']]) expect(collectAsked(h, q)).toBe(null);
  });
  it('is off unless the phone holds it, and off when storage cannot be read', () => {
    expect(collectOn(storage())).toBe(false);
    expect(collectOn(storage({ [COLLECT_KEY]: '1' }))).toBe(true);
    expect(collectOn({ getItem: () => { throw new Error('denied'); } })).toBe(false);
  });
  it('#collecte turns it on, #collecte-off off, and the word leaves the address', () => {
    const s = storage(), h = hist();
    expect(applyCollectSwitch(loc('#collecte'), s, h)).toBe('on');
    expect(collectOn(s)).toBe(true);
    expect(h.calls).toEqual(['/workout-vision/']);
    expect(applyCollectSwitch(loc('#collecte-off'), s, h)).toBe('off');
    expect(collectOn(s)).toBe(false);
    expect(applyCollectSwitch(loc('', '?collecte=1&lang=fr'), s, h)).toBe('on');
    expect(h.calls.at(-1)).toBe('/workout-vision/?lang=fr');
  });
  it('an address without the word changes nothing', () => {
    const s = storage({ [COLLECT_KEY]: '1' }), h = hist();
    expect(applyCollectSwitch(loc('#film'), s, h)).toBe(null);
    expect(collectOn(s)).toBe(true);
    expect(h.calls).toEqual([]);
  });
  it('says so when the phone cannot store it', () => {
    const s = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
    expect(applyCollectSwitch(loc('#collecte'), s, hist())).toBe('failed');
  });
});

describe('the file kept', () => {
  it('is the collector\'s payload, with the kept count, marked after-app beside the app\'s count', () => {
    const p = collectedPayload({ result, lift: 'bicep_curl', kept: 8, view: 'side', sha256: 'ab'.repeat(32), hashOf: 'video', version: 'v1' });
    expect(p).toMatchObject({ lift: 'bicep_curl', count: 8, view: 'side', videoSha256: 'ab'.repeat(32), labelKind: 'after-app', appCount: 7, corrected: true, hashOf: 'video', version: 'v1', frame: { width: 360, height: 640 }, extraction: { fps: 15 }, metadata: { extractionMethod: 'webcodecs', sampleCount: 3 } });
    expect(p.worldLandmarks).toEqual(result.worldLandmarks);
    expect(p.imageLandmarks).toEqual(result.imageLandmarks);
    expect(p.timestamps).toEqual(result.timestamps);
    expect(collectedPayload({ result, lift: 'squat', kept: 7, view: 'side', sha256: 'x', hashOf: 'video', version: 'v' }).corrected).toBe(false);
  });

  it('carries the blind count given before the app showed its own, and none when it was not asked', () => {
    const p = collectedPayload({ result, lift: 'bicep_curl', kept: 8, view: 'side', sha256: 'x', hashOf: 'video', version: 'v', blind: { count: 8, p: 1 } });
    // The count kept stays the file's count, marked after-app; the blind count stands beside it (sets.ts, blindSets).
    expect(p).toMatchObject({ count: 8, labelKind: 'after-app', appCount: 7, blind: { count: 8, p: 1 } });
    expect(collectedPayload({ result, lift: 'bicep_curl', kept: 8, view: 'side', sha256: 'x', hashOf: 'video', version: 'v', blind: { count: null, p: 1 } }).blind).toEqual({ count: null, p: 1 });
    expect('blind' in collectedPayload({ result, lift: 'bicep_curl', kept: 8, view: 'side', sha256: 'x', hashOf: 'video', version: 'v' })).toBe(false);
  });

  it('marks a refused set as refused by the app, with the proposal it made', () => {
    const refused = { ...result, count: 0, refused: true, proposal: { count: 6 } };
    expect(collectedPayload({ result: refused, lift: 'squat', kept: 6, view: 'side', sha256: 'x', hashOf: 'video', version: 'v', blind: { count: 6, p: 1 } }))
      .toMatchObject({ count: 6, appCount: 0, appRefused: true, proposal: 6, blind: { count: 6, p: 1 } });
    expect(collectedPayload({ result: { ...refused, proposal: null }, lift: 'squat', kept: 6, view: 'side', sha256: 'x', hashOf: 'video', version: 'v' }).proposal).toBe(null);
    expect('appRefused' in collectedPayload({ result, lift: 'squat', kept: 7, view: 'side', sha256: 'x', hashOf: 'video', version: 'v' })).toBe(false);
  });

  it('is stored gzipped under the collector\'s name, readable as the scoreboard reads a set', async () => {
    mem.clear();
    const s = storage({ [COLLECT_KEY]: '1' });
    const video = new File([new Uint8Array([1, 2, 3, 4])], 'IMG_0001.MOV');
    const name = await collectThisSet({ result, lift: 'bicep_curl', kept: 8, view: 'side', videoFile: video, version: 'v1', storage: s });
    const sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array([1, 2, 3, 4])))).map(b => b.toString(16).padStart(2, '0')).join('');
    expect(name).toBe(`bicep_curl_8_side_${sha.slice(0, 8)}.json.gz`);
    const files = await collectedFiles();
    expect(files.map(f => f.name)).toEqual([name]);
    // As labelledSets (sets.ts) reads it: gunzip, JSON, lift and an integer count, the world landmarks and times.
    const d = JSON.parse(gunzipSync(Buffer.from(await files[0].arrayBuffer())).toString());
    const m = name.match(/^(?:set\d+_)?(.+?)_(\d+)_/);
    expect(d.lift ?? m[1]).toBe('bicep_curl');
    expect(Number.isInteger(d.count ?? Number(m[2]))).toBe(true);
    expect(d.count).toBe(8);
    expect(Array.isArray(d.worldLandmarks) && d.worldLandmarks.length).toBe(3);
    expect(d.timestamps).toEqual(result.timestamps);
    expect(d.videoSha256).toBe(sha);
    expect(d.labelKind).toBe('after-app');
    expect(d.appCount).toBe(7);
    expect(JSON.stringify(d)).not.toContain('IMG_0001');
    expect(blind(`sets-x/${name}`)).toBe(`sets-x/bicep_curl side ${sha.slice(0, 8)}`);
    expect(await collectedCount()).toBe(1);
    await forgetCollected([name]);
    expect(await collectedCount()).toBe(0);
  });

  it('is named by the landmarks\' hash when there is no video to hash', async () => {
    mem.clear();
    const name = await collectThisSet({ result, lift: 'squat', kept: 7, view: 'side', version: 'v1', storage: storage({ [COLLECT_KEY]: '1' }) });
    const h = await landmarksSha256(result.worldLandmarks);
    expect(name).toBe(`squat_7_side_${h.slice(0, 8)}.json.gz`);
    expect(mem.get(name).blob).toBeInstanceOf(Blob);
  });
});

// Phase 6 of David's order of 6 November 2026: each blind-count file records when it was counted and an anonymous id
// for the page load, beside the video's hash, the exercise, the blind count and the app's count it already carried.
describe('the time and the anonymous session (Phase 6)', () => {
  const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('are written when given, and left out when not', () => {
    const p = collectedPayload({ result, lift: 'squat', kept: 7, view: 'side', sha256: 'x', hashOf: 'video', version: 'v', recordedAt: '2026-11-08', sessionId: 'a1b2c3d4-e5f6-4789-8abc-def012345678' });
    expect(p.recordedAt).toBe('2026-11-08');
    expect(p.sessionId).toBe('a1b2c3d4-e5f6-4789-8abc-def012345678');
    const q = collectedPayload({ result, lift: 'squat', kept: 7, view: 'side', sha256: 'x', hashOf: 'video', version: 'v' });
    expect('recordedAt' in q).toBe(false);
    expect('sessionId' in q).toBe(false);
  });

  const read = async n => JSON.parse(gunzipSync(Buffer.from(await mem.get(n).blob.arrayBuffer())).toString());

  it('a kept set carries the day it was kept, no finer, and every set of the page load the same random id', async () => {
    mem.clear();
    const s = storage({ [COLLECT_KEY]: '1' });
    const at = new Date(2026, 10, 9, 18, 30); // 9 November 2026, 18:30 on the phone's clock
    const a = await collectThisSet({ result, lift: 'squat', kept: 7, view: 'side', version: 'v1', storage: s, now: () => at, blind: { count: 7, p: 1 } });
    const b = await collectThisSet({ result: { ...result, worldLandmarks: [lm(1), lm(1.1), lm(1.2)] }, lift: 'squat', kept: 9, view: 'side', version: 'v1', storage: s, now: () => at, blind: { count: 9, p: 1 } });
    const da = await read(a), db = await read(b);
    // The repository that keeps testers' files is public: the day, not the hour a named person trained (review of
    // 8 November 2026). The store's own savedAt, which never leaves the phone, keeps the instant to sort the files.
    expect(da.recordedAt).toBe('2026-11-09');
    expect(mem.get(a).savedAt).toBe(at.toISOString());
    expect(da.sessionId).toMatch(UUID4);
    expect(db.sessionId).toBe(da.sessionId);
    expect(collectSessionId()).toBe(da.sessionId);
    // Nothing in the file says who counted: no name, no device, no address.
    expect(Object.keys(da).filter(k => /name|user|device|email|ip|tester/i.test(k))).toEqual([]);
  });

  it('dates the set when the count is kept, not when the video\'s hash ends (review of 8 November 2026)', async () => {
    mem.clear();
    let t = new Date(2026, 10, 9, 23, 55).getTime();
    // Safari suspends a page mid-hash when the phone locks: here the hash ends ten minutes later, on the next day.
    const video = { arrayBuffer: async () => { t += 600_000; return new ArrayBuffer(4); } };
    const n = await collectThisSet({ result, lift: 'squat', kept: 7, view: 'side', videoFile: video, version: 'v', storage: storage({ [COLLECT_KEY]: '1' }), now: () => new Date(t) });
    expect((await read(n)).recordedAt).toBe('2026-11-09');
  });

  it('writes files the blind schema reads, the app\'s counts above 99 included', async () => {
    const { parseBlindFile } = await import('../../../test/real-phone/blind/parse.mjs');
    const sha = 'ab'.repeat(32), base = { lift: 'squat', view: 'side', sha256: sha, hashOf: 'video', version: 'v', recordedAt: '2026-11-09', sessionId: '00112233-4455-4677-8899-aabbccddeeff' };
    const named = kept => `squat_${kept}_side_${sha.slice(0, 8)}.json.gz`;
    // A counted set, kept as the app gave it.
    const counted = collectedPayload({ ...base, result, kept: 7, blind: { count: 7, p: 1 } });
    expect(parseBlindFile(counted, named(7)).status).toBe('set');
    // A refused set the universal engine proposed 120 on, counted 60 blind and kept at 60.
    const universal = { ...result, count: 0, refused: true, proposal: { count: 120, by: 'universal' } };
    const over = collectedPayload({ ...base, result: universal, kept: 60, blind: { count: 60, p: 1 } });
    const r = parseBlindFile(over, named(60));
    expect(r.status).toBe('set');
    expect([r.set.label, r.set.proposal, r.set.appRefused]).toEqual([60, 120, true]);
    // An app count of 120, kept as given; and « Je ne sais pas ».
    expect(parseBlindFile(collectedPayload({ ...base, result: { ...result, count: 120 }, kept: 120, blind: { count: 100 - 1, p: 1 } }), named(120)).status).toBe('set');
    expect(parseBlindFile(collectedPayload({ ...base, result, kept: 7, blind: { count: null, p: 1 } }), named(7))).toEqual({ status: 'unsure' });
  });

  it('draws a version 4 UUID without randomUUID, and none without a random generator', () => {
    const bytes = Uint8Array.from({ length: 16 }, (_, i) => i * 17);
    const id = newSessionId({ getRandomValues: a => { a.set(bytes); return a; } });
    expect(id).toMatch(UUID4);
    expect(id).toBe('00112233-4455-4677-8899-aabbccddeeff');
    expect(newSessionId({})).toBe(null);
    expect(newSessionId(null)).toBe(null);
  });
});

describe('without the flag', () => {
  it('nothing is read, hashed or stored', async () => {
    mem.clear();
    const put = vi.fn();
    const video = { arrayBuffer: vi.fn(async () => new ArrayBuffer(4)) };
    expect(await collectThisSet({ result, lift: 'squat', kept: 7, view: 'side', videoFile: video, version: 'v', storage: storage(), put })).toBe(null);
    expect(await collectThisSet({ result, lift: 'squat', kept: 7, view: 'side', videoFile: video, version: 'v', storage: storage({ [COLLECT_KEY]: '0' }), put })).toBe(null);
    expect(await collectThisSet({ result, lift: 'squat', kept: 7, view: 'side', videoFile: video, version: 'v', storage: { getItem: () => { throw new Error('x'); } }, put })).toBe(null);
    expect(put).not.toHaveBeenCalled();
    expect(video.arrayBuffer).not.toHaveBeenCalled();
    expect(mem.size).toBe(0);
  });
});
