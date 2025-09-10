// auth-guard.js — PATCH anti-loop (Cloudflare/GitHub Pages friendly)
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

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
  const db   = getDatabase(app);
  return { app, auth, db };
}
export function getFirebase() { return getFb(); }

// --- Base prefix (untuk Pages dengan subpath, mis. /AvsecBWXApp/) ---
function getBasePrefix() {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts.length > 0 ? `/${parts[0]}/` : "/";
}

// Pastikan loginPath/homePath selalu absolut terhadap base prefix
function resolveToAbsolute(pathLike) {
  // Jika pathLike sudah absolut (diawali "/"), gunakan apa adanya terhadap origin.
  // Jika relatif, sandarkan ke base prefix (root repo / subfolder).
  const base = location.origin + getBasePrefix();
  return new URL(pathLike, base);
}

// Cek apakah saat ini sedang di halaman login (bandingkan pathname saja)
function isOnLoginPage(loginPathAbsURL) {
  try {
    return location.pathname === loginPathAbsURL.pathname;
  } catch {
    return false;
  }
}

// --- Helper tampil/sembunyi dokumen ---
function hideDoc() { document.documentElement.style.visibility = "hidden"; }
function showDoc() { document.documentElement.style.visibility = "visible"; }

/**
 * Guard: panggil di halaman yang WAJIB login (home.html, dll.)
 * Contoh:
 *   requireAuth({ loginPath: "/index.html", hideWhileChecking: true })
 */
function getDeviceId(){
  let id = localStorage.getItem("deviceId");
  if(!id){
    id = self.crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("deviceId", id);
  }
  return id;
}
const DEVICE_ID = getDeviceId();

export function requireAuth({
  loginPath = "/index.html",
  hideWhileChecking = true,
  requireEmailVerified = false
} = {}) {
  const { auth, db } = getFb();

  const loginAbs = resolveToAbsolute(loginPath); // URL absolut
  let watchdog = null;

  if (hideWhileChecking) {
    hideDoc();
    watchdog = setTimeout(() => showDoc(), 3500);
  }

  const unsubscribe = onAuthStateChanged(auth, (user) => {
    try {
      console.log(user ? `✅ Auth OK, UID: ${user.uid}` : "❌ Belum login Firebase");

      if (!user) {
        // Sudah di halaman login → jangan redirect lagi
        if (!isOnLoginPage(loginAbs)) {
          // Hindari membawa hash agar tidak muncul #index.html berulang
          const next = encodeURIComponent(location.pathname + location.search);
          // Jika URL login saat ini sudah punya ?next, jangan tumpuk lagi
          const loginURL = new URL(loginAbs.href);
          if (!loginURL.searchParams.has("next")) {
            loginURL.searchParams.set("next", next);
          }
          location.replace(loginURL.href);
        } else {
          showDoc();
        }
        return;
      }

      if (requireEmailVerified && user.email && !user.emailVerified) {
        showDoc();
        return;
      }

      const sessRef = ref(db, `sessions/${user.uid}`);
      set(sessRef, DEVICE_ID).catch(()=>{});
      onDisconnect(sessRef).remove().catch(()=>{});
      onValue(sessRef, s => {
        const val = s.val();
        if (val && val !== DEVICE_ID) {
          signOut(auth).finally(()=>alert("Akun digunakan di perangkat lain."));
        }
      });

      if (hideWhileChecking) showDoc();
    } finally {
      unsubscribe && unsubscribe();
      if (watchdog) clearTimeout(watchdog);
    }
  });
}

/**
 * Pakai di index.html (login): jika user sudah login, langsung redirect.
 * - ?next=… diprioritaskan
 * - fallback ke homePath (absolut)
 */
export function redirectIfAuthed({ homePath = "/home/" } = {}) {
  const { auth } = getFb();
  const homeAbs = resolveToAbsolute(homePath);

  const unsubscribe = onAuthStateChanged(auth, (user) => {
    try {
      if (user) {
        console.log(`↪️ Sudah login, redirect… UID: ${user.uid}`);
        const params = new URLSearchParams(location.search);
        const next = params.get("next");
        const dest = next ? decodeURIComponent(next) : homeAbs.href;
        location.replace(dest);
      }
    } finally {
      unsubscribe && unsubscribe();
    }
  });
}
