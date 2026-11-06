import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LandmarkPoint,
  FilterConfig,
  UNIFORM_LAYOUT,
  BUFFER_LAYOUT_SPEC,
  DEFAULT_NUM_LANDMARKS,
  COMPONENTS_PER_LANDMARK,
  TOTAL_STORAGE_BYTES,
  UNIFORM_BUFFER_BYTES,
  STATE_INIT_BUFFER_BYTES,
  GPU_BUFFER_USAGE,
  GPU_MAP_MODE,
  WGSL_LANDMARK_FILTER_SHADER,
  buildWasmLandmarkFilterBinary,
  createWasmFilterModule,
  CpuLandmarkFilter,
  WebAssemblyLandmarkFilter,
  WebGpuLandmarkPipeline,
  isWebGpuSupported,
  isWebAssemblySupported,
} from '../webgpuComputeShader';

describe('WorkoutVision WebGPU Compute Acceleration Pipeline', () => {
  // ─── 1. BUFFER LAYOUT & MEMORY SPECIFICATION ─────────────────────────────────

  describe('Buffer Layout Specification', () => {
    it('enforces 16-byte alignment and exact byte lengths for WebGPU uniforms', () => {
      expect(UNIFORM_BUFFER_BYTES).toBe(32);
      expect(UNIFORM_LAYOUT.byteLength).toBe(32);
      expect(UNIFORM_LAYOUT.byteLength % 16).toBe(0);

      expect(UNIFORM_LAYOUT.minCutoffOffset).toBe(0);
      expect(UNIFORM_LAYOUT.betaOffset).toBe(4);
      expect(UNIFORM_LAYOUT.dCutoffOffset).toBe(8);
      expect(UNIFORM_LAYOUT.dtOffset).toBe(12);
      expect(UNIFORM_LAYOUT.numLandmarksOffset).toBe(16);
      expect(UNIFORM_LAYOUT.resetStateOffset).toBe(20);
      expect(UNIFORM_LAYOUT.minVisThresholdOffset).toBe(24);
      expect(UNIFORM_LAYOUT.paddingOffset).toBe(28);
    });

    it('enforces 33-point MediaPipe pose layout with vec4<f32> 16-byte stride', () => {
      expect(DEFAULT_NUM_LANDMARKS).toBe(33);
      expect(COMPONENTS_PER_LANDMARK).toBe(4); // x, y, z, visibility
      expect(TOTAL_STORAGE_BYTES).toBe(528); // 33 * 4 * 4 bytes
      expect(TOTAL_STORAGE_BYTES % 16).toBe(0); // std140/std430 16-byte vec4 alignment

      expect(BUFFER_LAYOUT_SPEC.numLandmarks).toBe(33);
      expect(BUFFER_LAYOUT_SPEC.float32Count).toBe(132);
      expect(BUFFER_LAYOUT_SPEC.byteLength).toBe(528);
      expect(BUFFER_LAYOUT_SPEC.storageBufferBytes).toBe(528);
      expect(BUFFER_LAYOUT_SPEC.stateInitBufferBytes).toBe(STATE_INIT_BUFFER_BYTES);
      expect(STATE_INIT_BUFFER_BYTES % 16).toBe(0);
      expect(STATE_INIT_BUFFER_BYTES).toBeGreaterThanOrEqual(33 * 4);
    });

    it('defines standard WebGPU buffer usage bitmasks accurately', () => {
      expect(GPU_BUFFER_USAGE.MAP_READ).toBe(0x0001);
      expect(GPU_BUFFER_USAGE.COPY_SRC).toBe(0x0004);
      expect(GPU_BUFFER_USAGE.COPY_DST).toBe(0x0008);
      expect(GPU_BUFFER_USAGE.UNIFORM).toBe(0x0040);
      expect(GPU_BUFFER_USAGE.STORAGE).toBe(0x0080);
      expect(GPU_MAP_MODE.READ).toBe(0x0001);
      expect(GPU_MAP_MODE.WRITE).toBe(0x0002);
    });
  });

  // ─── 2. WGSL COMPUTE SHADER CODE INTEGRITY ───────────────────────────────────

  describe('WGSL Compute Shader', () => {
    it('contains valid WGSL compute entry point and binding signatures', () => {
      expect(WGSL_LANDMARK_FILTER_SHADER).toContain('@compute @workgroup_size(64, 1, 1)');
      expect(WGSL_LANDMARK_FILTER_SHADER).toContain('fn main(@builtin(global_invocation_id)');
      expect(WGSL_LANDMARK_FILTER_SHADER).toContain('@group(0) @binding(0) var<uniform> uniforms: FilterUniforms;');
      expect(WGSL_LANDMARK_FILTER_SHADER).toContain('@group(0) @binding(1) var<storage, read> inLandmarks: array<vec4<f32>>;');
      expect(WGSL_LANDMARK_FILTER_SHADER).toContain('@group(0) @binding(2) var<storage, read_write> stateX: array<vec4<f32>>;');
      expect(WGSL_LANDMARK_FILTER_SHADER).toContain('@group(0) @binding(3) var<storage, read_write> stateDx: array<vec4<f32>>;');
      expect(WGSL_LANDMARK_FILTER_SHADER).toContain('@group(0) @binding(4) var<storage, read_write> stateInit: array<u32>;');
      expect(WGSL_LANDMARK_FILTER_SHADER).toContain('@group(0) @binding(5) var<storage, read_write> outLandmarks: array<vec4<f32>>;');
    });

    it('implements adaptive One-Euro speed cutoff and visibility gating in WGSL', () => {
      expect(WGSL_LANDMARK_FILTER_SHADER).toContain('uniforms.minCutoff + uniforms.beta * speed');
      expect(WGSL_LANDMARK_FILTER_SHADER).toContain('computeAlpha(rate, uniforms.dCutoff)');
      expect(WGSL_LANDMARK_FILTER_SHADER).toContain('if (visibility < uniforms.minVisThreshold)');
      expect(WGSL_LANDMARK_FILTER_SHADER).toContain('if (isInit == 0u || doReset != 0u)');
    });
  });

  // ─── 3. WEBASSEMBLY COMPILED ENGINE ──────────────────────────────────────────

  describe('WebAssembly Compiled Engine (Zero Dependencies)', () => {
    it('synthesizes a valid WebAssembly binary with magic header', () => {
      const bytes = buildWasmLandmarkFilterBinary();
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(100);
      // \0asm header: 0x00, 0x61, 0x73, 0x6d
      expect(bytes[0]).toBe(0x00);
      expect(bytes[1]).toBe(0x61);
      expect(bytes[2]).toBe(0x73);
      expect(bytes[3]).toBe(0x6d);
      // Wasm version 1: 0x01, 0x00, 0x00, 0x00
      expect(bytes[4]).toBe(0x01);
      expect(bytes[5]).toBe(0x00);
      expect(bytes[6]).toBe(0x00);
      expect(bytes[7]).toBe(0x00);
    });

    it('compiles and instantiates the Wasm module with memory and smooth exports', () => {
      const { instance, exports } = createWasmFilterModule();
      expect(instance).toBeDefined();
      expect(exports.memory).toBeInstanceOf(WebAssembly.Memory);
      expect(typeof exports.smooth).toBe('function');
    });

    it('smooths 33 landmarks with initial pass-through and subsequent jitter reduction', () => {
      const wasm = new WebAssemblyLandmarkFilter({ minCutoff: 1.5, beta: 0.01 });
      expect(wasm.init()).toBe(true);

      const frame1: LandmarkPoint[] = Array.from({ length: 33 }, (_, i) => ({
        x: 0.5 + i * 0.01,
        y: 0.4 + i * 0.01,
        z: -0.1,
        visibility: 0.95,
      }));

      // Frame 1 initializes state: output must exactly equal input without lag
      const out1 = wasm.filterLandmarks(frame1, 0.0);
      expect(out1.length).toBe(33);
      expect(out1[0].x).toBeCloseTo(frame1[0].x, 5);
      expect(out1[0].y).toBeCloseTo(frame1[0].y, 5);
      expect(out1[0].visibility).toBeCloseTo(0.95, 5);

      // Frame 2 with small jitter (e.g. +0.02)
      const frame2: LandmarkPoint[] = frame1.map(pt => ({
        ...pt,
        x: pt.x + 0.02,
        y: pt.y + 0.02,
      }));

      const out2 = wasm.filterLandmarks(frame2, 0.03333333);
      // Filtered position should be between frame 1 and frame 2 (jitter damped)
      expect(out2[0].x).toBeGreaterThan(frame1[0].x);
      expect(out2[0].x).toBeLessThan(frame2[0].x);
      expect(out2[0].y).toBeGreaterThan(frame1[0].y);
      expect(out2[0].y).toBeLessThan(frame2[0].y);
    });

    it('adapts cutoff frequency for explosive movements to eliminate phase lag', () => {
      const wasm = new WebAssemblyLandmarkFilter({ minCutoff: 1.0, beta: 0.1 });
      wasm.init();

      const staticFrame: LandmarkPoint[] = [{ x: 10.0, y: 10.0, z: 0.0, visibility: 0.9 }];
      wasm.filterLandmarks(staticFrame, 0.0);

      // Rapid jump of +10 units in 33ms (~300 units/sec)
      const fastFrame: LandmarkPoint[] = [{ x: 20.0, y: 10.0, z: 0.0, visibility: 0.9 }];
      const outFast = wasm.filterLandmarks(fastFrame, 0.03333333);

      // With beta = 0.1 and explosive speed, alpha rises sharply towards 1.0
      expect(outFast[0].x).toBeGreaterThan(15.0);
    });

    it('passes low-visibility landmarks through raw without corrupting motion history', () => {
      const wasm = new WebAssemblyLandmarkFilter({ minVisThreshold: 0.2 });
      wasm.init();

      const validFrame: LandmarkPoint[] = [{ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }];
      wasm.filterLandmarks(validFrame, 0.0);

      // Low visibility frame (e.g. occluded arm, visibility = 0.05)
      const occludedFrame: LandmarkPoint[] = [{ x: 0.9, y: 0.9, z: 0, visibility: 0.05 }];
      const out = wasm.filterLandmarks(occludedFrame, 0.03333333);

      // Low visibility passes raw through
      expect(out[0].x).toBeCloseTo(0.9, 5);
      expect(out[0].y).toBeCloseTo(0.9, 5);
      expect(out[0].visibility).toBeCloseTo(0.05, 5);
    });

    it('resets state cleanly when requested', () => {
      const wasm = new WebAssemblyLandmarkFilter();
      wasm.init();

      wasm.filterLandmarks([{ x: 1.0, y: 1.0, z: 0, visibility: 0.9 }], 0.0);
      wasm.filterLandmarks([{ x: 2.0, y: 2.0, z: 0, visibility: 0.9 }], 0.033);

      wasm.reset();

      // After reset, next sample initializes freshly
      const fresh = wasm.filterLandmarks([{ x: 10.0, y: 10.0, z: 0, visibility: 0.9 }], 0.1);
      expect(fresh[0].x).toBeCloseTo(10.0, 5);
      expect(fresh[0].y).toBeCloseTo(10.0, 5);
    });
  });

  // ─── 4. CPU FALLBACK & MATHEMATICAL PARITY ────────────────────────────────────

  describe('CPU Fallback & Mathematical Parity', () => {
    it('produces identical outputs between CPU and WebAssembly backends', () => {
      const config: FilterConfig = { minCutoff: 1.7, beta: 0.015, dCutoff: 1.2 };
      const cpu = new CpuLandmarkFilter(config);
      const wasm = new WebAssemblyLandmarkFilter(config);
      wasm.init();

      const rawInput = new Float32Array(33 * 4);
      for (let i = 0; i < 33; i++) {
        rawInput[i * 4] = 0.2 + i * 0.01;
        rawInput[i * 4 + 1] = 0.3 + i * 0.01;
        rawInput[i * 4 + 2] = -0.05;
        rawInput[i * 4 + 3] = 0.85;
      }

      // Pass 1: Initialization
      const cpuOut1 = cpu.filterFloat32(rawInput, 0.03333333);
      const wasmOut1 = wasm.filterFloat32(rawInput, 0.03333333);

      for (let j = 0; j < 33 * 4; j++) {
        expect(cpuOut1[j]).toBeCloseTo(wasmOut1[j], 4);
      }

      // Pass 2: Movement
      for (let i = 0; i < 33; i++) {
        rawInput[i * 4] += 0.05;
        rawInput[i * 4 + 1] += 0.03;
      }

      const cpuOut2 = cpu.filterFloat32(rawInput, 0.03333333);
      const wasmOut2 = wasm.filterFloat32(rawInput, 0.03333333);

      for (let j = 0; j < 33 * 4; j++) {
        expect(cpuOut2[j]).toBeCloseTo(wasmOut2[j], 4);
      }
    });

    it('handles zero or negative dt gracefully without division by zero', () => {
      const cpu = new CpuLandmarkFilter();
      const input = new Float32Array([1.0, 2.0, 3.0, 0.9]);
      cpu.filterFloat32(input, 0.0);
      const res = cpu.filterFloat32(input, -0.01);
      expect(Number.isFinite(res[0])).toBe(true);
      expect(Number.isFinite(res[1])).toBe(true);
    });
  });

  // ─── 5. WEBGPU PIPELINE INITIALIZATION & FALLBACK PATHS ───────────────────────

  describe('WebGpuLandmarkPipeline Backend Selection & Fallbacks', () => {
    let originalNavigator: unknown;

    beforeEach(() => {
      originalNavigator = globalThis.navigator;
    });

    afterEach(() => {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    });

    it('falls back to WebAssembly when navigator.gpu is undefined (older iOS Safari)', async () => {
      // In standard Node/Vitest, navigator.gpu is undefined
      const pipeline = await WebGpuLandmarkPipeline.create({ preferredBackend: 'auto' });
      expect(pipeline.getBackend()).toBe('wasm');
      expect(pipeline.isGpuAccelerated()).toBe(false);

      const input: LandmarkPoint[] = [{ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }];
      const out = await pipeline.smoothLandmarks(input, 0.0);
      expect(out.length).toBe(1);
      expect(out[0].x).toBeCloseTo(0.5, 5);
      pipeline.destroy();
    });

    it('honors preferredBackend: "cpu"', async () => {
      const pipeline = await WebGpuLandmarkPipeline.create({ preferredBackend: 'cpu' });
      expect(pipeline.getBackend()).toBe('cpu');
      expect(pipeline.isGpuAccelerated()).toBe(false);
      pipeline.destroy();
    });

    it('honors preferredBackend: "wasm"', async () => {
      const pipeline = await WebGpuLandmarkPipeline.create({ preferredBackend: 'wasm' });
      expect(pipeline.getBackend()).toBe('wasm');
      expect(pipeline.isGpuAccelerated()).toBe(false);
      pipeline.destroy();
    });

    it('falls back to WebAssembly when requestAdapter returns null', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          gpu: {
            requestAdapter: vi.fn().mockResolvedValue(null),
          },
        },
        configurable: true,
        writable: true,
      });

      const pipeline = await WebGpuLandmarkPipeline.create({ preferredBackend: 'webgpu' });
      expect(pipeline.getBackend()).toBe('wasm');
      pipeline.destroy();
    });

    it('falls back to WebAssembly when adapter.requestDevice throws', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          gpu: {
            requestAdapter: vi.fn().mockResolvedValue({
              requestDevice: vi.fn().mockRejectedValue(new Error('GPU device allocation failed')),
            }),
          },
        },
        configurable: true,
        writable: true,
      });

      const pipeline = await WebGpuLandmarkPipeline.create({ preferredBackend: 'webgpu' });
      expect(pipeline.getBackend()).toBe('wasm');
      pipeline.destroy();
    });

    it('falls back to CPU when both WebGPU and WebAssembly fail', async () => {
      // Force Wasm check to fail
      const originalValidate = WebAssembly.validate;
      try {
        (WebAssembly as { validate?: unknown }).validate = () => false;

        const pipeline = await WebGpuLandmarkPipeline.create({ preferredBackend: 'auto' });
        expect(pipeline.getBackend()).toBe('cpu');
        pipeline.destroy();
      } finally {
        WebAssembly.validate = originalValidate;
      }
    });
  });

  // ─── 6. WEBGPU MOCK DEVICE & COMPUTE PIPELINE ────────────────────────────────

  describe('WebGpuComputeEngine with Mock GPUDevice', () => {
    function createMockGpuDevice() {
      const writtenBuffers: { buffer: unknown; offset: number; data: unknown }[] = [];
      const submittedCommands: unknown[] = [];

      const mockBuffer = {
        destroy: vi.fn(),
        mapAsync: vi.fn().mockResolvedValue(undefined),
        getMappedRange: vi.fn().mockReturnValue(new ArrayBuffer(TOTAL_STORAGE_BYTES)),
        unmap: vi.fn(),
      };

      const mockPass = {
        setPipeline: vi.fn(),
        setBindGroup: vi.fn(),
        dispatchWorkgroups: vi.fn(),
        end: vi.fn(),
      };

      const mockEncoder = {
        beginComputePass: vi.fn().mockReturnValue(mockPass),
        copyBufferToBuffer: vi.fn(),
        finish: vi.fn().mockReturnValue({ __commandBuffer: true }),
      };

      const mockDevice = {
        lost: new Promise<{ reason: string; message: string }>(() => {}),
        createShaderModule: vi.fn().mockReturnValue({ __module: true }),
        createComputePipeline: vi.fn().mockReturnValue({
          getBindGroupLayout: vi.fn().mockReturnValue({ __layout: true }),
        }),
        createBuffer: vi.fn().mockImplementation((desc: { label: string; size: number; usage: number }) => ({
          ...mockBuffer,
          label: desc.label,
          size: desc.size,
          usage: desc.usage,
        })),
        createBindGroup: vi.fn().mockReturnValue({ __bindGroup: true }),
        createCommandEncoder: vi.fn().mockReturnValue(mockEncoder),
        queue: {
          writeBuffer: vi.fn().mockImplementation((buf: unknown, offset: number, data: unknown) => {
            writtenBuffers.push({ buffer: buf, offset, data });
          }),
          submit: vi.fn().mockImplementation((cmds: unknown[]) => {
            submittedCommands.push(...cmds);
          }),
        },
      };

      return { mockDevice, mockBuffer, mockPass, mockEncoder, writtenBuffers, submittedCommands };
    }

    it('initializes WebGPU compute pipeline with correct buffer sizes and bindings', async () => {
      const { mockDevice, mockPass } = createMockGpuDevice();

      const pipeline = await WebGpuLandmarkPipeline.create({
        customDevice: mockDevice as unknown as GPUDevice,
      });

      expect(pipeline.getBackend()).toBe('webgpu');
      expect(pipeline.isGpuAccelerated()).toBe(true);

      // Verify shader module creation
      expect(mockDevice.createShaderModule).toHaveBeenCalledWith(
        expect.objectContaining({ code: WGSL_LANDMARK_FILTER_SHADER })
      );

      // Verify buffers created: 1 uniform (32B), 4 storage (528B), 1 stateInit (256B), 1 staging (528B)
      expect(mockDevice.createBuffer).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'WV_FilterUniforms', size: 32 })
      );
      expect(mockDevice.createBuffer).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'WV_InLandmarks', size: 528 })
      );
      expect(mockDevice.createBuffer).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'WV_StateInit', size: 256 })
      );
      expect(mockDevice.createBuffer).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'WV_StagingReadback', size: 528 })
      );

      // Execute a frame
      const landmarks: LandmarkPoint[] = Array.from({ length: 33 }, (_, i) => ({
        x: 0.1 * i,
        y: 0.2 * i,
        z: 0.0,
        visibility: 0.95,
      }));

      await pipeline.smoothLandmarks(landmarks, 0.0);

      // Compute pass should dispatch 1 workgroup of 64 threads (covering 33 landmarks)
      expect(mockPass.dispatchWorkgroups).toHaveBeenCalledWith(1);
      expect(mockPass.end).toHaveBeenCalled();

      // Exposes GPUBuffer for zero-copy downstream consumption
      const gpuBuffer = pipeline.getOutputGpuBuffer();
      expect(gpuBuffer).toBeDefined();

      pipeline.destroy();
    });

    it('falls back to WebAssembly if GPU device is lost during tracking session', async () => {
      let resolveLost: (info: { reason: string; message: string }) => void = () => {};
      const lostPromise = new Promise<{ reason: string; message: string }>((resolve) => {
        resolveLost = resolve;
      });

      const { mockDevice } = createMockGpuDevice();
      mockDevice.lost = lostPromise;

      const pipeline = await WebGpuLandmarkPipeline.create({
        customDevice: mockDevice as unknown as GPUDevice,
      });
      expect(pipeline.getBackend()).toBe('webgpu');

      // Simulate device loss (e.g. mobile Safari suspended tab)
      resolveLost({ reason: 'destroyed', message: 'GPU device was lost' });
      await new Promise(r => setTimeout(r, 10));

      // Next smoothing call should detect unhealthy GPU and fall back gracefully
      const landmarks: LandmarkPoint[] = [{ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }];
      const out = await pipeline.smoothLandmarks(landmarks, 0.033);

      expect(pipeline.getBackend()).toBe('wasm');
      expect(out.length).toBe(1);
      expect(out[0].x).toBeCloseTo(0.5, 4);

      pipeline.destroy();
    });
  });

  // ─── 7. BATCH SMOOTHING & LIFECYCLE ──────────────────────────────────────────

  describe('Batch Smoothing & Lifecycle', () => {
    it('processes batch frames sequentially with persistent kinematics', async () => {
      const pipeline = await WebGpuLandmarkPipeline.create({ preferredBackend: 'wasm' });

      const frames: LandmarkPoint[][] = [
        [{ x: 1.0, y: 1.0, z: 0.0, visibility: 0.95 }],
        [{ x: 1.05, y: 1.05, z: 0.0, visibility: 0.95 }],
        [{ x: 1.10, y: 1.10, z: 0.0, visibility: 0.95 }],
      ];
      const timestamps = [0.0, 0.033, 0.066];

      const smoothedBatch = await pipeline.smoothBatch(frames, timestamps);
      expect(smoothedBatch.length).toBe(3);
      expect(smoothedBatch[0][0].x).toBeCloseTo(1.0, 5);
      // Smoothed frames 1 and 2 exhibit dampening
      expect(smoothedBatch[1][0].x).toBeLessThan(1.05);
      expect(smoothedBatch[2][0].x).toBeLessThan(1.10);

      pipeline.destroy();
    });

    it('smooths raw Float32Array directly', async () => {
      const pipeline = await WebGpuLandmarkPipeline.create({ preferredBackend: 'wasm' });
      const raw = new Float32Array(33 * 4);
      raw[0] = 0.42; raw[1] = 0.88; raw[2] = 0.12; raw[3] = 0.99;

      const out = await pipeline.smoothFloat32(raw, 0.033);
      expect(out).toBeInstanceOf(Float32Array);
      expect(out[0]).toBeCloseTo(0.42, 5);
      expect(out[1]).toBeCloseTo(0.88, 5);
      expect(out[3]).toBeCloseTo(0.99, 5);

      pipeline.destroy();
    });

    it('dynamically updates configuration parameters', async () => {
      const pipeline = await WebGpuLandmarkPipeline.create({ preferredBackend: 'cpu' });
      expect(pipeline.getConfig().minCutoff).toBe(1.5);

      pipeline.setConfig({ minCutoff: 2.2, beta: 0.05 });
      expect(pipeline.getConfig().minCutoff).toBe(2.2);
      expect(pipeline.getConfig().beta).toBe(0.05);

      pipeline.destroy();
    });

    it('checks runtime support helpers correctly', async () => {
      expect(isWebAssemblySupported()).toBe(true);
      const gpuSup = await isWebGpuSupported();
      expect(typeof gpuSup).toBe('boolean');
    });
  });
});
