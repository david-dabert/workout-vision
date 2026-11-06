/**
 * WorkoutVision WebGPU Compute Acceleration Pipeline
 * 
 * Hardware-accelerated 33-point MediaPipe landmark parallel smoothing via
 * WGSL (WebGPU Shading Language) compute shaders, with deterministic WebAssembly
 * (WASM) and typed-array CPU fallbacks for older mobile WebKit / iOS Safari engines.
 * 
 * Invariants:
 * 1. Zero external dependencies.
 * 2. 100% client-side execution (0 server roundtrips, sub-millisecond local compute).
 * 3. Graceful degradation: WebGPU -> WebAssembly SIMD/Linear Memory -> TypedArray CPU.
 * 4. Memory-safe buffer alignments (std140/std430 WGSL 16-byte vec4 alignment).
 * 5. Deterministic One-Euro filter kinematics with adaptive velocity cutoff.
 */

// ─── TYPES & INTERFACES ────────────────────────────────────────────────────────

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface FilterConfig {
  /** Minimum cutoff frequency in Hz (default: 1.5 Hz). Dampens jitter at rest. */
  minCutoff?: number;
  /** Velocity coefficient scaling cutoff frequency with movement speed (default: 0.01). */
  beta?: number;
  /** Derivative cutoff frequency in Hz (default: 1.0 Hz). */
  dCutoff?: number;
  /** Visibility threshold below which raw landmarks pass through without corrupting state (default: 0.1). */
  minVisThreshold?: number;
}

export type AccelerationBackend = 'webgpu' | 'wasm' | 'cpu';

export interface UniformBufferLayout {
  readonly byteLength: number;
  readonly minCutoffOffset: number;
  readonly betaOffset: number;
  readonly dCutoffOffset: number;
  readonly dtOffset: number;
  readonly numLandmarksOffset: number;
  readonly resetStateOffset: number;
  readonly minVisThresholdOffset: number;
  readonly paddingOffset: number;
}

export interface BufferLayoutSpecification {
  readonly numLandmarks: number;
  readonly componentsPerLandmark: number;
  readonly float32Count: number;
  readonly byteLength: number;
  readonly uniformLayout: UniformBufferLayout;
  readonly storageBufferBytes: number;
  readonly stateInitBufferBytes: number;
}

export interface PipelineOptions {
  /** Preferred backend or 'auto' for automatic tier selection. */
  preferredBackend?: 'auto' | AccelerationBackend;
  /** Initial filter tuning configuration. */
  config?: FilterConfig;
  /** Number of landmarks per frame (default: 33 for MediaPipe Pose). */
  numLandmarks?: number;
  /** Optional custom GPUDevice (for dependency injection or testing). */
  customDevice?: GPUDevice;
}

// ─── CONSTANTS & BUFFER LAYOUT SPECIFICATION ────────────────────────────────────

export const DEFAULT_NUM_LANDMARKS = 33;
export const COMPONENTS_PER_LANDMARK = 4; // x, y, z, visibility (vec4<f32>)
export const BYTES_PER_FLOAT32 = 4;
export const VEC4_STRIDE_BYTES = COMPONENTS_PER_LANDMARK * BYTES_PER_FLOAT32; // 16 bytes
export const TOTAL_STORAGE_BYTES = DEFAULT_NUM_LANDMARKS * VEC4_STRIDE_BYTES; // 33 * 16 = 528 bytes
export const STATE_INIT_BUFFER_BYTES = 256; // 33 * 4 = 132 bytes, padded to 256 for universal GPU vendor compliance
export const UNIFORM_BUFFER_BYTES = 32; // 8 x 4 bytes = 32 bytes (16-byte aligned)

export const UNIFORM_LAYOUT: UniformBufferLayout = {
  byteLength: UNIFORM_BUFFER_BYTES,
  minCutoffOffset: 0,
  betaOffset: 4,
  dCutoffOffset: 8,
  dtOffset: 12,
  numLandmarksOffset: 16,
  resetStateOffset: 20,
  minVisThresholdOffset: 24,
  paddingOffset: 28,
};

export const BUFFER_LAYOUT_SPEC: BufferLayoutSpecification = {
  numLandmarks: DEFAULT_NUM_LANDMARKS,
  componentsPerLandmark: COMPONENTS_PER_LANDMARK,
  float32Count: DEFAULT_NUM_LANDMARKS * COMPONENTS_PER_LANDMARK,
  byteLength: TOTAL_STORAGE_BYTES,
  uniformLayout: UNIFORM_LAYOUT,
  storageBufferBytes: TOTAL_STORAGE_BYTES,
  stateInitBufferBytes: STATE_INIT_BUFFER_BYTES,
};

export const DEFAULT_CONFIG: Required<FilterConfig> = {
  minCutoff: 1.5,
  beta: 0.01,
  dCutoff: 1.0,
  minVisThreshold: 0.1,
};

// ─── WGSL COMPUTE SHADER SPECIFICATION ─────────────────────────────────────────

