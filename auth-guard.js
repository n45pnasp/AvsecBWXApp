// auth-guard.js
// Guard halaman yang wajib login (tanpa auto sign-in).
// Diselaraskan ke Firebase Web v9.22.2.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

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

// --- Firebase singleton ---
function getFb() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  return { app, auth };
}

// --- Base prefix untuk GitHub Pages project site (mis. "/AvsecBWXApp/") ---
function getBasePrefix() {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts.length > 0 ? `/${parts[0]}/` : "/";
}

// --- Helper tampil/sembunyi dokumen ---
function hideDoc() { document.documentElement.style.visibility = "hidden"; }
function showDoc() { document.documentElement.style.visibility = "visible"; }

// Cek apakah URL saat ini sudah sama dengan loginPath (hindari loop)
function isOnLoginPage(loginPath) {
  try {
    const loginURL = new URL(loginPath, location.origin + getBasePrefix()).href;
    return location.href.startsWith(loginURL);
  } catch (_) {
    return false;
  }
}

/**
 * Guard: panggil di halaman yang WAJIB login (home.html, chatbot.html, plotting.html, dst.)
 * Contoh:
 * <script type="module">
 *   import { requireAuth } from "./auth-guard.js";
 *   requireAuth({ loginPath: "index.html", hideWhileChecking: true });
 * </script>
 *
 * Opsi:
 * - requireEmailVerified: boolean (default false). Jika true, user harus verified.
 */
export function requireAuth({
  loginPath = "index.html",
  hideWhileChecking = true,
  requireEmailVerified = false
} = {}) {
  const { auth } = getFb();

  let watchdog = null;
  if (hideWhileChecking) {
    hideDoc();
    // Watchdog: paksa visible jika 3.5s tak ada respon (jaringan lambat/terputus)
    watchdog = setTimeout(() => showDoc(), 3500);
  }

  const unsubscribe = onAuthStateChanged(auth, (user) => {
    try {
      console.log(user ? `✅ Auth OK, UID: ${user.uid}` : "❌ Belum login Firebase");

      // Tidak login → redirect ke halaman login (hindari loop)
      if (!user) {
        if (!isOnLoginPage(loginPath)) {
          const next = encodeURIComponent(location.pathname + location.search + location.hash);
          const loginURL = new URL(loginPath, location.origin + getBasePrefix()).href;
          location.replace(`${loginURL}?next=${next}`);
        } else {
          // sudah di login page: tampilkan kontennya supaya user bisa login
          showDoc();
        }
        return;
      }

      // Opsional: wajib email terverifikasi
      if (requireEmailVerified && user.email && !user.emailVerified) {
        // Tampilkan halaman; UI bisa menunjukkan banner/alert verifikasi.
        showDoc();
        return;
      }

      // User valid → tampilkan halaman
      if (hideWhileChecking) showDoc();
    } finally {
      // Matikan listener agar tidak dipanggil berkali-kali
      unsubscribe && unsubscribe();
      if (watchdog) clearTimeout(watchdog);
    }
  });
}

/**
 * Redirect dari halaman login jika user SUDAH login.
 * Pakai di index.html (login) supaya user yang sudah login langsung masuk.
 * - Jika ada ?next=… → ke situ
 * - Jika tidak → ke homePath
 */
export function redirectIfAuthed({ homePath = "home.html" } = {}) {
  const { auth } = getFb();

  const unsubscribe = onAuthStateChanged(auth, (user) => {
    try {
      if (user) {
        console.log(`↪️ Sudah login, redirect… UID: ${user.uid}`);
        const params = new URLSearchParams(location.search);
        const next = params.get("next");
        location.replace(next ? decodeURIComponent(next) : new URL(homePath, location.origin + getBasePrefix()).href);
      }
    } finally {
      unsubscribe && unsubscribe();
    }
  });
}
