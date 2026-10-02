// A contribution (contribute.js): the app's count beside the count kept, the pose and the decoder, the phone's
// kind and nothing that names the person; the file gathering them reads back whole.
import { describe, expect, it } from 'vitest';
import { contribution, contributionsFile, deviceInfo, CONTRIBUTION_KIND } from '../contribute';

const result = { count: 8, arm: 'right', worldLandmarks: [[{ x: 0, y: 0, z: 0, visibility: 1 }]], imageLandmarks: [[{ x: 0.5, y: 0.5, z: 0, visibility: 1 }]], timestamps: [0], metadata: { width: 360, height: 640, method: 'webcodecs', duration: 30.7, rotationDecision: 'none' } };

describe('a contribution', () => {
  it('holds the app count and the count kept, the pose, the decoder and the phone kind', () => {
    const c = contribution({ result, lift: 'lateral_raise', kept: 9, setId: 'workout_1', appVersion: 'abc123', device: { userAgent: 'UA' }, now: new Date('2026-10-02T12:00:00Z') });
    expect(c).toMatchObject({ kind: CONTRIBUTION_KIND, lift: 'lateral_raise', count: 9, appCount: 8, corrected: true, arm: 'right', frame: { width: 360, height: 640 }, metadata: { extractionMethod: 'webcodecs', sampleCount: 1 }, device: { userAgent: 'UA' }, version: 'abc123', setId: 'workout_1' });
    expect(c.worldLandmarks).toEqual(result.worldLandmarks);
  });
  it('carries no video, no file name and nothing that names the person', () => {
    const keys = JSON.stringify(contribution({ result: { ...result, video: 'blob:x', fileName: 'IMG_0001.MOV' }, lift: 'squat', kept: 8, setId: 's', appVersion: 'v', device: deviceInfo({ userAgent: 'UA' }, { width: 390, height: 844 }, { devicePixelRatio: 3 }) }));
    expect(keys).not.toMatch(/blob:|IMG_0001|fileName|"name"|email|account/);
  });
  it('states the phone kind from what the browser says, and not its language', () => {
    expect(deviceInfo({ userAgent: 'UA', platform: 'iPhone', language: 'fr-FR', hardwareConcurrency: 6, maxTouchPoints: 5 }, { width: 390, height: 844 }, { devicePixelRatio: 3 }))
      .toEqual({ userAgent: 'UA', platform: 'iPhone', cores: 6, memoryGb: null, touchPoints: 5, screen: { width: 390, height: 844, pixelRatio: 3 } });
  });
  it('rounds each landmark to five decimals and keeps missing samples', () => {
    const c = contribution({ result: { ...result, worldLandmarks: [[{ x: 0.123456789, y: -1.000004, z: 2, visibility: 0.9999999 }], null] }, lift: 'squat', kept: 8, setId: 's', appVersion: 'v' });
    expect(c.worldLandmarks).toEqual([[{ x: 0.12346, y: -1, z: 2, visibility: 1 }], null]);
  });
});

describe('the contributions file', () => {
  const list = [contribution({ result, lift: 'lateral_raise', kept: 8, setId: 'a', appVersion: 'v' })];
  it('is gzip where the browser compresses, and reads back whole', async () => {
    const f = await contributionsFile(list, new Date('2026-10-02T12:00:00Z'));
    expect(f.name).toBe('workout-vision-contributions-2026-10-02-1.json.gz');
    const text = await new Response(f.stream().pipeThrough(new DecompressionStream('gzip'))).text();
    // The phone's own keys and the time of each set stay on the phone (review of 2 October).
    const expected = JSON.parse(JSON.stringify(list)).map(({ setId: _i, savedAt: _a, ...c }) => c);
    expect(JSON.parse(text).sets).toEqual(expected);
    expect(text).not.toMatch(/setId|savedAt|sentAt/);
  });
  it('is plain JSON where it cannot', async () => {
    const f = await contributionsFile(list, new Date('2026-10-02T12:00:00Z'), null);
    expect(f.name).toBe('workout-vision-contributions-2026-10-02-1.json');
    expect(JSON.parse(await f.text()).sets).toHaveLength(1);
  });
});
