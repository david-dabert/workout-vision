// Public labelled datasets as build data (David, 30 September): every video split once, by its name, into a
// build half the scoreboard measures and a held-out half no tool opens until its one run; RepCount-A's
// human labels read as TransRAC's own loader reads them (name, count, type, L1..Ln frame pairs).
import { describe, expect, it } from 'vitest';
import { splitOf } from '../public/split.mjs';
import { parseRepCount, repCountManifest } from '../public/repcount.mjs';

describe('the split', () => {
  it('is fixed by the id alone and puts about half in each part', () => {
    expect(splitOf('train951.mp4')).toBe(splitOf('train951.mp4'));
    const ids = Array.from({ length: 1000 }, (_, i) => `video${i}.mp4`);
    const build = ids.filter(id => splitOf(id) === 'build').length;
    expect(build).toBeGreaterThan(450);
    expect(build).toBeLessThan(550);
    expect(new Set(ids.map(splitOf))).toEqual(new Set(['build', 'holdout']));
  });
});

describe('RepCount-A labels', () => {
  const csv = 'type,name,count,L1,L2,L3,L4,L5,L6\nsquat,train1.mp4,3,10,40,40,70,70,100\nbench_pressing,train2.mp4,2,5,30,31,60,,\nsitup,train3.mp4,1,0,20,,,,\nsquat,train4.mp4,,0,20,20,40,,\nsquat,train5.mp4,3,0,20,20,40,,\n';
  it('reads each video with its reps as frame pairs', () => {
    const rows = parseRepCount(csv);
    expect(rows[0]).toEqual({ name: 'train1.mp4', type: 'squat', count: 3, reps: [[10, 40], [40, 70], [70, 100]] });
    expect(rows[1].reps).toEqual([[5, 30], [31, 60]]);
  });
  it('keeps a video only for a lift the app counts, with a count that agrees with its rep marks', () => {
    const { sets, skipped } = repCountManifest(parseRepCount(csv), { videoDir: '/data/videos' });
    expect(sets.map(s => [s.id, s.lift, s.count])).toEqual([['train1', 'squat', 3], ['train2', 'bench_press', 2]]);
    expect(sets[0]).toMatchObject({ video: '/data/videos/train1.mp4', repFrames: [[10, 40], [40, 70], [70, 100]], dataset: 'repcount' });
    expect(skipped).toEqual([
      'train3.mp4: situp is not a lift the app counts',
      'train4.mp4: no count',
      'train5.mp4: count 3 but 2 marked reps',
    ]);
  });
});

describe('MM-Fit labels', () => {
  it('reads each set with its frames and maps its activity to the lift the app counts', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const { mmfitManifest } = await import('../public/mmfit.mjs');
    const root = mkdtempSync(join(tmpdir(), 'mmfit'));
    mkdirSync(join(root, 'labels', 'mm-fit', 'w00'), { recursive: true });
    writeFileSync(join(root, 'labels', 'mm-fit', 'w00', 'w00_labels.csv'), '100,400,10,squats\n500,800,12,situps\n900,1200,8,pushups\n');
    writeFileSync(join(root, 'w00_rgb.mp4'), '');
    const { sets, skipped } = mmfitManifest(root);
    expect(sets.map(s => [s.id, s.lift, s.count, s.trimFrames])).toEqual([['w00-squats-100-400', 'squat', 10, [100, 400]], ['w00-pushups-900-1200', 'push_up', 8, [900, 1200]]]);
    expect(skipped).toEqual(['w00-situps-500-800: situps is not a lift the app counts']);
  });
});

describe('a video is split whole', () => {
  it('puts every set of one MM-Fit workout video in the same half', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const { mmfitManifest } = await import('../public/mmfit.mjs');
    const root = mkdtempSync(join(tmpdir(), 'mmfit'));
    mkdirSync(join(root, 'labels', 'mm-fit', 'w00'), { recursive: true });
    writeFileSync(join(root, 'labels', 'mm-fit', 'w00', 'w00_labels.csv'), '4040,4500,10,squats\n8770,9197,10,pushups\n13620,14000,10,pushups\n');
    writeFileSync(join(root, 'w00_rgb.mp4'), '');
    const { sets } = mmfitManifest(root);
    expect(sets.every(s => s.group === 'w00')).toBe(true);
    expect(new Set(sets.map(s => splitOf(s.group))).size).toBe(1);
  });
  it('splits a RepCount video by its own name', () => {
    const { sets } = repCountManifest(parseRepCount('type,name,count,L1,L2\nsquat,train9.mp4,1,0,20\n'), { videoDir: '/v' });
    expect(sets[0].group).toBe('train9');
  });
});
