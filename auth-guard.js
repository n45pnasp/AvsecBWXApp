// auth-guard.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

/** >>> GANTI dengan config kamu (sama seperti di home.js) <<< */
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

function getFb() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  return { app, auth };
}

/**
 * Wajibkan user sudah login. Jika belum → redirect ke login.
 * - loginPath: file halaman login kamu (mis. "login.html" atau "index.html")
 * - hideWhileChecking: sembunyikan halaman sementara agar tidak FOUC
 */
export function requireAuth({ loginPath = "login.html", hideWhileChecking = true } = {}) {
  const { auth } = getFb();

  if (hideWhileChecking) {
    document.documentElement.style.visibility = "hidden";
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      const next = encodeURIComponent(location.pathname + location.search + location.hash);
      // Pakai replace agar pengguna tidak bisa "Back" ke halaman yang dilindungi
      location.replace(`${loginPath}?next=${next}`);
      return;
    }
    // Sudah login → tampilkan halaman
    if (hideWhileChecking) {
      document.documentElement.style.visibility = "";
    }
  });
}

/**
 * Di halaman login: kalau SUDAH login → langsung lempar ke home.
 * - homePath: tujuan setelah login (mis. "home.html")
 */
export function redirectIfAuthed({ homePath = "home.html" } = {}) {
  const { auth } = getFb();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      const params = new URLSearchParams(location.search);
      const next = params.get("next");
      location.replace(next ? decodeURIComponent(next) : homePath);
    }
  });
}
