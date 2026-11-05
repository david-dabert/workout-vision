import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectCapabilities,
  selectOptimalBackend,
  createInferenceBackend,
  CpuInferenceBackend,
  WasmSimdInferenceBackend,
  WebGpuInferenceBackend,
} from '../inferenceBackend';

describe('InferenceBackend Abstraction', () => {
  describe('detectCapabilities', () => {
    it('returns capability report without throwing in standard and headless environments', async () => {
      const caps = await detectCapabilities();
      expect(typeof caps.webgpu).toBe('boolean');
      expect(typeof caps.webnn).toBe('boolean');
      expect(typeof caps.wasmSimd).toBe('boolean');
      expect(typeof caps.wasmThreads).toBe('boolean');
      expect(typeof caps.webgl2).toBe('boolean');
    });
  });

  describe('selectOptimalBackend', () => {
    it('defaults to wasm_simd or cpu when WebGPU is unavailable', async () => {
      const backend = await selectOptimalBackend();
      expect(['webgpu', 'wasm_simd', 'wasm', 'webgl', 'cpu']).toContain(backend);
    });

    it('honors preferred backend if supported by hardware capabilities', async () => {
      const cpu = await selectOptimalBackend('cpu');
      expect(cpu).toBe('cpu');
    });
  });

  describe('CpuInferenceBackend', () => {
    it('implements InferenceBackend interface correctly', async () => {
      const backend = new CpuInferenceBackend();
      expect(backend.type).toBe('cpu');
      expect(backend.name).toBe('CPU Reference Fallback');
      expect(await backend.isSupported()).toBe(true);
      await expect(backend.init()).resolves.toBeUndefined();
      
      const bench = await backend.benchmark(100);
      expect(bench.supported).toBe(true);
      expect(bench.operationsPerSec).toBeGreaterThan(0);
      expect(bench.latencyMs).toBeGreaterThanOrEqual(0);
      await expect(backend.dispose()).resolves.toBeUndefined();
    });
  });

  describe('WasmSimdInferenceBackend', () => {
    it('implements InferenceBackend interface and benchmark', async () => {
      const backend = new WasmSimdInferenceBackend();
      expect(backend.type).toBe('wasm_simd');
      expect(backend.name).toBe('WebAssembly Vector Acceleration (SIMD-128)');
      const supported = await backend.isSupported();
      expect(typeof supported).toBe('boolean');

      if (supported) {
        await backend.init();
        const bench = await backend.benchmark(100);
        expect(bench.supported).toBe(true);
        expect(bench.operationsPerSec).toBeGreaterThan(0);
        await backend.dispose();
      }
    });
  });

  describe('WebGpuInferenceBackend', () => {
    it('gracefully reports support state and handles missing WebGPU context', async () => {
      const backend = new WebGpuInferenceBackend();
      expect(backend.type).toBe('webgpu');
      expect(backend.name).toBe('WebGPU Compute Pipeline');
      const supported = await backend.isSupported();
      expect(typeof supported).toBe('boolean');

      if (!supported) {
        const bench = await backend.benchmark(10);
        expect(bench.supported).toBe(false);
      }
    });
  });

  describe('createInferenceBackend', () => {
    it('creates appropriate backend instance based on preference and capabilities', async () => {
      const cpuBackend = await createInferenceBackend('cpu');
      expect(cpuBackend).toBeInstanceOf(CpuInferenceBackend);
      expect(cpuBackend.type).toBe('cpu');

      const defaultBackend = await createInferenceBackend();
      expect(defaultBackend).toBeDefined();
      expect(['webgpu', 'wasm_simd', 'cpu']).toContain(defaultBackend.type);
    });
  });
});
