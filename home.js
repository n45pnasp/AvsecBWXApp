// ================= Firebase (modular v9) =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getDatabase, ref, get, child
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// -- samakan config dengan login.js --
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

// ================ Utils DOM & Waktu =====================
const $ = (s, el = document) => el.querySelector(s);

// WIB (GMT+7)
function getWIBDate(d = new Date()) {
  return new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
}

// Banner: "senin, 12 agustus 2025"
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
  const greetEl = $("#greet");
  const tagEl   = $("#taglineText");
  const dateEl  = $("#dateBanner");
  if (greetEl) greetEl.textContent = getGreetingID();
  const k = (greetEl?.textContent || "").split(" ")[1];
  const t = {
    Pagi:  "Fokus & semangat produktif ☕",
    Siang: "Jeda sejenak, tarik napas 🌤️",
    Sore:  "Akhiri dengan manis 🌇",
    Malam: "Santai, recharge energi 🌙"
  };
  if (tagEl)  tagEl.textContent  = t[k] || "Siap bantu aktivitasmu hari ini ✨";
  if (dateEl) dateEl.textContent = bannerString();
}

// ============== Ambil Profil dari RTDB ==================
const DEFAULT_AVATAR =
  "data:image/svg+xml;base64," + btoa(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>
      <rect width='128' height='128' rx='18' fill='#0b1220'/>
      <circle cx='64' cy='52' r='22' fill='#7c9bff'/>
      <rect x='26' y='84' width='76' height='26' rx='13' fill='#6a58ff'/>
    </svg>`
  );

function resolveDisplayName(user){
  if (user?.displayName && user.displayName.trim()) return user.displayName.trim();
  if (user?.email) return user.email.split("@")[0];
  return "Pengguna";
}

async function fetchProfile(user){
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
    const fallbackPhoto = (user.photoURL && user.photoURL.trim()) || DEFAULT_AVATAR;
    return { name: resolveDisplayName(user), spec: "", role: "user", isAdmin: false, photoURL: fallbackPhoto };
  }
}

// ============== Accent dari foto (opsional ringan) ==============
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
        resolve({ primary: `rgb(${br},${bg},${bb})` });
      } catch { resolve(null); }
    };
    img.onerror = reject;
    img.src = src;
  });
}

function setAccent(a1) {
  if (!a1) return;
  document.documentElement.style.setProperty('--accent', a1);
}

// ============== Render Profil ke UI =====================
function applyProfile({ name, photoURL }) {
  const nameEl = $("#name");
  const avatarEl = $("#avatar");
  if (nameEl)   nameEl.textContent = name || "Pengguna";
  if (avatarEl) avatarEl.src = photoURL || DEFAULT_AVATAR;

  // opsional: sinkronkan aksen dari foto
  extractAccentFromImage(photoURL || "").then(c => {
    if (c?.primary) setAccent(c.primary);
  }).catch(()=>{});
}

// ============== Toggle foto ↔ logout (tetap sama) =======
(function setupGreetCard() {
  const card = $("#greetCard");
  const profileSlot = $("#profileSlot");
  if (!card || !profileSlot) return;

  card.addEventListener('click', () => {
    const active = card.getAttribute('aria-pressed') === 'true';
    const next = !active;
    card.setAttribute('aria-pressed', String(next));

    if (next) {
      // Tampilkan tombol logout (ganti avatar)
      profileSlot.innerHTML = '<button id="logoutBtn" class="logout-btn" title="Logout" aria-label="Logout">✖</button>';
      $("#logoutBtn")?.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await signOut(auth);
        } catch {}
        // Bersihkan jejak dan kembali ke login
        try { sessionStorage.removeItem("auth_profile"); } catch {}
        location.href = "login.html";
      });
    } else {
      // Balik ke avatar
      const avatar = document.createElement("img");
      avatar.id = "avatar";
      avatar.className = "avatar-large";
      avatar.alt = "Foto pengguna";
      profileSlot.innerHTML = "";
      profileSlot.appendChild(avatar);
      // setelah kembali ke avatar, isi ulang foto dari elemen #name/#avatar yang sudah ada
      // (akan terisi lagi oleh applyProfile berikutnya bila diperlukan)
    }
  });
})();

// ============== Init: Auth Gate & Load Profil ==========
async function boot(){
  updateGreeting();
  setInterval(updateGreeting, 60 * 1000);

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // Jika tidak ada sesi, cek apakah ada jembatan dari login.js
      let bridge = null;
      try { bridge = JSON.parse(sessionStorage.getItem("auth_profile") || "null"); } catch {}
      if (bridge && bridge.uid) {
        // Tidak memaksa, tapi demi konsistensi UI: tetap arahkan ke login agar sesi Firebase jelas
        location.href = "login.html";
        return;
      }
      location.href = "login.html";
      return;
    }

    // Sudah login → ambil profil langsung dari RTDB
    const prof = await fetchProfile(user);
    applyProfile({ name: prof.name, photoURL: prof.photoURL });
  });
}

boot();
