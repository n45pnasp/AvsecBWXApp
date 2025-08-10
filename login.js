// login.js (module) — tanpa pengaturan warna; semua warna via CSS

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  setPersistence, browserLocalPersistence, signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getDatabase, ref, get, child
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

/** Firebase config */
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

// Sesi persisten
(async () => {
  try { await setPersistence(auth, browserLocalPersistence); }
  catch (e) { console.warn("setPersistence gagal:", e?.message || e); }
})();

/** ELEMENTS */
const $ = (q) => document.querySelector(q);
const welcome    = $("#welcome");
const login      = $("#login");
const goLoginBtn = $("#goLoginBtn");
const backBtn    = $("#backBtn");
const form       = $("#loginForm");
const emailEl    = $("#email");
const passEl     = $("#password");
const loginBtn   = $("#loginBtn");
const errBox     = $("#errBox");
const okBox      = $("#okBox");
const yearEl     = $("#year");
const logoEl     = $("#appLogo");
if (yearEl) yearEl.textContent = new Date().getFullYear();

/** Toggle password visibility (👁️ / 🙈) */
const toggleEye = document.querySelector("#togglePassword");
toggleEye?.addEventListener("click", () => {
  const isPassword = passEl.type === "password";
  passEl.type = isPassword ? "text" : "password";
  toggleEye.textContent = isPassword ? "🙈" : "👁️";
});

/** LOGO (tanpa warna di JS) */
(function setLogo(){
  if (!logoEl) return;
  logoEl.dataset.loading = "1";
  const params   = new URLSearchParams(location.search);
  const basePath = location.pathname.substring(0, location.pathname.lastIndexOf("/") + 1);
  const url = params.get("logo") || window.LOGO_URL || `${basePath}logohome.png?v=${Date.now()}`;

  // 1x1 transparent GIF sebagai fallback agar JS tidak mendikte warna
  const transparent = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

  logoEl.src = url;
  logoEl.onload  = () => { delete logoEl.dataset.loading; };
  logoEl.onerror = () => { logoEl.src = transparent; delete logoEl.dataset.loading; };
})();

/** UTIL UI */
function show(sec){
  for (const el of document.querySelectorAll(".section")) el.classList.remove("active");
  sec.classList.add("active");
  err(""); ok("");
}
function err(msg){
  if (!msg){ errBox.classList.remove("show"); errBox.textContent=""; }
  else { errBox.textContent=msg; errBox.classList.add("show"); }
}
function ok(msg){
  if (!msg){ okBox.classList.remove("show"); okBox.textContent=""; }
  else { okBox.textContent=msg; okBox.classList.add("show"); }
}
function disableForm(d){
  loginBtn.disabled = d; loginBtn.textContent = d ? "Memproses..." : "Masuk";
}

/** NAV */
goLoginBtn?.addEventListener("click", () => show(login));
backBtn?.addEventListener("click", () => show(welcome));
for (const b of document.querySelectorAll(".btn")){
  b.addEventListener("pointerdown", (e)=>{
    const r = b.getBoundingClientRect();
    b.style.setProperty("--x", `${e.clientX - r.left}px`);
    b.style.setProperty("--y", `${e.clientY - r.top}px`);
  }, {passive:true});
}

/** Helper nama (fallback) */
function resolveDisplayName(user){
  if (user?.displayName && user.displayName.trim()) return user.displayName.trim();
  if (user?.email) return user.email.split("@")[0];
  return "Pengguna";
}

/** Waktu salam (UTC+7 / Asia/Jakarta) */
function getTimeOfDayUTC7(){
  try{
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'
    }).formatToParts(new Date());
    const hour = parseInt(parts.find(p=>p.type==='hour')?.value ?? '0', 10);
    if (hour >= 5 && hour < 12) return "Pagi";
    if (hour >= 12 && hour < 15) return "Siang";
    if (hour >= 15 && hour < 18) return "Sore";
    return "Malam";
  }catch{
    const now = new Date();
    const hour = (now.getUTCHours() + 7) % 24;
    if (hour >= 5 && hour < 12) return "Pagi";
    if (hour >= 12 && hour < 15) return "Siang";
    if (hour >= 15 && hour < 18) return "Sore";
    return "Malam";
  }
}

/** ===== Offline Sheet (tanpa styling warna di JS) =====
 * Hanya markup & logika. Styling sepenuhnya dari CSS (.net-sheet, .net-btn, dst).
 */
