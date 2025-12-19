import { getFirebase } from "./auth-guard.js";
import { 
  ref, push, set, onValue, serverTimestamp, query, limitToLast, get, child 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const { auth, db } = getFirebase();
const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const msgInput = document.getElementById("messageInput");
const imageInput = document.getElementById("imageInput");

// URL Script Google Apps Script Anda
const GAS_URL = "https://script.google.com/macros/s/AKfycbxvhabtQ9MpGFZzOkIJaOpYoCh36CWxV1r3Jn_nOu3lW_YPHb1cnEOdLUlyv_jxWUqI/exec";
const DEFAULT_AVATAR = "icons/idperson.png";

let myProfile = { name: "User", photoURL: DEFAULT_AVATAR };

/**
 * FUNGSI KRUSIAL: Mengubah URL Google Drive/Auth menjadi resolusi rendah (Bit Kecil)
 */
function getOptimizedPhotoURL(url, size = 128) {
  if (!url || typeof url !== 'string') return DEFAULT_AVATAR;
  
  // Jika URL dari Google Auth (googleusercontent)
  if (url.includes("googleusercontent.com")) {
    return url.split('=')[0] + `=s${size}-c`;
  }
  
  // Jika URL dari Google Drive (Mengubah ke format Thumbnail API agar ringan)
  if (url.includes("drive.google.com") || url.includes("drive.usercontent.google.com")) {
    const fileIdMatch = url.match(/id=([-\w]+)/) || url.match(/\/d\/([-\w]+)/);
    if (fileIdMatch) {
      // Menggunakan parameter sz agar Google mengirim file dalam ukuran kecil (misal: w400)
      return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w${size}`;
    }
  }
  return url;
}

/**
 * Kompres Gambar di Sisi Klien (Canvas) agar proses upload ke Drive juga ringan
 */
async function resizeImage(file, maxWidth = 800) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        if (width > height) { if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } }
        else { if (height > maxWidth) { width *= maxWidth / height; height = maxWidth; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve({ base64: canvas.toDataURL('image/jpeg', 0.7).split(',')[1], type: 'image/jpeg' });
      };
    };
  });
}

/**
 * Upload ke Drive: Fix CORS dengan membaca respon sebagai teks
 */
async function uploadToDrive(file) {
  const resized = await resizeImage(file);
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ 
        name: `chat_${Date.now()}.jpg`, 
        type: resized.type, 
        base64: resized.base64 
      })
    });
    const resultText = await response.text();
    return JSON.parse(resultText);
  } catch (err) {
    console.error("Gagal Upload:", err);
    return null;
  }
}

/**
 * Menampilkan pesan ke UI (Teks atau Gambar)
 */
function appendMessage(data, isMe) {
  const div = document.createElement("div");
  div.className = `msg ${isMe ? 'me' : 'other'}`;
  
  // Ambil foto profil user (sudah versi kecil)
  const avatar = getOptimizedPhotoURL(data.photoURL, 128);
  
  // Cek apakah data pesan adalah gambar
  let contentHTML = data.imageURL 
    ? `<img src="${data.imageURL}" class="chat-img" onclick="window.open('${data.imageURL}')" title="Klik untuk memperbesar">`
    : `<div class="bubble">${data.text}</div>`;

  div.innerHTML = `
    <img src="${avatar}" class="avatar" onerror="this.src='${DEFAULT_AVATAR}'">
    <div class="content">${contentHTML}</div>
  `;
  
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Handler Upload Gambar (+)
 */
imageInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  msgInput.placeholder = "⌛ Sedang mengunggah...";
  msgInput.disabled = true;

  const res = await uploadToDrive(file);
  
  if (res && res.url) {
    // PENTING: Ubah URL asli menjadi URL Thumbnail (resolusi 400px) 
    // agar data yang disimpan di Firebase sangat kecil ("Bit Kecil")
    const optimizedImageUrl = getOptimizedPhotoURL(res.url, 400);

    const newMsgRef = push(ref(db, 'group_messages'));
    await set(newMsgRef, {
      uid: auth.currentUser.uid,
      name: myProfile.name,
      photoURL: myProfile.photoURL, // Foto Profil (Kecil)
      imageURL: optimizedImageUrl,  // Foto Pesan (Kecil)
      timestamp: serverTimestamp()
    });
  } else {
    alert("Gagal mengunggah foto ke Drive. Cek Apps Script Anda.");
  }

  msgInput.placeholder = "Ketik pesan...";
  msgInput.disabled = false;
  imageInput.value = "";
});

/**
 * Listener Auth & Chat Realtime
 */
auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  // Sinkronisasi Profil
  myProfile.name = user.displayName || user.email.split('@')[0];
  myProfile.photoURL = getOptimizedPhotoURL(user.photoURL);
  
  const snap = await get(child(ref(db), `users/${user.uid}`));
  if (snap.exists()) {
    const d = snap.val();
    if (d.name) myProfile.name = d.name;
    if (d.photoURL) myProfile.photoURL = getOptimizedPhotoURL(d.photoURL);
  }

  // Load Pesan
  onValue(query(ref(db, 'group_messages'), limitToLast(50)), (snapshot) => {
    chatBox.innerHTML = "";
    snapshot.forEach((s) => appendMessage(s.val(), s.val().uid === user.uid));
  });
});

/**
 * Kirim Pesan Teks
 */
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

// Tombol Kembali
const backBtn = document.getElementById("backBtn");
if (backBtn) backBtn.onclick = () => window.location.href = "home.html";
