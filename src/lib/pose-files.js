// The files an analysis needs before its first sample: the pose model and the pose library's WASM, the variant the
// library picks (FilesetResolver.forVisionTasks: SIMD where the browser has it). Fetched when an exercise is chosen,
// so the service worker keeps them and a first analysis made offline can start (audit of 3 October).

// The smallest module using a SIMD instruction: the library's own test of SIMD support.
const SIMD_PROBE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
export function simdSupported() {
  try { return WebAssembly.validate(SIMD_PROBE); } catch { return false; }
}

export function poseFiles(base, simd) {
  const v = simd ? 'vision_wasm_internal' : 'vision_wasm_nosimd_internal';
  return [`${base}mediapipe/pose_landmarker_full.task`, `${base}mediapipe/${v}.js`, `${base}mediapipe/${v}.wasm`];
}

/** Fetched once each, through the service worker, which keeps them; a failure costs nothing now. */
export function warmPoseFiles(base) {
  for (const url of poseFiles(base, simdSupported())) fetch(url).catch(() => {});
}
