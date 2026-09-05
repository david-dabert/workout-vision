/**
 * WorkoutVision Service Worker
 *
 * Strategies:
 * - App shell (HTML, CSS, JS): network-first with cache fallback
 * - MediaPipe WASM: cache-first (these files are large and immutable)
 * - Static assets (icons, fonts): cache-first
 * - Everything else: network-first
 *
 * The previous SW was removed because it cached stale HTML on iOS Safari.
 * This version uses a versioned cache and network-first for navigations
 * to avoid that problem.
 */

const CACHE_VERSION = 'wv-v2';
const WASM_CACHE = 'wv-wasm-v1';
const STATIC_CACHE = 'wv-static-v1';

const BASE = '/workout-vision/';

// MediaPipe WASM files that must be cached for offline pose detection
const WASM_FILES = [
  `${BASE}mediapipe/vision_wasm_internal.js`,
  `${BASE}mediapipe/vision_wasm_internal.wasm`,
  `${BASE}mediapipe/vision_wasm_module_internal.js`,
  `${BASE}mediapipe/vision_wasm_module_internal.wasm`,
  `${BASE}mediapipe/vision_wasm_nosimd_internal.js`,
  `${BASE}mediapipe/vision_wasm_nosimd_internal.wasm`,
];

// Static assets that rarely change
const STATIC_FILES = [
  `${BASE}favicon.svg`,
  `${BASE}icon-192.png`,
  `${BASE}icon-512.png`,
  `${BASE}icons.svg`,
  `${BASE}manifest.json`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      // Pre-cache WASM files
      caches.open(WASM_CACHE).then((cache) =>
        cache.addAll(WASM_FILES).catch((err) => {
          console.warn('[SW] WASM pre-cache failed (will cache on first use):', err);
        })
      ),
      // Pre-cache static assets
      caches.open(STATIC_CACHE).then((cache) =>
        cache.addAll(STATIC_FILES).catch((err) => {
          console.warn('[SW] Static pre-cache failed:', err);
        })
      ),
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION && key !== WASM_CACHE && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;

  // WASM files: cache-first (immutable, large)
  if (pathname.includes('/mediapipe/') && (pathname.endsWith('.wasm') || pathname.endsWith('.js'))) {
    event.respondWith(cacheFirst(request, WASM_CACHE));
    return;
  }

  // Static assets: cache-first
  if (STATIC_FILES.some((f) => pathname === f || pathname.endsWith('.png') || pathname.endsWith('.svg'))) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation requests (HTML): network-first to avoid stale HTML
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, CACHE_VERSION));
    return;
  }

  // JS/CSS bundles: network-first (Vite hashes them, but we want freshness)
  if (pathname.endsWith('.js') || pathname.endsWith('.css')) {
    event.respondWith(networkFirst(request, CACHE_VERSION));
    return;
  }

  // Everything else: network-first
  event.respondWith(networkFirst(request, CACHE_VERSION));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    // Offline and not cached
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // For navigations, return the cached index as fallback
    if (request.mode === 'navigate') {
      const fallback = await caches.match(`${BASE}`);
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}
