// The live counter (liveCounter.js) counts with the recorded path's own function: fed sample by sample, in chunks,
// with the screen's provisional counts worked out along the way, it ends on exactly the batch count, and each rep is
// announced once.
import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount, FrozenSkeletonsError } from '../coreAnalysis';
import { createLiveCounter, LIVE_MAX_SAMPLES, IN_VIEW_SAMPLES } from '../liveCounter';

const read = path => JSON.parse(gunzipSync(readFileSync(path)));
const REAL = resolve('test/real-phone/landmarks');
const SYNTH = resolve('test/real-phone/synth/sets');
// David's four real-phone sets whose landmarks are committed, and a spread of the 96 synthetic sets.
const real = readdirSync(REAL).filter(f => f.endsWith('.json.gz')).map(f => {
  const d = read(`${REAL}/${f}`);
  return { name: f, lift: d.exercise || f.replace(/_\d+_.*$/, ''), world: d.worldLandmarks, image: d.imageLandmarks, t: d.timestamps };
});
const synth = readdirSync(SYNTH).filter(f => f.endsWith('.json.gz')).filter((_, i) => i % 8 === 0).map(f => {
  const d = read(`${SYNTH}/${f}`);
  return { name: f, lift: d.params.exercise, world: d.worldLandmarks, image: null, t: d.timestamps };
});

function feed(set, chunk) {
  const live = createLiveCounter(set.lift);
  const announced = [];
  for (let i = 0; i < set.t.length; i += chunk) {
    for (let k = i; k < Math.min(set.t.length, i + chunk); k++) live.push({ image: set.image?.[k] ?? null, world: set.world[k], t: set.t[k], width: 360, height: 640 });
    const now = live.evaluate();
    if (now.announce !== null) announced.push(now.announce);
  }
  return { live, announced, last: live.evaluate() };
}

