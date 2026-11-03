// Builds the landing lab's telemetry (public/demo/<id>-telemetry.json) from a stored landmark set.
//
//   npx tsx scripts/make-demo-telemetry.mjs
//
// The count is the app's own, through the path the result screen takes (coreAnalysis.js, summarizeCount), never
// the bare counter on another lift key: the lab once showed "0 / 7" on a set David counted 9, because it was built
// from a held set the app does not count exactly (test/real-phone/held-01oct/README.md). A clip is written only when
// the app's count equals the label stored with the set, so the first screen a visitor opens cannot show a count the
// app does not give (R8). Nothing here is fabricated: landmark visibilities are the model's own, rounded.
// Status: no counting code is touched (R2); the scoreboard is unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { summarizeCount } from '../src/lib/coreAnalysis.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// id: the file name under public/demo; input: the stored set; lift: the app's lift key for it.
const CLIPS = [
  { id: 'bicep-curl-5', input: 'test/real-phone/sets-29sep/bicep_curl_5_side_f5e5bdf2.json.gz', lift: 'bicep_curl', width: 540, height: 960 },
];

const r3 = v => Math.round(v * 1000) / 1000;
const r2 = v => Math.round(v * 100) / 100;

for (const clip of CLIPS) {
  const set = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, clip.input))).toString());
  const counted = summarizeCount(set.worldLandmarks, set.timestamps, clip.lift);
  if (counted.refused) throw new Error(`${clip.id}: the app refuses this set`);
  if (counted.count !== set.count) throw new Error(`${clip.id}: the app counts ${counted.count}, the label is ${set.count}; a lab clip must be one the app counts exactly`);

  const imageLandmarks = set.imageLandmarks.map(frame => (frame
    ? frame.map(pt => (pt ? { x: r3(pt.x), y: r3(pt.y), visibility: r2(pt.visibility ?? 0) } : { x: 0, y: 0, visibility: 0 }))
    : null));

  const telemetry = {
    lift: clip.lift,
    count: counted.count,
    label: set.count,
    arm: counted.arm ?? null,
    reps: counted.reps,
    angles: counted.angles.map(a => (a === null ? null : Math.round(a * 10) / 10)),
    smoothedAngles: counted.smoothedAngles.map(a => (a === null ? null : Math.round(a * 10) / 10)),
    timestamps: set.timestamps.map(r3),
    imageLandmarks,
    metadata: { width: clip.width, height: clip.height, extractedWidth: set.metadata.extractedWidth, extractedHeight: set.metadata.extractedHeight, duration: set.metadata.duration },
  };
  const out = path.join(root, `public/demo/${clip.id}-telemetry.json`);
  fs.writeFileSync(out, JSON.stringify(telemetry));
  console.log(`${clip.id}: app count ${counted.count} = label ${set.count}; ${telemetry.timestamps.length} frames; ${(fs.statSync(out).size / 1024).toFixed(0)} KB -> ${path.relative(root, out)}`);
}
