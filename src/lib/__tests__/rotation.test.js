// The decoded frame is turned by hand when the container says the video is turned and the frame does not carry it
// (WebKit), for 180° as for 90 and 270 (second audit, 3 October).
import { describe, expect, it } from 'vitest';
import { manualRotationNeeded, normalizeRotation } from '../frameExtractor';

describe('turning a frame by hand', () => {
  it('on WebKit, whose frames carry no rotation, for every turn of the container', () => {
    for (const r of [90, 180, 270, -90, -180, -270]) expect(manualRotationNeeded(r, undefined), `${r}`).toBe(true);
    expect(manualRotationNeeded(-90, 0)).toBe(true);
  });
  it('never where the frame carries the rotation, nor for an upright or 360-degree container', () => {
    for (const r of [90, 180, 270]) expect(manualRotationNeeded(r, r), `${r}`).toBe(false);
    expect(manualRotationNeeded(-90, 270)).toBe(false);
    expect(manualRotationNeeded(0, undefined)).toBe(false);
    expect(manualRotationNeeded(360, undefined)).toBe(false);
    expect(manualRotationNeeded(-360, 0)).toBe(false);
    expect(manualRotationNeeded(90, 360)).toBe(true);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(360)).toBe(0);
  });
});
