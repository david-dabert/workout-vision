import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { countReps } from '../counting/core';
import { summarizeCount } from '../coreAnalysis';
import baseline from '../check-baseline.json';
import { clipId, injectVerdict, pathTally, readLines, repeatShare, rowName, rowVerdict } from '../check';
import { FrozenReadError, frozenStream } from '../frameExtractor';

// David's collected sets, one folder per session (test/real-phone/sets-*/, as the scoreboard reads them): a clip of
// the check page is found in whichever folder holds it, and in one only (WP0.2: no hard-coded sets-29sep).
const REAL = resolve(__dirname, '../../../test/real-phone');
const SET_DIRS = readdirSync(REAL).filter(d => /^sets-/.test(d)).sort();
const where = (file: string) => SET_DIRS.filter(d => existsSync(resolve(REAL, d, file)));

// The check page's "before" is the live core's count and refusal on the committed landmarks of David's
// sets, never a typed number; the video is known by the samples its collected read holds.
describe('the check page baseline', () => {
  it('names each clip by a distinct id, its file without the extension', () => {
    const ids = baseline.clips.map(clipId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of baseline.clips) expect(c.id).toBe(c.file.replace(/\.json\.gz$/, ''));
  });
  // The 3 October demo incident was the video of David's lateral raise of 29 September: its healthy collector read
  // has the same samples at the same times. The check row is that set; the incident read is kept apart, outside every
  // sets-* folder, so the scoreboard counts the video once (WP0.2; David's choice A, 4 October).
  it('holds the lateral raise of 29 September, the video of the 3 October incident: David 9, the core 8 (WP0.2)', () => {
    const c = baseline.clips.find(c => c.id === 'lateral_raise_9_front_43e71b40')!;
    expect(where(c.file)).toEqual(['sets-29sep']);
    expect([c.label, c.before, c.refused]).toEqual([9, 8, false]);
    const incident = resolve(REAL, 'incidents/2026-10-03-demo/machine_lateral_raise_9_front_7b9f157e.json.gz');
    const a = JSON.parse(gunzipSync(readFileSync(incident)).toString());
    const b = JSON.parse(gunzipSync(readFileSync(resolve(REAL, 'sets-29sep', c.file))).toString());
    expect(a.timestamps).toEqual(b.timestamps);
    expect(a.metadata.duration).toBe(b.metadata.duration);
    expect(where('machine_lateral_raise_9_front_7b9f157e.json.gz')).toEqual([]);
  });
  for (const c of baseline.clips) {
    it(`${c.lift}: ${c.before} on the committed landmarks, David ${c.label}`, () => {
      const dirs = where(c.file);
      expect(dirs).toHaveLength(1);
      const d = JSON.parse(gunzipSync(readFileSync(resolve(REAL, dirs[0], c.file))).toString());
      expect(countReps(d.worldLandmarks, d.timestamps, c.lift).count).toBe(c.before);
      expect(summarizeCount(d.worldLandmarks, d.timestamps, c.lift).refused).toBe(c.refused);
      expect(d.videoSha256).toBe(c.sha256);
      expect(d.timestamps.length).toBe(c.samples);
      expect(c.duration).toBe(d.metadata.duration);
      expect(Math.floor(c.duration * 15)).toBe(c.samples);
      expect(d.count).toBe(c.label);
    });
  }
});

describe('a row of the check page', () => {
  const clip = { before: 10, samples: 439, duration: 29.3, refused: false };
  it('as before: whole read, same count, same video', () => {
    expect(rowVerdict(clip, { count: 10, refused: false, read: 439, expected: 439 })).toEqual({ ok: true, why: [] });
  });
  it('not as before: a partial read, a different count, another video', () => {
    expect(rowVerdict(clip, { count: 2, read: 181, expected: 439 }).why).toEqual(['read 181 of 439 samples', 'counted 2, before 10']);
    expect(rowVerdict(clip, { count: 10, read: 460, expected: 460, duration: 30.7 }).why).toEqual(['another video (30.70 s where the set lasts 29.30 s)']);
  });
  it('the same set whose reported length crosses a sample boundary by a few milliseconds (review 11)', () => {
    const rdl = baseline.clips.find(c => c.lift === 'romanian_deadlift')!;
    const d = rdl.duration + 0.002, e = Math.floor(d * 15);
    expect(e).toBe(rdl.samples + 1);
    expect(rowVerdict(rdl, { count: rdl.before, refused: false, read: e, expected: e, duration: d }).ok).toBe(true);
    expect(rowVerdict(clip, { count: null, read: 181, expected: 439 }).ok).toBe(false);
  });
  it('not as before when the app now refuses, or no longer refuses, the set', () => {
    expect(rowVerdict(clip, { count: 10, refused: true, read: 439, expected: 439 }).why).toEqual(['refused now, counted before']);
    expect(rowVerdict({ before: 3, samples: 331, duration: 22.07, refused: true }, { count: 3, refused: false, read: 331, expected: 331 }).why).toEqual(['counted now, refused before']);
  });
});

