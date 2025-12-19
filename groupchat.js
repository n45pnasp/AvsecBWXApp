import { getFirebase } from "./auth-guard.js";
import { 
  ref, push, set, onValue, serverTimestamp, query, limitToLast, get, child 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const { auth, db } = getFirebase();
const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const msgInput = document.getElementById("messageInput");

const DEFAULT_AVATAR = "icons/idperson.png";

let myProfile = { name: "User", photoURL: DEFAULT_AVATAR };

/**
 * Optimasi URL: Mengubah resolusi menjadi s128 dan mode crop kotak (-c)
 * agar hemat data (bit kecil)
 */
function getOptimizedPhotoURL(url, size = 128) {
  if (!url || typeof url !== 'string') return DEFAULT_AVATAR;
  if (url.includes("googleusercontent.com")) {
    return url.split('=')[0] + `=s${size}-c`;
  }
  return url;
}

/**
 * Memuat Profil: Gabungan Auth (Online) dan RTDB
 */
async function loadMyProfile(user) {
  // 1. Ambil data dasar dari Firebase Auth (Foto Online)
  myProfile.name = user.displayName || user.email.split('@')[0];
  myProfile.photoURL = user.photoURL || DEFAULT_AVATAR;

  try {
    // 2. Cek apakah ada data foto custom di RTDB (Overriding)
    const snap = await get(child(ref(db), `users/${user.uid}`));
    if (snap.exists()) {
      const data = snap.val();
      if (data.name) myProfile.name = data.name;
      // Gunakan URL dari DB jika tersedia, jika tidak tetap gunakan Auth
      if (data.photoURL) myProfile.photoURL = data.photoURL;
    }
  } catch (e) { console.error("Database error:", e); }
  
  // 3. Aplikasikan optimasi resolusi rendah
  myProfile.photoURL = getOptimizedPhotoURL(myProfile.photoURL);
}

function appendMessage(data, isMe) {
  const div = document.createElement("div");
  div.className = `msg ${isMe ? 'me' : 'other'}`;
  
  // Pastikan URL pesan juga dioptimasi saat tampil
  const photo = getOptimizedPhotoURL(data.photoURL);
  
  div.innerHTML = `
    <img src="${photo}" class="avatar" onerror="this.src='${DEFAULT_AVATAR}'">
    <div class="content">
      <div class="bubble">${data.text}</div>
    </div>
  `;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  await loadMyProfile(user);

  const chatRef = query(ref(db, 'group_messages'), limitToLast(50));
  onValue(chatRef, (snapshot) => {
    chatBox.innerHTML = "";
    snapshot.forEach((childSnap) => {
      const msgData = childSnap.val();
      appendMessage(msgData, msgData.uid === user.uid);
    });
  });
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  if (!text || !auth.currentUser) return;

  try {
    const newMsgRef = push(ref(db, 'group_messages'));
    await set(newMsgRef, {
      uid: auth.currentUser.uid,
      name: myProfile.name,
      photoURL: myProfile.photoURL, // Menyimpan foto profil yang sudah dioptimasi
      text: text,
      timestamp: serverTimestamp()
    });
    msgInput.value = "";
    msgInput.focus();
  } catch (e) { console.error("Gagal kirim:", e); }
});

document.getElementById("backBtn").onclick = () => window.location.href = "home.html";
