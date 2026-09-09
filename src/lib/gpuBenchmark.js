/**
 * GPU/WebNN Capability Detection and Benchmarking
 *
 * Detects available hardware acceleration backends, WASM SIMD support,
 * and runs micro-benchmarks to select the optimal inference path.
 *
 * MediaPipe's FilesetResolver auto-selects between SIMD (~11.15MB) and
 * non-SIMD (~10.48MB) WASM binaries. This module exposes that detection
 * so the UI can report it and delegate selection can be informed.
 */

// ─── WASM SIMD feature detection ───

/**
 * Detect WebAssembly SIMD support by validating a minimal SIMD module.
 * This is the same technique MediaPipe uses internally via FilesetResolver.
 * SIMD is supported on: Chrome 91+, Safari 16.4+, Firefox 89+,
 * Apple A12+ (iPhone XS/XR+), Snapdragon 855+, Exynos 990+.
 * @returns {boolean}
 */
function detectWasmSimd() {
  try {
    // Minimal WASM module that uses a v128 SIMD instruction (i32x4.splat)
    // If the engine supports SIMD, WebAssembly.validate returns true.
    return WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123,
      3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
    ]));
  } catch (_) {
    return false;
  }
}

// Cached result (immutable per page load)
let _simdSupported = null;

/**
 * @returns {boolean} Whether WASM SIMD is supported (cached after first call)
 */
export function isSimdSupported() {
  if (_simdSupported === null) _simdSupported = detectWasmSimd();
  return _simdSupported;
}

// ─── GPU renderers known to cause MediaPipe GPU delegate failures ───
// These produce silent hangs or incorrect results; force CPU delegate.
const GPU_DELEGATE_BLOCKLIST = [
  /SwiftShader/i,
  /llvmpipe/i,
  /Software Rasterizer/i,
  /Mali-4/i,          // Mali-400 series (very old ARM GPU)
  /Adreno\s[23]\d{2}/i, // Adreno 2xx/3xx (pre-2015)
  /PowerVR SGX/i,     // Pre-Rogue PowerVR
];

/**
 * Detect available backends for ML inference.
 * @returns {Object} capabilities report
 */
export async function detectCapabilities() {
  const simd = isSimdSupported();

  const caps = {
    webgpu: false,
    webnn: false,
    webgl2: true, // fallback, always available in modern browsers
    gpuAdapter: null,
    simd,
    recommendedBackend: 'webgl',
    recommendedDelegate: 'GPU', // MediaPipe delegate preference
    timestamp: Date.now(),
  };

  // WebGPU detection
  if (typeof navigator !== 'undefined' && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        caps.webgpu = true;
        const info = await adapter.requestAdapterInfo?.() || {};
        caps.gpuAdapter = {
          vendor: info.vendor || 'unknown',
          architecture: info.architecture || 'unknown',
          description: info.description || '',
        };
      }
    } catch (_) {}
  }

  // WebNN detection
  if (typeof navigator !== 'undefined' && navigator.ml) {
    try {
      const context = await navigator.ml.createContext();
      if (context) {
        caps.webnn = true;
      }
    } catch (_) {}
  }

  // WebGL2 detection + renderer string for blocklist check
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    caps.webgl2 = !!gl;
    if (gl) {
      caps.webgl2Renderer = gl.getParameter(gl.RENDERER);
      caps.webgl2Vendor = gl.getParameter(gl.VENDOR);
      // Also try unmasked renderer for more accurate GPU identification
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) {
        caps.unmaskedRenderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
        caps.unmaskedVendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
      }
      // Clean up GL context
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
  } catch (_) {}

  // Recommend backend
  if (caps.webgpu) caps.recommendedBackend = 'webgpu';
  else if (caps.webnn) caps.recommendedBackend = 'webnn';
  else caps.recommendedBackend = 'webgl';

  // Recommend MediaPipe delegate based on GPU renderer blocklist
  const renderer = caps.unmaskedRenderer || caps.webgl2Renderer || '';
  const gpuBlocked = GPU_DELEGATE_BLOCKLIST.some(re => re.test(renderer));
  if (gpuBlocked || !caps.webgl2) {
    caps.recommendedDelegate = 'CPU';
    caps.gpuBlockedReason = gpuBlocked
      ? `GPU renderer "${renderer}" is on the blocklist (known to cause inference failures)`
      : 'WebGL2 not available';
  }

  return caps;
}

/**
 * Run a simple compute micro-benchmark.
 * Creates a matrix multiply workload and times it.
 * @returns {Object} benchmark results
 */
export async function runMicroBenchmark() {
  const results = { matMulCpu: 0, timestamp: Date.now() };

  // CPU baseline: 256x256 matrix multiply
  const size = 256;
  const a = new Float32Array(size * size);
  const b = new Float32Array(size * size);
  for (let i = 0; i < a.length; i++) { a[i] = Math.random(); b[i] = Math.random(); }

  const start = performance.now();
  const c = new Float32Array(size * size);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      let sum = 0;
      for (let k = 0; k < size; k++) sum += a[i * size + k] * b[k * size + j];
      c[i * size + j] = sum;
    }
  }
  results.matMulCpu = Math.round(performance.now() - start);

  return results;
}
