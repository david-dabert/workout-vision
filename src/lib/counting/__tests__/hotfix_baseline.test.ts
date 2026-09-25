/**
 * Hotfix-ios baseline — runs the OLD RepCounter on the committed landmark files
 * to get real measured numbers, not hand-typed ones.
 */

import { describe, it, expect } from 'vitest';
import { RepCounter } from '../../repCounter/index';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { gunzipSync } from 'zlib';

function loadClipLandmarks(clipName: string) {
  const gzPath = resolve(__dirname, '../../../../test/real-phone/landmarks', clipName + '.json.gz');
  const buf = gunzipSync(readFileSync(gzPath));
  return JSON.parse(buf.toString());
}

describe('Hotfix-ios RepCounter baseline on committed files', () => {
  const clips = [
    { file: 'bench_press_7_angle_mufhcy60', lift: 'bench_press', expected: 7 },
    { file: 'bicep_curl_7_side_mufhf3wy', lift: 'bicep_curl', expected: 7 },
    { file: 'lat_pulldown_10_front_mufhlh4o', lift: 'lat_pulldown', expected: 10 },
    { file: 'lateral_raise_10_front_mufhhbun', lift: 'lateral_raise', expected: 10 },
    { file: 'overhead_press_10_front_mufhjkku', lift: 'overhead_press', expected: 10 },
  ];

  for (const clip of clips) {
    it(`${clip.lift}: hotfix-ios count`, () => {
      const data = loadClipLandmarks(clip.file);
      const counter = new RepCounter(clip.lift, { mode: 'video', fps: 15 });

      for (let i = 0; i < data.imageLandmarks.length; i++) {
        const lm = data.imageLandmarks[i];
        if (lm) {
          counter.update(lm, data.timestamps[i]);
        }
      }
      counter.finalize();

      console.log(`hotfix-ios | ${clip.lift} | expected=${clip.expected} | counted=${counter.reps}`);
      expect(counter.reps).toBeGreaterThanOrEqual(0);
    });
  }
});
