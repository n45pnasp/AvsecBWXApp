// router.js
// Dipakai di index.html untuk menangani deep-link dari 404.html
// Contoh URL: /AvsecBWXApp/index.html#chatbot
//             /AvsecBWXApp/index.html#/AvsecBWXApp/plotting?x=1#frag
//             /AvsecBWXApp/index.html#viewer?file=abc

(function () {
  // --- Util: deteksi base path project di GitHub Pages (mis. "/AvsecBWXApp/")
  function getBasePrefix() {
    const parts = location.pathname.split("/").filter(Boolean);
    return parts.length > 0 ? `/${parts[0]}/` : "/";
  }
  const base = getBasePrefix();

  // Jalankan router hanya saat berada di halaman index (untuk cegah loop)
  const p = location.pathname;
  const isIndex =
    p.endsWith("/index.html") ||
    p === base ||                   // GitHub Pages kadang serve index di path folder
    (base === "/" && (p === "/" || p === "/index.html"));

  if (!isIndex) return;

  // Tidak ada hash → tidak ada yang perlu di-route (halaman login jalan normal)
  if (!location.hash || location.hash === "#" || location.hash === "#/") return;

  // Ambil hash mentah tanpa "#"
  let hash = location.hash.slice(1);

  // Buang semua "/" di awal agar seragam
  while (hash.startsWith("/")) hash = hash.slice(1);

  // Jika hash masih berisi segmen base (mis. "AvsecBWXApp/chatbot"), bersihkan
  const baseTrim = base.replace(/^\/|\/$/g, ""); // "AvsecBWXApp"
  if (baseTrim && (hash === baseTrim || hash.startsWith(baseTrim + "/"))) {
    hash = hash.slice(baseTrim.length);
    if (hash.startsWith("/")) hash = hash.slice(1);
  }

  // Pecah kemungkinan ada fragmen tambahan dalam hash (…#frag)
  let extraHash = "";
  const idxHashInside = hash.indexOf("#");
  if (idxHashInside >= 0) {
    extraHash = hash.slice(idxHashInside);   // termasuk "#"
    hash = hash.slice(0, idxHashInside);
  }

  // Sekarang "hash" bentuknya "route?[query]"
  let routePath = hash;
  let routeQuery = "";
  const qPos = routePath.indexOf("?");
  if (qPos >= 0) {
    routeQuery = routePath.slice(qPos + 1);
    routePath = routePath.slice(0, qPos);
  }

  // --- Pemetaan alias → file HTML
  // Tambah/ubah sesuai halaman kamu.
const ROUTE_MAP = {
    "": "home.html",
    "home": "home.html",
    "login": "index.html",
    "chatbot": "chatbot.html",
    "chat": "groupchat.html",      // Tambahkan ini
    "groupchat": "groupchat.html", // Tambahkan ini
    "plotting": "plotting.html",
    "sop": "sop-view.html",
    "fuel": "fuel.html",
  };

  // Jika route sudah ".html", langsung pakai (mis. "#chatbot.html")
  function resolveTarget(path) {
    if (!path) return ROUTE_MAP[""];

    if (/\.(html?)$/i.test(path)) return path;

    // Ambil segmen pertama sebagai alias (abaikan sisa)
    const seg = path.split("/")[0].toLowerCase();

    // Jika ada alias yang dikenali
    if (ROUTE_MAP[seg]) return ROUTE_MAP[seg];

    // Fallback → home
    return ROUTE_MAP[""];
  }

  const targetFile = resolveTarget(routePath);

  // Susun query yang diwariskan dari hash (routeQuery).
  // Kalau kamu juga mau mewariskan query dari index.html (?next=...), ganti `inheritedQuery` ke `location.search.slice(1)`
  const inheritedQuery = ""; // atau: location.search.slice(1)
  const params = new URLSearchParams();

  if (routeQuery) new URLSearchParams(routeQuery).forEach((v, k) => params.append(k, v));
  if (inheritedQuery) new URLSearchParams(inheritedQuery).forEach((v, k) => params.append(k, v));

  const queryString = params.toString();
  const finalURL =
    base + targetFile +
    (queryString ? `?${queryString}` : "") +
    (extraHash || "");

  // Redirect halus (tanpa menambah history)
  location.replace(finalURL);
})();
