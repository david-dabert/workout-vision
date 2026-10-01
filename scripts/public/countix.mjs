/**
 * Countix (Dwibedi et al., RepNet, CVPR 2020; labels at
 * https://s3.amazonaws.com/kinetics/700_2020/annotations/countix.tar.gz, whose README states no licence;
 * the Kinetics annotations are CC BY 4.0, and the videos belong to their YouTube authors): Kinetics clips
 * with the number of repetitions counted by people between a start and an end time. The videos are the
 * Kinetics-700-2020 clips mirrored by the CVDF on S3 (https://github.com/cvdfoundation/kinetics-dataset),
 * one tar per class, a clip named <youtube id>_<start>_<end>.mp4 in seconds. CLAUDE.md R1 names Countix
 * as a source of labels. Each clip is trimmed to its labelled repetitions (countix), or kept whole with its
 * window beside it (countix-whole); it marks no single rep. Only
 * derived landmarks enter the repository, never a video or a frame.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Countix's Kinetics classes, to the app's lift keys; "exercising arm" names no one movement and is left out.
export const COUNTIX_LIFTS = {
  'front raises': 'front_raise', 'rope pushdown': 'triceps_pushdown', lunge: 'lunge', 'push up': 'push_up',
  'pull ups': 'pull_up', squat: 'squat', 'bench pressing': 'bench_press',
};

export function parseCountix(text) {
  const [head, ...lines] = text.trim().split(/\r?\n/);
  const cols = head.split(',');
  return lines.map(line => Object.fromEntries(line.split(',').map((v, i) => [cols[i], v])));
}

// `seen`: the YouTube ids of the 43 Countix clips the counter was already built and gated on
// (benchmark/manifest.json, DIRECTIVES 1.3 and 1.4). Their sets go to the build half, whatever their
// hash, so the held-out half holds no video the counter has seen.
// `whole`: the whole Kinetics clip is kept, with the labelled window stored beside it, so the counter sees
// the video before and after the reps, as it sees a set filmed from rest to rest; only the reps inside the
// window are then scored (test/real-phone/accuracy/sets.ts, countInWindow). The dataset is countix-whole.
export function countixManifest(rows, { videoDir, seen = new Set(), whole = false }) {
  const sets = [], skipped = [];
  for (const r of rows) {
    // A clip may carry two labelled windows: the id names the clip and where its window starts, in ms.
    const k0 = Number(r.kinetics_start), k1 = Number(r.kinetics_end);
    const id = `${r.video_id}_${String(k0).padStart(6, '0')}_${Math.round((Number(r.repetition_start) - k0) * 1000)}`;
    const lift = COUNTIX_LIFTS[r.class];
    if (!lift) { skipped.push({ dataset: 'countix', id, reason: `${r.class} is not a lift the app counts` }); continue; }
    const count = Number(r.count), a = Number(r.repetition_start) - k0, b = Number(r.repetition_end) - k0;
    if (!Number.isInteger(count) || count < 1 || !(b > a) || a < 0) { skipped.push({ dataset: 'countix', id, reason: 'label not readable' }); continue; }
    const video = join(videoDir, r.class, `${r.video_id}_${String(k0).padStart(6, '0')}_${String(k1).padStart(6, '0')}.mp4`);
    if (!existsSync(video)) { skipped.push({ dataset: 'countix', id, reason: 'its video is not in the Kinetics mirror' }); continue; }
    const window = [Math.round(a * 1e3) / 1e3, Math.round(b * 1e3) / 1e3];
    sets.push({ id, group: r.video_id, ...(seen.has(r.video_id) ? { split: 'build' } : {}), dataset: whole ? 'countix-whole' : 'countix', video, lift, count, repFrames: [], ...(whole ? { window } : { trimSeconds: window }) });
  }
  return { sets, skipped };
}
