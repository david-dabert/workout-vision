import { describe, it, expect } from 'vitest';
import {
  LandmarkRingBuffer,
  LANDMARK_COUNT,
  LandmarkPoint,
} from '../ringBuffer';

describe('LandmarkRingBuffer (Zero-Allocation Typed Landmark Storage)', () => {
  it('instantiates buffer with specified capacity and initial zero count', () => {
    const ring = new LandmarkRingBuffer(100);
    expect(ring.length).toBe(0);
    expect(ring.maxCapacity).toBe(100);
    expect(ring.totalFramesPushed).toBe(0);
  });

  it('pushes frames and reads back exact landmark coordinates and visibility', () => {
    const ring = new LandmarkRingBuffer(10);

    const mockLandmarks = Array.from({ length: 33 }, (_, i) => ({
      x: 0.1 * i,
      y: 0.2 * i,
      z: -0.05 * i,
      visibility: 0.95,
    }));

    const idx = ring.pushFrame(mockLandmarks, 1000);
    expect(idx).toBe(0);
    expect(ring.length).toBe(1);
    expect(ring.getTimestamp(0)).toBe(1000);

    const lm0 = ring.getLandmark(0, 0);
    expect(lm0.x).toBeCloseTo(0.0);
    expect(lm0.y).toBeCloseTo(0.0);
    expect(lm0.z).toBeCloseTo(0.0);
    expect(lm0.visibility).toBeCloseTo(0.95);

    const lm25 = ring.getLandmark(0, 25);
    expect(lm25.x).toBeCloseTo(2.5);
    expect(lm25.y).toBeCloseTo(5.0);
    expect(lm25.z).toBeCloseTo(-1.25);
    expect(lm25.visibility).toBeCloseTo(0.95);
  });

  it('supports zero-allocation reads via reusable target object', () => {
    const ring = new LandmarkRingBuffer(10);

    const mockLandmarks = Array.from({ length: 33 }, () => ({
      x: 0.42,
      y: 0.88,
      z: 0.12,
      visibility: 0.99,
    }));

    ring.pushFrame(mockLandmarks, 500);

    const reusable: LandmarkPoint = { x: 0, y: 0, z: 0, visibility: 0 };
    const returned = ring.getLandmark(0, 11, reusable);

    expect(returned).toBe(reusable); // Same object reference!
    expect(reusable.x).toBeCloseTo(0.42);
    expect(reusable.y).toBeCloseTo(0.88);
    expect(reusable.z).toBeCloseTo(0.12);
    expect(reusable.visibility).toBeCloseTo(0.99);
  });

  it('handles circular wrap-around correctly when pushed beyond capacity', () => {
    const capacity = 5;
    const ring = new LandmarkRingBuffer(capacity);

    // Push 8 frames into a capacity-5 buffer
    for (let f = 0; f < 8; f++) {
      const mockLandmarks = Array.from({ length: 33 }, () => ({
        x: f,
        y: f * 2,
        z: 0,
        visibility: 1.0,
      }));
      ring.pushFrame(mockLandmarks, 1000 + f * 33);
    }

    expect(ring.length).toBe(5);
    expect(ring.totalFramesPushed).toBe(8);

    // Oldest available frame (index 0) should now be frame 3 (pushed at t = 1000 + 3*33 = 1099)
    expect(ring.getTimestamp(0)).toBe(1099);
    const oldestLm = ring.getLandmark(0, 0);
    expect(oldestLm.x).toBe(3);

    // Newest frame (index 4) should be frame 7 (pushed at t = 1000 + 7*33 = 1231)
    expect(ring.getTimestamp(4)).toBe(1231);
    const newestLm = ring.getLandmark(4, 0);
    expect(newestLm.x).toBe(7);
  });

  it('computes instantaneous landmark velocity with zero allocations', () => {
    const ring = new LandmarkRingBuffer(10);

    // Push 5 frames with moving right wrist (index 16)
    for (let f = 0; f < 5; f++) {
      const mockLandmarks = Array.from({ length: 33 }, (_, i) => ({
        x: i === 16 ? f * 0.1 : 0.5, // 0.1m per frame for wrist
        y: 0.5,
        z: 0.0,
        visibility: 1.0,
      }));
      // 33.33ms per frame = 30 FPS
      ring.pushFrame(mockLandmarks, f * 33.333);
    }

    // Velocity across 3 frames: dx = 3 * 0.1 = 0.3, dt = 3 * 0.033333 = 0.1s -> v = 3.0 units/sec
    const v = ring.getInstantaneousVelocity(16, 3);
    expect(v).toBeCloseTo(3.0, 1);
  });

  it('clears state without discarding allocated typed memory', () => {
    const ring = new LandmarkRingBuffer(5);
    const mockLandmarks = Array.from({ length: 33 }, () => ({
      x: 1,
      y: 1,
      z: 1,
      visibility: 1,
    }));

    ring.pushFrame(mockLandmarks, 100);
    ring.pushFrame(mockLandmarks, 200);
    expect(ring.length).toBe(2);

    ring.clear();
    expect(ring.length).toBe(0);
    expect(ring.totalFramesPushed).toBe(0);

    // Can push new frames immediately
    ring.pushFrame(mockLandmarks, 300);
    expect(ring.length).toBe(1);
    expect(ring.getTimestamp(0)).toBe(300);
  });

  it('converts to standard array representation for offline export', () => {
    const ring = new LandmarkRingBuffer(3);
    const mockLandmarks = Array.from({ length: 33 }, (_, i) => ({
      x: i * 0.01,
      y: i * 0.02,
      z: 0.0,
      visibility: 0.8,
    }));

    ring.pushFrame(mockLandmarks, 10);
    ring.pushFrame(mockLandmarks, 20);

    const exported = ring.toArray();
    expect(exported.length).toBe(2);
    expect(exported[0].timestamp).toBe(10);
    expect(exported[0].landmarks.length).toBe(LANDMARK_COUNT);
    expect(exported[1].timestamp).toBe(20);
  });
});
