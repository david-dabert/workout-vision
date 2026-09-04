/**
 * GPU/WebNN Capability Detection and Benchmarking
 *
 * Detects available hardware acceleration backends and runs
 * micro-benchmarks to select the optimal inference path.
 */

/**
 * Detect available backends for ML inference.
 * @returns {Object} capabilities report
 */
export async function detectCapabilities() {
  const caps = {
    webgpu: false,
    webnn: false,
    webgl2: true, // fallback, always available in modern browsers
    gpuAdapter: null,
    recommendedBackend: 'webgl',
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

  // WebGL2 detection
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    caps.webgl2 = !!gl;
    if (gl) {
      caps.webgl2Renderer = gl.getParameter(gl.RENDERER);
      caps.webgl2Vendor = gl.getParameter(gl.VENDOR);
    }
  } catch (_) {}

  // Recommend backend
  if (caps.webgpu) caps.recommendedBackend = 'webgpu';
  else if (caps.webnn) caps.recommendedBackend = 'webnn';
  else caps.recommendedBackend = 'webgl';

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
