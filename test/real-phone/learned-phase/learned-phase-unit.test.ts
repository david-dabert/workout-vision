// The learned phase counter's JS inference (data.js features, model.js forward) against train.py on the same input:
// fixture.json holds 40 frames of one synthetic set's joints (a joint unseen for 4 frames, 2 frames missing), the
// features and the model outputs train.py computed for them with models/model-all.json. Runs in the normal suite.
import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { features, F } from './data.js';
import { forward, loadModel, readouts } from './model.js';

const fx = JSON.parse(readFileSync(resolve(__dirname, 'fixture.json'), 'utf8'));
const model = loadModel(JSON.parse(readFileSync(resolve(__dirname, 'models/model-all.json'), 'utf8')));

test('features match train.py', () => {
  const X = features(Float32Array.from(fx.joints), fx.T);
  expect(X.length).toBe(fx.T * F);
  let worst = 0;
  for (let i = 0; i < X.length; i++) worst = Math.max(worst, Math.abs(X[i] - fx.features[i]));
  expect(worst).toBeLessThan(1e-3);
});

test('forward pass matches train.py', () => {
  const X = Float32Array.from(fx.features);
  const o = forward(model, X, fx.T);
  let worst = 0;
  for (let i = 0; i < o.length; i++) worst = Math.max(worst, Math.abs(o[i] - fx.outputs[i]));
  expect(worst).toBeLessThan(1e-3);
  const r = readouts(o, fx.T);
  expect(Number.isFinite(r.densityRaw)).toBe(true);
});

test('model stays phone-sized', () => {
  expect(model.bytes).toBeLessThan(300 * 1024);
});
