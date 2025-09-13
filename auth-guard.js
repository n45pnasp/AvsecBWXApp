// auth-guard.js — PATCH anti-loop & robust ?next= handling (Cloudflare/GitHub Pages friendly)
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getDatabase, ref, runTransaction, onValue, onDisconnect, update
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

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

/* =========================
 * Firebase singleton
 * ========================= */
function getFb() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db   = getDatabase(app);
  return { app, auth, db };
}
export function getFirebase() { return getFb(); }

/* =========================
 * Helpers: base & URL
 * ========================= */

// Base prefix (untuk Pages dengan subpath, mis. /AvsecBWXApp/)
function getBasePrefix() {
  const parts = location.pathname.split("/").filter(Boolean);
  // Jika deployed di subfolder (GitHub Pages user/REPO), ambil segmen pertama sebagai base
  return parts.length > 0 ? `/${parts[0]}/` : "/";
}

/** Decode repeatedly until stable (maks 3x) */
function safeMultiDecode(s) {
  if (s == null) return "";
  let prev = String(s);
  for (let i = 0; i < 3; i++) {
    try {
      const dec = decodeURIComponent(prev);
      if (dec === prev) return dec;
      prev = dec;
    } catch {
      return prev; // kalau gagal decode, pakai apa adanya
    }
  }
  return prev;
}

/** Pastikan URL tetap same-origin. Kembalikan pathname+search+hash. */
function normalizeSameOrigin(u) {
  try {
    const url = new URL(u, location.origin);
    if (url.origin !== location.origin) {
      // blok open redirect — balik ke home saja (pemanggilnya tentukan fallback)
      return null;
    }
    return url.pathname + (url.search || "") + (url.hash || "");
  } catch {
    return null;
  }
}

/** 
 * Resolve ke URL absolut berdasarkan base prefix.
 * - Menerima string yang mungkin masih mengandung %2F
 * - Boleh relatif ("home.html"), absolut path ("/AvsecBWXApp/home.html"), atau absolut same-origin
 */
function resolveToAbsolute(pathLike) {
  const base = location.origin + getBasePrefix();

  // Jika input double-encoded, pecahkan dulu
  const decoded = safeMultiDecode(pathLike || "");

  // Jika sudah URL absolut same-origin → normalize ke absolut href langsung
  try {
    const asURL = new URL(decoded);
    if (asURL.origin === location.origin) return asURL;
    // kalau beda origin, lempar ke fallback (pemanggil yang putuskan)
  } catch {
    // bukan URL absolut, lanjut
  }

  // Jika diawali "/" → treat as root-path (tetap same-origin)
  if (decoded.startsWith("/")) {
    return new URL(decoded, location.origin);
  }

  // Relatif terhadap base prefix
  return new URL(decoded, base);
}

// Cek apakah saat ini sedang di halaman login (bandingkan pathname saja)
function isOnLoginPage(loginPathAbsURL) {
  try {
    return location.pathname === loginPathAbsURL.pathname;
  } catch {
    return false;
  }
}

/* =========================
 * UI helpers
 * ========================= */
function hideDoc() { document.documentElement.style.visibility = "hidden"; }
function showDoc() { document.documentElement.style.visibility = "visible"; }

function showSingleDeviceModal(msg) {
  let modal = document.getElementById("singleDeviceModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "singleDeviceModal";
    modal.innerHTML = `
      <div class="sdm-backdrop"></div>
      <div class="sdm-dialog">
        <p id="sdm-text"></p>
        <button id="sdm-close">OK</button>
      </div>`;
    document.body.appendChild(modal);
    const style = document.createElement("style");
    style.textContent = `
#singleDeviceModal{position:fixed;top:0;left:0;width:100%;height:100%;display:none;align-items:center;justify-content:center;z-index:9999;}
#singleDeviceModal .sdm-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(2px);}
#singleDeviceModal .sdm-dialog{position:relative;background:var(--card,#111827);color:var(--text,#e5e7eb);padding:24px 20px;border-radius:16px;max-width:90%;text-align:center;border:1px solid rgba(148,163,184,.25);box-shadow:0 6px 16px rgba(0,0,0,.3);}
#singleDeviceModal button{margin-top:18px;padding:10px 18px;border:none;border-radius:12px;background:var(--accent,#A855F7);color:#fff;font-weight:600;cursor:pointer;}
#singleDeviceModal button:hover{background:var(--accent-2,#6B21A8);}
    `;
    document.head.appendChild(style);
    modal.querySelector("#sdm-close").addEventListener("click", () => {
      modal.style.display = "none";
    });
  }
  modal.querySelector("#sdm-text").textContent = msg;
  modal.style.display = "flex";
}

