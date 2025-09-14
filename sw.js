// sw.js — FINAL+ (anti-stale auth/router, precache shell, nav-preload)
const VERSION = "2025-09-14a";
const STATIC_CACHE = `static-${VERSION}`;
const BASE = new URL(self.registration.scope).pathname;
const toBase = (p) => BASE + p.replace(/^\//, "");

const PRECACHE = [
  toBase(""),
  toBase("index.html"),
  toBase("home.html"),
  toBase("login.css"),
  toBase("login.js"),
  toBase("auth-guard.js"),
  toBase("router.js"),
  toBase("offline.js"),
  toBase("manifest.json"),
  toBase("icons/favicon-192.png"),
  toBase("icons/favicon-256.png"),
  toBase("icons/favicon-384.png"),
  toBase("icons/favicon-512.png"),
  toBase("icons/apple-touch-icon.png"),
];

// File yang harus selalu network-only (jangan pernah pakai cache)
const NETWORK_ONLY = [
  toBase("index.html"),
  toBase("auth-guard.js"),
  toBase("login.js"),
  toBase("router.js"),
];

// ===== Install: aktifkan cepat + precache minimal shell
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // Precache: abaikan error jika ada file tidak tersedia (404)
    await Promise.allSettled(PRECACHE.map(u => fetch(u, { cache: "no-store" }).then(r => r.ok && cache.put(u, r))));
  })());
});

// ===== Activate: bersihkan cache lama + claim klien + enable nav-preload
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.includes(VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function shouldBypass(pathname) {
  return NETWORK_ONLY.some(p => pathname === p || pathname.startsWith(p + "?"));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Hanya handle GET same-origin
  if (req.method !== "GET" || url.origin !== location.origin) return;

  // 1) Auth/router: network-only (hindari cache)
  if (shouldBypass(url.pathname)) {
    event.respondWith(fetch(req, { cache: "no-store" }).catch(() => caches.match(req)));
    return;
  }

  // 2) Navigasi HTML: network-first (hindari HTML basi) + nav-preload
  const isNavigate = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isNavigate) {
    event.respondWith((async () => {
      try {
        // Ambil preload jika tersedia (lebih cepat)
        const preload = event.preloadResponse ? await event.preloadResponse : null;
        const fresh = preload || await fetch(req, { cache: "no-store" });
        const cache = await caches.open(STATIC_CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(STATIC_CACHE);
        // fallback: coba cache dengan dan tanpa query
        const cached = await (cache.match(req) || cache.match(new Request(url.pathname)));
        if (cached) return cached;
        // fallback terakhir
        return new Response("<h1>Offline</h1><p>Konten tidak tersedia.</p>", {
          status: 503, headers: { "Content-Type": "text/html" }
        });
      }
    })());
    return;
  }

  // 3) Aset statis: stale-while-revalidate (abaikan querystring saat match)
  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await (cache.match(req, { ignoreSearch: true }) ||
                          cache.match(new Request(url.pathname)));
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
