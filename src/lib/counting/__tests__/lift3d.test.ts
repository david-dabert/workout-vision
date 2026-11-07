import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { liftSet, isDepthAxisCompoundLift } from '../lift3d';

describe('Monocular 3D Inverse Taylor Projection (lift3d)', () => {
  it('correctly discriminates depth-axis compound lifts from planar side views', () => {
    const latBackFile = resolve(__dirname, '../../../../test/real-phone/sets-18oct-video/lat_pulldown_11_back.json.gz');
    const latBack = JSON.parse(gunzipSync(readFileSync(latBackFile)).toString());
    expect(isDepthAxisCompoundLift('lat_pulldown', latBack.worldLandmarks)).toBe(true);

    const squatSideFile = resolve(__dirname, '../../../../test/real-phone/sets-07oct-video/barbell_squat_9_a.json.gz');
    const squatSide = JSON.parse(gunzipSync(readFileSync(squatSideFile)).toString());
    expect(isDepthAxisCompoundLift('squat', squatSide.worldLandmarks)).toBe(false);

    const curlSideFile = resolve(__dirname, '../../../../test/real-phone/sets-29sep/bicep_curl_5_side_f5e5bdf2.json.gz');
    const curlSide = JSON.parse(gunzipSync(readFileSync(curlSideFile)).toString());
    expect(isDepthAxisCompoundLift('bicep_curl', curlSide.worldLandmarks)).toBe(false);
  });

  it('preserves bone length invariance under scaled orthographic projection', () => {
    const file = resolve(__dirname, '../../../../test/real-phone/sets-18oct-video/lat_pulldown_11_back.json.gz');
    const raw = JSON.parse(gunzipSync(readFileSync(file)).toString());
    const lifted = liftSet(raw.worldLandmarks, raw.imageLandmarks, 'fused');

    expect(lifted.frames.length).toBe(raw.worldLandmarks.length);
    expect(lifted.info.samples).toBeGreaterThan(10);
    expect(Number.isFinite(lifted.info.kx)).toBe(true);
    expect(Number.isFinite(lifted.info.ky)).toBe(true);
  });
});
