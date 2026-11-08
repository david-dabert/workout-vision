// The blind-count file through its typed entry point (schema.ts; parse.mjs is the reader, parse.test.mjs its cases).
// What a phone writes since Phase 6 of David's order of 6 November 2026 is one blind set, with the day and the anonymous
// session it was kept in; a file written before has neither and is read all the same; « Je ne sais pas » has no label.
import { describe, expect, it } from 'vitest';
import { parseBlindFile, type BlindFile } from '../schema';

const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
const sha = '0f'.repeat(32);
const name = `bicep_curl_6_side_${sha.slice(0, 8)}.json.gz`;
const session = '00112233-4455-4677-8899-aabbccddeeff';
const file = (over: Partial<BlindFile> = {}): BlindFile => ({
  lift: 'bicep_curl', count: 6, view: 'side', videoSha256: sha, hashOf: 'video', labelKind: 'after-app', appCount: 6,
  recordedAt: '2026-11-09', sessionId: session, blind: { count: 6, p: 1 },
  worldLandmarks: [lm, lm], imageLandmarks: [lm, lm], timestamps: [0, 66.7], ...over,
});

describe('a blind-count file, as the phone writes it', () => {
  it('is one blind set, with the day and the anonymous session it was kept in', () => {
    const r = parseBlindFile(file(), name);
    expect(r.status).toBe('set');
    if (r.status !== 'set') return;
    expect([r.set.lift, r.set.label, r.set.kept, r.set.videoSha256, r.set.recordedAt, r.set.sessionId]).toEqual(['bicep_curl', 6, 6, sha, '2026-11-09', session]);
  });

  it('written before Phase 6, without the day or the session, is read with both empty', () => {
    const old: Partial<BlindFile> = { ...file() };
    delete old.recordedAt;
    delete old.sessionId;
    const r = parseBlindFile(old, name);
    expect(r.status === 'set' ? [r.set.recordedAt, r.set.sessionId] : r).toEqual([null, null]);
  });

  it('answered « Je ne sais pas » carries no label', () => {
    expect(parseBlindFile(file({ blind: { count: null, p: 1 } }), name)).toEqual({ status: 'unsure' });
  });

  it('with one fixed word for a session, or a name that does not match it, is refused', () => {
    expect(parseBlindFile(file({ sessionId: 'anon-session' }), name)).toEqual({ status: 'unreadable', reason: 'sessionId is not a UUID' });
    expect(parseBlindFile(file(), `bicep_curl_7_side_${sha.slice(0, 8)}.json.gz`).status).toBe('unreadable');
  });
});