export const WGSL_LANDMARK_FILTER_SHADER = /* wgsl */ `
struct FilterUniforms {
  minCutoff: f32,
  beta: f32,
  dCutoff: f32,
  dt: f32,
  numLandmarks: u32,
  resetState: u32,
  minVisThreshold: f32,
  padding: u32,
};

@group(0) @binding(0) var<uniform> uniforms: FilterUniforms;
@group(0) @binding(1) var<storage, read> inLandmarks: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write> stateX: array<vec4<f32>>;
@group(0) @binding(3) var<storage, read_write> stateDx: array<vec4<f32>>;
@group(0) @binding(4) var<storage, read_write> stateInit: array<u32>;
@group(0) @binding(5) var<storage, read_write> outLandmarks: array<vec4<f32>>;

const TWO_PI: f32 = 6.28318530717958647692;

fn computeAlpha(rate: f32, cutoff: f32) -> f32 {
  let tau = 1.0 / (TWO_PI * cutoff);
  return 1.0 / (1.0 + tau * rate);
}

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let idx = global_id.x;
  if (idx >= uniforms.numLandmarks) {
    return;
  }

  let raw = inLandmarks[idx];
  let isInit = stateInit[idx];
  let doReset = uniforms.resetState;

  // First frame initialization or explicit pipeline reset
  if (isInit == 0u || doReset != 0u) {
    stateX[idx] = raw;
    stateDx[idx] = vec4<f32>(0.0, 0.0, 0.0, 0.0);
    stateInit[idx] = 1u;
    outLandmarks[idx] = raw;
    return;
  }

  // Low-visibility landmarks pass through raw without corrupting motion history
  let visibility = raw.w;
  if (visibility < uniforms.minVisThreshold) {
    outLandmarks[idx] = raw;
    return;
  }

  // Guard against non-positive sampling periods (e.g. paused / dropped frames)
  var te = uniforms.dt;
  if (te <= 0.0001) {
    te = 0.03333333; // Default 30 fps sampling interval
  }
  let rate = 1.0 / te;

  let prevX = stateX[idx].xyz;
  let prevDx = stateDx[idx].xyz;
  let currX = raw.xyz;

  // 1. Raw spatial velocity derivative
  let dx = (currX - prevX) * rate;

  // 2. Filter derivative with fixed cutoff dCutoff
  let alphaD = computeAlpha(rate, uniforms.dCutoff);
  let edx = alphaD * dx + (1.0 - alphaD) * prevDx;

  // 3. Adaptive cutoff frequency: fc = minCutoff + beta * |edx|
  let speed = abs(edx);
  let fc = vec3<f32>(
    uniforms.minCutoff + uniforms.beta * speed.x,
    uniforms.minCutoff + uniforms.beta * speed.y,
    uniforms.minCutoff + uniforms.beta * speed.z
  );

  // 4. Adaptive smoothing factor alpha per spatial axis
  let alpha = vec3<f32>(
    computeAlpha(rate, fc.x),
    computeAlpha(rate, fc.y),
    computeAlpha(rate, fc.z)
  );

  // 5. Exponential smoothing of landmark position
  let filteredPos = alpha * currX + (vec3<f32>(1.0, 1.0, 1.0) - alpha) * prevX;

  // 6. Update filter states
  stateX[idx] = vec4<f32>(filteredPos, raw.w);
  stateDx[idx] = vec4<f32>(edx, 0.0);

  // 7. Write smoothed landmark out (preserving confidence/visibility)
  outLandmarks[idx] = vec4<f32>(filteredPos, raw.w);
}
`;

// ─── WEBASSEMBLY BYTECODE GENERATOR (FALLBACK TIER 2) ──────────────────────────

/**
 * Encodes an unsigned 32-bit integer into WebAssembly LEB128 format.
 */
