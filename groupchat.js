// groupchat.js — FINAL & INTEGRATED
import { getFirebase } from "./auth-guard.js";
import { 
  ref, push, set, onValue, serverTimestamp, query, limitToLast, get, child 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const { auth, db } = getFirebase();
const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const msgInput = document.getElementById("messageInput");
const statusInfo = document.getElementById("statusInfo");

// Default Avatar SVG sesuai login.js
const DEFAULT_AVATAR = "data:image/svg+xml;base64," + btoa(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>
    <rect width='128' height='128' rx='18' fill='#0b1220'/>
    <circle cx='64' cy='52' r='22' fill='#9C27B0'/>
    <rect x='26' y='84' width='76' height='26' rx='13' fill='#6A1B9A'/>
  </svg>`
);

let myProfile = { name: "User", photoURL: DEFAULT_AVATAR };

/**
 * MENGAMBIL PROFIL DARI RTDB
 */
async function loadMyProfile(user) {
  try {
    const userRef = ref(db, `users/${user.uid}`);
    const snap = await get(userRef);
    
    if (snap.exists()) {
      const data = snap.val();
      myProfile.name = data.name || user.displayName || user.email.split('@')[0];
      // Ambil field photoURL dari RTDB
      myProfile.photoURL = data.photoURL || user.photoURL || DEFAULT_AVATAR;
    } else {
      myProfile.name = user.displayName || user.email.split('@')[0];
      myProfile.photoURL = user.photoURL || DEFAULT_AVATAR;
    }
  } catch (e) {
    console.error("Gagal sinkronisasi profil:", e);
  }
}

/**
 * MENAMPILKAN PESAN
 */
function appendMessage(data, isMe) {
  const div = document.createElement("div");
  div.className = `msg ${isMe ? 'me' : 'other'}`;
  
  const photo = data.photoURL || DEFAULT_AVATAR;
  
  div.innerHTML = `
    <img src="${photo}" class="avatar" onerror="this.src='${DEFAULT_AVATAR}'">
    <div class="content">
      <span class="sender-name">${isMe ? 'Anda' : (data.name || 'User')}</span>
      <div class="bubble">${data.text}</div>
    </div>
  `;
  
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Listener Status Auth
auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  
  if (statusInfo) statusInfo.textContent = "Sinkronisasi Profil...";
  await loadMyProfile(user);
  if (statusInfo) statusInfo.textContent = "Online";

  const chatRef = query(ref(db, 'group_messages'), limitToLast(50));
  onValue(chatRef, (snapshot) => {
    chatBox.innerHTML = ""; 
    snapshot.forEach((childSnap) => {
      const msgData = childSnap.val();
      appendMessage(msgData, msgData.uid === user.uid);
    });
  });
});

// Listener Kirim Pesan
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  if (!text || !auth.currentUser) return;

  try {
    const newMsgRef = push(ref(db, 'group_messages'));
    await set(newMsgRef, {
      uid: auth.currentUser.uid,
      name: myProfile.name,
      photoURL: myProfile.photoURL, // Menyimpan URL foto saat ini ke pesan
      text: text,
      timestamp: serverTimestamp()
    });
    msgInput.value = "";
  } catch (e) {
    console.error("Gagal mengirim:", e);
  }
});

// Tombol Kembali
const backBtn = document.getElementById("backBtn");
if (backBtn) backBtn.onclick = () => window.location.href = "home.html";
