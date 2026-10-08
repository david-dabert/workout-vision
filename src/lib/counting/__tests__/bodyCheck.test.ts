// The body check (bodyCheck.js) and its second candidate (sgc.js specGuidedCount), wired by coreAnalysis.js
// withBodyCheck: the profiles file is the generator's output; generated curls pin the mechanics (a joint that follows
// the body is not flagged, one read at twice the body's rhythm is); David's real sets pin what the calibration found
// (test/real-phone/accuracy/body-check.txt); and the check never changes a count, a refusal or a proposal.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { AGREE_MIN, bodyCheck, signalProfile, flatImage } from '../bodyCheck.js';
import { specGuidedCount, swapName } from '../sgc.js';
import { BODY_CHECK_MAX_SAMPLES, PROPOSAL_MAX_SAMPLES, summarizeCount, withBodyCheck, withProposal } from '../../coreAnalysis';
import { liftDefinition } from '../core';
import { makeSpecProfiles, OUT } from '../../../../scripts/make-spec-profiles.mjs';
import { sgcCount } from '../../../../test/real-phone/template/sgc.js';
import patterns from '../guide-patterns.json';
import families from '../guide-families.json';

const ROOT = resolve(__dirname, '../../../../test/real-phone');
const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(resolve(ROOT, f))).toString());
const spec = (key: string) => JSON.parse(readFileSync(resolve(ROOT, 'synth/motions', `${key}.json`), 'utf8'));

// A standing body (world landmarks, hips at the origin, y down) curling both arms `reps` times, 2 s each, between 1 s
// rests. misread: the elbow landmarks placed so the elbow's angle runs at twice the body's rhythm while the wrists,
// shoulders and hips keep the curl, as a pose model that misplaces the elbow would read it.
function curls(reps: number, { misread = false } = {}) {
  const fs = 15, period = 2, rest = 1, total = rest + reps * period + rest;
  const wl: any[] = [], ts: number[] = [];
  const p = (x: number, y: number, z = 0) => ({ x, y, z, visibility: 0.99 });
  for (let k = 0; k / fs <= total; k++) {
    const t = k / fs, active = t > rest && t < total - rest, ph = active ? ((t - rest) / period) * 2 * Math.PI : 0;
    const bend = (x: number) => (active ? (1 - Math.cos(x)) / 2 : 0);
    const f = Array.from({ length: 33 }, () => p(0, 0));
    f[0] = p(0, -0.6); f[11] = p(0.18, -0.5); f[12] = p(-0.18, -0.5); f[23] = p(0.1, 0); f[24] = p(-0.1, 0);
    f[25] = p(0.1, 0.45); f[26] = p(-0.1, 0.45); f[27] = p(0.1, 0.9); f[28] = p(-0.1, 0.9); f[31] = p(0.1, 0.95, -0.1); f[32] = p(-0.1, 0.95, -0.1);
    const b = bend(ph);
    for (const [sh, el, wr, sx] of [[11, 13, 15, 0.2], [12, 14, 16, -0.2]] as const) {
      f[el] = p(sx, -0.2);
      f[wr] = p(sx, -0.2 + Math.cos(b * 2.4) * 0.25, -Math.sin(b * 2.4) * 0.25);
      if (misread) {
        // The elbow on the perpendicular bisector of shoulder-wrist, at the distance that gives the misread angle.
        const th = ((170 - 120 * bend(2 * ph)) * Math.PI) / 180, S = f[sh], W = f[wr];
        const M = { x: (S.x + W.x) / 2, y: (S.y + W.y) / 2, z: (S.z + W.z) / 2 }, d = Math.hypot(W.x - S.x, W.y - S.y, W.z - S.z) / 2;
        const u = { y: (W.y - S.y) / (2 * d), z: (W.z - S.z) / (2 * d) }, h = d / Math.tan(th / 2);
        f[el] = p(M.x, M.y - u.z * h, M.z + u.y * h);
      }
    }
    wl.push(f); ts.push(t);
  }
  return { wl, ts };
}
const counted = (set: { wl: any[]; ts: number[] }, lift: string) => ({ ...summarizeCount(set.wl, set.ts, lift), exercise: lift, worldLandmarks: set.wl, timestamps: set.ts, imageLandmarks: null });