function encodeUleb128(value: number): number[] {
  let val = value >>> 0;
  const bytes: number[] = [];
  do {
    let byte = val & 0x7f;
    val >>>= 7;
    if (val !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (val !== 0);
  return bytes;
}

/**
 * Encodes a WebAssembly section with its identifier and payload length.
 */
function encodeSection(id: number, payload: number[]): number[] {
  return [id, ...encodeUleb128(payload.length), ...payload];
}

/**
 * Encodes a UTF-8 string with length prefix for WebAssembly exports.
 */
function encodeString(str: string): number[] {
  const enc: number[] = [];
  for (let i = 0; i < str.length; i++) {
    enc.push(str.charCodeAt(i) & 0xff);
  }
  return [...encodeUleb128(enc.length), ...enc];
}

/**
 * Converts a 32-bit float into 4 little-endian bytes.
 */
function floatToBytesLE(value: number): number[] {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, value, true);
  const u8 = new Uint8Array(buf);
  return [u8[0], u8[1], u8[2], u8[3]];
}

/**
 * Synthesizes a valid, standalone WebAssembly binary module in memory.
 * Implements the 1€ landmark smoothing loop directly in WebAssembly bytecode.
 * Memory Layout (Page 0, 64KB):
 * - Offset 0 .. 527: Input Buffer (33 * 4 * f32 = 528 bytes)
 * - Offset 528 .. 1055: State X Buffer (33 * 4 * f32 = 528 bytes)
 * - Offset 1056 .. 1583: State dX Buffer (33 * 4 * f32 = 528 bytes)
 * - Offset 1584 .. 1715: State Init Buffer (33 * i32 = 132 bytes)
 * - Offset 1728 .. 2255: Output Buffer (33 * 4 * f32 = 528 bytes)
 */
export function buildWasmLandmarkFilterBinary(): Uint8Array {
  // Section 1: Type
  // Func Type 0: (f32, f32, f32, f32, i32, i32, f32) -> void
  // 0: dt, 1: minCutoff, 2: beta, 3: dCutoff, 4: numLandmarks, 5: resetState, 6: minVisThreshold
  const typePayload = [
    ...encodeUleb128(1),
    0x60, // func
    ...encodeUleb128(7), 0x7d, 0x7d, 0x7d, 0x7d, 0x7f, 0x7f, 0x7d,
    ...encodeUleb128(0),
  ];
  const typeSec = encodeSection(1, typePayload);

  // Section 3: Function
  const funcSec = encodeSection(3, [...encodeUleb128(1), 0x00]);

  // Section 5: Memory (1 min page = 64KB, no max)
  const memSec = encodeSection(5, [...encodeUleb128(1), 0x00, 0x01]);

  // Section 7: Export ('memory' index 0, 'smooth' func 0)
  const expSec = encodeSection(7, [
    ...encodeUleb128(2),
    ...encodeString('memory'), 0x02, 0x00,
    ...encodeString('smooth'), 0x00, 0x00,
  ]);

  // Section 10: Code
  // Opcode definitions
  const OP = {
    block: 0x02, loop: 0x03, if: 0x04, else: 0x05, end: 0x0b, br: 0x0c, br_if: 0x0d,
    local_get: 0x20, local_set: 0x21,
    i32_load: 0x28, f32_load: 0x2a, i32_store: 0x36, f32_store: 0x38,
    i32_const: 0x41, f32_const: 0x43, i32_eqz: 0x45, i32_ge_s: 0x4e,
    f32_lt: 0x5d, f32_le: 0x5f, i32_add: 0x6a, i32_shl: 0x74,
    f32_abs: 0x8b, f32_add: 0x92, f32_sub: 0x93, f32_mul: 0x94, f32_div: 0x95,
  };

  // Locals:
  // i32: 7: i, 8: isInit, 9: baseIn, 10: baseX, 11: baseDx, 12: baseInit, 13: baseOut, 14: axis (8 locals)
  // f32: 15: te, 16: rate, 17: alphaD, 18: vis, 19: currVal, 20: prevVal, 21: prevDx, 22: dx, 23: edx, 24: fc, 25: alpha, 26: xHat (12 locals)
  const localsHeader = [
    2,
    8, 0x7f,
    12, 0x7d,
  ];

  const body: number[] = [];

  // te = dt <= 0.0001 ? 0.03333333 : dt
  body.push(OP.local_get, 0, OP.f32_const, ...floatToBytesLE(0.0001), OP.f32_le);
  body.push(OP.if, 0x40);
  body.push(OP.f32_const, ...floatToBytesLE(0.03333333), OP.local_set, 15);
  body.push(OP.else);
  body.push(OP.local_get, 0, OP.local_set, 15);
  body.push(OP.end);

  // rate = 1.0 / te
  body.push(OP.f32_const, ...floatToBytesLE(1.0), OP.local_get, 15, OP.f32_div, OP.local_set, 16);

  // alphaD = 1.0 / (1.0 + (1.0 / (6.2831853 * dCutoff)) * rate)
  body.push(OP.f32_const, ...floatToBytesLE(1.0));
  body.push(OP.f32_const, ...floatToBytesLE(1.0));
  body.push(OP.f32_const, ...floatToBytesLE(1.0));
  body.push(OP.f32_const, ...floatToBytesLE(6.2831853), OP.local_get, 3, OP.f32_mul);
  body.push(OP.f32_div);
  body.push(OP.local_get, 16, OP.f32_mul);
  body.push(OP.f32_add);
  body.push(OP.f32_div, OP.local_set, 17);

  // i = 0
  body.push(OP.i32_const, 0, OP.local_set, 7);

  // Landmark loop
  body.push(OP.block, 0x40);
  body.push(OP.loop, 0x40);

  // if (i >= numLandmarks) break
  body.push(OP.local_get, 7, OP.local_get, 4, OP.i32_ge_s, OP.br_if, 1);

  // baseIn = i * 16 (0)
  body.push(OP.local_get, 7, OP.i32_const, 4, OP.i32_shl, OP.local_set, 9);
  // baseX = baseIn + 528
  body.push(OP.local_get, 9, OP.i32_const, ...encodeUleb128(528), OP.i32_add, OP.local_set, 10);
  // baseDx = baseIn + 1056
  body.push(OP.local_get, 9, OP.i32_const, ...encodeUleb128(1056), OP.i32_add, OP.local_set, 11);
  // baseInit = i * 4 + 1584
  body.push(OP.local_get, 7, OP.i32_const, 2, OP.i32_shl, OP.i32_const, ...encodeUleb128(1584), OP.i32_add, OP.local_set, 12);
  // baseOut = baseIn + 1728
  body.push(OP.local_get, 9, OP.i32_const, ...encodeUleb128(1728), OP.i32_add, OP.local_set, 13);

  // vis = load_f32(baseIn + 12)
  body.push(OP.local_get, 9, OP.f32_load, 2, 12, OP.local_set, 18);
  // isInit = load_i32(baseInit)
  body.push(OP.local_get, 12, OP.i32_load, 2, 0, OP.local_set, 8);

  // If isInit == 0 || resetState != 0
  body.push(OP.local_get, 8, OP.i32_eqz, OP.local_get, 5, OP.i32_eqz, OP.i32_eqz, OP.i32_add);
  body.push(OP.if, 0x40);
  for (let a = 0; a < 4; a++) {
    // stateX[a] = in[a]
    body.push(OP.local_get, 10, OP.local_get, 9, OP.f32_load, 2, a * 4, OP.f32_store, 2, a * 4);
    // out[a] = in[a]
    body.push(OP.local_get, 13, OP.local_get, 9, OP.f32_load, 2, a * 4, OP.f32_store, 2, a * 4);
    // stateDx[a] = 0
    body.push(OP.local_get, 11, OP.f32_const, ...floatToBytesLE(0.0), OP.f32_store, 2, a * 4);
  }
  // stateInit = 1
  body.push(OP.local_get, 12, OP.i32_const, 1, OP.i32_store, 2, 0);
  body.push(OP.else);

  // check visibility < minVisThreshold
  body.push(OP.local_get, 18, OP.local_get, 6, OP.f32_lt);
  body.push(OP.if, 0x40);
  for (let a = 0; a < 4; a++) {
    body.push(OP.local_get, 13, OP.local_get, 9, OP.f32_load, 2, a * 4, OP.f32_store, 2, a * 4);
  }
  body.push(OP.else);

  // Filter 3 spatial axes (x, y, z)
  for (let a = 0; a < 3; a++) {
    const offset = a * 4;
    body.push(OP.local_get, 9, OP.f32_load, 2, offset, OP.local_set, 19);
    body.push(OP.local_get, 10, OP.f32_load, 2, offset, OP.local_set, 20);
    body.push(OP.local_get, 11, OP.f32_load, 2, offset, OP.local_set, 21);

    // dx = (currVal - prevVal) * rate
    body.push(OP.local_get, 19, OP.local_get, 20, OP.f32_sub, OP.local_get, 16, OP.f32_mul, OP.local_set, 22);

    // edx = alphaD * dx + (1.0 - alphaD) * prevDx
    body.push(OP.local_get, 17, OP.local_get, 22, OP.f32_mul);
    body.push(OP.f32_const, ...floatToBytesLE(1.0), OP.local_get, 17, OP.f32_sub, OP.local_get, 21, OP.f32_mul);
    body.push(OP.f32_add, OP.local_set, 23);

    // fc = minCutoff + beta * |edx|
    body.push(OP.local_get, 1, OP.local_get, 2, OP.local_get, 23, OP.f32_abs, OP.f32_mul, OP.f32_add, OP.local_set, 24);

    // alpha = 1.0 / (1.0 + (1.0 / (6.2831853 * fc)) * rate)
    body.push(OP.f32_const, ...floatToBytesLE(1.0));
    body.push(OP.f32_const, ...floatToBytesLE(1.0));
    body.push(OP.f32_const, ...floatToBytesLE(1.0));
    body.push(OP.f32_const, ...floatToBytesLE(6.2831853), OP.local_get, 24, OP.f32_mul);
    body.push(OP.f32_div);
    body.push(OP.local_get, 16, OP.f32_mul);
    body.push(OP.f32_add);
    body.push(OP.f32_div, OP.local_set, 25);

    // xHat = alpha * currVal + (1.0 - alpha) * prevVal
    body.push(OP.local_get, 25, OP.local_get, 19, OP.f32_mul);
    body.push(OP.f32_const, ...floatToBytesLE(1.0), OP.local_get, 25, OP.f32_sub, OP.local_get, 20, OP.f32_mul);
    body.push(OP.f32_add, OP.local_set, 26);

    body.push(OP.local_get, 10, OP.local_get, 26, OP.f32_store, 2, offset);
    body.push(OP.local_get, 13, OP.local_get, 26, OP.f32_store, 2, offset);
    body.push(OP.local_get, 11, OP.local_get, 23, OP.f32_store, 2, offset);
  }

  // Preserve visibility in output and stateX
  body.push(OP.local_get, 13, OP.local_get, 18, OP.f32_store, 2, 12);
  body.push(OP.local_get, 10, OP.local_get, 18, OP.f32_store, 2, 12);

  body.push(OP.end); // end inner if (vis)
  body.push(OP.end); // end outer if (init)

  // i = i + 1
  body.push(OP.local_get, 7, OP.i32_const, 1, OP.i32_add, OP.local_set, 7);
  body.push(OP.br, 0);

  body.push(OP.end); // end loop
  body.push(OP.end); // end block
  body.push(OP.end); // end func

  const codePayload = [...localsHeader, ...body];
  const codeSec = encodeSection(10, [...encodeUleb128(1), ...encodeUleb128(codePayload.length), ...codePayload]);

  return new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...typeSec, ...funcSec, ...memSec, ...expSec, ...codeSec,
  ]);
}

