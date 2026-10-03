// The pose library's WASM is fetched with the model when an exercise is chosen, so a first analysis made offline
// (filmed in a gym with no signal) finds it in the service worker's cache (audit of 3 October). The files fetched
// are the ones the library itself loads (FilesetResolver), with or without SIMD.
import { describe, expect, it, vi } from 'vitest';
import { FilesetResolver } from '@mediapipe/tasks-vision';
import { demuxerFile, poseFiles, simdSupported, warmPoseFiles } from '../pose-files';

describe('the pose files warmed ahead', () => {
  it('are the files the library loads', async () => {
    const lib = await FilesetResolver.forVisionTasks('/b/mediapipe');
    expect(poseFiles('/b/', simdSupported())).toEqual(['/b/mediapipe/pose_landmarker_full.task', lib.wasmLoaderPath, lib.wasmBinaryPath]);
  });
  it('take the variant without SIMD where SIMD is missing', () => {
    expect(poseFiles('/b/', false)).toEqual(['/b/mediapipe/pose_landmarker_full.task', '/b/mediapipe/vision_wasm_nosimd_internal.js', '/b/mediapipe/vision_wasm_nosimd_internal.wasm']);
  });
});

// The decoder's WASM is warmed too, at the address the decoder loads it from (frameExtractor.js), so a first analysis
// made offline decodes with WebCodecs, not the playback fallback (third audit, C15).
describe('the decoder WASM warmed ahead', () => {
  it('is fetched with the pose files, at the address the decoder loads', () => {
    const fetched = [];
    vi.stubGlobal('fetch', url => { fetched.push(url); return Promise.resolve(new Response('')); });
    try { warmPoseFiles('/b/'); } finally { vi.unstubAllGlobals(); }
    expect(fetched).toEqual([...poseFiles('/b/', simdSupported()), '/b/web-demuxer.wasm']);
    expect(new URL(demuxerFile('/b/'), 'https://a.test').href).toBe(new URL('web-demuxer.wasm', new URL('/b/', 'https://a.test')).href);
  });
});