(function setupOfflineSheet(){
  const sheet = document.createElement("div");
  sheet.className = "net-sheet";
  sheet.innerHTML = `
    <div class="net-dot"></div>
    <div class="net-msg">Tidak ada koneksi internet. Cek jaringan Anda.</div>
    <div class="net-act"><button class="net-btn" id="netRetryBtn" type="button">Coba Lagi</button></div>
  `;
  document.body.appendChild(sheet);

  const retryBtn = sheet.querySelector("#netRetryBtn");

  function setFormEnabled(enable){
    [emailEl, passEl, loginBtn].forEach(el => { if (el) el.disabled = !enable; });
  }
  function showSheet(){ sheet.classList.add("show"); setFormEnabled(false); err("Tidak ada koneksi internet."); }
  function hideSheet(){ sheet.classList.remove("show"); setFormEnabled(true); err(""); }

  function reportNetwork(){ navigator.onLine ? hideSheet() : showSheet(); }
  window.addEventListener("online", reportNetwork);
  window.addEventListener("offline", reportNetwork);
  retryBtn.addEventListener("click", reportNetwork);

  let timer=null;
  sheet.addEventListener("transitionend", ()=>{
    if (sheet.classList.contains("show") && !timer){
      timer = setInterval(()=>{
        if (navigator.onLine){ clearInterval(timer); timer=null; hideSheet(); }
      }, 3000);
    }
  });

  reportNetwork();
  form?.addEventListener("submit", (e)=>{
    if (!navigator.onLine){
      e.preventDefault();
      showSheet();
    }
  }, true);
})();

/** Avatar default (netral) */
const DEFAULT_AVATAR = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

/** Ambil profil dari RTDB */
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

/** LOGIN */
form?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  err(""); ok("");

  if (!navigator.onLine){
    err("Tidak ada koneksi internet. Coba lagi setelah jaringan tersambung.");
    return;
  }

  const email = emailEl.value.trim();
  const pass  = passEl.value;
  if (!email || !pass){ err("Email & kata sandi wajib diisi."); return; }

  disableForm(true);
  try{
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    await notifyKodularAndGoHome("success", cred.user);
  }catch(e){
    const map = {
      "auth/invalid-email":"Format email tidak valid.",
      "auth/user-not-found":"Akun tidak ditemukan.",
      "auth/wrong-password":"Kata sandi salah.",
      "auth/too-many-requests":"Terlalu banyak percobaan. Coba lagi nanti.",
      "auth/user-disabled":"Akun dinonaktifkan."
    };
    err(map[e.code] || ("Gagal login: " + (e.message || e)));
  }finally{
    disableForm(false);
  }
});

/** AUTO-SKIP jika sudah login */
onAuthStateChanged(auth, async (user)=>{
  if (user){
    await notifyKodularAndGoHome("already_signed_in", user);
  }else{
    show(welcome);
  }
});

/** Kirim ke Kodular + profil lengkap + salam waktu */
async function notifyKodularAndGoHome(status, user){
  const prof = await fetchProfile(user);
  const payload = JSON.stringify({
    event: "auth",
    status,
    uid: user.uid,
    email: user.email || null,
    name: prof.name,
    spec: prof.spec,
    role: prof.role,
    isAdmin: prof.isAdmin,
    photoURL: prof.photoURL,
    ts: Date.now(),
    timeOfDay: getTimeOfDayUTC7()
  });

  if (window.AppInventor && typeof window.AppInventor.setWebViewString === "function"){
    window.AppInventor.setWebViewString(payload);
  }else{
    document.title = payload; // fallback
  }

  ok(status==="success" ? "Login berhasil. Mengalihkan ke Home..." : "Sesi ditemukan. Mengalihkan ke Home...");
  setTimeout(()=>{ /* location.href = "kodular://home"; */ }, 600);
}

/** LOGOUT */
window.logout = async function(){
  try{
    await signOut(auth);
    const payload = JSON.stringify({
      event:"auth",
      status:"signed_out",
      ts:Date.now(),
      timeOfDay: getTimeOfDayUTC7()
    });
    if (window.AppInventor?.setWebViewString) window.AppInventor.setWebViewString(payload);
    show(welcome);
  }catch(e){
    err("Gagal logout: " + (e.message || e));
  }
};
