/**
 * The whole catalogue on synthetic sets (12 October 2026). patterns.test.ts checks one exercise per pattern on one clean
 * set; this runs every one of the 190 countable exercises (core.ts, liftDefinition: its LIFTS entry, its parent's in
 * COUNT_AS, else its guide pattern plus DETECTION) under the conditions a phone meets, and the 119 without a joint
 * under the rule that they never get a count.
 *
 * Positive sets (ten reps each; the count must be 10):
 *   clean    30 samples a second, a 70-degree rep, 1.2 s out, 0.8 s back, 0.8 s at rest.
 *   video    15 samples a second (the rate of a whole video read frame by frame), Gaussian noise of 2 degrees.
 *   paused   a 1.0 s hold at the working end and 1.5 s at rest (a physio's tempo).
 *   depth    each rep's depth drawn between 55 and 85 degrees (a tiring set), noise of 1.5 degrees.
 * Negative sets (the count must be 0):
 *   still    the body held at rest for 20 s, noise of 2 degrees.
 *   wobble   ten 6-degree wobbles about the rest angle: under every range floor in the core (10 degrees and up).
 *
 * The body is built as the side rules expect: one side moving (plain, eitherSide with the idle limb held still at
 * rest), both moving together (together), or the two alternating (bothSides). The prone Y raise is read as the arm's
 * lift (LiftDefinition.lift) and gets a body lying face down, with its own 16-degree lift.
 *
 * Angles, tempos and noise are illustrative (UNSOURCED): a synthetic set says the counting logic is coherent for every
 * exercise's definition, not that a phone reads that exercise right. No count shown to a user rests on it.
 */
import { describe, expect, it } from 'vitest';
import families from '../guide-families.json';
import { countReps, liftDefinition, type LiftDefinition, type WorldLandmarkFrame } from '../core';
import { gaussian, jointFrame, seeded, timestamps, type Segment, sample } from './synthetic';

type Family = { joint: LiftDefinition['joint'] | null; why: string };
const FAMILIES = families as Record<string, Family>;
const COUNTABLE = Object.keys(FAMILIES).filter(k => FAMILIES[k].joint);
const NOT_COUNTABLE = Object.keys(FAMILIES).filter(k => !FAMILIES[k].joint);

const D = Math.PI / 180;

/** The rest angle and the direction a rep moves away from it, for a joint read as a three-point angle. */
function restOf(def: LiftDefinition): { rest: number; dir: 1 | -1 } {
  if (def.rest === 'high') return { rest: 170, dir: -1 };
  return { rest: def.joint === 'shoulder' ? 20 : 80, dir: 1 };
}

type Opts = { sps: number; reps?: number; depth: (r: number) => number; outSec?: number; backSec?: number; holdSec?: number; restSec?: number };

/** One side's angle path: rest, then each rep out to rest + dir * depth(r), an optional hold, and back. */
function path(rest: number, dir: 1 | -1, o: Opts): number[] {
  const segs: Segment[] = [{ hold: rest, sec: o.restSec ?? 0.8 }];
  for (let r = 0; r < (o.reps ?? 10); r++) {
    const work = rest + dir * o.depth(r);
    segs.push({ to: work, sec: o.outSec ?? 1.2 });
    if (o.holdSec) segs.push({ hold: work, sec: o.holdSec });
    segs.push({ to: rest, sec: o.backSec ?? 0.8 }, { hold: rest, sec: o.restSec ?? 0.8 });
  }
  return sample(segs, rest, o.sps);
}

/** A body lying face down along +x, both arms overhead in a Y at `lift` degrees above level (as lift.test.ts). */
function prone(lift: number): WorldLandmarkFrame {
  const pt = (x: number, y: number, z: number) => ({ x, y, z, visibility: 0.9 });
  const f = Array.from({ length: 33 }, () => pt(0, 0, 0));
  for (const [sh, el, wr, hip, side] of [[11, 13, 15, 23, 1], [12, 14, 16, 24, -1]] as const) {
    const s = pt(0.5, -0.05, side * 0.18);
    const dir = (len: number) => pt(s.x + len * Math.cos(lift * D) * Math.cos(45 * D), s.y - len * Math.sin(lift * D), s.z + side * len * Math.cos(lift * D) * Math.sin(45 * D));
    f[sh] = s; f[el] = dir(0.29); f[wr] = dir(0.55); f[hip] = pt(0, 0, side * 0.09);
  }
  return f;
}

/** The frames of a set for this exercise, the moving side(s) following `moving` and the angle noise added per side. */
function frames(def: LiftDefinition, moving: number[], noise: () => number, restAngle: number): WorldLandmarkFrame[] {
  if (def.lift) return moving.map(a => prone(a + noise()));
  if (def.bothSides) {
    // The two sides alternate: the left moves on even reps, the right on odd ones (the path is split rep by rep).
    return moving.map(a => jointFrame(def.joint, { left: a + noise(), right: restAngle + noise() }));
  }
  if (def.together) return moving.map(a => jointFrame(def.joint, { left: a + noise(), right: a + noise() }));
  // Plain: one side seen. eitherSide: the idle limb held at rest, seen as well as the working one.
  if (def.eitherSide) return moving.map(a => jointFrame(def.joint, { left: a + noise(), right: restAngle + noise() }));
  return moving.map(a => jointFrame(def.joint, { left: a + noise() }));
}