describe('spec profiles (spec-profiles.json)', () => {
  it('is the generator’s output (node scripts/make-spec-profiles.mjs)', () => {
    expect(readFileSync(OUT, 'utf8')).toBe(makeSpecProfiles());
  });
  it('holds every counted catalogue exercise whose spec has reps on one or both sides together, and only those', () => {
    const want = Object.keys(patterns).filter(k => { const s = spec(k); return !s.noReps && s.alternate !== true; }).sort();
    const have = Object.keys(JSON.parse(readFileSync(OUT, 'utf8')).profiles).sort();
    expect(have).toEqual(want);
    for (const k of have) {
      expect(liftDefinition(k)).not.toBeNull();
      const p = signalProfile(k)!;
      expect(p.first).toBe((families as any)[k].first);
      expect(p.signals.length).toBeGreaterThan(0);
      for (const s of p.signals as any[]) expect([1, -1]).toContain(s.delta);
      const st = (p.signals as any[]).map(s => s.strength);
      expect(st).toEqual([...st].sort((a, b) => b - a));
    }
  });
  it('reads a curl as the elbows bending, the wrists rising', () => {
    const p = signalProfile('bicep_curl')!;
    expect(p.mode).toBe('both');
    expect((p.signals as any[]).slice(0, 4).map(s => `${s.delta > 0 ? '+' : '-'}${s.name}`)).toEqual(['-elbowL', '-elbowR', '-wristYL', '-wristYR']);
    expect(signalProfile('no_such_exercise')).toBeNull();
    expect(signalProfile('plank')).toBeNull(); // no reps
    expect(signalProfile('lunge')).toBeNull(); // counted, but no motion spec of its own
  });
  it('mirrors a one-limb profile’s names for the right side', () => {
    expect(signalProfile('concentration_curl')!.mode).toBe('side');
    expect(swapName('elbowL')).toBe('elbowR');
    expect(swapName('wristShoulderR')).toBe('wristShoulderL');
    expect(swapName('trunk')).toBe('trunk');
  });
});

describe('bodyCheck', () => {
  it('passes eight curls whose elbows follow the body', () => {
    const set = curls(8), r = counted(set, 'bicep_curl');
    expect(r.count).toBe(8);
    const bc = bodyCheck(r, 'bicep_curl')!;
    expect(bc.agreement).toBeGreaterThan(0.9);
    expect(bc.flagged).toBe(false);
    expect(bc.signals.map(s => s.name)).not.toContain('w.elbowL');
    expect(bc.signals.every(s => !/^.\.elbow[LR]$/.test(s.name))).toBe(true);
  });
  it('flags eight curls whose elbow is read at twice their rhythm, and offers the body’s count', () => {
    const set = curls(8, { misread: true }), r = counted(set, 'bicep_curl');
    expect(r.refused).toBe(false);
    expect(r.count).toBeGreaterThanOrEqual(14);
    const bc = bodyCheck(r, 'bicep_curl')!;
    expect(bc.agreement).toBeLessThan(AGREE_MIN);
    expect(bc.flagged).toBe(true);
    const out: any = withBodyCheck(r, 'bicep_curl');
    expect(out.bodyCheck.flagged).toBe(true);
    expect(out.bodyCheck.second.count).not.toBe(r.count);
  });
  it('returns null where it cannot check', () => {
    const set = curls(8);
    expect(bodyCheck({ ...counted(set, 'bicep_curl'), refused: true }, 'bicep_curl')).toBeNull();
    expect(bodyCheck(counted(set, 'lunge'), 'lunge')).toBeNull(); // no profile
    expect(bodyCheck(counted(set, 'bicep_curl'), 'no_such_exercise')).toBeNull();
    // An alternating lift counted on both sides: its angle is one side's, its count both sides'.
    expect(liftDefinition('lateral_lunge')!.bothSides).toBe(true);
    expect(signalProfile('lateral_lunge')).not.toBeNull();
    expect(bodyCheck(counted(set, 'lateral_lunge'), 'lateral_lunge')).toBeNull();
    // Too little seen: under two seconds.
    const short = { wl: set.wl.slice(0, 25), ts: set.ts.slice(0, 25) };
    expect(bodyCheck({ ...counted(short, 'bicep_curl'), refused: false }, 'bicep_curl')).toBeNull();
  });
  it('flattens image landmarks as PSC reads them', () => {
    const wl = [[{ x: 0, y: 0, z: 0 }], [{ x: 0, y: 0, z: 0 }]];
    const flat = (set: any) => flatImage(set);
    expect(flat({ worldLandmarks: wl, imageLandmarks: [[{ x: 0.25, y: 0.5 }], null] })).toEqual([[0.25, 0.5], null]);
    expect(flat({ worldLandmarks: wl, imageXY: [[1, 2], [3, 4]] })).toEqual([[1, 2], [3, 4]]);
    expect(flat({ worldLandmarks: wl, imageLandmarks: [null, null] })).toBeNull();
  });
});

