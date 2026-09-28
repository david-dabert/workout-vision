import { describe, it, expect } from 'vitest';
import { setFileName, issueUrl, setPayload, sampleSet, setIsWhole } from '../collector';

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

    it('refuses a set missing one sample', () => {
      expect(setIsWhole({ samples: 608, duration: 40.618333, fps: 15, maxFrames: 10000, failed: 0 })).toBe(false);
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
});
