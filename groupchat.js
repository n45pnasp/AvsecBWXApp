// groupchat.js — FINAL & LENGKAP
import { getFirebase } from "./auth-guard.js";
import { 
  ref, push, set, onValue, serverTimestamp, query, limitToLast, get, child 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const { auth, db } = getFirebase();
const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const msgInput = document.getElementById("messageInput");
const statusInfo = document.getElementById("statusInfo");

// Default Avatar SVG yang konsisten dengan login.js
const DEFAULT_AVATAR = "data:image/svg+xml;base64," + btoa(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>
    <rect width='128' height='128' rx='18' fill='#0b1220'/>
    <circle cx='64' cy='52' r='22' fill='#9C27B0'/>
    <rect x='26' y='84' width='76' height='26' rx='13' fill='#6A1B9A'/>
  </svg>`
);

let myProfile = { name: "User", photoURL: DEFAULT_AVATAR };

/**
 * MENGAMBIL DATA PROFIL DARI RTDB
 * Memastikan foto diambil dari users/${uid}/photoURL
 */
async function loadMyProfile(user) {
  try {
    const userRef = ref(db, `users/${user.uid}`);
    const snap = await get(userRef);
    
    if (snap.exists()) {
      const data = snap.val();
      // Mengambil nama dari database atau fallback ke email
      myProfile.name = data.name || user.displayName || user.email.split('@')[0];
      // MENGAMBIL URL FOTO LANGSUNG DARI RTDB
      myProfile.photoURL = data.photoURL || user.photoURL || DEFAULT_AVATAR;
    } else {
      myProfile.name = user.displayName || user.email.split('@')[0];
      myProfile.photoURL = user.photoURL || DEFAULT_AVATAR;
    }
    console.log("Profil dimuat:", myProfile.name);
  } catch (e) {
    console.error("Gagal sinkronisasi profil dari RTDB:", e);
  }
}

/**
 * MENAMPILKAN PESAN KE UI
 */
function appendMessage(data, isMe) {
  const div = document.createElement("div");
  div.className = `msg ${isMe ? 'me' : 'other'}`;
  
  // Gunakan photoURL yang tersimpan di dalam data pesan
  const photo = data.photoURL || DEFAULT_AVATAR;
  
  div.innerHTML = `
    <img src="${photo}" class="avatar" onerror="this.src='${DEFAULT_AVATAR}'" alt="avatar">
    <div class="content">
      <span class="sender-name">${isMe ? 'Anda' : (data.name || 'User')}</span>
      <div class="bubble">${data.text}</div>
    </div>
  `;
  
  chatBox.appendChild(div);
  // Auto-scroll ke pesan terbaru
  chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * INISIALISASI AUTH & LISTENER REALTIME
 */
auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  
  if (statusInfo) statusInfo.textContent = "Menghubungkan...";
  
  // Muat profil dari RTDB sebelum mulai chatting
  await loadMyProfile(user);
  
  if (statusInfo) statusInfo.textContent = "Online";

  // Ambil 50 pesan terakhir dan pantau perubahan secara realtime
  const chatRef = query(ref(db, 'group_messages'), limitToLast(50));
  onValue(chatRef, (snapshot) => {
    chatBox.innerHTML = ""; // Bersihkan kontainer
    snapshot.forEach((childSnap) => {
      const msgData = childSnap.val();
      appendMessage(msgData, msgData.uid === user.uid);
    });
  });
});

/**
 * EVENT KIRIM PESAN
 */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  
  if (!text || !auth.currentUser) return;

  try {
    const newMsgRef = push(ref(db, 'group_messages'));
    await set(newMsgRef, {
      uid: auth.currentUser.uid,
      name: myProfile.name,
      photoURL: myProfile.photoURL, // Menyimpan URL foto ke database agar bisa dilihat user lain
      text: text,
      timestamp: serverTimestamp()
    });
    msgInput.value = ""; // Reset input
  } catch (e) {
    console.error("Gagal mengirim pesan:", e);
    alert("Gagal mengirim pesan. Pastikan koneksi stabil.");
  }
});

/**
 * NAVIGASI KEMBALI
 */
const backBtn = document.getElementById("backBtn");
if (backBtn) {
  backBtn.onclick = () => {
    window.location.href = "home.html";
  };
}