export interface WasmFilterExports {
  memory: WebAssembly.Memory;
  smooth(
    dt: number,
    minCutoff: number,
    beta: number,
    dCutoff: number,
    numLandmarks: number,
    resetState: number,
    minVisThreshold: number
  ): void;
}

export const GPU_BUFFER_USAGE = {
  MAP_READ: 0x0001,
  MAP_WRITE: 0x0002,
  COPY_SRC: 0x0004,
  COPY_DST: 0x0008,
  INDEX: 0x0010,
  VERTEX: 0x0020,
  UNIFORM: 0x0040,
  STORAGE: 0x0080,
  INDIRECT: 0x0100,
  QUERY_RESOLVE: 0x0200,
} as const;

export const GPU_MAP_MODE = {
  READ: 0x0001,
  WRITE: 0x0002,
} as const;

/**
 * Creates and instantiates the WebAssembly landmark smoothing module.
 */
export function createWasmFilterModule(): { instance: WebAssembly.Instance; exports: WasmFilterExports } {
  const binary = buildWasmLandmarkFilterBinary();
  const module = new WebAssembly.Module(binary.buffer as ArrayBuffer);
  const instance = new WebAssembly.Instance(module);
  const exports = instance.exports as unknown as WasmFilterExports;
  return { instance, exports };
}

// ─── ACCELERATION ENGINES ──────────────────────────────────────────────────────

/**
 * High-performance TypedArray CPU Fallback Engine.
 * Reuses internal Float32Array allocations with zero GC pauses.
 */
export class CpuLandmarkFilter {
  private config: Required<FilterConfig>;
  private readonly numLandmarks: number;
  private readonly inputBuffer: Float32Array;
  private readonly stateX: Float32Array;
  private readonly stateDx: Float32Array;
  private readonly stateInit: Int32Array;
  private readonly outputBuffer: Float32Array;
  private lastTimestampSec: number | null = null;

