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
 * Mengolah URL agar resolusi kecil (bit kecil) dan kotak (1:1)
 * Mendukung Google Auth Profile & Google Drive Links
 */
function getOptimizedPhotoURL(url, size = 128) {
  if (!url || typeof url !== 'string') return DEFAULT_AVATAR;

  // Optimasi link Google Drive (id=...) ke format thumbnail
  if (url.includes("drive.google.com") || url.includes("drive.usercontent.google.com")) {
    const fileIdMatch = url.match(/id=([-\w]+)/) || url.match(/\/d\/([-\w]+)/);
    if (fileIdMatch) {
      return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w${size}-h${size}`;
    }
  }

  // Optimasi link Google Auth Profile (googleusercontent)
  if (url.includes("googleusercontent.com")) {
    return url.split('=')[0] + `=s${size}-c`;
  }

  return url;
}

/**
 * Memuat profil dari Auth (online) dan RTDB (database)
 */
async function loadMyProfile(user) {
  try {
    // 1. Ambil data dasar dari Firebase Auth
    myProfile.name = user.displayName || user.email.split('@')[0];
    myProfile.photoURL = user.photoURL || DEFAULT_AVATAR;

    // 2. Cek override di Realtime Database
    const snap = await get(child(ref(db), `users/${user.uid}`));
    if (snap.exists()) {
      const data = snap.val();
      if (data.name) myProfile.name = data.name;
      if (data.photoURL) myProfile.photoURL = data.photoURL;
    }
    
    // 3. Aplikasikan optimasi resolusi
    myProfile.photoURL = getOptimizedPhotoURL(myProfile.photoURL);
  } catch (e) { console.error("Error muat profil:", e); }
}

function appendMessage(data, isMe) {
  const div = document.createElement("div");
  div.className = `msg ${isMe ? 'me' : 'other'}`;
  
  // Optimasi URL foto setiap pesan yang muncul
  const photo = getOptimizedPhotoURL(data.photoURL);
  
  div.innerHTML = `
    <img src="${photo}" class="avatar" onerror="this.src='${DEFAULT_AVATAR}'" alt="avatar">
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

  // Ambil data chat realtime
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
      photoURL: myProfile.photoURL, // Simpan versi foto yang sudah dioptimasi
      text: text,
      timestamp: serverTimestamp()
    });
    msgInput.value = "";
    msgInput.focus();
  } catch (e) { console.error("Gagal kirim pesan:", e); }
});

document.getElementById("backBtn").onclick = () => window.location.href = "home.html";
