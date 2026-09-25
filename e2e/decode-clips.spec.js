/**
 * Step 1 DECODING test — extracts landmarks from David's five clips.
 *
 * One extraction path: extractFramesStreaming → detectPoseImage.
 * Sequential decode (WebCodecs required, RVFC fallback logged as failure).
 * Samples at 15/s, downscales to 640px long side.
 * Saves landmarks JSON (+ gzipped for git) and middle-frame PNG per clip.
 *
 * Runs in Chrome (primary) and WebKit (iPhone profile).
 * Fails any run whose decoder is not WebCodecs.
 * Time to result includes model loading.
 *
 * Pass criteria:
 *   - Every clip finishes
 *   - Decoder is WebCodecs
 *   - Pose coverage > 0
 *   - Nose above hips > 90% for upright lifts
 *   - All five clips produce identical landmarks on two runs
 */

import { test, expect } from '@playwright/test';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { gzipSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, '../test/real-phone/landmarks');
const FRAMES_DIR = resolve(__dirname, '../test/real-phone/frames');

const CLIPS = [
  { file: 'bench_press_7_angle_mufhcy60.mov', exercise: 'bench_press', reps: 7, upright: false },
  { file: 'bicep_curl_7_side_mufhf3wy.mov', exercise: 'bicep_curl', reps: 7, upright: true },
  { file: 'lat_pulldown_10_front_mufhlh4o.mov', exercise: 'lat_pulldown', reps: 10, upright: true },
  { file: 'lateral_raise_10_front_mufhhbun.mov', exercise: 'lateral_raise', reps: 10, upright: true },
  { file: 'overhead_press_10_front_mufhjkku.mov', exercise: 'overhead_press', reps: 10, upright: true },
];

for (const dir of [OUTPUT_DIR, FRAMES_DIR]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

test.describe('Step 1: Decode clips', () => {
  // 5 minutes per clip (model load + decode + inference)
  test.setTimeout(300_000);

  for (const clip of CLIPS) {
    test(`extract ${clip.exercise}`, async ({ page, browserName }) => {
      // Capture browser console for debugging
      page.on('console', msg => console.log(`[${browserName} ${msg.type()}] ${msg.text()}`));

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

      // Decoder must be WebCodecs
      expect(result.metadata.extractionMethod).toBe('webcodecs');

      // Save landmark file
      const landmarkFile = join(OUTPUT_DIR, clip.file.replace('.mov', '.json'));
      const landmarkData = {
        metadata: result.metadata,
        timestamps: result.timestamps,
        imageLandmarks: result.imageLandmarks,
        worldLandmarks: result.worldLandmarks,
      };
      writeFileSync(landmarkFile, JSON.stringify(landmarkData));

      // Save gzipped version for git
      const gzPath = landmarkFile + '.gz';
      writeFileSync(gzPath, gzipSync(JSON.stringify(landmarkData)));

      // Save middle frame PNG (from extraction canvas, not video player)
      if (result.midFrameDataURL) {
        const pngPath = join(FRAMES_DIR, clip.file.replace('.mov', '_mid.png'));
        const base64Data = result.midFrameDataURL.replace(/^data:image\/png;base64,/, '');
        writeFileSync(pngPath, Buffer.from(base64Data, 'base64'));
      }

      // Print results table row
      const totalTime = result.metadata.elapsedSeconds + result.metadata.modelLoadSeconds;
      console.log([
        clip.exercise,
        browserName,
        result.metadata.extractionMethod,
        `${result.metadata.extractedWidth}x${result.metadata.extractedHeight}`,
        `${result.metadata.duration?.toFixed(1)}s duration`,
        `${totalTime.toFixed(2)}s total`,
        `${result.metadata.sampleCount} samples`,
        `coverage ${(result.metadata.poseCoverage * 100).toFixed(1)}%`,
        `nose>${(result.metadata.noseAboveHips * 100).toFixed(1)}%`,
        `L-arm ${(result.metadata.leftArmVisibility * 100).toFixed(1)}%`,
        `R-arm ${(result.metadata.rightArmVisibility * 100).toFixed(1)}%`,
        `peak ${result.metadata.peakOpenFrames} frames`,
        `mid: ${result.metadata.midFrameWidth}x${result.metadata.midFrameHeight}`,
      ].join(' | '));

      // Pose coverage must be > 0
      expect(result.metadata.poseCoverage).toBeGreaterThan(0);

      // For upright lifts, nose must be above hips in >90% of detected samples
      if (clip.upright) {
        expect(result.metadata.noseAboveHips).toBeGreaterThan(0.9);
      }
    });
  }
});

test.describe('Step 1: Determinism', () => {
  test.setTimeout(300_000);

  for (const clip of CLIPS) {
    test(`determinism ${clip.exercise}`, async ({ page, browserName }) => {
      // Run 1 must have already completed (extract tests above)
      const run1Path = join(OUTPUT_DIR, clip.file.replace('.mov', '.json'));
      test.skip(!existsSync(run1Path), 'Run extract tests first');
      const run1 = JSON.parse(readFileSync(run1Path, 'utf-8'));

      // Run 2
      page.on('console', msg => console.log(`[${browserName} det ${msg.type()}] ${msg.text()}`));
      await page.goto('/workout-vision/test/real-phone/harness.html', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window._harnessReady === true, null, { timeout: 60_000 });

      const result = await page.evaluate(async (url) => {
        const output = await window._fetchAndProcess(url);
        return {
          timestamps: output.timestamps,
          imageLandmarks: output.imageLandmarks,
          method: output.metadata.extractionMethod,
        };
      }, `/workout-vision/test/real-phone/clips/${clip.file}`);

      // Must use WebCodecs
      expect(result.method).toBe('webcodecs');

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
      console.log(`Determinism ${clip.exercise}: ${result.timestamps.length} samples, ${diffs} diffs`);
    });
  }
});
