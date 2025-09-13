// sw.js — FINAL (anti-stale auth/router, update cepat)
const VERSION = "2025-09-13c";
const STATIC_CACHE = `static-${VERSION}`;
const NETWORK_ONLY = [
  /\/index\.html(\?.*)?$/i,
  /\/auth-guard\.js(\?.*)?$/i,
  /\/login\.js(\?.*)?$/i,
  /\/router\.js(\?.*)?$/i,
];

// Install → aktifkan cepat
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate → klaim klien & buang cache lama
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.includes(VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function shouldBypass(pathname) {
  return NETWORK_ONLY.some(rx => rx.test(pathname));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Hanya handle GET same-origin
  if (req.method !== "GET" || url.origin !== location.origin) return;

  // 1) Auth/router: network-only (hindari cache)
  if (shouldBypass(url.pathname)) {
    event.respondWith(fetch(req));
    return;
  }

  // 2) Navigasi HTML: network-first (hindari HTML basi)
  const isNavigate = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isNavigate) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(STATIC_CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        return caches.match("/") || new Response("<h1>Offline</h1>", { status: 503, headers: { "Content-Type": "text/html" } });
      }
    })());
    return;
  }

  // 3) Aset statis: stale-while-revalidate
  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(req);
    const fetching = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || fetching || new Response(null, { status: 504 });
  })());
});

// Terima pesan agar update SW tanpa reload manual
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});