const drift = [];
describe('live counting', () => {
  afterAll(() => console.log(`provisional vs final (chunks of 7):\n${drift.join('\n')}`));
  it('has the sets to test on', () => {
    expect(real.length).toBeGreaterThanOrEqual(4);
    expect(synth.length).toBeGreaterThanOrEqual(10);
  });

  for (const set of [...real, ...synth]) {
    it(`${set.name}: fed in chunks, ends on the batch count`, () => {
      const batch = summarizeCount(set.world, set.t, set.lift);
      // 7 samples is about the 500 ms between two counts on screen; 1 and 23 are the extremes either side.
      for (const chunk of [1, 7, 23]) {
        const { live, announced, last } = feed(set, chunk);
        const result = live.finish();
        expect(result.count, `chunk ${chunk}`).toBe(batch.count);
        expect(result.refused).toBe(batch.refused);
        expect(result.reps).toEqual(batch.reps);
        expect(result.timestamps).toEqual(set.t);
        expect(result.worldLandmarks).toEqual(set.world);
        // Each number announced once, rising.
        expect(new Set(announced).size).toBe(announced.length);
        expect(announced).toEqual([...announced].sort((a, b) => a - b));
        // The last count shown is the final count when the set ends in view and is not refused.
        if (last.count !== null) expect(last.count).toBe(batch.count);
        // The provisional count is the core on part of a set, and the core's thresholds move as the set grows: on
        // David's overhead press (Experimental) it reached 10 before the whole set settled on 9. So a number announced
        // may exceed the final count; the result says so when they differ (Result.jsx, liveShown).
        if (chunk === 7) drift.push(`${set.name}: announced up to ${announced.at(-1) ?? '-'}, final ${batch.count}`);
      }
    });
  }

  it('the result has the recorded path\'s shape', () => {
    const set = real.find(s => s.name.startsWith('bicep_curl'));
    const { live } = feed(set, 7);
    const r = live.finish();
    for (const key of ['count', 'reps', 'arm', 'refused', 'angles', 'smoothedAngles', 'exercise', 'metadata', 'imageLandmarks', 'worldLandmarks', 'timestamps']) expect(r).toHaveProperty(key);
    expect(r.metadata).toMatchObject({ method: 'live', live: true, width: 360, height: 640, fps: 15 });
    expect(r.metadata.duration).toBeCloseTo(set.t.at(-1) - set.t[0] + 1 / 15, 6);
    expect(r.count).toBe(7);
  });

  it('shows no number while nobody is in view (R8)', () => {
    const set = real.find(s => s.name.startsWith('bicep_curl'));
    const live = createLiveCounter(set.lift);
    for (let k = 0; k < 150; k++) live.push({ world: set.world[k], image: set.image[k], t: set.t[k] });
    expect(live.evaluate().count).not.toBeNull();
    // The person walks out: a second of samples without a body.
    for (let k = 150; k < 150 + IN_VIEW_SAMPLES; k++) live.push({ world: null, image: null, t: set.t[k] });
    const now = live.evaluate();
    expect(now.inView).toBe(false);
    expect(now.count).toBeNull();
    expect(now.announce).toBeNull();
    // An empty counter shows nothing either.
    expect(createLiveCounter('bicep_curl').evaluate()).toMatchObject({ count: null, inView: false });
  });

  it('announces a count that drops back and rises again only once', () => {
    let n = 0;
    const visible = { angles: [1] };
    const live = createLiveCounter('bicep_curl', { summarize: () => ({ ...visible, count: n, refused: false }) });
    const said = [];
    for (const c of [0, 1, 2, 2, 1, 2, 3, 3]) {
      n = c;
      live.push({ world: [], t: live.length / 15 });
      const e = live.evaluate();
      if (e.announce !== null) said.push(e.announce);
    }
    expect(said).toEqual([1, 2, 3]);
  });

  it('stops taking samples at the cap and refuses samples out of time order', () => {
    const live = createLiveCounter('bicep_curl', { summarize: () => ({ count: 0, refused: false, angles: [] }) });
    for (let k = 0; k < LIVE_MAX_SAMPLES; k++) expect(live.push({ t: k / 15 })).toBe(true);
    expect(live.full).toBe(true);
    expect(live.push({ t: LIVE_MAX_SAMPLES / 15 })).toBe(false);
    const other = createLiveCounter('bicep_curl');
    other.push({ t: 1 });
    expect(() => other.push({ t: 1 })).toThrow();
  });

  it('a camera picture that stood still gives no count: the recorded path\'s frozen-read rule', () => {
    // David's real curl, its first 20 samples, then the camera hands on its last picture for 40 more: 40 of 59
    // samples repeat the one before, more than half (frozenRead.js).
    const set = real.find(s => s.name.startsWith('bicep_curl'));
    const frozen = createLiveCounter(set.lift);
    for (let k = 0; k < 60; k++) frozen.push({ world: set.world[Math.min(k, 19)], image: null, t: set.t[k] });
    expect(() => frozen.finish()).toThrow(FrozenSkeletonsError);
    try { frozen.finish(); } catch (e) { expect(e).toMatchObject({ samples: 60, repeats: 40, decoder: 'live' }); }
    // A camera at half the rate for the second half (15 of 59 repeated): counted as usual.
    const slowed = createLiveCounter(set.lift);
    for (let k = 0; k < 60; k++) slowed.push({ world: set.world[k < 30 ? k : k - (k % 2)], image: null, t: set.t[k] });
    expect(() => slowed.finish()).not.toThrow();
    // A set of nobody in view (all null) is never a repeat: the visibility refusal's business.
    const empty = createLiveCounter(set.lift);
    for (let k = 0; k < 60; k++) empty.push({ world: null, image: null, t: set.t[k] });
    expect(empty.finish().refused).toBe(true);
  });

  it('works out a ten-minute set fast enough to count twice a second', () => {
    // The longest set the live screen keeps, made of a real set repeated: the count on screen runs on all of it.
    const set = real.find(s => s.name.startsWith('bicep_curl'));
    const world = [], t = [];
    while (world.length < LIVE_MAX_SAMPLES) for (let k = 0; k < set.world.length && world.length < LIVE_MAX_SAMPLES; k++) { world.push(set.world[k]); t.push(world.length / 15); }
    const start = performance.now();
    summarizeCount(world, t, set.lift);
    const ms = performance.now() - start;
    console.log(`summarizeCount on ${world.length} samples: ${ms.toFixed(0)} ms`);
    // The live screen spaces its counts by at least ten times the time one takes (liveEngine.js), so a slow count
    // slows the screen's updates and never the sampling; this bounds the cost on this machine.
    expect(ms).toBeLessThan(1500);
  });
});

// The numbers the live screen displayed, for the result screen (nextShown, shownForResult; 9 October 2026).
import { nextShown, shownForResult } from '../liveCounter';
describe('the number the result compares with the final count', () => {
  const run = counts => counts.reduce(nextShown, null);
  it('keeps no 0 and no null: the screen never displayed them', () => {
    // soldier-lateral_raise-v90-a20, replayed: 0, 2, 1, 0, 5, 4, 0, 4, 0, final 4 (as built, "affichait 0").
    const rec = run([0, 2, 1, 0, 5, 4, 0, 4, 0]);
    expect(rec).toEqual({ last: 4, max: 5 });
    expect(run([0, null, 0])).toBe(null);
    expect(shownForResult(run([0, null]), 3)).toBe(null);
  });
  it('names the last number shown when it is not the final', () => {
    expect(shownForResult(run([1, 2, 3]), 4)).toBe(3);
    expect(shownForResult(run([3, 0]), 3)).toBe(3);
  });
  it('names a higher number shown, when the last equals the final but more was announced', () => {
    // The back extension of David's videos: 18 shown live, 17 final.
    expect(shownForResult(run([16, 17, 18, 17]), 17)).toBe(18);
    expect(shownForResult(run([0, 2, 1, 0, 5, 4, 0, 4, 0]), 4)).toBe(5);
  });
  it('equals the final when every number shown led up to it', () => {
    expect(shownForResult(run([1, 2, 3, 3]), 3)).toBe(3);
  });
});