  constructor(config: FilterConfig = {}, numLandmarks = DEFAULT_NUM_LANDMARKS) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.numLandmarks = numLandmarks;
    const len = numLandmarks * COMPONENTS_PER_LANDMARK;
    this.inputBuffer = new Float32Array(len);
    this.stateX = new Float32Array(len);
    this.stateDx = new Float32Array(len);
    this.stateInit = new Int32Array(numLandmarks);
    this.outputBuffer = new Float32Array(len);
  }

  public setConfig(config: FilterConfig): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): Required<FilterConfig> {
    return { ...this.config };
  }

  public reset(): void {
    this.stateInit.fill(0);
    this.stateX.fill(0);
    this.stateDx.fill(0);
    this.lastTimestampSec = null;
  }

  public filterFloat32(input: Float32Array, dt: number, doReset = false): Float32Array {
    if (doReset) {
      this.reset();
    }

    const te = dt <= 0.0001 ? 0.03333333 : dt;
    const rate = 1.0 / te;
    const tauD = 1.0 / (2.0 * Math.PI * this.config.dCutoff);
    const alphaD = 1.0 / (1.0 + tauD * rate);

    const count = Math.min(this.numLandmarks, Math.floor(input.length / COMPONENTS_PER_LANDMARK));

    for (let i = 0; i < count; i++) {
      const base = i * COMPONENTS_PER_LANDMARK;
      const vis = input[base + 3];

      if (this.stateInit[i] === 0 || doReset) {
        this.stateX[base] = input[base];
        this.stateX[base + 1] = input[base + 1];
        this.stateX[base + 2] = input[base + 2];
        this.stateX[base + 3] = vis;

        this.stateDx[base] = 0;
        this.stateDx[base + 1] = 0;
        this.stateDx[base + 2] = 0;

        this.stateInit[i] = 1;

        this.outputBuffer[base] = input[base];
        this.outputBuffer[base + 1] = input[base + 1];
        this.outputBuffer[base + 2] = input[base + 2];
        this.outputBuffer[base + 3] = vis;
        continue;
      }

      if (vis < this.config.minVisThreshold) {
        this.outputBuffer[base] = input[base];
        this.outputBuffer[base + 1] = input[base + 1];
        this.outputBuffer[base + 2] = input[base + 2];
        this.outputBuffer[base + 3] = vis;
        continue;
      }

      for (let a = 0; a < 3; a++) {
        const idx = base + a;
        const curr = input[idx];
        const prev = this.stateX[idx];
        const prevD = this.stateDx[idx];

        const dx = (curr - prev) * rate;
        const edx = alphaD * dx + (1.0 - alphaD) * prevD;
        const fc = this.config.minCutoff + this.config.beta * Math.abs(edx);
        const tau = 1.0 / (2.0 * Math.PI * fc);
        const alpha = 1.0 / (1.0 + tau * rate);
        const xHat = alpha * curr + (1.0 - alpha) * prev;

        this.stateX[idx] = xHat;
        this.stateDx[idx] = edx;
        this.outputBuffer[idx] = xHat;
      }

      this.outputBuffer[base + 3] = vis;
      this.stateX[base + 3] = vis;
    }

    return this.outputBuffer;
  }

  public filterLandmarks(landmarks: LandmarkPoint[], timestampSec?: number): LandmarkPoint[] {
    const now = timestampSec ?? (performance ? performance.now() / 1000 : Date.now() / 1000);
    const dt = this.lastTimestampSec !== null ? now - this.lastTimestampSec : 0.03333333;
    this.lastTimestampSec = now;

    const count = Math.min(this.numLandmarks, landmarks.length);
    for (let i = 0; i < count; i++) {
      const lm = landmarks[i];
      const base = i * COMPONENTS_PER_LANDMARK;
      this.inputBuffer[base] = lm ? lm.x : 0;
      this.inputBuffer[base + 1] = lm ? lm.y : 0;
      this.inputBuffer[base + 2] = lm && lm.z !== undefined ? lm.z : 0;
      this.inputBuffer[base + 3] = lm && lm.visibility !== undefined ? lm.visibility : 1.0;
    }

    this.filterFloat32(this.inputBuffer, dt);

    const out: LandmarkPoint[] = new Array(count);
    for (let i = 0; i < count; i++) {
      const base = i * COMPONENTS_PER_LANDMARK;
      out[i] = {
        x: this.outputBuffer[base],
        y: this.outputBuffer[base + 1],
        z: this.outputBuffer[base + 2],
        visibility: this.outputBuffer[base + 3],
      };
    }
    return out;
  }
}

/**
 * WebAssembly Landmark Filter Engine.
 * Operates on shared Linear Memory for near-metal performance on Safari/WebKit.
 */
export class WebAssemblyLandmarkFilter {
  private config: Required<FilterConfig>;
  private readonly numLandmarks: number;
  private wasmExports: WasmFilterExports | null = null;
  private memF32: Float32Array | null = null;
  private lastTimestampSec: number | null = null;
  private initialized = false;

  constructor(config: FilterConfig = {}, numLandmarks = DEFAULT_NUM_LANDMARKS) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.numLandmarks = numLandmarks;
  }

  public init(): boolean {
    if (this.initialized) return true;
    try {
      const { exports } = createWasmFilterModule();
      this.wasmExports = exports;
      this.memF32 = new Float32Array(exports.memory.buffer);
      this.initialized = true;
      return true;
    } catch {
      this.initialized = false;
      return false;
    }
  }

  public setConfig(config: FilterConfig): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): Required<FilterConfig> {
    return { ...this.config };
  }

  public reset(): void {
    if (!this.initialized || !this.wasmExports || !this.memF32) return;
    // Clear stateInit (offset 1584, 33 * 4 bytes)
    const stateInitU8 = new Uint8Array(this.wasmExports.memory.buffer, 1584, this.numLandmarks * 4);
    stateInitU8.fill(0);
    this.lastTimestampSec = null;
  }

  public filterFloat32(input: Float32Array, dt: number, doReset = false): Float32Array {
    if (!this.initialized || !this.wasmExports || !this.memF32) {
      throw new Error('WebAssemblyLandmarkFilter not initialized');
    }

    const count = Math.min(this.numLandmarks, Math.floor(input.length / COMPONENTS_PER_LANDMARK));
    const floatCount = count * COMPONENTS_PER_LANDMARK;

    // Direct memory copy into Wasm page at input base (offset 0)
    this.memF32.set(input.subarray(0, floatCount), 0);

    this.wasmExports.smooth(
      dt,
      this.config.minCutoff,
      this.config.beta,
      this.config.dCutoff,
      count,
      doReset ? 1 : 0,
      this.config.minVisThreshold
    );

    // Read back from Wasm output buffer at offset 1728 / 4 = 432
    return this.memF32.subarray(432, 432 + floatCount);
  }

  public filterLandmarks(landmarks: LandmarkPoint[], timestampSec?: number): LandmarkPoint[] {
    if (!this.initialized || !this.wasmExports || !this.memF32) {
      throw new Error('WebAssemblyLandmarkFilter not initialized');
    }

    const now = timestampSec ?? (performance ? performance.now() / 1000 : Date.now() / 1000);
    const dt = this.lastTimestampSec !== null ? now - this.lastTimestampSec : 0.03333333;
    this.lastTimestampSec = now;

    const count = Math.min(this.numLandmarks, landmarks.length);
    for (let i = 0; i < count; i++) {
      const lm = landmarks[i];
      const base = i * COMPONENTS_PER_LANDMARK;
      this.memF32[base] = lm ? lm.x : 0;
      this.memF32[base + 1] = lm ? lm.y : 0;
      this.memF32[base + 2] = lm && lm.z !== undefined ? lm.z : 0;
      this.memF32[base + 3] = lm && lm.visibility !== undefined ? lm.visibility : 1.0;
    }

    this.wasmExports.smooth(
      dt,
      this.config.minCutoff,
      this.config.beta,
      this.config.dCutoff,
      count,
      0,
      this.config.minVisThreshold
    );

    const out: LandmarkPoint[] = new Array(count);
    const outOffset = 432;
    for (let i = 0; i < count; i++) {
      const base = outOffset + i * COMPONENTS_PER_LANDMARK;
      out[i] = {
        x: this.memF32[base],
        y: this.memF32[base + 1],
        z: this.memF32[base + 2],
        visibility: this.memF32[base + 3],
      };
    }
    return out;
  }
}

