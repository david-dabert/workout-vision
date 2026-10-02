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

describe('Countix labels', () => {
  it('trims each clip to its labelled repetitions and maps its class to the lift the app counts', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const { countixManifest, parseCountix } = await import('../public/countix.mjs');
    const dir = mkdtempSync(join(tmpdir(), 'countix'));
    mkdirSync(join(dir, 'squat')); mkdirSync(join(dir, 'push up'));
    writeFileSync(join(dir, 'squat', 'abc_000017_000027.mp4'), '');
    const rows = parseCountix('video_id,class,kinetics_start,kinetics_end,repetition_start,repetition_end,count\nabc,squat,17,27,18.500000,26.000000,4\nxyz,push up,5,15,5.0,15.0,7\nqqq,slicing onion,0,10,0,10,5\n');
    const { sets, skipped } = countixManifest(rows, { videoDir: dir });
    expect(sets).toEqual([{ id: 'abc_000017_1500', group: 'abc', dataset: 'countix', video: join(dir, 'squat', 'abc_000017_000027.mp4'), lift: 'squat', count: 4, repFrames: [], trimSeconds: [1.5, 9] }]);
    expect(skipped).toEqual([
      { dataset: 'countix', id: 'xyz_000005_0', reason: 'its video is not in the Kinetics mirror' },
      { dataset: 'countix', id: 'qqq_000000_0', reason: 'slicing onion is not a lift the app counts' },
    ]);
  });
});

describe('Countix windows', () => {
  it('names apart two labelled windows of one clip', async () => {
    const { countixManifest, parseCountix } = await import('../public/countix.mjs');
    const rows = parseCountix('video_id,class,kinetics_start,kinetics_end,repetition_start,repetition_end,count\nabc,slicing onion,17,27,17.0,24.7,10\nabc,slicing onion,17,27,25.07,26.97,3\n');
    expect(countixManifest(rows, { videoDir: '/v' }).skipped.map(s => s.id)).toEqual(['abc_000017_0', 'abc_000017_8070']);
  });
});

describe('the cut of a set', () => {
  it('turns a label in seconds into frames at the video rate, and keeps a label in frames as it is', async () => {
    const { cutOf } = await import('../public/cut.mjs');
    expect(cutOf({ trimSeconds: [1.5, 9] }, 29.97)).toEqual({ from: 45, to: 270, exact: false });
    expect(cutOf({ trimFrames: [4040, 4500] }, 30)).toEqual({ from: 4040, to: 4500, exact: true });
    expect(cutOf({}, 30)).toBeNull();
  });
});

describe('videos the counter was built on', () => {
  it('go to the build half, whatever their hash', async () => {
    const { countixManifest, parseCountix } = await import('../public/countix.mjs');
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'countix'));
    mkdirSync(join(dir, 'squat'));
    // FyYRvnHdOgU hashes to the held-out half; it is one of the 43 clips of benchmark/manifest.json.
    writeFileSync(join(dir, 'squat', 'FyYRvnHdOgU_000003_000013.mp4'), '');
    expect(splitOf('FyYRvnHdOgU')).toBe('holdout');
    const rows = parseCountix('video_id,class,kinetics_start,kinetics_end,repetition_start,repetition_end,count\nFyYRvnHdOgU,squat,3,13,3.7,10.0,5\n');
    const { sets } = countixManifest(rows, { videoDir: dir, seen: new Set(['FyYRvnHdOgU']) });
    expect(sets[0].split).toBe('build');
  });
});

describe('Countix whole clips', () => {
  it('keeps the whole clip and stores the labelled window beside it', async () => {
    const { countixManifest, parseCountix } = await import('../public/countix.mjs');
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const dir = mkdtempSync(join(tmpdir(), 'countix'));
    mkdirSync(join(dir, 'squat'));
    writeFileSync(join(dir, 'squat', 'abc_000017_000027.mp4'), '');
    const rows = parseCountix('video_id,class,kinetics_start,kinetics_end,repetition_start,repetition_end,count\nabc,squat,17,27,18.5,26.0,4\n');
    const [set] = countixManifest(rows, { videoDir: dir, whole: true }).sets;
    expect(set).toMatchObject({ dataset: 'countix-whole', window: [1.5, 9], count: 4 });
    expect(set.trimSeconds).toBeUndefined();
  });
});

// A public set is written only when the whole video was read, as the app requires before it counts
// (coreAnalysis.js, unreadSamples): Astra's audit found the importer kept a whole-clip label on any read.
import { unreadPublic } from '../public/whole-read.mjs';
describe('a public video read in part is not written', () => {
  const ts = n => Array.from({ length: n }, (_, i) => i / 15);
  it('passes a whole read: floor(duration x 15) samples, each after the last', () => {
    expect(unreadPublic({ timestamps: ts(150), duration: 10.02, fps: 15 })).toBeNull();
  });
  it('names a read with samples missing, or too many', () => {
    expect(unreadPublic({ timestamps: ts(120), duration: 10.02, fps: 15 })).toBe('read 120 samples of the 150 the video holds');
    expect(unreadPublic({ timestamps: ts(180), duration: 10.02, fps: 15 })).toBe('read 180 samples of the 150 the video holds');
  });
  it('names a read whose length is unknown, or whose samples go back in time', () => {
    expect(unreadPublic({ timestamps: ts(10), duration: NaN, fps: 15 })).toBe('the video reports no length');
    expect(unreadPublic({ timestamps: [...ts(5), 0.1, ...ts(144).slice(6)], duration: 10.02, fps: 15 })).toBe('samples out of time order');
  });
});
