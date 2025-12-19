import { getFirebase } from "./auth-guard.js";
import { 
  ref, push, set, onValue, serverTimestamp, query, limitToLast, get, child 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const { auth, db } = getFirebase();
const msgList = document.getElementById("messageList");
const chatForm = document.getElementById("chatForm");
const msgInput = document.getElementById("msgInput");
const chatWindow = document.getElementById("chatWindow");

let currentUserProfile = null;

// 1. Ambil profil pengguna (mirip di login.js)
async function getMyProfile(user) {
  const snapshot = await get(child(ref(db), `users/${user.uid}`));
  if (snapshot.exists()) {
    return snapshot.val();
  }
  return { name: user.email.split('@')[0], photoURL: "" };
}

// 2. Tampilkan pesan di UI
function renderMessage(data, isMe) {
  const div = document.createElement("div");
  div.className = `msg-item ${isMe ? 'me' : 'other'}`;
  
  const photo = data.photoURL || 'icons/favicon-32.png';
  
  div.innerHTML = `
    <img src="${photo}" class="avatar" alt="av">
    <div class="msg-content">
      <span class="sender-name">${isMe ? 'Anda' : (data.name || 'User')}</span>
      <div class="bubble">${data.text}</div>
    </div>
  `;
  
  msgList.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// 3. Inisialisasi Chat
auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  
  currentUserProfile = await getMyProfile(user);
  
  // Ambil 50 pesan terakhir
  const messagesRef = query(ref(db, 'group_messages'), limitToLast(50));
  
  onValue(messagesRef, (snapshot) => {
    msgList.innerHTML = ""; // Reset list
    snapshot.forEach((childSnapshot) => {
      const data = childSnapshot.val();
      renderMessage(data, data.uid === user.uid);
    });
  });
});

// 4. Kirim Pesan
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  if (!text || !auth.currentUser) return;

  const newMessageRef = push(ref(db, 'group_messages'));
  await set(newMessageRef, {
    uid: auth.currentUser.uid,
    name: currentUserProfile.name || "Anonim",
    photoURL: currentUserProfile.photoURL || "",
    text: text,
    timestamp: serverTimestamp()
  });

  msgInput.value = "";
});

// Tombol Kembali
document.getElementById("backBtn").addEventListener("click", () => {
  window.location.href = "home.html";
});
