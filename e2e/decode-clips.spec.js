/**
 * Step 1 DECODING test — extracts landmarks from David's five clips.
 *
 * One extraction path: extractFramesStreaming → detectPoseImage.
 * Sequential decode (rVFC or WebCodecs), not one-seek-per-frame.
 * Samples at 15/s, downscales to 640px long side.
 * Saves landmarks JSON and middle-frame PNG per clip.
 *
 * Pass criteria:
 *   - Every clip finishes
 *   - Time to result ≤ clip duration
 *   - Two runs produce identical landmark files
 */

import { test, expect } from '@playwright/test';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, '../test/real-phone/landmarks');
const FRAMES_DIR = resolve(__dirname, '../test/real-phone/frames');

const CLIPS = [
  { file: 'bench_press_7_angle_mufhcy60.mov', exercise: 'bench_press', reps: 7 },
  { file: 'bicep_curl_7_side_mufhf3wy.mov', exercise: 'bicep_curl', reps: 7 },
  { file: 'lat_pulldown_10_front_mufhlh4o.mov', exercise: 'lat_pulldown', reps: 10 },
  { file: 'lateral_raise_10_front_mufhhbun.mov', exercise: 'lateral_raise', reps: 10 },
  { file: 'overhead_press_10_front_mufhjkku.mov', exercise: 'overhead_press', reps: 10 },
];

for (const dir of [OUTPUT_DIR, FRAMES_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

test.describe('Step 1: Decode clips', () => {
  // 5 minutes per clip (model load + decode + inference)
  test.setTimeout(300_000);

  for (const clip of CLIPS) {
    test(`extract ${clip.exercise}`, async ({ page }) => {
      // Capture browser console for debugging
      page.on('console', msg => console.log(`[browser ${msg.type()}] ${msg.text()}`));

      // Navigate to the harness served by Vite dev server
      await page.goto('/workout-vision/test/real-phone/harness.html', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window._harnessReady === true, null, { timeout: 60_000 });

      // Run extraction via the harness — fetches clip from dev server
      const clipUrl = `/workout-vision/test/real-phone/clips/${clip.file}`;
      const result = await page.evaluate(async (url) => {
        try {
          const output = await window._fetchAndProcess(url);
          return {
            metadata: output.metadata,
            imageLandmarks: output.imageLandmarks,
            worldLandmarks: output.worldLandmarks,
            timestamps: output.timestamps,
            midFrameDataURL: output.midFrameDataURL,
          };
        } catch (e) {
          return { error: e.message, stack: e.stack };
        }
      }, clipUrl);

      expect(result.error, `Clip ${clip.file} failed: ${result.error}`).toBeUndefined();
      expect(result.metadata.sampleCount).toBeGreaterThan(0);

      // Save landmark file (save before assertions so data isn't lost)
      const landmarkFile = join(OUTPUT_DIR, clip.file.replace('.mov', '.json'));
      const landmarkData = {
        metadata: result.metadata,
        timestamps: result.timestamps,
        imageLandmarks: result.imageLandmarks,
        worldLandmarks: result.worldLandmarks,
      };
      writeFileSync(landmarkFile, JSON.stringify(landmarkData));

      // Save middle frame PNG (stays on Mac per PLAN.md)
      if (result.midFrameDataURL) {
        const pngPath = join(FRAMES_DIR, clip.file.replace('.mov', '_mid.png'));
        const base64Data = result.midFrameDataURL.replace(/^data:image\/png;base64,/, '');
        writeFileSync(pngPath, Buffer.from(base64Data, 'base64'));
      }

      // Print results table row
      console.log([
        clip.exercise,
        `${result.metadata.extractedWidth}x${result.metadata.extractedHeight}`,
        result.metadata.extractionMethod,
        `${result.metadata.duration?.toFixed(1)}s duration`,
        `${result.metadata.elapsedSeconds}s decode+infer`,
        `${result.metadata.modelLoadSeconds}s model`,
        `${result.metadata.sampleCount} samples`,
        `mid: ${result.metadata.midFrameWidth}x${result.metadata.midFrameHeight}`,
      ].join(' | '));

      // Time to result (decode+inference, excluding model load) must be ≤ clip duration
      expect(result.metadata.elapsedSeconds).toBeLessThanOrEqual(result.metadata.duration);
    });
  }
});

test.describe('Step 1: Determinism', () => {
  test.setTimeout(300_000);

  test('two runs produce identical landmarks (bench_press)', async ({ page }) => {
    // Run 1 must have already completed (extract tests above)
    const run1Path = join(OUTPUT_DIR, 'bench_press_7_angle_mufhcy60.json');
    test.skip(!existsSync(run1Path), 'Run extract tests first');
    const run1 = JSON.parse(readFileSync(run1Path, 'utf-8'));

    // Run 2
    await page.goto('/workout-vision/test/real-phone/harness.html', { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window._harnessReady === true, null, { timeout: 60_000 });

    const result = await page.evaluate(async (url) => {
      const output = await window._fetchAndProcess(url);
      return {
        timestamps: output.timestamps,
        imageLandmarks: output.imageLandmarks,
      };
    }, '/workout-vision/test/real-phone/clips/bench_press_7_angle_mufhcy60.mov');

    expect(result.timestamps.length).toBe(run1.timestamps.length);

    let diffs = 0;
    for (let i = 0; i < result.imageLandmarks.length; i++) {
      const a = result.imageLandmarks[i];
      const b = run1.imageLandmarks[i];
      if (a === null && b === null) continue;
      if (a === null || b === null) { diffs++; continue; }
      for (let j = 0; j < a.length; j++) {
        if (Math.abs((a[j]?.x || 0) - (b[j]?.x || 0)) > 1e-6 ||
            Math.abs((a[j]?.y || 0) - (b[j]?.y || 0)) > 1e-6) {
          diffs++;
          break;
        }
      }
    }
    expect(diffs).toBe(0);
    console.log(`Determinism: ${result.timestamps.length} samples, ${diffs} diffs`);
  });
});
