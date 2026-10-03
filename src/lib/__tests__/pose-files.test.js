// The pose library's WASM is fetched with the model when an exercise is chosen, so a first analysis made offline
// (filmed in a gym with no signal) finds it in the service worker's cache (audit of 3 October). The files fetched
// are the ones the library itself loads (FilesetResolver), with or without SIMD.
import { describe, expect, it } from 'vitest';
import { FilesetResolver } from '@mediapipe/tasks-vision';
import { poseFiles, simdSupported } from '../pose-files';

describe('the pose files warmed ahead', () => {
  it('are the files the library loads', async () => {
    const lib = await FilesetResolver.forVisionTasks('/b/mediapipe');
    expect(poseFiles('/b/', simdSupported())).toEqual(['/b/mediapipe/pose_landmarker_full.task', lib.wasmLoaderPath, lib.wasmBinaryPath]);
  });
  it('take the variant without SIMD where SIMD is missing', () => {
    expect(poseFiles('/b/', false)).toEqual(['/b/mediapipe/pose_landmarker_full.task', '/b/mediapipe/vision_wasm_nosimd_internal.js', '/b/mediapipe/vision_wasm_nosimd_internal.wasm']);
  });
});