/**
 * WebGPU Compute Shader Acceleration Engine.
 * Compiles WGSL compute pipelines and executes parallel filtering directly on the GPU.
 */
export class WebGpuComputeEngine {
  private device: GPUDevice;
  private config: Required<FilterConfig>;
  private readonly numLandmarks: number;
  private pipeline: GPUComputePipeline | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private inBuffer: GPUBuffer | null = null;
  private stateXBuffer: GPUBuffer | null = null;
  private stateDxBuffer: GPUBuffer | null = null;
  private stateInitBuffer: GPUBuffer | null = null;
  private outBuffer: GPUBuffer | null = null;
  private stagingBuffer: GPUBuffer | null = null;
  private uniformHostData: ArrayBuffer;
  private uniformF32: Float32Array;
  private uniformU32: Uint32Array;
  private inputHostBuffer: Float32Array;
  private lastTimestampSec: number | null = null;
  private deviceLost = false;

  constructor(device: GPUDevice, config: FilterConfig = {}, numLandmarks = DEFAULT_NUM_LANDMARKS) {
    this.device = device;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.numLandmarks = numLandmarks;

    this.uniformHostData = new ArrayBuffer(UNIFORM_BUFFER_BYTES);
    this.uniformF32 = new Float32Array(this.uniformHostData);
    this.uniformU32 = new Uint32Array(this.uniformHostData);
    this.inputHostBuffer = new Float32Array(numLandmarks * COMPONENTS_PER_LANDMARK);

    // Watch for GPU device loss (e.g. background suspension on iOS Safari)
    if (this.device.lost) {
      this.device.lost.then(() => {
        this.deviceLost = true;
      }).catch(() => {
        this.deviceLost = true;
      });
    }
  }

  public async init(): Promise<void> {
    const shaderModule = this.device.createShaderModule({
      label: 'WorkoutVision_LandmarkFilter_ShaderModule',
      code: WGSL_LANDMARK_FILTER_SHADER,
    });

    this.pipeline = this.device.createComputePipeline({
      label: 'WorkoutVision_LandmarkFilter_Pipeline',
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'main',
      },
    });

    const storageBytes = this.numLandmarks * VEC4_STRIDE_BYTES;

    this.uniformBuffer = this.device.createBuffer({
      label: 'WV_FilterUniforms',
      size: UNIFORM_BUFFER_BYTES,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });

    this.inBuffer = this.device.createBuffer({
      label: 'WV_InLandmarks',
      size: storageBytes,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST,
    });

    this.stateXBuffer = this.device.createBuffer({
      label: 'WV_StateX',
      size: storageBytes,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST,
    });

    this.stateDxBuffer = this.device.createBuffer({
      label: 'WV_StateDx',
      size: storageBytes,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST,
    });

    this.stateInitBuffer = this.device.createBuffer({
      label: 'WV_StateInit',
      size: STATE_INIT_BUFFER_BYTES,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST,
    });

    this.outBuffer = this.device.createBuffer({
      label: 'WV_OutLandmarks',
      size: storageBytes,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_SRC,
    });

    this.stagingBuffer = this.device.createBuffer({
      label: 'WV_StagingReadback',
      size: storageBytes,
      usage: GPU_BUFFER_USAGE.MAP_READ | GPU_BUFFER_USAGE.COPY_DST,
    });

