#!/usr/bin/env node
// CFRep into the public scoreboard (David, 4 October 2026: he takes responsibility for the data used; the repository
// https://github.com/lc-leonardo/CFRep has no licence file and asks to be cited: Alves, Li, Xu, "RepVal", ACM/IEEE
// SEC 2025). 8 people, one camera (front, diagonal, side), every attempt marked by a certified CrossFit judge.
//
//   node scripts/public/cfrep.mjs <video_config.json> <landmarks dir from test/real-phone/pose-bench/run.mjs, full model>
//
// Writes test/real-phone/public/cfrep/{build,holdout}/<id>.json.gz in run-public.mjs's format and cfrep/sets.json.
// The label is every attempt the judge marked, valid or not (the app counts movements); the judge's verdicts are kept
// beside it (judged). Halves by person, as split.mjs does by video: the group is the person, so no one is in both.
// Squat and deadlift only: the app offers no double-under.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitOf } from './split.mjs';
import { admitted } from './admission.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [cfgPath, lmDir] = process.argv.slice(2);
if (!cfgPath || !lmDir) throw new Error('usage: cfrep.mjs <video_config.json> <landmarks dir>');
const OUT = join(ROOT, 'test/real-phone/public/cfrep');
const LIFT = { squat: 'squat', deadlift: 'deadlift' };
const FPS = 30; // CFRep's videos: 30 frames a second (their mp4 headers)
const round = v => Math.round(v * 1e4) / 1e4;
const visible = p => p && p.visibility >= 0.5;

const record = {};
for (const v of JSON.parse(readFileSync(cfgPath, 'utf8'))) {
  const lift = LIFT[v.exercise];
  if (!lift) continue;
  const id = v.filename.replace(/\.mp4$/, '');
  const person = id.split('_')[2];
  const split = splitOf(`cfrep-${person}`);
  let d;
  try { d = JSON.parse(gunzipSync(readFileSync(join(lmDir, `${id}.json.gz`))).toString()); }
  catch { record[id] = { split, status: 'failed', reason: 'no landmarks from the pose bench' }; continue; }
  const samples = d.imageLandmarks.length;
  const seen = d.imageLandmarks.filter(lm => lm && [15, 16, 27, 28].every(i => visible(lm[i]))).length;
  const out = {
    dataset: 'cfrep', id, split, lift, count: v.segments.length,
    judged: { valid: [...v.binary_label].filter(c => c === '1').length, label: v.binary_label },
    reps: v.segments.map(s => [round(s.start / FPS), round(s.end / FPS)]),
    fps: FPS, samples, visibleShare: samples ? round(seen / samples) : 0,
    admitted: admitted('cfrep', samples ? seen / samples : 0),
    worldLandmarks: d.worldLandmarks.map(f => f && f.map(p => ({ x: round(p.x), y: round(p.y), z: round(p.z), visibility: round(p.visibility) }))),
    timestamps: d.timestamps.map(round),
  };
  const dest = join(OUT, split, `${id}.json.gz`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, gzipSync(JSON.stringify(out)));
  record[id] = { split, status: 'written' };
}
writeFileSync(join(OUT, 'sets.json'), JSON.stringify(record, null, 1) + '\n');
const n = s => Object.values(record).filter(r => r.split === s && r.status === 'written').length;
console.log(`cfrep: ${n('build')} build, ${n('holdout')} held out, ${Object.values(record).filter(r => r.status !== 'written').length} failed`);
