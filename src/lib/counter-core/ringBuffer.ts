/**
 * LandmarkRingBuffer: Zero-Allocation Circular Ring Buffer for MediaPipe Pose Landmarks.
 *
 * Problem:
 * During a 60-second working set at 30 FPS (1,800 frames), instantiating 33 individual
 * landmark objects ({ x, y, z, visibility }) per frame creates 59,400 objects.
 * JavaScript engines (V8 / JavaScriptCore) trigger periodic stop-the-world GC pauses
 * (10-35ms), causing dropped frames and timing jitter in camera inference loops.
 *
 * Solution:
 * Pre-allocate a contiguous Float32Array of shape (MaxFrames, 33, 4) along with a Float64Array
 * for timestamps. Writing frames mutates the underlying buffer in-place with zero heap
 * allocations, guaranteeing 0ms GC pauses during active lifting sets.
 *
 * Memory Footprint:
 * 1,800 frames * 33 landmarks * 4 floats * 4 bytes = 950,400 bytes (~928 KB).
 */

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export const LANDMARK_COUNT = 33;
export const FLOATS_PER_LANDMARK = 4; // x, y, z, visibility
export const FLOATS_PER_FRAME = LANDMARK_COUNT * FLOATS_PER_LANDMARK; // 132 floats
export const DEFAULT_CAPACITY = 1800; // 60 seconds @ 30 FPS

export class LandmarkRingBuffer {
  private readonly capacity: number;
  private readonly buffer: Float32Array;
  private readonly timestamps: Float64Array;
  private head: number = 0; // Index of next write slot
  private count: number = 0; // Total frames stored (capped at capacity)
  private totalPushed: number = 0; // Monotonically increasing write counter

  constructor(capacity: number = DEFAULT_CAPACITY) {
    if (capacity <= 0 || !Number.isInteger(capacity)) {
      throw new Error(`LandmarkRingBuffer capacity must be a positive integer, got ${capacity}`);
    }
    this.capacity = capacity;
    this.buffer = new Float32Array(this.capacity * FLOATS_PER_FRAME);
    this.timestamps = new Float64Array(this.capacity);
  }

  /**
   * Pushes a frame of 33 landmarks into the ring buffer with zero object allocation.
   *
   * @param landmarks Array-like collection of 33 points with x, y, and optional z, visibility
   * @param timestampMs Frame timestamp in milliseconds
   * @returns The logical frame index in the sequence
   */
  public pushFrame(
    landmarks: ArrayLike<{ x: number; y: number; z?: number; visibility?: number }>,
    timestampMs: number
  ): number {
    const slot = this.head;
    const baseOffset = slot * FLOATS_PER_FRAME;

    const count = Math.min(landmarks.length, LANDMARK_COUNT);
    for (let k = 0; k < count; k++) {
      const lm = landmarks[k];
      const offset = baseOffset + k * FLOATS_PER_LANDMARK;
      this.buffer[offset] = lm.x;
      this.buffer[offset + 1] = lm.y;
      this.buffer[offset + 2] = lm.z !== undefined ? lm.z : 0.0;
      this.buffer[offset + 3] = lm.visibility !== undefined ? lm.visibility : 1.0;
    }

    // Zero out any remaining landmarks if input was shorter than 33
    for (let k = count; k < LANDMARK_COUNT; k++) {
      const offset = baseOffset + k * FLOATS_PER_LANDMARK;
      this.buffer[offset] = 0.0;
      this.buffer[offset + 1] = 0.0;
      this.buffer[offset + 2] = 0.0;
      this.buffer[offset + 3] = 0.0;
    }

    this.timestamps[slot] = timestampMs;

    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
    const pushedIndex = this.totalPushed;
    this.totalPushed++;

    return pushedIndex;
  }

  /**
   * Number of frames currently held in the buffer (up to capacity).
   */
  public get length(): number {
    return this.count;
  }

  /**
   * Maximum capacity of the buffer in frames.
   */
  public get maxCapacity(): number {
    return this.capacity;
  }

  /**
   * Total number of frames pushed across the buffer's entire lifetime.
   */
  public get totalFramesPushed(): number {
    return this.totalPushed;
  }

