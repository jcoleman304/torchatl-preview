// TORCH ATL Member Portal — service worker
// Bump CACHE when shipping new app-shell assets so clients pick them up.
const CACHE = 'torch-members-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './data.js',
  './api-client.js',
  './app.js',
  './square-billing.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only manage same-origin assets. API (api.torchatl.com), fonts, and the
  // Square SDK are cross-origin and always go straight to the network.
  if (url.origin !== self.location.origin) return;

  // Network-first: fresh when online, fall back to cache when offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
