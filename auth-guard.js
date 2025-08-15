// auth-guard.js
// Versi final: perbaikan unhide (visible), anti-blank, dan path aman untuk GitHub Pages project site.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

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

// --- Helper tampil/sembunyi dokumen (inline style > CSS eksternal) ---
function hideDoc() {
  document.documentElement.style.visibility = "hidden";
}
function showDoc() {
  document.documentElement.style.visibility = "visible";
}

/**
 * Guard: panggil di halaman yang WAJIB login (home.html, chatbot.html, plotting.html, dst.)
 * Contoh:
 * <script type="module">
 *   import { requireAuth } from "./auth-guard.js";
 *   requireAuth({ loginPath: "index.html", hideWhileChecking: true });
 * </script>
 */
export function requireAuth({ loginPath = "index.html", hideWhileChecking = true } = {}) {
  const { auth } = getFb();

  // Sembunyikan konten selama cek session (hindari flicker / bocor UI)
  let watchdog = null;
  if (hideWhileChecking) {
    hideDoc();
    // Watchdog: paksa visible jika 3.5s tak ada respon (jaringan lambat/terputus)
    watchdog = setTimeout(() => showDoc(), 3500);
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      // Bawa rute sekarang sebagai ?next=… agar setelah login bisa balik
      const next = encodeURIComponent(location.pathname + location.search + location.hash);
      const loginURL = new URL(loginPath, location.origin + getBasePrefix()).href;
      location.replace(`${loginURL}?next=${next}`);
      return;
    }
    // User valid → tampilkan halaman
    if (hideWhileChecking) {
      clearTimeout(watchdog);
      showDoc(); // PENTING: jangan "", harus "visible"
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

  onAuthStateChanged(auth, (user) => {
    if (user) {
      const params = new URLSearchParams(location.search);
      const next = params.get("next");
      if (next) {
        location.replace(decodeURIComponent(next));
      } else {
        const homeURL = new URL(homePath, location.origin + getBasePrefix()).href;
        location.replace(homeURL);
      }
    }
  });
}