    this.bindGroup = this.device.createBindGroup({
      label: 'WV_FilterBindGroup',
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: { buffer: this.inBuffer } },
        { binding: 2, resource: { buffer: this.stateXBuffer } },
        { binding: 3, resource: { buffer: this.stateDxBuffer } },
        { binding: 4, resource: { buffer: this.stateInitBuffer } },
        { binding: 5, resource: { buffer: this.outBuffer } },
      ],
    });
  }

  public isHealthy(): boolean {
    return !this.deviceLost && this.pipeline !== null && this.bindGroup !== null;
  }

  public setConfig(config: FilterConfig): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): Required<FilterConfig> {
    return { ...this.config };
  }

  public getOutputGpuBuffer(): GPUBuffer | null {
    return this.outBuffer;
  }

  public reset(): void {
    if (!this.isHealthy() || !this.stateInitBuffer) return;
    const zeros = new Uint8Array(STATE_INIT_BUFFER_BYTES);
    this.device.queue.writeBuffer(this.stateInitBuffer, 0, zeros);
    this.lastTimestampSec = null;
  }

  public async filterFloat32(input: Float32Array, dt: number, doReset = false): Promise<Float32Array> {
    if (!this.isHealthy() || !this.pipeline || !this.bindGroup || !this.uniformBuffer || !this.inBuffer || !this.outBuffer || !this.stagingBuffer) {
      throw new Error('WebGpuComputeEngine pipeline not initialized or device lost');
    }

    const storageBytes = this.numLandmarks * VEC4_STRIDE_BYTES;

    // Pack uniform buffer data:
    // [0]: minCutoff (f32), [1]: beta (f32), [2]: dCutoff (f32), [3]: dt (f32)
    // [4]: numLandmarks (u32), [5]: resetState (u32), [6]: minVisThreshold (f32), [7]: padding (u32)
    this.uniformF32[0] = this.config.minCutoff;
    this.uniformF32[1] = this.config.beta;
    this.uniformF32[2] = this.config.dCutoff;
    this.uniformF32[3] = dt;
    this.uniformU32[4] = this.numLandmarks;
    this.uniformU32[5] = doReset ? 1 : 0;
    this.uniformF32[6] = this.config.minVisThreshold;
    this.uniformU32[7] = 0;

    // Write uniform and input buffer to GPU
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformHostData);
    this.device.queue.writeBuffer(this.inBuffer, 0, input.buffer, input.byteOffset, Math.min(input.byteLength, storageBytes));

    // Record compute commands
    const commandEncoder = this.device.createCommandEncoder({ label: 'WV_FilterEncoder' });
    const computePass = commandEncoder.beginComputePass({ label: 'WV_FilterComputePass' });
    computePass.setPipeline(this.pipeline);
    computePass.setBindGroup(0, this.bindGroup);
    // Workgroup size 64 -> 1 workgroup covers all 33 landmarks
    const workgroupCount = Math.ceil(this.numLandmarks / 64);
    computePass.dispatchWorkgroups(workgroupCount);
    computePass.end();

    // Copy computed results to staging buffer for CPU readback
    commandEncoder.copyBufferToBuffer(this.outBuffer, 0, this.stagingBuffer, 0, storageBytes);
    this.device.queue.submit([commandEncoder.finish()]);

    // Map staging buffer back to host memory
    await this.stagingBuffer.mapAsync(GPU_MAP_MODE.READ, 0, storageBytes);
    const copyArray = new Float32Array(this.stagingBuffer.getMappedRange(0, storageBytes)).slice();
    this.stagingBuffer.unmap();

    return copyArray;
  }

  public async filterLandmarks(landmarks: LandmarkPoint[], timestampSec?: number): Promise<LandmarkPoint[]> {
    const now = timestampSec ?? (performance ? performance.now() / 1000 : Date.now() / 1000);
    const dt = this.lastTimestampSec !== null ? now - this.lastTimestampSec : 0.03333333;
    this.lastTimestampSec = now;

    const count = Math.min(this.numLandmarks, landmarks.length);
    for (let i = 0; i < count; i++) {
      const lm = landmarks[i];
      const base = i * COMPONENTS_PER_LANDMARK;
      this.inputHostBuffer[base] = lm ? lm.x : 0;
      this.inputHostBuffer[base + 1] = lm ? lm.y : 0;
      this.inputHostBuffer[base + 2] = lm && lm.z !== undefined ? lm.z : 0;
      this.inputHostBuffer[base + 3] = lm && lm.visibility !== undefined ? lm.visibility : 1.0;
    }

    const smoothedArray = await this.filterFloat32(this.inputHostBuffer, dt);

    const out: LandmarkPoint[] = new Array(count);
    for (let i = 0; i < count; i++) {
      const base = i * COMPONENTS_PER_LANDMARK;
      out[i] = {
        x: smoothedArray[base],
        y: smoothedArray[base + 1],
        z: smoothedArray[base + 2],
        visibility: smoothedArray[base + 3],
      };
    }
    return out;
  }

  public destroy(): void {
    if (this.uniformBuffer) this.uniformBuffer.destroy();
    if (this.inBuffer) this.inBuffer.destroy();
    if (this.stateXBuffer) this.stateXBuffer.destroy();
    if (this.stateDxBuffer) this.stateDxBuffer.destroy();
    if (this.stateInitBuffer) this.stateInitBuffer.destroy();
    if (this.outBuffer) this.outBuffer.destroy();
    if (this.stagingBuffer) this.stagingBuffer.destroy();

    this.uniformBuffer = null;
    this.inBuffer = null;
    this.stateXBuffer = null;
    this.stateDxBuffer = null;
    this.stateInitBuffer = null;
    this.outBuffer = null;
    this.stagingBuffer = null;
    this.pipeline = null;
    this.bindGroup = null;
  }
}

// ─── UNIFIED PIPELINE ORCHESTRATOR ─────────────────────────────────────────────

/**
 * Checks whether WebGPU is supported in the current environment.
 */