describe('withBodyCheck', () => {
  it('adds its field and changes nothing else', () => {
    for (const misread of [false, true]) {
      const r = counted(curls(8, { misread }), 'bicep_curl');
      const out: any = withBodyCheck(r, 'bicep_curl');
      expect(Object.keys(out).sort()).toEqual([...Object.keys(r), 'bodyCheck'].sort());
      for (const k of Object.keys(r)) expect(out[k]).toBe((r as any)[k]);
      expect(out.bodyCheck.ms).toBeGreaterThanOrEqual(0);
      expect(out.bodyCheck.second === null).toBe(!misread);
    }
  });
  it('leaves a refused set, its proposal and a fitness test as they came', () => {
    const r = { ...counted(curls(8), 'bicep_curl'), refused: true, proposal: { count: 8 } };
    expect(withBodyCheck(r, 'bicep_curl')).toBe(r);
    const t = counted(curls(8), 'arm_curl_test');
    expect(withBodyCheck(t, 'arm_curl_test')).toBe(t);
  });
  it('leaves a set counted none in, and a set longer than PSC’s bound, as they came', () => {
    const none = { ...counted(curls(8), 'bicep_curl'), count: 0, reps: [] };
    expect(withBodyCheck(none, 'bicep_curl')).toBe(none);
    expect(BODY_CHECK_MAX_SAMPLES).toBe(PROPOSAL_MAX_SAMPLES);
    const set = curls(8), n = BODY_CHECK_MAX_SAMPLES + 1;
    const long = { ...counted(set, 'bicep_curl'), timestamps: Array.from({ length: n }, (_, k) => k / 15) };
    expect(withBodyCheck(long, 'bicep_curl')).toBe(long);
  });
  it('gives no check, never an error, when the check cannot run', () => {
    const r: any = { ...counted(curls(8), 'bicep_curl'), worldLandmarks: null };
    const out: any = withBodyCheck(r, 'bicep_curl');
    expect(out.bodyCheck).toBeNull();
    expect(out.count).toBe(r.count);
  });
});

// David's sets (R1: his labels, read only), as the calibration of 8 October found them (body-check.txt).
describe('on David’s real sets', () => {
  const video = (f: string) => { const d = gz(`sets-07oct-video/${f}`); return { d, r: withBodyCheck(withProposal({ ...summarizeCount(d.worldLandmarks, d.timestamps, d.lift), exercise: d.lift, worldLandmarks: d.worldLandmarks, timestamps: d.timestamps, imageLandmarks: d.imageLandmarks }, d.lift), d.lift) as any }; };
  it('turns the pendulum squat’s silent 14 into a choice between 14 and 7 (labelled 7)', () => {
    const { d, r } = video('pendulum_squat_7.json.gz');
    expect([d.lift, d.count, r.count]).toEqual(['hack_squat', 7, 14]);
    expect(r.bodyCheck.flagged).toBe(true);
    expect(r.bodyCheck.agreement).toBeLessThan(0.2);
    expect(r.bodyCheck.second.count).toBe(7);
  });
  it('flags the barbell squats exact by luck, with nothing else to offer', () => {
    for (const f of ['barbell_squat_9_a.json.gz', 'barbell_squat_9_b.json.gz']) {
      const { r } = video(f);
      expect(r.count).toBe(9);
      expect(r.bodyCheck.flagged).toBe(true);
      expect(r.bodyCheck.second.count).toBe(9); // the same number: the screen offers one count to confirm
    }
  });
  it('passes the clean curl', () => {
    const { r } = video('seated_dumbbell_curl_10.json.gz');
    expect(r.count).toBe(10);
    expect(r.bodyCheck.flagged).toBe(false);
    expect(r.bodyCheck.second).toBeNull();
  });
  it('gives the bench’s spec-guided count on every video (sgc.js sgcCount, physical, the core’s rep logic)', () => {
    for (const f of readdirSync(resolve(ROOT, 'sets-07oct-video')).filter(f => f.endsWith('.json.gz'))) {
      const d = gz(`sets-07oct-video/${f}`), p = signalProfile(d.lift);
      if (!p) continue;
      const image = flatImage(d);
      const mine = specGuidedCount({ wl: d.worldLandmarks, ts: d.timestamps, image }, p, summarizeCount);
      const bench: any = sgcCount({ wl: d.worldLandmarks, ts: d.timestamps, image }, spec(d.lift), { summarize: summarizeCount, first: p.first, physical: true });
      expect([f, mine?.count ?? null]).toEqual([f, bench.coreCount ?? null]);
    }
  }, 60_000);
});
