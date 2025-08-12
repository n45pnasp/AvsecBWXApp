// ===== Firebase =====
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get, child } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

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

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

// ===== Utils =====
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

// ===== Avatar default =====
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

// ===== Helpers URL Foto =====
function cleanURL(s) {
  if (!s) return "";
  return String(s).trim().replace(/^['"]+|['"]+$/g, "");
}

function normalizeDriveURL(u) {
  if (!u) return "";
  const url = cleanURL(u);
  const m1 = url.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  const m2 = url.match(/[?&]id=([^&]+)/i);
  const id = m1 ? m1[1] : (m2 ? m2[1] : null);
  if (!id) return url;
  return {
    id,
    primary: `https://drive.google.com/uc?export=view&id=${id}`,
    fallback: `https://drive.google.com/thumbnail?id=${id}&sz=w512`
  };
}

async function resolvePhotoURL(raw, user) {
  let url = cleanURL(raw || user?.photoURL || "");
  if (!url) return { primary: "", fallback: "" };
  if (location.protocol === "https:" && url.startsWith("http://"))
    return { primary: "", fallback: "" };

  if (/drive\.google\.com/i.test(url)) {
    const drv = normalizeDriveURL(url);
    if (typeof drv === "string") return { primary: drv, fallback: "" };
    return drv;
  }
  return { primary: url, fallback: "" };
}

// ===== Ambil profil dari RTDB =====
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

    const rawPhoto = photoSnap.exists() ? photoSnap.val() : (user.photoURL || "");
    console.log("[profile] rawPhoto from RTDB/Auth:", rawPhoto);

    const resolved = await resolvePhotoURL(rawPhoto, user);
    console.log("[profile] resolved photoURL:", resolved);

    return { name, spec, role, isAdmin, photoURL: resolved };
  }catch(e){
    console.warn("RTDB fetch error:", e?.message || e);
    return { name: resolveDisplayName(user), spec: "", role: "user", isAdmin: false, photoURL: { primary: DEFAULT_AVATAR, fallback: "" } };
  }
}

// ===== Render profil =====
function applyProfile({ name, photoURL }) {
  if (name) {
    $("#name").textContent = name;
    localStorage.setItem('tinydb_name', name);
  }

  const srcs = typeof photoURL === "object"
    ? [photoURL.primary, photoURL.fallback, DEFAULT_AVATAR]
    : [photoURL, DEFAULT_AVATAR];

  const avatar = $("#avatar");
  if (avatar) {
    avatar.referrerPolicy = "no-referrer";
    let idx = 0;
    const tryNext = () => {
      const next = (srcs[idx] || "").trim();
      if (!next) return;
      console.log(`[profile] try load [${idx}]:`, next);
      idx++;
      avatar.src = next;
    };
    avatar.onerror = () => { 
      console.warn("[profile] img error → try fallback"); 
      tryNext(); 
    };
    avatar.onload  = () => { 
      console.log("[profile] img loaded:", avatar.naturalWidth, "x", avatar.naturalHeight); 
    };
    tryNext();

    avatar.addEventListener("load", () => {
      localStorage.setItem('tinydb_photo', avatar.src || DEFAULT_AVATAR);
    }, { once: true });
  }
}

// ===== Toggle foto ↔ logout =====
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
        if (typeof window.onLogout === 'function') window.onLogout();
      });
    } else {
      const photo = localStorage.getItem('tinydb_photo') || '';
      profileSlot.innerHTML =
        `<img id="avatar" class="avatar-large" alt="Foto pengguna" src="${photo}" />`;
    }
  });
})();

window.onLogout = function () {
  try {
    localStorage.removeItem("tinydb_name");
    localStorage.removeItem("tinydb_photo");
  } catch (_) {}
  location.href = "index.html?logout=1";
};

// ===== Auth Gate =====
function mountAuthGate() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      location.href = "index.html";
      return;
    }
    try {
      const p = await fetchProfile(user);
      applyProfile({ name: p.name, photoURL: p.photoURL });
    } catch (e) {
      applyProfile({ name: resolveDisplayName(user), photoURL: DEFAULT_AVATAR });
    }
  });
}

// ===== Init =====
function tick() { updateGreeting(); }
tick();
setInterval(tick, 60 * 1000);
mountAuthGate();
