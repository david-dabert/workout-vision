import { describe, it, expect, vi } from 'vitest';
import {
  detectCapabilities,
  selectOptimalBackend,
  createInferenceBackend,
  CpuInferenceBackend,
  WasmSimdInferenceBackend,
  WebGpuInferenceBackend,
} from '../inferenceBackend';

describe('InferenceBackend Hardware Execution Pipeline', () => {
  it('detects runtime capabilities without throwing in any environment', async () => {
    const caps = await detectCapabilities();
    expect(typeof caps.webgpu).toBe('boolean');
    expect(typeof caps.webnn).toBe('boolean');
    expect(typeof caps.wasmSimd).toBe('boolean');
    expect(typeof caps.wasmThreads).toBe('boolean');
  });

  it('selects optimal backend gracefully degrading to CPU or Wasm when WebGPU is absent', async () => {
    const optimal = await selectOptimalBackend();
    expect(['webgpu', 'webnn', 'wasm_simd', 'webgl', 'wasm', 'cpu']).toContain(optimal);
  });

  it('CpuInferenceBackend initializes and benchmarks successfully', async () => {
    const cpu = new CpuInferenceBackend();
    expect(await cpu.isSupported()).toBe(true);
    await cpu.init();
    const bench = await cpu.benchmark(100);
    expect(bench.supported).toBe(true);
    expect(bench.operationsPerSec).toBeGreaterThan(0);
    expect(bench.latencyMs).toBeGreaterThanOrEqual(0);
    await cpu.dispose();
  });

  it('WasmSimdInferenceBackend checks SIMD availability and benchmarks if supported', async () => {
    const wasm = new WasmSimdInferenceBackend();
    const supported = await wasm.isSupported();
    expect(typeof supported).toBe('boolean');
    const bench = await wasm.benchmark(50);
    expect(typeof bench.supported).toBe('boolean');
  });

  it('WebGpuInferenceBackend gracefully reports unsupported on environments without WebGPU', async () => {
    const gpu = new WebGpuInferenceBackend();
    const supported = await gpu.isSupported();
    expect(typeof supported).toBe('boolean');
    if (!supported) {
      await expect(gpu.init()).rejects.toThrow();
    }
  });

  it('createInferenceBackend instantiates appropriate backend for preference', async () => {
    const backend = await createInferenceBackend('cpu');
    expect(backend.type).toBe('cpu');
    expect(backend.name).toContain('CPU');
  });
});