  /**
   * Reads a single landmark from a specific logical frame index (0 = oldest available frame).
   * To achieve zero allocation, pass an existing `out` object to be mutated in-place.
   */
  public getLandmark(
    frameIndex: number,
    landmarkIndex: number,
    out?: LandmarkPoint
  ): LandmarkPoint {
    if (frameIndex < 0 || frameIndex >= this.count) {
      throw new RangeError(`Frame index ${frameIndex} out of bounds [0, ${this.count - 1}]`);
    }
    if (landmarkIndex < 0 || landmarkIndex >= LANDMARK_COUNT) {
      throw new RangeError(`Landmark index ${landmarkIndex} out of bounds [0, ${LANDMARK_COUNT - 1}]`);
    }

    const slot = this.getPhysicalSlot(frameIndex);
    const offset = slot * FLOATS_PER_FRAME + landmarkIndex * FLOATS_PER_LANDMARK;

    const target = out || { x: 0, y: 0, z: 0, visibility: 0 };
    target.x = this.buffer[offset];
    target.y = this.buffer[offset + 1];
    target.z = this.buffer[offset + 2];
    target.visibility = this.buffer[offset + 3];

    return target;
  }

  /**
   * Retrieves the timestamp of a logical frame index (0 = oldest available frame).
   */
  public getTimestamp(frameIndex: number): number {
    if (frameIndex < 0 || frameIndex >= this.count) {
      throw new RangeError(`Frame index ${frameIndex} out of bounds [0, ${this.count - 1}]`);
    }
    const slot = this.getPhysicalSlot(frameIndex);
    return this.timestamps[slot];
  }

  /**
   * Calculates the instantaneous 2D or 3D velocity of a given landmark between the most recent
   * frame and `lookbackFrames` ago, in units per second. Zero object allocation.
   */
  public getInstantaneousVelocity(
    landmarkIndex: number,
    lookbackFrames: number = 3,
    use3D: boolean = false
  ): number {
    if (this.count <= lookbackFrames) {
      return 0.0;
    }

    const latestIdx = this.count - 1;
    const prevIdx = this.count - 1 - lookbackFrames;

    const tLatest = this.getTimestamp(latestIdx);
    const tPrev = this.getTimestamp(prevIdx);
    const dt = (tLatest - tPrev) / 1000.0; // seconds

    if (dt <= 0.0001) {
      return 0.0;
    }

    const slotLatest = this.getPhysicalSlot(latestIdx);
    const slotPrev = this.getPhysicalSlot(prevIdx);

    const offLatest = slotLatest * FLOATS_PER_FRAME + landmarkIndex * FLOATS_PER_LANDMARK;
    const offPrev = slotPrev * FLOATS_PER_FRAME + landmarkIndex * FLOATS_PER_LANDMARK;

    const dx = this.buffer[offLatest] - this.buffer[offPrev];
    const dy = this.buffer[offLatest + 1] - this.buffer[offPrev + 1];

    let distSq = dx * dx + dy * dy;
    if (use3D) {
      const dz = this.buffer[offLatest + 2] - this.buffer[offPrev + 2];
      distSq += dz * dz;
    }

    return Math.sqrt(distSq) / dt;
  }

  /**
   * Converts the logical frame stream to a standard JavaScript array representation
   * for persistence (IndexedDB, JSON export).
   */
  public toArray(): Array<{ timestamp: number; landmarks: LandmarkPoint[] }> {
    const result: Array<{ timestamp: number; landmarks: LandmarkPoint[] }> = [];
    result.length = this.count;

    for (let f = 0; f < this.count; f++) {
      const slot = this.getPhysicalSlot(f);
      const baseOffset = slot * FLOATS_PER_FRAME;
      const lms: LandmarkPoint[] = new Array(LANDMARK_COUNT);

      for (let k = 0; k < LANDMARK_COUNT; k++) {
        const off = baseOffset + k * FLOATS_PER_LANDMARK;
        lms[k] = {
          x: this.buffer[off],
          y: this.buffer[off + 1],
          z: this.buffer[off + 2],
          visibility: this.buffer[off + 3],
        };
      }

      result[f] = {
        timestamp: this.timestamps[slot],
        landmarks: lms,
      };
    }

    return result;
  }

  /**
   * Clears the buffer for the next set without reallocating underlying memory.
   */
  public clear(): void {
    this.head = 0;
    this.count = 0;
    this.totalPushed = 0;
  }

  /**
   * Resolves a logical frame index (0 = oldest) to the physical circular slot index.
   */
  private getPhysicalSlot(logicalIndex: number): number {
    if (this.count < this.capacity) {
      return logicalIndex;
    }
    // When full, oldest is at head, newest is at (head - 1) % capacity
    return (this.head + logicalIndex) % this.capacity;
  }
}
