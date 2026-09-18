// WorkoutVision Service Worker — offline-first caching
// Strategy: cache app shell on install, network-first for navigation,
// cache-first for static assets and MediaPipe WASM files.

const CACHE_NAME = 'wv-vd995e129';
const APP_SHELL = [
  '/workout-vision/',
  '/workout-vision/manifest.json',
  '/workout-vision/favicon.svg',
  '/workout-vision/icon-192.png',
  '/workout-vision/icon-512.png',
  '/workout-vision/mediapipe/pose_landmarker_full.task',
  '/workout-vision/mediapipe/manifest.json',
];
// ── Auto-injected by inject-sw-precache.js ──
const PRECACHE_ASSETS = [
  "/workout-vision/assets/ExerciseSelector-DTVxtoye.js",
  "/workout-vision/assets/LiveCapture-BEZfue_H.js",
  "/workout-vision/assets/ManualLog-60q6KKPH.js",
  "/workout-vision/assets/Onboarding-C-cG4Ua8.js",
  "/workout-vision/assets/PersonalRecords-BB-vuYGg.js",
  "/workout-vision/assets/Profile-BDvy3ner.js",
  "/workout-vision/assets/Profile-DSM60F3w.css",
  "/workout-vision/assets/RestTimer-D-40sIG4.css",
  "/workout-vision/assets/RestTimer-Dh0M86pm.js",
  "/workout-vision/assets/Validate-D51oBttc.css",
  "/workout-vision/assets/Validate-DC8AGQQg.js",
  "/workout-vision/assets/VideoUpload-Cx2vq5w1.css",
  "/workout-vision/assets/VideoUpload-lg7Bcmi9.js",
  "/workout-vision/assets/WeeklyReport-1qOt5TTf.js",
  "/workout-vision/assets/WorkoutHistory-BWSnJ6m8.css",
  "/workout-vision/assets/WorkoutHistory-nFTaTiTR.js",
  "/workout-vision/assets/biomechanics-C6jOx9Xv.js",
  "/workout-vision/assets/correctionLog-CmRCgcUw.js",
  "/workout-vision/assets/exerciseDetector-C0N3sVu-.js",
  "/workout-vision/assets/exercises-DFwFYDJz.js",
  "/workout-vision/assets/fr-Kt8g5cD_.js",
  "/workout-vision/assets/gpuBenchmark-CWotvkM8.js",
  "/workout-vision/assets/i18n-Cne2JNyh.js",
  "/workout-vision/assets/index-BE_uW3cE.js",
  "/workout-vision/assets/index-BvQnUhP1.css",
  "/workout-vision/assets/localforage-53-gm4O1.js",
  "/workout-vision/assets/poseAnalysis-BcRRrX0s.js",
  "/workout-vision/assets/poseWorker-DcYzUWYA.js",
  "/workout-vision/assets/react-vendor-DCgi73_X.js",
  "/workout-vision/assets/usePoseWorker-ChOopUp0.js",
  "/workout-vision/assets/web-demuxer-Cj2z-sgM.js",
  "/workout-vision/boot.js",
  "/workout-vision/cache-bust.js"
];


self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([...APP_SHELL, ...PRECACHE_ASSETS]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // MediaPipe WASM/model files: cache-first (large, immutable)
  if (url.pathname.includes('/mediapipe/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // JS/CSS assets with hashed filenames: cache-first
  // Vite adds crossorigin to <script type="module"> and <link rel="stylesheet">,
  // causing cors-mode requests. cache.addAll() stores with no-cors mode.
  // Try both the original request and a mode-agnostic URL match.
  if (/\.[a-f0-9]{8}\.(js|css)$/.test(url.pathname)) {
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

  // Navigation and app shell: network-first with cache fallback
  if (request.mode === 'navigate' || APP_SHELL.includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/workout-vision/')))
    );
    return;
  }

  // Everything else: stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
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
        icon: '/workout-vision/icon-192.png',
        badge: '/workout-vision/icon-192.png',
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
      return self.clients.openWindow('/workout-vision/');
    })
  );
});
