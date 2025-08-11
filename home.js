// ================== Utils dasar ==================
const $ = (s, el = document) => el.querySelector(s);
const params = new URLSearchParams(location.search);

// WIB (GMT+7)
function getWIBDate(d = new Date()) {
  return new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
}

// Banner tanggal: "senin, 12 agustus 2025"
function bannerString() {
  const d = getWIBDate();
  const hari = d.toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();
  const tanggal = d.getDate();
  const bulan = d.toLocaleDateString('id-ID', { month: 'long' }).toLowerCase();
  const tahun = d.getFullYear();
  return `${hari}, ${tanggal} ${bulan} ${tahun}`;
}

// Greeting (ID)
function getGreetingID(d = getWIBDate()) {
  const h = d.getHours();
  if (h >= 4 && h < 11)  return "Selamat Pagi,";
  if (h >= 11 && h < 15) return "Selamat Siang,";
  if (h >= 15 && h < 18) return "Selamat Sore,";
  return "Selamat Malam,";
}

function updateGreeting() {
  $("#greet").textContent = getGreetingID();
  const k = $("#greet").textContent.split(" ")[1]; // Pagi/Siang/Sore/Malam
  const t = {
    Pagi:  "Fokus & semangat produktif ☕",
    Siang: "Jeda sejenak, tarik napas 🌤️",
    Sore:  "Akhiri dengan manis 🌇",
    Malam: "Santai, recharge energi 🌙"
  };
  $("#taglineText").textContent = t[k] || "Siap bantu aktivitasmu hari ini ✨";
  $("#dateBanner").textContent = bannerString();
}

// ================== Firebase (Auth + RTDB) ==================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getDatabase, ref, get, child
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

/** Gunakan config yang sama dengan login.js */
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

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

// ================== Profil dari RTDB ==================
const DEFAULT_AVATAR =
  "data:image/svg+xml;base64," + btoa(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128' aria-hidden='true'>
      <rect width='128' height='128' rx='18'/>
      <circle cx='64' cy='52' r='22'/>
      <rect x='26' y='84' width='76' height='26' rx='13'/>
    </svg>`
  );

function resolveDisplayName(user){
  if (user?.displayName && user.displayName.trim()) return user.displayName.trim();
  if (user?.email) return user.email.split("@")[0];
  return "Pengguna";
}

async function fetchProfileFromRTDB(user){
  try{
    const root = ref(db);
    const snaps = await Promise.all([
      get(child(root, `users/${user.uid}/name`)),
      get(child(root, `users/${user.uid}/spec`)),
      get(child(root, `users/${user.uid}/role`)),
      get(child(root, `users/${user.uid}/isAdmin`)),
      get(child(root, `users/${user.uid}/photoURL`)),
    ]);
    const [nameSnap, specSnap, roleSnap, isAdminSnap, photoSnap] = snaps;

    const name = nameSnap.exists() ? String(nameSnap.val()).trim()
               : (user.displayName?.trim() || (user.email?.split("@")[0] ?? "Pengguna"));
    const spec = specSnap.exists() ? String(specSnap.val()).trim() : "";
    const role = roleSnap.exists() ? String(roleSnap.val()).trim()
               : (isAdminSnap.exists() && isAdminSnap.val() ? "admin" : "user");
    const isAdmin  = isAdminSnap.exists() ? !!isAdminSnap.val() : role === "admin";

    const fromRTDB = photoSnap.exists() ? String(photoSnap.val()).trim() : "";
    const fromAuth = (user.photoURL || "").trim();
    const photoURL = fromRTDB || fromAuth || DEFAULT_AVATAR;

    return { name, spec, role, isAdmin, photoURL };
  }catch(e){
    console.warn("RTDB fetch error:", e?.message || e);
    const fallbackPhoto = (user?.photoURL && user.photoURL.trim()) || DEFAULT_AVATAR;
    return { name: resolveDisplayName(user), spec: "", role: "user", isAdmin: false, photoURL: fallbackPhoto };
  }
}

// ================== Terapkan profil ke UI ==================
function applyProfile({ name, photo }) {
  if (name) $("#name").textContent = name;

  if (photo) {
    const avatar = $("#avatar");
    if (avatar) avatar.src = photo;
    extractAccentFromImage(photo).then(c => {
      if (c) setAccent(c.primary, c.secondary);
    }).catch(() => {});
  } else {
    // Avatar inisial (fallback)
    const n = (name || 'P U').trim();
    const initials = n.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 256, 256);
    g.addColorStop(0, '#1b2238'); g.addColorStop(1, '#151b2e');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.fillStyle = '#7c9bff'; x.font = 'bold 120px ui-sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(initials, 128, 140);
    const avatar = $("#avatar");
    if (avatar) avatar.src = c.toDataURL('image/png');
  }
}

// ================== Accent dari foto ==================
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
        for (let i = 0; i < data.length; i += 16) { // sampling
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
        resolve({
          primary: `rgb(${br},${bg},${bb})`,
          secondary: `rgb(${sec[0]},${sec[1]},${sec[2]})`
        });
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

// ================== Kartu profil (JANGAN DIUBAH) ==================
(function setupGreetCard() {
  const card = $("#greetCard");
  const profileSlot = $("#profileSlot");

  card.addEventListener('click', () => {
    const active = card.getAttribute('aria-pressed') === 'true';
    const next = !active;
    card.setAttribute('aria-pressed', String(next));

    if (next) {
      // Tampilkan tombol logout (ganti avatar)
      profileSlot.innerHTML = '<button id="logoutBtn" class="logout-btn" title="Logout" aria-label="Logout">✖</button>';
      $("#logoutBtn").addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          if (typeof window.onLogout === 'function') await window.onLogout();
        } catch (_) {}
      });
    } else {
      // Balik ke avatar
      const photo = $("#avatar")?.src || "";
      profileSlot.innerHTML = `<img id="avatar" class="avatar-large" alt="Foto pengguna" src="${photo}" />`;
    }
  });
})();

// ================== Auth guard + binding logout ==================
function redirectToLogin(){
  const here = location.pathname.split("/").pop() || "home.html";
  const loginURL = `login.html?next=${encodeURIComponent(here)}`;
  location.replace(loginURL);
}

// Dijalankan saat halaman siap
async function initHome(){
  updateGreeting();
  setInterval(updateGreeting, 60 * 1000);

  // Opsi: izinkan override aksen via URL
  if (params.get('accent'))  setAccent(params.get('accent'));
  if (params.get('accent2')) setAccent(undefined, params.get('accent2'));

  // Auth guard
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      redirectToLogin();
      return;
    }

    // 1) Paint cepat jika ada cache dari login (LOGIN MENGISI dari RTDB)
    try {
      const cached = sessionStorage.getItem("HOME_PROFILE");
      if (cached) {
        const { name, photo } = JSON.parse(cached);
        applyProfile({ name, photo });
      }
    } catch (_) {}

    // 2) Sumber kebenaran: RTDB (fresh)
    const prof = await fetchProfileFromRTDB(user);
    applyProfile({ name: prof.name, photo: prof.photoURL });

    // Siapkan handler logout yang dipanggil tombol pada kartu
    window.onLogout = async function(){
      try { await signOut(auth); } catch (_) {}
      // bersih-bersih ringan
      try { sessionStorage.removeItem("HOME_PROFILE"); } catch (_){}
      redirectToLogin();
    };
  });
}

initHome();
