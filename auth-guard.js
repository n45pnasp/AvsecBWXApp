// auth-guard.js
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

function getFb() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  return { app, auth };
}

// Cari base path repo di GitHub Pages → "/AvsecBWXApp/"
function getBasePrefix() {
  const parts = location.pathname.split("/").filter(Boolean);
  return parts.length > 0 ? `/${parts[0]}/` : "/";
}

export function requireAuth({ loginPath = "index.html", hideWhileChecking = true } = {}) {
  const { auth } = getFb();

  if (hideWhileChecking) {
    document.documentElement.style.visibility = "hidden";
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      const next = encodeURIComponent(location.pathname + location.search + location.hash);
      const loginURL = new URL(loginPath, location.origin + getBasePrefix()).href;
      location.replace(`${loginURL}?next=${next}`);
      return;
    }
    if (hideWhileChecking) {
      document.documentElement.style.visibility = "";
    }
  });
}

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
