// home.js (module)

/* ===========================
   Mobile Debug Console (eruda)
   Aktifkan dengan ?debug=1 atau localStorage.debug=1
   =========================== */
(function setupMobileDebug() {
  const qs = new URLSearchParams(location.search);
  const shouldDebug =
    qs.get('debug') === '1' ||
    localStorage.getItem('debug') === '1' ||
    location.hostname === 'localhost';

  if (!shouldDebug) return;

  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/eruda';
  s.async = true;
  s.onload = () => {
    try { eruda.init(); console.warn('[debug] eruda initialized'); } catch(e){ console.warn('[debug] eruda failed:', e); }
  };
  document.head.appendChild(s);
})();

/* ===========================
   Firebase (samakan dengan login.js)
   =========================== */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged }   from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get, child }  from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
// Jika kelak pakai Firebase Storage, aktifkan ini:
// import { getStorage, ref as sref, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBc-kE-_q1yoENYECPTLC3EZf_GxBEwrWY",
  authDomain: "avsecbwx-4229c.firebaseapp.com",
  projectId: "avsecbwx-4229c",
  appId: "1:1029406629258:web:53e8f09585cd77823efc73",
  storageBucket: "avsecbwx-4229c.appspot.com",
  messagingSenderId: "1029406629258",
  measurementId: "G-P37F88HGFE",
  databaseURL: "https://avsecbwx-4229c-default-rtdb.firebaseio.com"
};

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

/* ===========================
   Utils & WIB
   =========================== */
const $ = (s, el = document) => el.querySelector(s);

function getWIBDate(d = new Date()) {
  return new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
}
function bannerString() {
  const d = getWIBDate();
  const hari = d.toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();
  const tanggal = d.getDate();
  const bulan = d.toLocaleDateString('id-ID', { month: 'long' }).toLowerCase();
  const tahun = d.getFullYear();
  return `${hari}, ${tanggal} ${bulan} ${tahun}`;
}
function getGreetingID(d = getWIBDate()) {
  const h = d.getHours();
  if (h >= 4 && h < 11)  return "Selamat Pagi,";
  if (h >= 11 && h < 15) return "Selamat Siang,";
  if (h >= 15 && h < 18) return "Selamat Sore,";
  return "Selamat Malam,";
}
function updateGreeting() {
  $("#greet").textContent = getGreetingID();
  const k = $("#greet").textContent.split(" ")[1];
  const t = {
    Pagi:  "Fokus & semangat produktif ☕",
    Siang: "Jeda sejenak, tarik napas 🌤️",
    Sore:  "Akhiri dengan manis 🌇",
    Malam: "Santai, recharge energi 🌙"
  };
  $("#taglineText").textContent = t[k] || "Siap bantu aktivitasmu hari ini ✨";
  $("#dateBanner").textContent = bannerString();
}

/* ===========================
   Avatar default & helpers
   =========================== */
const DEFAULT_AVATAR =
  "data:image/svg+xml;base64," + btoa(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>
      <rect width='128' height='128' rx='18' fill='#0b1220'/>
      <circle cx='64' cy='52' r='22' fill='#9C27B0'/>
      <rect x='26' y='84' width='76' height='26' rx='13' fill='#6A1B9A'/>
    </svg>`
  );

function resolveDisplayName(user){
  if (user?.displayName && user.displayName.trim()) return user.displayName.trim();
  if (user?.email) return user.email.split("@")[0];
  return "Pengguna";
}

/* ===========================
   URL Cleaning & Drive normalizer
   =========================== */
function cleanURL(s) {
  if (!s) return "";
  let v = String(s).trim();
  // hapus SEMUA kutip (biasa & smart) di mana pun posisinya
  v = v.replace(/['"\u2018-\u201F]/g, "");
  // hapus zero-width & whitespace tak terlihat
  v = v.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");
  // buang spasi/tab/linebreak
  v = v.replace(/\s+/g, "");
  return v;
}
function normalizeDriveURL(u) {
  if (!u) return "";
  const url = cleanURL(u);
  const m1 = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  const m2 = url.match(/[?&]id=([^&]+)/i);
  const id = m1 ? m1[1] : (m2 ? m2[1] : null);
  return id ? `https://drive.google.com/uc?export=view&id=${id}` : url;
}
async function resolvePhotoURL(raw, user) {
  let url = cleanURL(raw || user?.photoURL || "");
  if (!url) return "";
  if (location.protocol === "https:" && url.startsWith("http://")) return "";
  if (/drive\.google\.com/i.test(url)) url = normalizeDriveURL(url);
  // Jika nanti pakai Firebase Storage, aktifkan blok ini:
  // if (url.startsWith("gs://") || (!/^https?:\/\//i.test(url) && !url.startsWith("data:"))) {
  //   try { const storage = getStorage(app); url = await getDownloadURL(sref(storage, url)); } catch { url = ""; }
  // }
  return url;
}

