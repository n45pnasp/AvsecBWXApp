import { getFirebase } from "./auth-guard.js";
import { 
  ref, push, set, onValue, serverTimestamp, query, limitToLast, get, child 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const { auth, db } = getFirebase();
const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const msgInput = document.getElementById("messageInput");
const imageInput = document.getElementById("imageInput");

const DEFAULT_AVATAR = "icons/idperson.png";
const DRIVE_FOLDER_ID = "1VrdNc_f-fFIIGGjNIfm9DrVyOnnZQFLX";

let myProfile = { name: "User", photoURL: DEFAULT_AVATAR };

/**
 * Optimasi Foto: Bit kecil, resolusi pas (s128/sz=128), dan kotak (-c)
 */
function getOptimizedPhotoURL(url, size = 128) {
  if (!url || typeof url !== 'string') return DEFAULT_AVATAR;
  
  // Link Google Drive
  if (url.includes("drive.google.com") || url.includes("drive.usercontent.google.com")) {
    const fileIdMatch = url.match(/id=([-\w]+)/) || url.match(/\/d\/([-\w]+)/);
    if (fileIdMatch) return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w${size}-h${size}`;
  }

  // Link Google Auth
  if (url.includes("googleusercontent.com")) {
    return url.split('=')[0] + `=s${size}-c`;
  }
  return url;
}

/**
 * Upload ke Google Drive (Pastikan folder diset Public Editor agar bisa upload tanpa token rumit)
 */
async function uploadToGoogleDrive(file) {
  const metadata = { name: `chat_${Date.now()}.jpg`, parents: [DRIVE_FOLDER_ID] };
  const formData = new FormData();
  formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  formData.append("file", file);

  try {
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
      method: "POST",
      body: formData
    });
    const result = await response.json();
    return result.id ? `https://drive.google.com/uc?export=view&id=${result.id}` : null;
  } catch (error) {
    console.error("Gagal upload Drive:", error);
    return null;
  }
}

function appendMessage(data, isMe) {
  const div = document.createElement("div");
  div.className = `msg ${isMe ? 'me' : 'other'}`;
  const photo = getOptimizedPhotoURL(data.photoURL);
  
  // Jika pesan berupa gambar, gunakan img. Jika teks, gunakan bubble.
  let content = data.imageURL 
    ? `<img src="${getOptimizedPhotoURL(data.imageURL, 400)}" class="chat-img" onclick="window.open('${data.imageURL}')">`
    : `<div class="bubble">${data.text}</div>`;

  div.innerHTML = `
    <img src="${photo}" class="avatar" onerror="this.src='${DEFAULT_AVATAR}'">
    <div class="content">${content}</div>
  `;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Handler Pilih Gambar
imageInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  msgInput.placeholder = "Mengunggah...";
  msgInput.disabled = true;

  const driveUrl = await uploadToGoogleDrive(file);
  if (driveUrl) {
    const newMsgRef = push(ref(db, 'group_messages'));
    await set(newMsgRef, {
      uid: auth.currentUser.uid,
      photoURL: myProfile.photoURL,
      imageURL: driveUrl,
      timestamp: serverTimestamp()
    });
  }
  msgInput.placeholder = "Ketik pesan Anda...";
  msgInput.disabled = false;
  imageInput.value = "";
});

// Load Chat & Profil
auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  
  // Ambil data dari Auth Online & RTDB
  myProfile.name = user.displayName || user.email.split('@')[0];
  myProfile.photoURL = getOptimizedPhotoURL(user.photoURL);
  
  const snap = await get(child(ref(db), `users/${user.uid}`));
  if (snap.exists()) {
    const d = snap.val();
    if (d.name) myProfile.name = d.name;
    if (d.photoURL) myProfile.photoURL = getOptimizedPhotoURL(d.photoURL);
  }

  onValue(query(ref(db, 'group_messages'), limitToLast(50)), (snapshot) => {
    chatBox.innerHTML = "";
    snapshot.forEach((s) => appendMessage(s.val(), s.val().uid === user.uid));
  });
});

// Kirim Teks
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  if (!text) return;

  const newMsgRef = push(ref(db, 'group_messages'));
  await set(newMsgRef, {
    uid: auth.currentUser.uid,
    name: myProfile.name,
    photoURL: myProfile.photoURL,
    text: text,
    timestamp: serverTimestamp()
  });
  msgInput.value = "";
});

document.getElementById("backBtn").onclick = () => window.location.href = "home.html";
