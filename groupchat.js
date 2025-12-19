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
 * Optimasi URL Foto:
 * Mengubah resolusi menjadi kecil (s128) dan melakukan crop kotak (-c)
 */
function getOptimizedPhotoURL(url, size = 128) {
  if (!url || typeof url !== 'string') return DEFAULT_AVATAR;
  // Jika dari Google, gunakan parameter sXXX-c untuk gambar kecil & kotak
  if (url.includes("googleusercontent.com")) {
    return url.split('=')[0] + `=s${size}-c`;
  }
  return url;
}

/**
 * Memuat Profil User aktif dengan optimasi URL
 */
async function loadMyProfile(user) {
  try {
    // Prioritas 1: Firebase Auth Profile
    myProfile.name = user.displayName || user.email.split('@')[0];
    myProfile.photoURL = getOptimizedPhotoURL(user.photoURL);

    // Prioritas 2: Cek Database (Overriding)
    const snap = await get(child(ref(db), `users/${user.uid}`));
    if (snap.exists()) {
      const data = snap.val();
      if (data.name) myProfile.name = data.name;
      if (data.photoURL) myProfile.photoURL = getOptimizedPhotoURL(data.photoURL);
    }
  } catch (e) { console.error("Profil error:", e); }
}

/**
 * Menampilkan pesan ke layar
 */
function appendMessage(data, isMe) {
  const div = document.createElement("div");
  div.className = `msg ${isMe ? 'me' : 'other'}`;
  
  // Gunakan URL yang sudah dioptimasi
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

// Pantau status login
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

// Event Kirim Pesan
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  if (!text || !auth.currentUser) return;

  try {
    const newMsgRef = push(ref(db, 'group_messages'));
    await set(newMsgRef, {
      uid: auth.currentUser.uid,
      name: myProfile.name,
      photoURL: myProfile.photoURL, // Menyimpan versi URL bit kecil
      text: text,
      timestamp: serverTimestamp()
    });
    msgInput.value = "";
    msgInput.focus();
  } catch (e) { console.error("Kirim gagal:", e); }
});

document.getElementById("backBtn").onclick = () => window.location.href = "home.html";