/* ===========================
   Fetch profil dari RTDB
   =========================== */
async function fetchProfile(user){
  try{
    const root = ref(db);
    const snaps = await Promise.all([
      get(child(root, `users/${user.uid}/name`)),
      get(child(root, `users/${user.uid}/spec`)),
      get(child(root, `users/${user.uid}/role`)),
      get(child(root, `users/${user.uid}/isAdmin`)),

      // beberapa kemungkinan key foto
      get(child(root, `users/${user.uid}/photoURL`)),
      get(child(root, `users/${user.uid}/photoUrl`)),
      get(child(root, `users/${user.uid}/avatar`)),
      get(child(root, `users/${user.uid}/profile/photoURL`)),
      get(child(root, `users/${user.uid}/profile/avatar`)),
    ]);

    const [nameSnap, specSnap, roleSnap, isAdminSnap, p1, p2, p3, p4, p5] = snaps;

    const name = nameSnap.exists() ? String(nameSnap.val()).trim()
               : (user.displayName?.trim() || (user.email?.split("@")[0] ?? "Pengguna"));
    const spec = specSnap.exists() ? String(specSnap.val()).trim() : "";
    const role = roleSnap.exists() ? String(roleSnap.val()).trim()
               : (isAdminSnap.exists() && isAdminSnap.val() ? "admin" : "user");
    const isAdmin  = isAdminSnap.exists() ? !!isAdminSnap.val() : role === "admin";

    const rawPhoto = [p1, p2, p3, p4, p5].find(s => s.exists())?.val() || (user.photoURL || "");
    const resolved = await resolvePhotoURL(rawPhoto, user);
    const photoURL = resolved || DEFAULT_AVATAR;

    // DEBUG
    console.log("[profile] rawPhoto from RTDB/Auth:", rawPhoto);
    console.log("[profile] resolved photoURL:", photoURL);

    return { name, spec, role, isAdmin, photoURL };
  }catch(e){
    console.warn("RTDB fetch error:", e?.message || e);
    const fallbackPhoto = (user.photoURL && cleanURL(user.photoURL)) || DEFAULT_AVATAR;
    return { name: resolveDisplayName(user), spec: "", role: "user", isAdmin: false, photoURL: fallbackPhoto };
  }
}

/* ===========================
   Render profil
   =========================== */
function applyProfile({ name, photoURL }) {
  if (name) {
    $("#name").textContent = name;
    localStorage.setItem('tinydb_name', name);
  }
  const finalURL = photoURL || DEFAULT_AVATAR;

  // DEBUG: tampilkan kode karakter 6 terakhir
  try {
    const tail = Array.from(finalURL).slice(-6).map(c => c.charCodeAt(0)).join(",");
    console.log("[profile] tail char codes:", tail);
  } catch {}

  const avatar = $("#avatar");
  if (avatar) {
    avatar.referrerPolicy = "no-referrer";
    avatar.onerror = () => { console.warn("[profile] img error → fallback"); avatar.src = DEFAULT_AVATAR; };
    avatar.onload  = () => { console.log("[profile] img loaded:", avatar.naturalWidth, "x", avatar.naturalHeight); };
    avatar.src = finalURL;
  }
  localStorage.setItem('tinydb_photo', finalURL);

  // Ekstrak aksen: skip jika host Google Drive (CORS bisa tainted)
  if (finalURL && !/drive\.google\.com/i.test(finalURL)) {
    extractAccentFromImage(finalURL).then(c => { if (c) setAccent(c.primary, c.secondary); }).catch(()=>{});
  }
}

