// Pahinga Service Worker - Local-First Offline Shell & Cache
const CACHE_NAME = 'pahinga-v1';
const PRECACHE_URLS = [
  '/',
  '/chat',
  '/onboarding',
  '/favicon.svg',
  '/manifest.json'
];

function isHuggingFaceAsset(url) {
  return url.hostname === 'huggingface.co' ||
    url.hostname.endsWith('.huggingface.co') ||
    url.hostname === 'hf.co' ||
    url.hostname.endsWith('.hf.co') ||
    url.hostname.endsWith('.huggingfaceusercontent.com');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Bypass service worker for audio/video media requests (prevents NotSupportedError due to Range header issues)
  if (event.request.destination === 'audio' || event.request.destination === 'video') return;
  if (event.request.headers.get('range')) return;

  const url = new URL(event.request.url);

  // Cache-first or Stale-while-revalidate for local origin and Hugging Face model assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached, and optionally update in background if online
        if (navigator.onLine && url.origin === self.location.origin) {
          fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          }).catch(() => {});
        }
        return cachedResponse;
      }

      // Not in cache, try network
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // Cache onnx models, scripts, fonts, and stylesheets
        const shouldCache =
          url.origin === self.location.origin ||
          isHuggingFaceAsset(url) ||
          url.hostname.includes('fonts.googleapis.com') ||
          url.hostname.includes('fonts.gstatic.com') ||
          url.hostname.includes('tailwindcss.com');

        if (shouldCache) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return networkResponse;
      }).catch(() => {
        // Fallback for navigations
        if (event.request.mode === 'navigate') {
          return caches.match('/chat') || caches.match('/');
        }
      });
    })
  );
});
