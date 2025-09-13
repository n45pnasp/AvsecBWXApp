// sw.js - simple offline cache for Avsec BWX App
const CACHE_NAME = 'avsec-cache-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/home.html',
  '/home.css',
  '/home.js',
  '/offline.js',
  '/camera.js',
  '/manifest.json',
  '/icons/favicon-192.png',
  '/icons/favicon-512.png'
];

// install: cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// activate: remove old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// fetch: cache-first with network fallback & dynamic caching
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