export async function isWebGpuSupported(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/**
 * Checks whether WebAssembly is supported in the current environment.
 */
export function isWebAssemblySupported(): boolean {
  if (typeof WebAssembly === 'undefined' || !WebAssembly.validate) return false;
  try {
    return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
  } catch {
    return false;
  }
}

/**
 * Master Pipeline Orchestrator for Landmark Smoothing Acceleration.
 * Automatically selects WebGPU -> WebAssembly -> CPU, managing memory and fallbacks.
 */
export class WebGpuLandmarkPipeline {
  private backend: AccelerationBackend = 'cpu';
  private gpuEngine: WebGpuComputeEngine | null = null;
  private wasmEngine: WebAssemblyLandmarkFilter | null = null;
  private cpuEngine: CpuLandmarkFilter;
  private config: Required<FilterConfig>;
  private readonly numLandmarks: number;
  private options: PipelineOptions;

  private constructor(options: PipelineOptions = {}) {
    this.options = options;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.numLandmarks = options.numLandmarks ?? DEFAULT_NUM_LANDMARKS;
    this.cpuEngine = new CpuLandmarkFilter(this.config, this.numLandmarks);
  }

  /**
   * Asynchronous factory that instantiates and initializes the optimal acceleration pipeline.
   */
  public static async create(options: PipelineOptions = {}): Promise<WebGpuLandmarkPipeline> {
    const pipeline = new WebGpuLandmarkPipeline(options);
    await pipeline.init();
    return pipeline;
  }

  /**
   * Initializes the pipeline and selects the optimal acceleration backend.
   */
  public async init(): Promise<AccelerationBackend> {
    const preferred = this.options.preferredBackend ?? 'auto';

    // 1. Try WebGPU if requested or auto
    if (preferred === 'auto' || preferred === 'webgpu') {
      try {
        let device = this.options.customDevice;
        if (!device && typeof navigator !== 'undefined' && navigator.gpu) {
          const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
          if (adapter) {
            device = await adapter.requestDevice();
          }
        }

        if (device) {
          const gpu = new WebGpuComputeEngine(device, this.config, this.numLandmarks);
          await gpu.init();
          this.gpuEngine = gpu;
          this.backend = 'webgpu';
          return 'webgpu';
        }
      } catch {
        // Fall through to WASM
      }
    }

    // 2. Try WebAssembly if requested or fallback
    if (preferred === 'auto' || preferred === 'wasm' || preferred === 'webgpu') {
      try {
        if (isWebAssemblySupported()) {
          const wasm = new WebAssemblyLandmarkFilter(this.config, this.numLandmarks);
          if (wasm.init()) {
            this.wasmEngine = wasm;
            this.backend = 'wasm';
            return 'wasm';
          }
        }
      } catch {
        // Fall through to CPU
      }
    }

    // 3. Fall back to pure TypedArray CPU engine
    this.backend = 'cpu';
    return 'cpu';
  }

  public getBackend(): AccelerationBackend {
    return this.backend;
  }

  public isGpuAccelerated(): boolean {
    return this.backend === 'webgpu';
  }

  public setConfig(config: FilterConfig): void {
    this.config = { ...this.config, ...config };
    if (this.gpuEngine) this.gpuEngine.setConfig(this.config);
    if (this.wasmEngine) this.wasmEngine.setConfig(this.config);
    this.cpuEngine.setConfig(this.config);
  }

  public getConfig(): Required<FilterConfig> {
    return { ...this.config };
  }

  public getBufferLayout(): BufferLayoutSpecification {
    return BUFFER_LAYOUT_SPEC;
  }

  public getOutputGpuBuffer(): GPUBuffer | null {
    if (this.gpuEngine && this.backend === 'webgpu') {
      return this.gpuEngine.getOutputGpuBuffer();
    }
    return null;
  }

  public reset(): void {
    if (this.gpuEngine && this.backend === 'webgpu') {
      this.gpuEngine.reset();
    }
    if (this.wasmEngine && this.backend === 'wasm') {
      this.wasmEngine.reset();
    }
    this.cpuEngine.reset();
  }

  /**
   * Smooths an incoming frame of MediaPipe landmarks.
   * Gracefully degrades to WASM/CPU if GPU execution throws or device is lost.
   */
  public async smoothLandmarks(landmarks: LandmarkPoint[], timestampSec?: number): Promise<LandmarkPoint[]> {
    if (!landmarks || landmarks.length === 0) return [];

    if (this.backend === 'webgpu' && this.gpuEngine) {
      try {
        if (this.gpuEngine.isHealthy()) {
          return await this.gpuEngine.filterLandmarks(landmarks, timestampSec);
        }
        // GPU device lost: trigger transparent fallback
        await this.fallbackFromGpu();
      } catch {
        await this.fallbackFromGpu();
      }
    }

    if (this.backend === 'wasm' && this.wasmEngine) {
      try {
        return this.wasmEngine.filterLandmarks(landmarks, timestampSec);
      } catch {
        this.backend = 'cpu';
      }
    }

    return this.cpuEngine.filterLandmarks(landmarks, timestampSec);
  }

  /**
   * Smooths raw float data directly (e.g. 132-float array).
   */
  public async smoothFloat32(buffer: Float32Array, dt = 0.03333333): Promise<Float32Array> {
    if (!buffer || buffer.length === 0) return new Float32Array(0);

    if (this.backend === 'webgpu' && this.gpuEngine) {
      try {
        if (this.gpuEngine.isHealthy()) {
          return await this.gpuEngine.filterFloat32(buffer, dt);
        }
        await this.fallbackFromGpu();
      } catch {
        await this.fallbackFromGpu();
      }
    }

    if (this.backend === 'wasm' && this.wasmEngine) {
      try {
        return this.wasmEngine.filterFloat32(buffer, dt);
      } catch {
        this.backend = 'cpu';
      }
    }

    return this.cpuEngine.filterFloat32(buffer, dt);
  }

  /**
   * Batch-processes an array of landmark frames (e.g. for post-processing or video replay).
   */
  public async smoothBatch(frames: LandmarkPoint[][], timestampsSec?: number[]): Promise<LandmarkPoint[][]> {
    const results: LandmarkPoint[][] = [];
    for (let i = 0; i < frames.length; i++) {
      const ts = timestampsSec && timestampsSec[i] !== undefined ? timestampsSec[i] : undefined;
      const smoothed = await this.smoothLandmarks(frames[i], ts);
      results.push(smoothed);
    }
    return results;
  }

  private async fallbackFromGpu(): Promise<void> {
    if (isWebAssemblySupported()) {
      const wasm = new WebAssemblyLandmarkFilter(this.config, this.numLandmarks);
      if (wasm.init()) {
        this.wasmEngine = wasm;
        this.backend = 'wasm';
        return;
      }
    }
    this.backend = 'cpu';
  }

  public destroy(): void {
    if (this.gpuEngine) {
      this.gpuEngine.destroy();
      this.gpuEngine = null;
    }
    this.wasmEngine = null;
    this.cpuEngine.reset();
  }
}
