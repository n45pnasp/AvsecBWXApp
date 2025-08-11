// home.js (FINAL, module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getDatabase, ref, get, child, onValue
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

/* ============ Firebase Config ============ */
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getDatabase(app);

/* ============ DOM Helpers ============ */
const $ = s => document.querySelector(s);
const nameEl    = $("#name");
const emailEl   = $("#email");
const avatarEl  = $("#avatar");
const logoutBtn = $("#logoutBtn");

/* ============ Avatar default ============ */
const DEFAULT_AVATAR = "data:image/svg+xml;base64," + btoa(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>
     <rect width='128' height='128' rx='18' fill='#0b1220'/>
     <circle cx='64' cy='50' r='22' fill='#7c9bff'/>
     <rect x='26' y='84' width='76' height='26' rx='13' fill='#1f2937'/>
   </svg>`
);

/* ============ UI Render ============ */
function setProfile({ name, email, photoURL }){
  if (nameEl)  nameEl.textContent  = name || "Pengguna";
  if (emailEl) emailEl.textContent = email || "";
  if (avatarEl){
    avatarEl.src = photoURL || DEFAULT_AVATAR;
    avatarEl.alt = name ? `Avatar ${name}` : "Avatar";
  }
}

/* ============ Ambil profil lengkap dari RTDB ============ */
async function fetchFullProfile(user){
  const root = ref(db);
  const snaps = await Promise.all([
    get(child(root, `users/${user.uid}/name`)),
    get(child(root, `users/${user.uid}/spec`)),
    get(child(root, `users/${user.uid}/role`)),
    get(child(root, `users/${user.uid}/isAdmin`)),
    get(child(root, `users/${user.uid}/photoURL`))
  ]);

  const [nameSnap, specSnap, roleSnap, isAdminSnap, photoSnap] = snaps;

  const name = nameSnap.exists() ? String(nameSnap.val()).trim()
            : (user.displayName?.trim() || (user.email?.split("@")[0] ?? "Pengguna"));
  const spec = specSnap.exists() ? String(specSnap.val()).trim() : "";
  const role = roleSnap.exists() ? String(roleSnap.val()).trim()
            : (isAdminSnap.exists() && isAdminSnap.val() ? "admin" : "user");
  const isAdmin = isAdminSnap.exists() ? !!isAdminSnap.val() : role === "admin";

  const fromRTDB = photoSnap.exists() ? String(photoSnap.val()).trim() : "";
  const fromAuth = (user.photoURL || "").trim();
  const photoURL = fromRTDB || fromAuth || DEFAULT_AVATAR;

  return {
    uid: user.uid,
    name,
    spec,
    role,
    isAdmin,
    email: user.email || "",
    photoURL
  };
}

/* ============ Kirim ke Kodular ============ */
function sendToKodular(data){
  const jsonStr = JSON.stringify({
    event: "profile",
    ...data
  });
  if (window.AppInventor && typeof window.AppInventor.setWebViewString === "function"){
    try { window.AppInventor.setWebViewString(jsonStr); }
    catch(e){ console.warn("setWebViewString error:", e); }
  } else {
    // Untuk debug di browser biasa:
    console.log("[KODULAR_SIMULATE]", jsonStr);
  }
}

/* ============ Realtime subscribe (opsional, tapi aktif) ============ */
function subscribeProfile(user){
  const userRef = ref(db, `users/${user.uid}`);
  // Kembalikan fungsi unsubscribe dari onValue
  return onValue(userRef, (snap)=>{
    const v = snap.val() || {};
    const name = (v.name || auth.currentUser?.displayName || auth.currentUser?.email?.split("@")[0] || "Pengguna").toString().trim();
    const email = auth.currentUser?.email || "";
    const photoURL = (v.photoURL || auth.currentUser?.photoURL || "").toString().trim();

    // Render ke UI
    setProfile({ name, email, photoURL });

    // Kirim ulang ke Kodular saat ada perubahan
    sendToKodular({
      uid: user.uid,
      name,
      spec: (v.spec || ""),
      role: (v.role || (v.isAdmin ? "admin" : "user")),
      isAdmin: !!v.isAdmin,
      email,
      photoURL: photoURL || DEFAULT_AVATAR
    });
  }, (err)=>{
    console.warn("RTDB subscribe error:", err?.message || err);
  });
}

/* ============ Auth flow ============ */
let unsubProfile = null;

onAuthStateChanged(auth, async (user)=>{
  if (!user){
    // Belum login → balik ke login
    location.replace("./login.html");
    return;
  }

  // Render cepat dari Auth
  setProfile({
    name: user.displayName || user.email?.split("@")[0],
    email: user.email || "",
    photoURL: user.photoURL || ""
  });

  // Ambil profil lengkap dari RTDB, kirim ke Kodular
  try{
    const prof = await fetchFullProfile(user);

    setProfile({
      name: prof.name,
      email: prof.email,
      photoURL: prof.photoURL
    });

    sendToKodular(prof);
  }catch(e){
    console.warn("fetchFullProfile error:", e?.message || e);
    // Tetap kirim minimal payload dari Auth agar Kodular punya data
    sendToKodular({
      uid: user.uid,
      name: user.displayName || user.email?.split("@")[0] || "Pengguna",
      spec: "",
      role: "user",
      isAdmin: false,
      email: user.email || "",
      photoURL: user.photoURL || DEFAULT_AVATAR
    });
  }

  // Realtime update
  if (unsubProfile) { try { unsubProfile(); } catch(_){} }
  unsubProfile = subscribeProfile(user);
});

/* ============ Logout ============ */
logoutBtn?.addEventListener("click", async ()=>{
  try{
    await signOut(auth);
  } finally {
    location.replace("./login.html");
  }
});

/* ============ API tambahan untuk Kodular (opsional) ============ */
// Kodular bisa panggil JS function ini via WebViewer.EvaluateJavaScript
// untuk minta kirim ulang profil kapan saja.
window.requestProfile = async function(){
  const user = auth.currentUser;
  if (!user) return;
  try{
    const prof = await fetchFullProfile(user);
    sendToKodular(prof);
  }catch(e){
    sendToKodular({
      uid: user.uid,
      name: user.displayName || user.email?.split("@")[0] || "Pengguna",
      spec: "",
      role: "user",
      isAdmin: false,
      email: user.email || "",
      photoURL: user.photoURL || DEFAULT_AVATAR
    });
  }
};