/* =========================
 * Device id (single-session)
 * ========================= */
function getDeviceId(){
  let id = localStorage.getItem("deviceId");
  if(!id){
    id = self.crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("deviceId", id);
  }
  return id;
}
const DEVICE_ID = getDeviceId();

/* =========================
 * Guards
 * ========================= */

/**
 * Guard: panggil di halaman yang WAJIB login (home.html, dll.)
 * Contoh:
 *   requireAuth({ loginPath: "index.html", hideWhileChecking: true })
 */
export function requireAuth({
  loginPath = "index.html",
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

  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    try {
      console.log(user ? `✅ Auth OK, UID: ${user?.uid}` : "❌ Belum login Firebase");

      if (!user) {
        // Sudah di halaman login → jangan redirect lagi
        if (!isOnLoginPage(loginAbs)) {
          const here = location.pathname + location.search + location.hash;
          const loginURL = new URL(loginAbs.href);
          // Simpan tujuan (encode SEKALI)
          if (!loginURL.searchParams.has("next")) {
            loginURL.searchParams.set("next", encodeURIComponent(here));
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

      // ===== Single-session lock di sessions/$uid/current (sesuai rules) =====
      const currRef = ref(db, `sessions/${user.uid}/current`);
      try {
        const res = await runTransaction(currRef, (cur) => {
          if (cur === null || cur === DEVICE_ID) return DEVICE_ID;
          return; // milik device lain → abort
        });
        if (!res.committed) {
          await signOut(auth);
          showSingleDeviceModal("Akun digunakan di perangkat lain. Web ini dibatasi hanya bisa login 1 device saja");
          return;
        }
      } catch (_) {
        // Abaikan error network kecil
      }

      // Cleanup saat tab/perangkat putus
      onDisconnect(currRef).remove().catch(()=>{});

      // (Opsional) catat lastAttempt
      update(ref(db, `sessions/${user.uid}/lastAttempt`), {
        device: DEVICE_ID,
        ts: Date.now()
      }).catch(()=>{});

      // Monitor sesi & percobaan login dari device lain
      const sessRef = ref(db, `sessions/${user.uid}`);
      let lastSeenAttemptTs = 0;
      onValue(sessRef, (s) => {
        const data = s.val() || {};

        if (data.current && data.current !== DEVICE_ID) {
          signOut(auth).finally(() => {
            showSingleDeviceModal("Akun digunakan di perangkat lain. Web ini dibatasi hanya bisa login 1 device saja");
          });
          return;
        }

        const att = data.lastAttempt;
        if (att && att.device !== DEVICE_ID) {
          const ts = att.ts || 0;
          if (lastSeenAttemptTs === 0) {
            lastSeenAttemptTs = ts;
          } else if (ts > lastSeenAttemptTs) {
            lastSeenAttemptTs = ts;
            showSingleDeviceModal("Ada perangkat lain mencoba masuk ke akun Anda, Web ini dibatasi hanya bisa login 1 device saja");
          }
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
 * - ?next=… diprioritaskan (multi-decode safe)
 * - fallback ke homePath (absolut)
 */
export function redirectIfAuthed({ homePath = "home.html" } = {}) {
  const { auth } = getFb();
  const homeAbs = resolveToAbsolute(homePath);

  function chooseDestination() {
    const params = new URLSearchParams(location.search);
    const rawNext = params.get("next");              // mungkin null / encoded ganda
    const nextDecoded = safeMultiDecode(rawNext);    // pecahkan sampai bersih
    // Normalisasi dan pastikan same-origin
    let dest = normalizeSameOrigin(nextDecoded);
    if (!dest) {
      // Jika next kosong/invalid/beda origin → pakai home
      return homeAbs.href;
    }
    // Ubah menjadi absolut href berbasis base prefix (kalau relatif)
    return resolveToAbsolute(dest).href;
  }

  function doRedirectIfNeeded() {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      try {
        if (user) {
          console.log(`↪️ Sudah login, redirect… UID: ${user.uid}`);
          const destHref = chooseDestination();
          if (location.href !== destHref) {
            location.replace(destHref);
          }
        }
      } finally {
        unsubscribe && unsubscribe();
      }
    });
  }

  // Jalankan saat load pertama
  doRedirectIfNeeded();
  // Jalankan kembali setiap kali halaman ditampilkan kembali (mis. tombol Back)
  window.addEventListener("pageshow", () => {
    doRedirectIfNeeded();
  });
  // Jalankan pula saat tab kembali aktif (mis. dari background)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) doRedirectIfNeeded();
  });
}
