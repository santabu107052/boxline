/**
 * sw.js — service worker: cache-first cho app shell (offline 100%).
 *
 * Quy tắc:
 *  - CHỈ cache tài nguyên NỘI BỘ (same-origin, đường dẫn tương đối). Không cache CDN/quảng cáo.
 *  - Cache theo version → nâng CACHE_VERSION khi phát hành bản mới; bản cũ bị xoá ở 'activate'.
 *  - Mọi lỗi mạng → trả bản đã cache; không chặn điều hướng nếu không tìm thấy (trả index.html).
 */
const CACHE_VERSION = 'boxline-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './src/styles.css',
  './src/config.js',
  './src/engine.js',
  './src/ai.js',
  './src/audio.js',
  './src/render.js',
  './src/tutorial.js',
  './src/ui.js',
  './src/main.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Chỉ xử lý tài nguyên cùng origin.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) {
        // Cache-first + làm mới ngầm để lần sau có bản mới.
        fetch(req).then((res) => {
          if (res && res.ok) caches.open(CACHE_VERSION).then((c) => c.put(req, res));
        }).catch(() => {});
        return cached;
      }
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === 'navigate') return caches.match('./index.html');
          return new Response('', { status: 503, statusText: 'Offline' });
        });
    }),
  );
});
