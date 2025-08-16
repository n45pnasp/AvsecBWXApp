// login.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  setPersistence, browserLocalPersistence, signOut, sendPasswordResetEmail
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

/** Inject custom color styles (Ungu) */
(function injectCustomColors(){
  const style = document.createElement("style");
  (function injectCustomColors(){
  const style = document.createElement("style");
  style.textContent = `
    .btn, .net-btn {
      background-color: #9C27B0FF !important;
      color: #fff !important;
    }
    .btn:hover, .net-btn:hover {
      background-color: #6A1B9A !important;
    }
    .avatar-dark { background-color: #6A1B9A !important; }
  `;
  document.head.appendChild(style);
})();

/** Toggle password visibility (👁️ / 🙈) */
const toggleEye = document.querySelector("#togglePassword");
toggleEye?.addEventListener("click", () => {
  const isPassword = passEl.type === "password";
  passEl.type = isPassword ? "text" : "password";
  toggleEye.textContent = isPassword ? "🙈" : "👁️";
});

/** LOGO */
(function setLogo(){
  if (!logoEl) return;
  logoEl.dataset.loading = "1";
  const params   = new URLSearchParams(location.search);
  const basePath = location.pathname.substring(0, location.pathname.lastIndexOf("/") + 1);
  const url = params.get("logo") || window.LOGO_URL || `${basePath}logohome.png?v=${Date.now()}`;
  const fallback = "data:image/svg+xml;base64," + btoa(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'>
      <rect width='256' height='256' rx='40' fill='#0b1220'/>
      <g fill='#9C27B0'>
        <circle cx='92' cy='104' r='34'/>
        <rect x='132' y='70' width='60' height='68' rx='12'/>
        <rect x='52' y='154' width='140' height='24' rx='12'/>
      </g>
    </svg>`
  );
  logoEl.src = url;
  logoEl.onload  = () => { delete logoEl.dataset.loading; };
  logoEl.onerror = () => { logoEl.src = fallback; delete logoEl.dataset.loading; };
})();

/** UTIL UI */
function show(sec){
  for (const el of document.querySelectorAll(".section")) el.classList.remove("active");
  sec.classList.add("active");
  err(""); ok("");
}
function err(msg){
  if (!errBox) return;
  if (!msg){ errBox.classList.remove("show"); errBox.textContent=""; }
  else { errBox.textContent=msg; errBox.classList.add("show"); }
}
function ok(msg){
  if (!okBox) return;
  if (!msg){ okBox.classList.remove("show"); okBox.textContent=""; }
  else { okBox.textContent=msg; okBox.classList.add("show"); }
}
function disableForm(d){
  if (!loginBtn) return;
  loginBtn.disabled = d;
  loginBtn.textContent = d ? "Memproses..." : "Masuk";
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

/** ===== Offline Sheet ===== */
(function setupOfflineSheet(){
  const style = document.createElement("style");
  style.textContent = `
    .net-sheet{position:fixed;left:0;right:0;bottom:0;z-index:9999;
      background:#7f1d1d;color:#fecaca;border-top:1px solid #fecaca33;
      padding:12px 14px;display:none;gap:10px;align-items:center}
    .net-sheet.show{display:flex;animation:slideUp .18s ease-out both}
    .net-dot{width:10px;height:10px;border-radius:50%;background:#ef4444}
    .net-msg{flex:1;font-size:14px;line-height:1.3}
    .net-act{display:flex;gap:8px}
    .net-btn{background:#9C27B0FF;color:#fff;border:1px solid #6A1B9A;
      padding:8px 10px;border-radius:10px;cursor:pointer}
    .net-btn:hover{background:#6A1B9A;}
    @keyframes slideUp{from{transform:translateY(8px);opacity:.0}to{transform:none;opacity:1}}
  `;
  document.head.appendChild(style);

  const sheet = document.createElement("div");
  sheet.className = "net-sheet";
  sheet.innerHTML = `
    <div class="net-dot"></div>
    <div class="net-msg">Tidak ada koneksi internet. Cek jaringan Anda.</div>
    <div class="net-act"><button class="net-btn" id="netRetryBtn">Coba Lagi</button></div>
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

/** (opsional) Avatar default */
const DEFAULT_AVATAR =
  "data:image/svg+xml;base64," + btoa(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>
      <rect width='128' height='128' rx='18' fill='#0b1220'/>
      <circle cx='64' cy='52' r='22' fill='#9C27B0'/>
      <rect x='26' y='84' width='76' height='26' rx='13' fill='#6A1B9A'/>
    </svg>`
  );

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

/** Kirim ke Kodular + simpan profil + goto Home */
async function notifyKodularAndGoHome(status, user){
  const prof = await fetchProfile(user);

  // 1) Simpan ke sessionStorage agar bisa dibaca home.js (pengganti TinyDB)
  try {
    sessionStorage.setItem("authProfile", JSON.stringify({
      uid: user.uid,
      email: user.email || null,
      name: prof.name,
      photoURL: prof.photoURL,
      role: prof.role,
      isAdmin: prof.isAdmin,
      ts: Date.now()
    }));
    // tanda baru login untuk anti-bounce di home.js
    sessionStorage.setItem("justSignedIn", "1");
  } catch (_) {}

  // 2) (opsional) kirim ke Kodular
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
  } else {
    document.title = payload; // fallback
  }

  ok(status==="success" ? "Login berhasil. Mengalihkan ke Home..." : "Sesi ditemukan. Mengalihkan ke Home...");
  // 3) Arahkan ke Home (pakai replace agar history bersih)
  setTimeout(()=>{ location.replace("home.html"); }, 600);
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

/** AUTO-SKIP jika sudah login / handle logout */
onAuthStateChanged(auth, async (user)=>{
  const params = new URLSearchParams(location.search);
  const wantLogout = params.get("logout") === "1";

  if (wantLogout) {
    // Jika datang dari home → logout
    await window.logout();
    return;
  }

  if (user){
    await notifyKodularAndGoHome("already_signed_in", user);
  }else{
    show(welcome);
  }
});

/** LOGOUT (dipanggil dari index.html?logout=1 atau manual) */
window.logout = async function(){
  try{
    await signOut(auth);
    sessionStorage.removeItem("authProfile");
    sessionStorage.removeItem("justSignedIn");
    ok("Berhasil keluar.");
    show(welcome);
  }catch(e){
    err("Gagal logout: " + (e.message || e));
  }
};

// Lupa password (butuh elemen #forgotBtn di HTML-mu)
document.querySelector("#forgotBtn")?.addEventListener("click", async ()=>{
  const email = (emailEl?.value || "").trim();
  if (!email) return err("Masukkan email terlebih dahulu.");
  try{
    await sendPasswordResetEmail(auth, email);
    ok("Link reset password telah dikirim.");
  }catch(e){
    err("Gagal kirim reset: " + (e.code || e.message || e));
  }
});
