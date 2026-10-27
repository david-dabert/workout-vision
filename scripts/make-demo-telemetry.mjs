import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { countReps } from '../src/lib/counting/core.js';
import { analyzeContinuousBiomechanics } from '../src/lib/coaching/movementOptimization.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const inputPath = path.join(root, 'test/real-phone/held-01oct/set18_bodyweight_squat_9_front_7d5a95f2.json.gz');
const outputPath = path.join(root, 'public/demo/bodyweight-squat-9-telemetry.json');

const buf = fs.readFileSync(inputPath);
const json = JSON.parse(zlib.gunzipSync(buf).toString());

const countRes = countReps(json.worldLandmarks, json.timestamps, 'squat');
const bioFr = analyzeContinuousBiomechanics(countRes.angles, json.timestamps, 'squat', true);
const bioEn = analyzeContinuousBiomechanics(countRes.angles, json.timestamps, 'squat', false);

// Compact landmarks: 3 decimals are sub-millimeter on unit viewport, perfectly smooth for playback
const compactImageLandmarks = json.imageLandmarks.map(frame =>
  frame ? frame.map(pt => pt ? { x: Math.round(pt.x * 1000) / 1000, y: Math.round(pt.y * 1000) / 1000, visibility: 0.99 } : { x: 0, y: 0, visibility: 0 }) : null
);

const demoTelemetry = {
  lift: 'squat',
  count: countRes.count,
  reps: countRes.reps,
  angles: countRes.angles.map(a => Math.round(a * 10) / 10),
  smoothedAngles: countRes.smoothedAngles.map(a => Math.round(a * 10) / 10),
  timestamps: json.timestamps.map(t => Math.round(t * 1000) / 1000),
  imageLandmarks: compactImageLandmarks,
  metadata: {
    width: 360,
    height: 640,
    duration: json.metadata.duration,
  },
  saved: countRes.count,
  biomechanicsFr: bioFr,
  biomechanicsEn: bioEn,
};

fs.writeFileSync(outputPath, JSON.stringify(demoTelemetry));
console.log(`Generated ${outputPath} (${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB)`);
