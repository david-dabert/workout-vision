// The learned phase counter's JS inference (data.js features, model.js forward) against train.py on the same input:
// fixture.json holds 40 frames of one synthetic set's joints (a joint unseen for 4 frames, 2 frames missing), the
// features and the model outputs train.py computed for them with models/model-all.json. fixture-progress.json does the
// same for a progress-input model (train.py --progress, held in the fixture itself): the set's progress too (absent on
// the 2 missing frames, 2 frames beyond the clip). Runs in the normal suite.
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { alignProgress, features, progressOnGrid, resampleJoints, F } from './data.js';
import { forward, learnedCount, loadModel, readouts } from './model.js';
import { specFor } from './spec-of';

const fx = JSON.parse(readFileSync(resolve(__dirname, 'fixture.json'), 'utf8'));
const model = loadModel(JSON.parse(readFileSync(resolve(__dirname, 'models/model-all.json'), 'utf8')));
const fxp = JSON.parse(readFileSync(resolve(__dirname, 'fixture-progress.json'), 'utf8'));
const pmodel = loadModel(fxp.model);
const worstDiff = (a: ArrayLike<number>, b: number[]) => { let w = 0; for (let i = 0; i < a.length; i++) w = Math.max(w, Math.abs(a[i] - b[i])); return w; };

test('features match train.py', () => {
  const X = features(Float32Array.from(fx.joints), fx.T);
  expect(X.length).toBe(fx.T * F);
  expect(worstDiff(X, fx.features)).toBeLessThan(1e-3);
});

test('forward pass matches train.py', () => {
  const X = Float32Array.from(fx.features);
  const o = forward(model, X, fx.T);
  expect(worstDiff(o, fx.outputs)).toBeLessThan(1e-3);
  const r = readouts(o, fx.T);
  expect(Number.isFinite(r.densityRaw)).toBe(true);
});

test('model stays phone-sized', () => {
  expect(model.bytes).toBeLessThan(300 * 1024);
});

test('a model without the progress input reads the pose only', () => {
  expect(model.input).toBe('pose');
  expect(model.F).toBe(F);
});

test('progress features match train.py', () => {
  expect(pmodel.input).toBe('progress');
  expect(pmodel.F).toBe(F + 2);
  const P = Float32Array.from(fxp.progress.map((v: number | null) => (v === null ? NaN : v)));
  const X = features(Float32Array.from(fxp.joints), fxp.T, P);
  expect(X.length).toBe(fxp.T * (F + 2));
  expect(worstDiff(X, fxp.features)).toBeLessThan(1e-3);
  // the pose channels are the pose-only features, unchanged
  const X0 = features(Float32Array.from(fxp.joints), fxp.T);
  for (let k = 0; k < fxp.T; k++) for (let c = 0; c < F; c++) expect(X[k * (F + 2) + c]).toBe(X0[k * F + c]);
  // absent: 0 and mask 0; beyond the clip: +-2
  expect([X[20 * (F + 2) + F], X[20 * (F + 2) + F + 1]]).toEqual([0, 0]);
  expect([X[30 * (F + 2) + F], X[31 * (F + 2) + F]]).toEqual([2, -2]);
});

test('progress forward pass matches train.py', () => {
  const o = forward(pmodel, Float32Array.from(fxp.features), fxp.T);
  expect(worstDiff(o, fxp.outputs)).toBeLessThan(1e-3);
});

test('progress lies on the joints grid', () => {
  const prog = { t0: 10, p: Float64Array.from([0, 1, 2, NaN, 4]) };
  expect(Array.from(alignProgress(prog, 10, 6))).toEqual([0, 1, 2, NaN, 4, NaN]);
  // a grid starting half a step later reads between two finite neighbours, none next to a gap
  const half = Array.from(alignProgress(prog, 10 + 0.5 / 15, 4));
  expect(half[0]).toBeCloseTo(0.5, 5);
  expect(half[1]).toBeCloseTo(1.5, 5);
  expect(half.slice(2)).toEqual([NaN, NaN]);
  expect(Array.from(alignProgress(null, 0, 2))).toEqual([NaN, NaN]);
  // the same grid from a large first timestamp (epoch seconds) is still a copy, frame for frame
  const big = 1.7e9, q = Float64Array.from({ length: 900 }, (_, k) => (k % 50 === 25 ? NaN : Math.sin(k / 7)));
  expect(Array.from(alignProgress({ t0: big, p: q }, big, 900))).toEqual(Array.from(Float32Array.from(q)));
});

test('learnedCount reads the spec\'s progress for a progress model only', () => {
  const r = JSON.parse(gunzipSync(readFileSync(resolve(__dirname, '..', fxp.name.replace(/^synthetic\//, 'synth/sets/')))).toString());
  const spec = specFor(r.params.exercise);
  expect(spec).not.toBeNull();
  const g = resampleJoints(r.worldLandmarks, r.timestamps);
  const P = progressOnGrid({ wl: r.worldLandmarks, ts: r.timestamps }, spec, g.t0, g.T);
  expect(P.length).toBe(g.T);
  const withSpec = learnedCount(pmodel, r.worldLandmarks, r.timestamps, { spec });
  const without = learnedCount(pmodel, r.worldLandmarks, r.timestamps, {});
  expect(withSpec!.progressSeen).toBeCloseTo(P.filter(Number.isFinite).length / g.T, 9);
  expect(withSpec!.progressSeen).toBeGreaterThan(0.9);
  expect(without!.progressSeen).toBe(0);
  expect(learnedCount(model, r.worldLandmarks, r.timestamps, { spec })).toEqual(learnedCount(model, r.worldLandmarks, r.timestamps));
});
