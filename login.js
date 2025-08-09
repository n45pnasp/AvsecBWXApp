// login.js (module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  setPersistence, browserLocalPersistence, signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

/** 1) GANTI DENGAN punyamu (Firebase Console -> Project settings) */
const firebaseConfig = {
  apiKey: "AIzaSyBc-kE-_q1yoENYECPTLC3EZf_GxBEwrWY",
  authDomain: "avsecbwx-4229c.firebaseapp.com",
  projectId: "avsecbwx-4229c",
  appId: "1:1029406629258:web:53e8f09585cd77823efc73",
};

/** 2) INIT */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// Pastikan sesi PERSISTEN (tetap login setelah app ditutup/dibuka lagi)
await setPersistence(auth, browserLocalPersistence);

/** 3) ELEMENTS */
const $ = (q) => document.querySelector(q);
const welcome = $("#welcome");
const login = $("#login");
const goLoginBtn = $("#goLoginBtn");
const backBtn = $("#backBtn");
const form = $("#loginForm");
const emailEl = $("#email");
const passEl = $("#password");
const loginBtn = $("#loginBtn");
const errBox = $("#errBox");
const okBox = $("#okBox");
const yearEl = $("#year");
const logoEl = $("#appLogo");
if (yearEl) yearEl.textContent = new Date().getFullYear();

/** 4) LOGO SETUP (via ?logo=... atau window.LOGO_URL) */
(function setLogo() {
  const params = new URLSearchParams(location.search);
  const url = params.get("logo") || window.LOGO_URL || "";
  if (url && logoEl) logoEl.src = url;
  else if (logoEl) {
    // fallback kecil (SVG inline base64 transparan)
    logoEl.src =
      "data:image/svg+xml;base64," +
      btoa(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'>
        <rect width='256' height='256' rx='40' fill='#0b1220'/>
        <g fill='#22c55e'>
          <circle cx='92' cy='104' r='34'/>
          <rect x='132' y='70' width='60' height='68' rx='12'/>
          <rect x='52' y='154' width='140' height='24' rx='12'/>
        </g>
      </svg>`);
  }
})();

/** 5) UTIL */
function show(sec) {
  for (const el of document.querySelectorAll(".section")) el.classList.remove("active");
  sec.classList.add("active");
  err(""); ok("");
}
function err(msg) {
  if (!msg) { errBox.classList.remove("show"); errBox.textContent = ""; }
  else { errBox.textContent = msg; errBox.classList.add("show"); }
}
function ok(msg) {
  if (!msg) { okBox.classList.remove("show"); okBox.textContent = ""; }
  else { okBox.textContent = msg; okBox.classList.add("show"); }
}
function disableForm(d) {
  loginBtn.disabled = d;
  loginBtn.textContent = d ? "Memproses..." : "Masuk";
}

/** 6) NAV */
goLoginBtn?.addEventListener("click", () => show(login));
backBtn?.addEventListener("click", () => show(welcome));

/** 7) LOGIN: Email & Password */
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  err(""); ok("");
  const email = emailEl.value.trim();
  const pass = passEl.value;

  if (!email || !pass) { err("Email & kata sandi wajib diisi."); return; }
  disableForm(true);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const user = cred.user;

    notifyKodularAndGoHome("success", user);
  } catch (e) {
    const map = {
      "auth/invalid-email": "Format email tidak valid.",
      "auth/user-not-found": "Akun tidak ditemukan.",
      "auth/wrong-password": "Kata sandi salah.",
      "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti.",
      "auth/user-disabled": "Akun dinonaktifkan."
    };
    err(map[e.code] || ("Gagal login: " + (e.message || e)));
  } finally {
    disableForm(false);
  }
});

/** 8) AUTO-REDIRECT kalau SUDAH login (skip welcome/login) */
onAuthStateChanged(auth, (user) => {
  if (user) {
    // JANGAN tampilkan form — langsung arahkan
    notifyKodularAndGoHome("already_signed_in", user);
  } else {
    // Tampilkan welcome sebagai default
    show(welcome);
  }
});

/** 9) Helper kirim sinyal ke Kodular & delay sejenak */
function notifyKodularAndGoHome(status, user) {
  const payload = JSON.stringify({
    event: "auth",
    status,
    uid: user.uid,
    email: user.email || null,
    ts: Date.now()
  });

  if (window.AppInventor && typeof window.AppInventor.setWebViewString === "function") {
    window.AppInventor.setWebViewString(payload);
  } else {
    document.title = payload; // fallback
  }

  ok(status === "success" ? "Login berhasil. Mengalihkan ke Home..." : "Sesi ditemukan. Mengalihkan ke Home...");
  // beri waktu Kodular menangkap WebViewString
  setTimeout(() => {
    // Bisa juga pakai scheme: location.href = "kodular://home";
  }, 600);
}

/** 10) LOGOUT bisa dipanggil dari Kodular:
 *    WebViewer.EvaluateJavaScript("logout()")
 */
window.logout = async function logout() {
  try {
    await signOut(auth);
    // optional: beri tahu Kodular bahwa sesi sudah keluar
    const payload = JSON.stringify({ event: "auth", status: "signed_out", ts: Date.now() });
    if (window.AppInventor && typeof window.AppInventor.setWebViewString === "function") {
      window.AppInventor.setWebViewString(payload);
    }
    // Kembali ke halaman welcome
    show(welcome);
  } catch (e) {
    err("Gagal logout: " + (e.message || e));
  }
};