/** An alternating set (bothSides): ten reps, five per side, each side holding rest while the other moves. */
function alternating(def: LiftDefinition, rest: number, dir: 1 | -1, o: Opts, noise: () => number): WorldLandmarkFrame[] {
  const one = path(rest, dir, { ...o, reps: 1, restSec: 0.4 });
  const idle = new Array(one.length).fill(rest);
  const left: number[] = [], right: number[] = [];
  for (let r = 0; r < (o.reps ?? 10); r++) {
    const rep = path(rest, dir, { ...o, depth: () => o.depth(r), reps: 1, restSec: 0.4 });
    left.push(...(r % 2 ? idle : rep));
    right.push(...(r % 2 ? rep : idle));
  }
  return left.map((l, i) => jointFrame(def.joint, { left: l + noise(), right: right[i] + noise() }));
}

type Scenario = { name: string; expect: number; build: (def: LiftDefinition, rng: () => number) => { wl: WorldLandmarkFrame[]; sps: number } };

function scenario(name: string, expected: number, o: Opts | null, noiseSd: number, special?: 'still' | 'wobble'): Scenario {
  return {
    name, expect: expected,
    build(def, rng) {
      const noise = () => (noiseSd ? gaussian(rng, noiseSd) : 0);
      // The prone Y raise: a lift from 3 degrees under level, read about 180 (liftAngleDeg returns 180 + the lift;
      // prone() takes the lift itself), so its rest is -3 and a rep rises 16 degrees.
      const { rest, dir } = def.lift ? { rest: -3, dir: 1 as const } : restOf(def);
      const scale = def.lift ? 16 / 70 : 1;
      const sps = o?.sps ?? 30;
      if (special === 'still') {
        const n = 20 * sps;
        return { wl: frames(def, new Array(n).fill(rest), noise, rest), sps };
      }
      if (special === 'wobble') {
        const wob = path(rest, dir, { sps, depth: () => 6 * (def.lift ? 0.5 : 1), outSec: 0.8, backSec: 0.8 });
        return { wl: frames(def, wob, noise, rest), sps };
      }
      const opts: Opts = { ...o!, depth: r => o!.depth(r) * scale };
      if (def.bothSides) return { wl: alternating(def, rest, dir, opts, noise), sps };
      return { wl: frames(def, path(rest, dir, opts), noise, rest), sps };
    },
  };
}

const depthRng = seeded(7);
const DEPTHS = Array.from({ length: 10 }, () => 55 + 30 * depthRng());

const SCENARIOS: Scenario[] = [
  scenario('clean', 10, { sps: 30, depth: () => 70 }, 0),
  scenario('video', 10, { sps: 15, depth: () => 70 }, 2),
  scenario('paused', 10, { sps: 30, depth: () => 70, holdSec: 1.0, restSec: 1.5 }, 1),
  scenario('depth', 10, { sps: 30, depth: r => DEPTHS[r] }, 1.5),
  scenario('still', 0, null, 2, 'still'),
  scenario('wobble', 0, null, 0.5, 'wobble'),
];

// Exercises whose definition the core is known not to count on a given synthetic condition, with the reason. Empty is
// the goal; an entry here is a documented limit, not a pass.
const KNOWN: Record<string, Record<string, string>> = {};

describe('the whole catalogue on synthetic sets', () => {
  it('holds 309 exercises: 190 countable, 119 without a joint', () => {
    expect(COUNTABLE).toHaveLength(190);
    expect(NOT_COUNTABLE).toHaveLength(119);
  });

  const failures: string[] = [];
  for (const key of COUNTABLE) {
    const def = liftDefinition(key)!;
    it(`${key}: a definition, and the right count on every condition`, () => {
      expect(def, key).not.toBeNull();
      const wrong: string[] = [];
      for (const [i, s] of SCENARIOS.entries()) {
        if (KNOWN[key]?.[s.name]) continue;
        const { wl, sps } = s.build(def, seeded(1000 + i));
        const r = countReps(wl, timestamps(wl.length, sps), key);
        if (r.count !== s.expect) wrong.push(`${s.name}: ${r.count} for ${s.expect}`);
      }
      if (wrong.length) failures.push(`${key} (${[def.joint, def.rest, def.first, def.bothSides ? 'both' : def.eitherSide ? 'either' : def.together ? 'together' : '', def.lift ? 'lift' : ''].filter(Boolean).join('/')}): ${wrong.join('; ')}`);
      expect(wrong, key).toEqual([]);
    });
  }

  it('prints the benchmark summary', () => {
    // Printed only when something fails, so a green run stays quiet.
    if (failures.length) console.log(`Catalogue benchmark: ${failures.length} of ${COUNTABLE.length} exercises wrong on some condition\n${failures.join('\n')}`);
    expect(true).toBe(true);
  });

  // An exercise without a joint is never given a count, whatever the body does (patterns.test.ts checks three keys;
  // this checks all 119, on a clean curl that any countable elbow exercise would count 10).
  it('gives no count to any of the 119 exercises without a joint', () => {
    const a = path(170, -1, { sps: 30, depth: () => 90 });
    const wl = a.map(x => jointFrame('elbow', { left: x, right: x }));
    const ts = timestamps(wl.length, 30);
    for (const key of NOT_COUNTABLE) {
      expect(liftDefinition(key), key).toBeNull();
      expect(countReps(wl, ts, key).count, key).toBe(0);
    }
  });

  // Every reason is written for a user (shown on the guide): kinesiology, never a clinical word.
  it('explains each of the 119 in plain biomechanical words, with no clinical vocabulary', () => {
    const clinical = /\b(pain|injur\w*|rehab\w*|therap\w*|patholog\w*|impinge\w*|tendin\w*|tendon\w*|diagnos\w*|syndrome|disease|cure|treat\w*|patient)\b/i;
    for (const key of NOT_COUNTABLE) {
      const why = FAMILIES[key].why;
      expect(why.length, key).toBeGreaterThan(30);
      expect(why, key).not.toMatch(clinical);
    }
  });
});