describe('rows keyed by clip id (WP0.2)', () => {
  const NAMES = { lateral_raise: 'Lateral raise' };
  const a = { id: 'lateral_raise_9_front_43e71b40', lift: 'lateral_raise', file: 'lateral_raise_9_front_43e71b40.json.gz' };
  const b = { id: 'lateral_raise_10_front_mufhhbun', lift: 'lateral_raise', file: 'lateral_raise_10_front_mufhhbun.json.gz' };
  it('two rows of one lift do not overwrite each other', () => {
    const done = new Map();
    done.set(clipId(a), { ok: true, why: [] });
    done.set(clipId(b), { ok: false, why: ['counted 9, before 10'] });
    expect(done.size).toBe(2);
    const t = pathTally(done, [a, b], NAMES);
    expect(t).toMatchObject({ n: 2, checked: 2, ok: 1, whole: false });
    expect(t.bad).toEqual(['Lateral raise mufhhbun']);
    expect(rowName(a, NAMES)).not.toBe(rowName(b, NAMES));
  });
  it('every clip of the baseline is its own row, two of one lift included', () => {
    const done = new Map(baseline.clips.map(c => [clipId(c), { ok: true, why: [] }]));
    expect(pathTally(done, baseline.clips)).toMatchObject({ n: baseline.clips.length, checked: baseline.clips.length, whole: true, bad: [] });
  });
  it('a verdict of a clip not on the page is not counted', () => {
    expect(pathTally(new Map([['elsewhere', { ok: false }]]), [a])).toMatchObject({ checked: 0, bad: [] });
  });
});

describe('a row says how the video was read', () => {
  it('renders the repeat share of the pictures and the skeletons, the decoder and the fallback', () => {
    const lines = readLines({ pictures: { samples: 460, repeats: 0 }, skeletons: { samples: 460, repeats: 9 }, decoder: 'rvfc', fallback: 'WebCodecs: skipped, playback path forced' });
    expect(lines).toEqual([
      'Repeats: pictures 0 of 459 (0 %) · skeletons 9 of 459 (2 %)',
      'Decoder: rvfc · fallback: WebCodecs: skipped, playback path forced',
    ]);
    expect(readLines({ pictures: { samples: 460, repeats: 459 }, decoder: 'webcodecs' }, true)).toEqual([
      'Répétitions\u00A0: images 459 sur 459 (100\u00A0%) · squelettes inconnu',
      'Décodeur\u00A0: webcodecs · repli\u00A0: aucun',
    ]);
  });
  it('reads the share as the frozen-read rule does: repeats of samples - 1', () => {
    expect(repeatShare({ samples: 461, repeats: 231 })!.share).toBeCloseTo(231 / 460);
    expect(repeatShare(null)).toBe(null);
    expect(repeatShare({ samples: 1, repeats: 0 })!.share).toBe(0);
  });
});

describe('the frozen injection (check.html?inject=frozen)', () => {
  // A canvas stand-in: its picture is a number; drawImage copies another's.
  const canvasOf = (pic: number) => ({ width: 4, height: 4, pic, getContext() { const self = this; return { drawImage(c: any) { self.pic = c.pic; } }; } });
  it('hands on the first sample again and again, and a new pass keeps its own first sample', async () => {
    const seen: number[] = [];
    const onFrame = frozenStream(async (c: any) => { seen.push(c.pic); }, (() => canvasOf(-1)) as any);
    for (const [pic, i] of [[1, 0], [2, 1], [3, 2], [7, 0], [8, 1]]) await onFrame(canvasOf(pic) as any, i, i / 15);
    expect(seen).toEqual([1, 1, 1, 7, 7]);
  });
  it('passes only on a refusal as a frozen read', () => {
    const extraction = Object.assign(new Error('Video extraction failed.'), { frozen: { samples: 460, repeats: 459, decoder: 'rvfc' } });
    expect(injectVerdict({ error: extraction })).toMatchObject({ ok: true, by: 'pictures', read: { samples: 460, repeats: 459 } });
    expect(injectVerdict({ error: new FrozenReadError({ samples: 60, repeats: 59 }, 'rvfc') }).ok).toBe(true);
    expect(injectVerdict({ error: Object.assign(new Error('x'), { name: 'FrozenSkeletonsError', samples: 60, repeats: 59 }) })).toMatchObject({ ok: true, by: 'skeletons' });
  });
  it('fails when the guard did not fire: a count, a refusal for another reason, another error', () => {
    expect(injectVerdict({ count: 0 })).toMatchObject({ ok: false, why: ['counted 0, not refused'] });
    expect(injectVerdict({ count: 'refused' })).toMatchObject({ ok: false, why: ['refused, but not as frozen'] });
    expect(injectVerdict({ error: Object.assign(new Error('12 samples read'), { name: 'PartialReadError' }) }).ok).toBe(false);
  });
});
