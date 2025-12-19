import { getFirebase } from "./auth-guard.js";
import { 
  ref, push, set, onValue, serverTimestamp, query, limitToLast, get, child 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const { auth, db } = getFirebase();
const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const msgInput = document.getElementById("messageInput");

// Avatar default jika user tidak punya foto profil
const DEFAULT_AVATAR = "data:image/svg+xml;base64," + btoa(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'>
    <rect width='128' height='128' rx='18' fill='#0b1220'/>
    <circle cx='64' cy='52' r='22' fill='#9C27B0'/>
    <rect x='26' y='84' width='76' height='26' rx='13' fill='#6A1B9A'/>
  </svg>`
);

// Objek profil lokal untuk menampung data user aktif
let myProfile = { name: "User", photoURL: DEFAULT_AVATAR };

/**
 * Memuat Profil User: 
 * Memprioritaskan data dari Firebase Auth (photoURL).
 */
async function loadMyProfile(user) {
  // 1. Ambil data langsung dari Firebase Auth Profile
  myProfile.name = user.displayName || user.email.split('@')[0];
  myProfile.photoURL = user.photoURL || DEFAULT_AVATAR;

  // 2. Opsi: Cek override di database (jika Anda menyimpan custom profile di RTDB)
  try {
    const snap = await get(child(ref(db), `users/${user.uid}`));
    if (snap.exists()) {
      const data = snap.val();
      if (data.name) myProfile.name = data.name;
      if (data.photoURL) myProfile.photoURL = data.photoURL;
    }
  } catch (e) { 
    console.error("Gagal memuat data DB:", e); 
  }
}

/**
 * Menampilkan Pesan di Layar
 */
function appendMessage(data, isMe) {
  const div = document.createElement("div");
  div.className = `msg ${isMe ? 'me' : 'other'}`;
  
  // Ambil foto dari data pesan (yang disimpan saat kirim)
  const photo = data.photoURL || DEFAULT_AVATAR;
  
  div.innerHTML = `
    <img src="${photo}" class="avatar" onerror="this.src='${DEFAULT_AVATAR}'">
    <div class="content">
      <div class="bubble">${data.text}</div>
    </div>
  `;
  
  chatBox.appendChild(div);
  
  // Auto scroll ke bawah setiap ada pesan baru
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Listener status Login
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "index.html"; // Redirect jika tidak login
    return;
  }

  // Load profil sebelum memulai chat
  await loadMyProfile(user);

  // Ambil 50 pesan terakhir secara Realtime
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
 * Event Listener Kirim Pesan
 */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  
  if (!text || !auth.currentUser) return;

  try {
    const newMsgRef = push(ref(db, 'group_messages'));
    
    // Simpan pesan beserta photoURL profil kita saat ini
    await set(newMsgRef, {
      uid: auth.currentUser.uid,
      name: myProfile.name,
      photoURL: myProfile.photoURL, // Ini akan menggunakan foto dari Firebase Auth
      text: text,
      timestamp: serverTimestamp()
    });
    
    msgInput.value = ""; // Kosongkan input
    msgInput.focus();
  } catch (e) { 
    console.error("Gagal kirim pesan:", e); 
    alert("Gagal mengirim pesan. Coba lagi.");
  }
});

// Tombol Kembali
const backBtn = document.getElementById("backBtn");
if (backBtn) {
  backBtn.onclick = () => window.location.href = "home.html";
}