/* ===========================
   Accent dari foto (opsional)
   =========================== */
async function extractAccentFromImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous'; img.decoding = 'async';
    img.onload = () => {
      try {
        const w = 80, h = 80;
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, 0, 0, w, h);
        const { data } = x.getImageData(0, 0, w, h);
        const bins = {};
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 128) continue;
          const key = [(r / 24 | 0), (g / 24 | 0), (b / 24 | 0)].join(',');
          bins[key] = (bins[key] || 0) + 1;
        }
        let topKey = null, max = -1;
        for (const k in bins) { if (bins[k] > max) { max = bins[k]; topKey = k; } }
        if (!topKey) return resolve(null);
        const [br, bg, bb] = topKey.split(',').map(n => Number(n) * 24 + 12);
        const sec = rotateHue(br, bg, bb, 30);
        resolve({ primary: `rgb(${br},${bg},${bb})`, secondary: `rgb(${sec[0]},${sec[1]},${sec[2]})` });
      } catch (e) { resolve(null); }
    };
    img.onerror = reject;
    img.src = src;
  });
}
function rotateHue(r, g, b, deg) {
  const u = Math.cos(deg * Math.PI / 180), w = Math.sin(deg * Math.PI / 180);
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  return [
    clamp((.299 + .701 * u + .168 * w) * r + (.587 - .587 * u + .330 * w) * g + (.114 - .114 * u - .497 * w) * b),
    clamp((.299 - .299 * u - .328 * w) * r + (.587 + .413 * u + .035 * w) * g + (.114 - .114 * u + .292 * w) * b),
    clamp((.299 - .3 * u + 1.25 * w) * r + (.587 - .588 * u - 1.05 * w) * g + (.114 + .886 * u - .203 * w) * b)
  ];
}
function setAccent(a1, a2) {
  const root = document.documentElement.style;
  if (a1) root.setProperty('--accent', a1);
  if (a2) root.setProperty('--accent-2', a2);
}

/* ===========================
   Toggle foto ↔ logout (TIDAK DIUBAH)
   =========================== */
(function setupGreetCard() {
  const card = $("#greetCard");
  const profileSlot = $("#profileSlot");

  card.addEventListener('click', () => {
    const active = card.getAttribute('aria-pressed') === 'true';
    const next = !active;
    card.setAttribute('aria-pressed', String(next));

    if (next) {
      profileSlot.innerHTML =
        '<button id="logoutBtn" class="logout-btn" title="Logout" aria-label="Logout">✖</button>';

      $("#logoutBtn").addEventListener('click', (e) => {
        e.stopPropagation();
        try { window.parent && window.parent.postMessage(JSON.stringify({ type: 'logout' }), '*'); } catch (_) {}
        if (typeof window.onLogout === 'function') window.onLogout();
      });
    } else {
      const photo = localStorage.getItem('tinydb_photo') || '';
      profileSlot.innerHTML =
        `<img id="avatar" class="avatar-large" alt="Foto pengguna" src="${photo}" />`;
    }
  });
})();

/* ===========================
   Logout hook
   =========================== */
window.onLogout = function () {
  try {
    localStorage.removeItem("tinydb_name");
    localStorage.removeItem("tinydb_photo");
  } catch (_) {}
  location.href = "index.html?logout=1"; // ganti jika nama file login berbeda
};

/* ===========================
   Auth Gate
   =========================== */
function mountAuthGate() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { location.href = "index.html"; return; }
    try {
      const p = await fetchProfile(user);
      applyProfile({ name: p.name, photoURL: p.photoURL });
    } catch (e) {
      console.warn("apply profile error:", e);
      applyProfile({ name: resolveDisplayName(user), photoURL: user.photoURL || DEFAULT_AVATAR });
    }
  });
}

/* ===========================
   Init
   =========================== */
function tick() { updateGreeting(); }
tick();
setInterval(tick, 60 * 1000);
mountAuthGate();
