import { describe, it, expect } from 'vitest';
import { basename } from 'path';

// Unit tests for copy-models filtering rules (Card 049)
describe('copy-models filter', () => {
  const isKept = (srcPath) => !basename(srcPath).startsWith('vision_wasm_module_internal');

  it('filters out unused MediaPipe module WASM and JS', () => {
    expect(isKept('/node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_module_internal.wasm')).toBe(false);
    expect(isKept('/node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_module_internal.js')).toBe(false);
    expect(isKept('vision_wasm_module_internal.wasm')).toBe(false);
  });

  it('preserves active SIMD and non-SIMD runtime assets', () => {
    expect(isKept('/node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm')).toBe(true);
    expect(isKept('/node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js')).toBe(true);
    expect(isKept('/node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.wasm')).toBe(true);
    expect(isKept('/node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_nosimd_internal.js')).toBe(true);
    expect(isKept('/public/models/pose_landmarker_full.task')).toBe(true);
  });

  it('does not falsely filter paths where parent directory matches but basename does not', () => {
    expect(isKept('/path/to/vision_wasm_module_internal_dir/vision_wasm_internal.wasm')).toBe(true);
  });
});
