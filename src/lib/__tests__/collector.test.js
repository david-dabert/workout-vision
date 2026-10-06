import { describe, it, expect } from 'vitest';
import { setFileName, issueUrl, setPayload, sampleSet, setIsWhole, refusal } from '../collector';

describe('collector', () => {
  describe('setFileName', () => {
    it('formats lift_reps_view_hash.json.gz', () => {
      expect(setFileName('bicep_curl', 7, 'side', 'abcdef1234567890abcdef'))
        .toBe('bicep_curl_7_side_abcdef12.json.gz');
    });

    it('takes only the first 8 hex chars of the hash', () => {
      expect(setFileName('squat', 10, 'front', '0123456789abcdef0123456789abcdef'))
        .toBe('squat_10_front_01234567.json.gz');
    });

    it('accepts the three view values', () => {
      for (const view of ['side', 'front', 'angle']) {
        const name = setFileName('lat_pulldown', 5, view, 'aa'.repeat(16));
        expect(name).toContain(`_${view}_`);
      }
    });
  });

  describe('issueUrl', () => {
    it('returns a GitHub new-issue URL with the set label', () => {
      const url = issueUrl({ lift: 'squat', count: 10, view: 'front', sha256: 'abc123' });
      expect(url).toContain('github.com/david-dabert/workout-vision/issues/new');
      expect(url).toContain('labels=set');
      expect(url).toContain('Lift%3A+squat');
      // The URL encodes a newline between fields
      expect(url).toContain('Count%3A+10');
      expect(url).toContain('View%3A+front');
      expect(url).toContain('SHA-256%3A+abc123');
    });

    it('title names the lift and count', () => {
      const url = issueUrl({ lift: 'bicep_curl', count: 7, view: 'side', sha256: 'ff' });
      const parsed = new URL(url);
      expect(parsed.searchParams.get('title')).toBe('Set: bicep_curl, 7 reps, side');
    });
  });

  describe('setPayload', () => {
    const landmarks = [[{ x: 1, y: 2, z: 3 }], null, [{ x: 4, y: 5, z: 6 }]];
    const timestamps = [0, 0.0667, 0.1333];
    const meta = {
      lift: 'lateral_raise',
      count: 10,
      view: 'front',
      sha256: 'abcdef1234567890',
      frameWidth: 360,
      frameHeight: 640,
      version: '1.4.0',
    };

    it('includes all required fields', () => {
      const payload = setPayload({ worldLandmarks: landmarks, timestamps, ...meta });
      expect(payload.worldLandmarks).toBe(landmarks);
      expect(payload.timestamps).toBe(timestamps);
      expect(payload.lift).toBe('lateral_raise');
      expect(payload.count).toBe(10);
      expect(payload.view).toBe('front');
      expect(payload.videoSha256).toBe('abcdef1234567890');
      expect(payload.extraction.fps).toBe(15);
      expect(payload.extraction.maxLongSide).toBe(640);
      expect(payload.frame.width).toBe(360);
      expect(payload.frame.height).toBe(640);
      expect(payload.version).toBe('1.4.0');
    });

    it('records the extractor\'s metadata as the committed clips carry it, the decoder included', () => {
      const extractor = { width: 360, height: 640, fps: 15, duration: 22.77, frameCount: 3, method: 'webcodecs', peakOpenFrames: 1, rotationDecision: 'manual rotation=90° from container' };
      const payload = setPayload({ worldLandmarks: landmarks, timestamps, ...meta, extractor });
      expect(payload.metadata).toEqual({
        extractionMethod: 'webcodecs',
        extractedWidth: 360,
        extractedHeight: 640,
        duration: 22.77,
        sampleCount: 3,
        targetFps: 15,
        maxLongSide: 640,
        peakOpenFrames: 1,
        rotationDecision: 'manual rotation=90° from container',
      });
    });

    it('keeps the image landmarks of each sample, as the committed clips hold them', () => {
      const image = [[{ x: 0.5, y: 0.4, z: 0, visibility: 0.9 }], null, [{ x: 0.6, y: 0.4, z: 0, visibility: 0.8 }]];
      const payload = setPayload({ worldLandmarks: landmarks, imageLandmarks: image, timestamps, ...meta });
      expect(payload.imageLandmarks).toBe(image);
    });

    it('does not include a count from the counter', () => {
      const payload = setPayload({ worldLandmarks: landmarks, timestamps, ...meta });
      expect(payload).not.toHaveProperty('appCount');
      expect(payload).not.toHaveProperty('reps');
    });
  });

  // A file carries David's count for the whole video, so its landmarks must cover the whole video
  // (28 September 2026). The extractor can end early, drop a sample or start again from the first
  // frame without throwing; none of these may reach a file.
  describe('sampleSet', () => {
    it('keeps the samples in order', () => {
      const set = sampleSet();
      set.add(0, 'a', 0); set.add(1, 'b', 0.0667);
      expect(set.world).toEqual(['a', 'b']);
      expect(set.timestamps).toEqual([0, 0.0667]);
      expect(set.failed).toBe(0);
    });

    it('starts again from nothing when the decoder starts again from the first frame', () => {
      const set = sampleSet();
      for (const i of [0, 1, 2]) set.add(i, `first${i}`, i / 15);
      for (const i of [0, 1, 2, 3, 4]) set.add(i, `second${i}`, i / 15);
      expect(set.world).toEqual(['second0', 'second1', 'second2', 'second3', 'second4']);
      expect(set.timestamps).toEqual([0, 1 / 15, 2 / 15, 3 / 15, 4 / 15]);
    });

    it('counts a sample whose pose could not be read', () => {
      const set = sampleSet();
      set.add(0, 'a', 0); set.fail(1);
      expect(set.failed).toBe(1);
    });

    it('forgets a failure once the same sample is read on a later try', () => {
      const set = sampleSet();
      set.add(0, 'a', 0); set.fail(1); set.add(1, 'b', 1 / 15);
      expect(set.failed).toBe(0);
    });

    it('forgets a failure before the decoder started again from the first frame', () => {
      const set = sampleSet();
      set.fail(0);
      for (const i of [0, 1, 2, 3, 4]) set.add(i, 'x', i / 15);
      expect(set.failed).toBe(0);
    });

    it('keeps the image landmarks beside the world landmarks, sample by sample', () => {
      const set = sampleSet();
      set.add(0, 'w0', 0, 'i0'); set.add(1, null, 1 / 15, null);
      for (const i of [0, 1, 2]) set.add(i, `w${i}`, i / 15, `i${i}`);
      expect(set.image).toEqual(['i0', 'i1', 'i2']);
      expect(set.world).toEqual(['w0', 'w1', 'w2']);
    });

    it('counts the samples with a pose', () => {
      const set = sampleSet();
      set.add(0, null, 0); set.add(1, 'b', 1 / 15); set.add(2, null, 2 / 15);
      expect(set.posed).toBe(1);
    });
  });

  describe('setIsWhole', () => {
    // The extractor samples floor(duration x 15) times; the five committed clips match it exactly
    // (test/real-phone/landmarks: 331, 341, 609, 439 and 620 samples).
    it('accepts a set whose samples cover the whole video', () => {
      expect(setIsWhole({ samples: 341, duration: 22.766666999999998, fps: 15, maxFrames: 10000, failed: 0 })).toBe(true);
    });

    it('refuses a set that ended early', () => {
      expect(setIsWhole({ samples: 180, duration: 40.618333, fps: 15, maxFrames: 10000, failed: 0 })).toBe(false);
    });

    // 6 October: a read 1 or 2 samples short (the end of the stream) is whole; a real partial read is not.
    it('keeps a set missing one or two samples, and refuses one missing more than 2 samples or 1 %', () => {
      expect(setIsWhole({ samples: 608, duration: 40.618333, fps: 15, maxFrames: 10000, failed: 0 })).toBe(true);
      expect(setIsWhole({ samples: 607, duration: 40.618333, fps: 15, maxFrames: 10000, failed: 0 })).toBe(true);
      expect(setIsWhole({ samples: 602, duration: 40.618333, fps: 15, maxFrames: 10000, failed: 0 })).toBe(false);
      expect(setIsWhole({ samples: 181, duration: 29.3, fps: 15, maxFrames: 10000, failed: 0 })).toBe(false);
    });

    it('refuses a set with a sample whose pose could not be read', () => {
      expect(setIsWhole({ samples: 341, duration: 22.766666999999998, fps: 15, maxFrames: 10000, failed: 1 })).toBe(false);
    });

    it('refuses a video longer than the samples the extractor may take', () => {
      expect(setIsWhole({ samples: 100, duration: 10, fps: 15, maxFrames: 100, failed: 0 })).toBe(false);
    });

    it('refuses a set in which no sample has a pose', () => {
      expect(setIsWhole({ samples: 341, posed: 0, duration: 22.766666999999998, fps: 15, maxFrames: 10000, failed: 0 })).toBe(false);
    });

    it('refuses a set with no duration', () => {
      expect(setIsWhole({ samples: 0, duration: 0, fps: 15, maxFrames: 10000, failed: 0 })).toBe(false);
    });
  });

  // The page tells David why no file is offered, and says only what happened (29 September 2026):
  // "no body was found" only when every sample was read; a sample the pose model could not read is
  // reported as unread, never as an early end. The extractor does not say whether it reached the
  // end of the video (on the playback path, captures can fall behind playback), and a failed first
  // pass can leave its samples behind, so the page states counts, never a cause (review of
  // 29 September 2026).
  describe('refusal', () => {
    const base = { duration: 22.766666999999998, fps: 15, maxFrames: 10000 };

    it('offers the file, with no message, when the set is whole', () => {
      expect(refusal({ ...base, samples: 341, posed: 341, failed: 0 })).toBeNull();
    });

    it('says no body was found when every sample was read and none has a pose', () => {
      const text = refusal({ ...base, samples: 341, posed: 0, failed: 0 });
      expect(text).toContain('no body was found in any frame of the video');
      expect(text).toContain('Film the whole body');
    });

    it('does not say no body was found when fewer samples were read, even with no pose so far', () => {
      const text = refusal({ ...base, samples: 180, posed: 0, failed: 0 });
      expect(text).not.toContain('no body');
      expect(text).not.toContain('Film the whole body');
      expect(text).toContain('only 180 of the 341 samples of the video were read');
    });

    it('never claims the video was not read to the end, which the extractor cannot tell', () => {
      for (const c of [{ samples: 200, posed: 200, failed: 0 }, { samples: 340, posed: 300, failed: 1 }, { samples: 100, posed: 90, failed: 2 }]) {
        expect(refusal({ ...base, ...c })).not.toContain('not read to the end');
      }
    });

    it('does not say no body was found when a sample could not be read', () => {
      const text = refusal({ ...base, samples: 340, posed: 0, failed: 1 });
      expect(text).not.toContain('no body');
      expect(text).toContain('the pose model could not read 1 sample');
    });

    it('reports a sample that failed as unread', () => {
      const text = refusal({ ...base, samples: 340, posed: 300, failed: 1 });
      expect(text).toContain('only 340 of the 341 samples of the video were read');
      expect(text).toContain('the pose model could not read 1 sample');
    });

    it('adds no count of its own when a failed first pass left samples behind', () => {
      const set = sampleSet();
      for (let i = 0; i < 5; i++) set.add(i, [1], i / 15);
      set.fail(5); set.fail(0);
      const text = refusal({ samples: set.world.length, posed: set.posed, failed: set.failed, duration: 1, fps: 15, maxFrames: Infinity });
      expect(text).not.toContain('7 of 15');
      expect(text).not.toContain('2 of 15');
      expect(text).toContain('only 5 of the 15 samples of the video were read');
    });

    it('says the video is too long when it holds more samples than the page may take', () => {
      const text = refusal({ samples: 100, posed: 100, failed: 0, duration: 10, fps: 15, maxFrames: 100 });
      expect(text).toContain('longer than the 100 samples the page can read');
      expect(text).not.toContain('only');
    });

    it('says the length could not be read when the duration is missing or endless', () => {
      for (const duration of [0, NaN, Infinity]) {
        const text = refusal({ samples: 300, posed: 300, failed: 0, duration, fps: 15, maxFrames: Infinity });
        expect(text).toContain('the length of the video could not be read');
        expect(text).not.toContain('Infinity');
      }
    });

    it('refuses exactly the sets setIsWhole refuses', () => {
      const cases = [
        { samples: 341, posed: 341, failed: 0 }, { samples: 341, posed: 0, failed: 0 },
        { samples: 180, posed: 0, failed: 0 }, { samples: 340, posed: 300, failed: 1 },
        { samples: 342, posed: 342, failed: 0 },
      ];
      for (const c of cases) expect(refusal({ ...base, ...c }) === null).toBe(setIsWhole({ ...base, ...c }));
    });

    it('never uses an em dash', () => {
      for (const c of [{ samples: 341, posed: 0, failed: 0 }, { samples: 100, posed: 90, failed: 2 }, { samples: 342, posed: 342, failed: 0 }]) {
        expect(refusal({ ...base, ...c })).not.toContain('\u2014');
      }
    });
  });
});
