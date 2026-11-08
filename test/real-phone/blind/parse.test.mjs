// The blind-count file's schema (parse.mjs, README.md here; Phase 6 of David's order of 6 November 2026).
import { describe, expect, it } from 'vitest';
import { parseBlindFile } from './parse.mjs';

const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.9 }));
const sha = 'ab'.repeat(32);
const name = `squat_8_side_${sha.slice(0, 8)}.json.gz`;
// A file as src/lib/phoneCollect.js keeps it (collectedPayload), with the fields Phase 6 added.
const file = (over = {}) => ({
  lift: 'squat', count: 8, view: 'side', videoSha256: sha,
  worldLandmarks: [lm, lm, lm], imageLandmarks: [lm, lm, lm], timestamps: [0, 66.7, 133.3],
  labelKind: 'after-app', appCount: 8, corrected: false, hashOf: 'video', source: 'result-screen',
  recordedAt: '2026-11-09T18:30:00.000Z', sessionId: '00112233-4455-4677-8899-aabbccddeeff',
  blind: { count: 8, p: 1 },
  ...over,
});

describe('a blind-count file', () => {
  it('gives every field the order names: video hash, exercise, blind count, app count, time and session', () => {
    const r = parseBlindFile(file({ count: 9, appCount: 9 }), `squat_9_side_${sha.slice(0, 8)}.json.gz`);
    expect(r.status).toBe('set');
    expect(r.set.videoSha256).toBe(sha);
    expect(r.set.hashOf).toBe('video');
    expect(r.set.lift).toBe('squat');
    expect(r.set.label).toBe(8);
    expect(r.set.kept).toBe(9);
    expect(r.set.appCount).toBe(9);
    expect(r.set.appRefused).toBe(false);
    expect(r.set.recordedAt).toBe('2026-11-09T18:30:00.000Z');
    expect(r.set.sessionId).toBe('00112233-4455-4677-8899-aabbccddeeff');
    expect(r.set.wl).toHaveLength(3);
    expect(r.set.ts).toEqual([0, 66.7, 133.3]);
  });

  it('takes a file kept before 8 November 2026, with no time and no session, and a refused set with its proposal', () => {
    const old = file();
    delete old.recordedAt;
    delete old.sessionId;
    const r = parseBlindFile(old, name);
    expect(r.status).toBe('set');
    expect(r.set.recordedAt).toBe(null);
    expect(r.set.sessionId).toBe(null);
    const refused = parseBlindFile(file({ appCount: null, appRefused: true, proposal: 7 }), name);
    expect(refused.status).toBe('set');
    expect(refused.set.appRefused).toBe(true);
    expect(refused.set.proposal).toBe(7);
    expect(refused.set.appCount).toBe(null);
  });

  it('tells "Je ne sais pas" (no label) from a file with no blind count at all', () => {
    expect(parseBlindFile(file({ blind: { count: null, p: 1 } }), name)).toEqual({ status: 'unsure' });
    const plain = file();
    delete plain.blind;
    expect(parseBlindFile(plain, name)).toEqual({ status: 'none' });
  });

  it('refuses a file that breaks the schema, and says why', () => {
    const cases = [
      [{ blind: { count: 0, p: 1 } }, 'blind.count'],
      [{ blind: { count: 100, p: 1 } }, 'blind.count'],
      [{ blind: { count: 7.5, p: 1 } }, 'blind.count'],
      [{ blind: 8 }, 'blind is not'],
      [{ blind: { count: 8, p: 2 } }, 'blind.p'],
      [{ labelKind: undefined }, 'labelKind'],
      [{ lift: '' }, 'lift'],
      [{ count: -1 }, 'kept'],
      [{ worldLandmarks: [] }, 'world landmarks'],
      [{ timestamps: [0, 66.7] }, 'timestamps'],
      [{ imageLandmarks: [lm] }, 'image landmarks'],
      [{ videoSha256: 'abc' }, 'videoSha256'],
      [{ hashOf: 'thumbnail' }, 'hashOf'],
      [{ appCount: 'eight' }, 'appCount'],
      [{ appRefused: 'yes' }, 'appRefused'],
      [{ proposal: 0 }, 'proposal'],
      [{ recordedAt: 'yesterday' }, 'recordedAt'],
      [{ sessionId: 'david' }, 'sessionId'],
    ];
    for (const [over, why] of cases) {
      const r = parseBlindFile(file(over), name);
      expect(r.status, JSON.stringify(over)).toBe('unreadable');
      expect(r.reason, JSON.stringify(over)).toContain(why);
    }
    expect(parseBlindFile(null).status).toBe('unreadable');
    expect(parseBlindFile([file()]).status).toBe('unreadable');
  });

  // Review of 8 November 2026: the cap of 99 is the person's field; the app's count, its proposal and a count kept as
  // the app gave it have none, and a tester's over-count is exactly what the blind scoreboard exists to record.
  it('takes the app\'s own counts above 99: only the blind count, typed in the person\'s field, stops at 99', () => {
    expect(parseBlindFile(file({ appCount: 0, appRefused: true, proposal: 120 }), name).status).toBe('set');
    expect(parseBlindFile(file({ appCount: 120 }), name).status).toBe('set');
    expect(parseBlindFile(file({ count: 120, appCount: 120 }), `squat_120_side_${sha.slice(0, 8)}.json.gz`).status).toBe('set');
    expect(parseBlindFile(file({ blind: { count: 100, p: 1 } }), name).status).toBe('unreadable');
  });

  it('holds a « Je ne sais pas » file to the whole schema: it carries no label, and it is locked and kept like the others', () => {
    const unsure = { blind: { count: null, p: 1 } };
    expect(parseBlindFile(file(unsure), name)).toEqual({ status: 'unsure' });
    expect(parseBlindFile(file({ ...unsure, labelKind: undefined }), name).status).toBe('unreadable');
    expect(parseBlindFile(file({ ...unsure, worldLandmarks: [] }), name).status).toBe('unreadable');
    expect(parseBlindFile(file({ ...unsure, videoSha256: 'abc' }), name).status).toBe('unreadable');
    expect(parseBlindFile(file(unsure), 'IMG_0001.json.gz').status).toBe('unreadable');
  });

  it('reads the day a count was kept, which is all the phone records of the time since the review of 8 November 2026', () => {
    expect(parseBlindFile(file({ recordedAt: '2026-11-09' }), name).set.recordedAt).toBe('2026-11-09');
    expect(parseBlindFile(file({ recordedAt: '2026-11-31' }), name).status).toBe('unreadable');
    expect(parseBlindFile(file({ recordedAt: '9 November' }), name).status).toBe('unreadable');
  });

  it('holds the file name to what the file says: exercise, kept count and hash', () => {
    expect(parseBlindFile(file(), name).status).toBe('set');
    expect(parseBlindFile(file(), `blind/olivier/set3_${name}`).status).toBe('set');
    expect(parseBlindFile(file()).status).toBe('set');
    for (const wrong of [`squat_9_side_${sha.slice(0, 8)}.json.gz`, `lunge_8_side_${sha.slice(0, 8)}.json.gz`, 'squat_8_side_cdcdcdcd.json.gz', 'IMG_0001.json.gz']) {
      expect(parseBlindFile(file(), wrong).status, wrong).toBe('unreadable');
    }
  });
});
