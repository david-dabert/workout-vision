// WorkoutVision Service Worker — offline-first caching
// Strategy: cache app shell on install, network-first for navigation,
// cache-first for static assets and MediaPipe WASM files.

const CACHE_NAME = 'wv-v1';
const MODEL_CACHE = 'wv-model-__MODEL_SHA256__';
// MediaPipe's WASM and its loaders sit at unversioned addresses: they are kept apart, under a fingerprint of the
// files themselves (scripts/inject-sw-precache.js), and looked up there only, so the previous version's cache can
// never hand a new app the old library's WASM (audit of 2 October; src/lib/__tests__/sw-wasm.test.js). The decoder's
// WASM (/web-demuxer.wasm, also unversioned) is kept the same way, so a web-demuxer upgrade never meets the old
// file (third audit, C20).
const WASM_CACHE = 'wv-wasm-__WASM_HASH__';
const APP_SHELL = [
  '__SW_BASE__',
  '__SW_BASE__manifest.json',
  '__SW_BASE__favicon.svg',
  '__SW_BASE__icon-192.png',
  '__SW_BASE__icon-512.png',
];

// Files are fetched past the browser's own cache, which may still hold the last
// version's page for ten minutes: a new version must never store the old one.
const fresh = (urls) => urls.map((url) => new Request(url, { cache: 'reload' }));

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(fresh(APP_SHELL)))
  );
  self.skipWaiting();
});

// The previous version's files stay one deploy longer: a page open since before the deploy still loads its own
// chunks (the report's PDF module, on 2 October, was gone from the cache and from the site). The versions are
// listed, oldest first, in the wv-meta cache; every older one is dropped (src/lib/__tests__/sw-versions.test.js).
const META_CACHE = 'wv-meta';
// How long a page request waits for the network before the page kept answers. Status: convention (UNSOURCED value).
const NAV_WAIT_MS = 4000;
// This version's cache first, then any other: the previous version's cache holds the same unversioned addresses.
const fromCurrent = (request) => caches.open(CACHE_NAME).then((cache) => cache.match(request)).then((hit) => hit || caches.match(request));
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const meta = await caches.open(META_CACHE);
    let seen = [];
    try { const r = await meta.match('list'); if (r) seen = await r.json(); } catch { seen = []; }
    const keep = [...(Array.isArray(seen) ? seen : []).filter((v) => v !== CACHE_NAME), CACHE_NAME].slice(-2);
    await meta.put('list', new Response(JSON.stringify(keep)));
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => (k.startsWith('wv-v') && !keep.includes(k)) || (k.startsWith('wv-model-') && k !== MODEL_CACHE) || (k.startsWith('wv-wasm-') && k !== WASM_CACHE)).map((k) => caches.delete(k)));
  })());
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/mediapipe/pose_landmarker_full.task')) {
    // Keeping the model offline is a convenience: when the phone refuses to open, read or fill the store
    // (little space left, private browsing), the verified download is still handed to the analysis
    // (src/lib/__tests__/sw-model.test.js). A download whose fingerprint differs is never handed over.
    event.respondWith((async () => {
      let cache = null;
      try {
        cache = await caches.open(MODEL_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
      } catch { cache = null; }
      const response = await fetch(request);
      if (response.ok) {
        const bytes = await response.clone().arrayBuffer();
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
        if (MODEL_CACHE !== `wv-model-${hash}`) throw new Error('Pose model integrity mismatch');
        if (cache) { try { await cache.put(request, response.clone()); } catch { /* not kept offline */ } }
      }
      return response;
    })());
    return;
  }

  // MediaPipe WASM files and the decoder's WASM: cache-first, from their own cache only.
  if (url.pathname.includes('/mediapipe/') || url.pathname.endsWith('/web-demuxer.wasm')) {
    event.respondWith(
      caches.open(WASM_CACHE).then((cache) => cache.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone()).catch(() => {});
          return response;
        });
      }), () => fetch(request))
    );
    return;
  }

  // JS/CSS assets with hashed filenames (Vite names them name-XXXXXXXX.js): cache-first
  // Vite adds crossorigin to <script type="module"> and <link rel="stylesheet">,
  // causing cors-mode requests. cache.addAll() stores with no-cors mode.
  // Try both the original request and a mode-agnostic URL match.
  if (/-[A-Za-z0-9_-]{8}\.(js|css)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        // Fallback: match by URL with different request mode
        return caches.match(new Request(url.href)).then((fallback) => {
          if (fallback) return fallback;
          return fetch(request).then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // Navigation and app shell: network-first with cache fallback. The page is checked
  // with the server each time, so it never outlives the files it names. Offline, or when the network has not
  // answered within NAV_WAIT_MS (a weak signal in a gym), the page kept by this version answers, never the
  // previous version's (audit of 3 October; src/lib/__tests__/sw-offline.test.js).
  if (request.mode === 'navigate' || APP_SHELL.includes(url.pathname)) {
    const network = fetch(request, { cache: 'no-cache' }).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    });
    const kept = () => fromCurrent(request).then((cached) => cached || fromCurrent('__SW_BASE__'));
    event.respondWith(new Promise((resolve, reject) => {
      let settled = false;
      const answer = (r) => { if (!settled && r) { settled = true; resolve(r); } };
      const timer = setTimeout(() => { kept().then(answer, () => {}); }, NAV_WAIT_MS);
      network.then((r) => { clearTimeout(timer); answer(r); }, () => {
        clearTimeout(timer);
        kept().then((r) => (r ? answer(r) : reject(new TypeError('offline, nothing kept'))), reject);
      });
    }));
    return;
  }

  // Everything else: stale-while-revalidate, from this version's cache first.
  event.respondWith(
    fromCurrent(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
      return cached || networkFetch;
    })
  );
});

// Periodic Background Sync — weekly training reminder
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'wv-weekly-reminder') {
    event.waitUntil(
      self.registration.showNotification('WorkoutVision', {
        body: 'Time to train! Record a set and track your progress.',
        icon: '__SW_BASE__icon-192.png',
        badge: '__SW_BASE__icon-192.png',
        tag: 'wv-weekly',
        renotify: true,
      })
    );
  }
});

// Notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      if (clients.length > 0) {
        clients[0].focus();
        return;
      }
      return self.clients.openWindow('__SW_BASE__');
    })
  );
});
