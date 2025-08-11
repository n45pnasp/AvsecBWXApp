// home.js (FINAL)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, get, child, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

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

/* ============ Helpers & UI ============ */
const $ = (s, el = document) => el.querySelector(s);
const params = new URLSearchParams(location.search);

function getWIBDate(d = new Date()){
  return new Date(d.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
}
function bannerString(){
  const d = getWIBDate();
  const hari  = d.toLocaleDateString('id-ID', { weekday: 'long' });
  const tanggal = d.getDate();
  const bulan = d.toLocaleDateString('id-ID', { month: 'long' });
  const tahun = d.getFullYear();
  return `${hari}, ${tanggal} ${bulan} ${tahun}`;
}
function getGreetingID(d = getWIBDate()){
  const h = d.getHours();
  if (h >= 4 && h < 11)  return "Selamat Pagi,";
  if (h >= 11 && h < 15) return "Selamat Siang,";
  if (h >= 15 && h < 18) return "Selamat Sore,";
  return "Selamat Malam,";
}
function updateGreeting(){
  $("#greet")?.textContent = getGreetingID();
  const k = ($("#greet")?.textContent || "").split(" ")[1];
  const tips = {
    Pagi:"Fokus & semangat produktif ☕",
    Siang:"Jeda sejenak, tarik napas 🌤️",
    Sore:"Akhiri dengan manis 🌇",
    Malam:"Santai, recharge energi 🌙"
  };
  $("#taglineText")!.textContent = tips[k] || "Siap bantu aktivitasmu hari ini ✨";
  $("#dateBanner")!.textContent = bannerString();
}

/* ============ Profile State ============ */
let CURRENT_NAME = "Pengguna";
let CURRENT_PHOTO = "";

const DEFAULT_AVATAR = "data:image/svg+xml;base64," + btoa(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>
     <rect width='128' height='128' rx='18' fill='#0b1220'/>
     <circle cx='64' cy='50' r='22' fill='#7c9bff'/>
     <rect x='26' y='84' width='76' height='26' rx='13' fill='#1f2937'/>
   </svg>`
);

function setAvatarSrc(src){
  const img = $("#avatar");
  if (img) img.src = src;
}
function makeInitialsAvatar(name){
  const initials = (name || "P U").trim().split(/\s+/).map(w => w[0]).slice(0,2).join("").toUpperCase();
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0,0,256,256);
  g.addColorStop(0, "#1b2238"); g.addColorStop(1, "#151b2e");
  x.fillStyle = g; x.fillRect(0,0,256,256);
  x.fillStyle = "#7c9bff"; x.font = "bold 120px ui-sans-serif";
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(initials, 128, 140);
  return c.toDataURL("image/png");
}
function applyProfile({ name, photo }){
  if (name){
    CURRENT_NAME = name;
    $("#name") && ($("#name").textContent = name);
  }
  if (photo){
    CURRENT_PHOTO = photo;
    setAvatarSrc(photo);
  } else if (!CURRENT_PHOTO){
    CURRENT_PHOTO = makeInitialsAvatar(CURRENT_NAME);
    setAvatarSrc(CURRENT_PHOTO);
  }
}

/* ============ Greet Card (toggle avatar ↔ tombol logout) ============ */
(function setupGreetCard(){
  const card        = $("#greetCard");
  const profileSlot = $("#profileSlot");
  if (!card || !profileSlot) return;

  function renderProfileSlot(showLogout){
    if (showLogout){
      profileSlot.innerHTML =
        '<button id="logoutBtn" class="logout-btn" title="Logout" aria-label="Logout">Logout</button>';
      $("#logoutBtn")?.addEventListener("click", async (e)=>{
        e.stopPropagation();

        // 1) Kirim nilai "logout" ke Kodular (jika ada)
        try {
          if (window.AppInventor?.setWebViewString) {
            window.AppInventor.setWebViewString("logout");
          }
        } catch(_){}

        // 2) Sign out dari Firebase
        try { await signOut(auth); } catch(e) { console.warn("Sign out error:", e); }

        // 3) Redirect ke login.html
        location.replace("./login.html");
      });
    }else{
      profileSlot.innerHTML =
        `<img id="avatar" class="avatar-large" alt="Foto pengguna" src="${CURRENT_PHOTO || ""}" />`;
    }
  }

  // Tampilan awal avatar
  renderProfileSlot(false);
  card.setAttribute("aria-pressed", "false");

  // Klik kartu → toggle avatar ↔ tombol logout
  card.addEventListener("click", ()=>{
    const active = card.getAttribute("aria-pressed") === "true";
    const next = !active;
    card.setAttribute("aria-pressed", String(next));
    renderProfileSlot(next);
  });
})();

/* ============ RTDB: ambil & kirim ke Kodular ============ */
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

  return { uid: user.uid, name, spec, role, isAdmin, email: user.email || "", photoURL };
}

function sendToKodular(data){
  const jsonStr = JSON.stringify({ event: "profile", ...data });
  if (window.AppInventor && typeof window.AppInventor.setWebViewString === "function"){
    try { window.AppInventor.setWebViewString(jsonStr); }
    catch(e){ console.warn("setWebViewString error:", e); }
  } else {
    // debug di browser
    console.log("[KODULAR_SIMULATE]", jsonStr);
  }
}

function subscribeProfile(user){
  const userRef = ref(db, `users/${user.uid}`);
  return onValue(userRef, (snap)=>{
    const v = snap.val() || {};
    const name = (v.name || user.displayName || user.email?.split("@")[0] || "Pengguna").toString().trim();
    const photoURL = (v.photoURL || user.photoURL || DEFAULT_AVATAR).toString().trim();

    applyProfile({ name, photo: photoURL });

    // kirim update realtime ke Kodular
    sendToKodular({
      uid: user.uid,
      name,
      spec: (v.spec || ""),
      role: (v.role || (v.isAdmin ? "admin" : "user")),
      isAdmin: !!v.isAdmin,
      email: user.email || "",
      photoURL
    });
  }, (err)=>{
    console.warn("RTDB subscribe error:", err?.message || err);
  });
}

/* ============ Init ============ */
function tick(){ updateGreeting(); }
tick();
setInterval(tick, 60 * 1000);

let unsubProfile = null;

onAuthStateChanged(auth, async (user)=>{
  if (!user){
    location.replace("./login.html");
    return;
  }

  // Render cepat dari Auth
  applyProfile({
    name: user.displayName || user.email?.split("@")[0] || "Pengguna",
    photo: user.photoURL || ""
  });

  // Ambil RTDB & kirim ke Kodular
  try{
    const prof = await fetchFullProfile(user);
    applyProfile({ name: prof.name, photo: prof.photoURL });
    sendToKodular(prof);
  }catch(e){
    console.warn("fetchFullProfile error:", e?.message || e);
    // tetap kirim minimal dari Auth
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

/* Opsional: Kodular bisa panggil ini untuk minta kirim ulang profil */
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
