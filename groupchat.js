import { getFirebase } from "./auth-guard.js";
import { 
  ref, push, set, onValue, serverTimestamp, query, limitToLast, get, child 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const { auth, db } = getFirebase();
const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const msgInput = document.getElementById("messageInput");
const imageInput = document.getElementById("imageInput");

// URL SCRIPT BARU ANDA (PASTIKAN SUDAH DEPLOY ULANG SEBAGAI NEW VERSION)
const GAS_URL = "https://script.google.com/macros/s/AKfycbxvhabtQ9MpGFZzOkIJaOpYoCh36CWxV1r3Jn_nOu3lW_YPHb1cnEOdLUlyv_jxWUqI/exec";
const DEFAULT_AVATAR = "icons/idperson.png";

let myProfile = { name: "User", photoURL: DEFAULT_AVATAR };

/**
 * Optimasi URL agar resolusi rendah (bit kecil) & kotak simetris
 */
function getOptimizedPhotoURL(url, size = 128) {
  if (!url || typeof url !== 'string') return DEFAULT_AVATAR;
  
  // Jika URL dari Google Auth (googleusercontent)
  if (url.includes("googleusercontent.com")) {
    return url.split('=')[0] + `=s${size}-c`;
  }
  
  // Jika URL dari Google Drive
  if (url.includes("drive.google.com") || url.includes("drive.usercontent.google.com")) {
    const fileIdMatch = url.match(/id=([-\w]+)/) || url.match(/\/d\/([-\w]+)/);
    if (fileIdMatch) {
      return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w${size}-h${size}`;
    }
  }
  return url;
}

/**
 * Kompres Gambar sebelum upload agar ukuran file sangat kecil (Bit Kecil)
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
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
        } else {
          if (height > maxWidth) { width *= maxWidth / height; height = maxWidth; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Simpan sebagai JPEG kualitas 0.7 agar hemat data
        resolve({ 
          base64: canvas.toDataURL('image/jpeg', 0.7).split(',')[1], 
          type: 'image/jpeg' 
        });
      };
    };
  });
}

/**
 * Upload ke Drive: Menggunakan mode 'cors' dan pembacaan respon sebagai teks 
 * untuk menghindari kegagalan pembacaan JSON (Zero Error Flow)
 */
async function uploadToDrive(file) {
  const resized = await resizeImage(file);
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      mode: "cors", 
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ 
        name: `chat_${Date.now()}.jpg`, 
        type: resized.type, 
        base64: resized.base64 
      })
    });

    // Baca respon sebagai teks dulu baru diparse ke JSON
    const resultText = await response.text();
    const result = JSON.parse(resultText);
    
    if (result && result.status === "success") {
      return result.url;
    } else {
      console.error("Server Error:", result.message);
      return null;
    }
  } catch (err) {
    console.error("CORS / Network Error:", err);
    return null;
  }
}

/**
 * Merender pesan ke layar (Teks atau Gambar)
 */
function appendMessage(data, isMe) {
  const div = document.createElement("div");
  div.className = `msg ${isMe ? 'me' : 'other'}`;
  
  const photo = getOptimizedPhotoURL(data.photoURL);
  
  // Jika ada imageURL, tampilkan tag IMG. Jika tidak, tampilkan bubble TEXT.
  let contentHTML = data.imageURL 
    ? `<img src="${getOptimizedPhotoURL(data.imageURL, 400)}" class="chat-img" onclick="window.open('${data.imageURL}')" title="Klik untuk memperbesar">`
    : `<div class="bubble">${data.text}</div>`;

  div.innerHTML = `
    <img src="${photo}" class="avatar" onerror="this.src='${DEFAULT_AVATAR}'">
    <div class="content">${contentHTML}</div>
  `;
  
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Handler Upload Gambar (+)
imageInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const oldPlaceholder = msgInput.placeholder;
  msgInput.placeholder = "⌛ Sedang mengunggah gambar...";
  msgInput.disabled = true;

  const driveUrl = await uploadToDrive(file);
  
  if (driveUrl) {
    const newMsgRef = push(ref(db, 'group_messages'));
    await set(newMsgRef, {
      uid: auth.currentUser.uid,
      name: myProfile.name,
      photoURL: myProfile.photoURL,
      imageURL: driveUrl,
      timestamp: serverTimestamp()
    });
  } else {
    alert("Upload gagal dibaca oleh browser. Pastikan Anda sudah me-redeploy Apps Script sebagai 'Version: New'.");
  }

  msgInput.placeholder = oldPlaceholder;
  msgInput.disabled = false;
  imageInput.value = "";
});

// Listener Login & Sinkronisasi Realtime
auth.onAuthStateChanged(async (user) => {
  if (!user) return;

  // 1. Load Profil
  myProfile.name = user.displayName || user.email.split('@')[0];
  myProfile.photoURL = getOptimizedPhotoURL(user.photoURL);
  
  const snap = await get(child(ref(db), `users/${user.uid}`));
  if (snap.exists()) {
    const d = snap.val();
    if (d.name) myProfile.name = d.name;
    if (d.photoURL) myProfile.photoURL = getOptimizedPhotoURL(d.photoURL);
  }

  // 2. Load Chat
  onValue(query(ref(db, 'group_messages'), limitToLast(50)), (snapshot) => {
    chatBox.innerHTML = "";
    snapshot.forEach((s) => {
      const msgData = s.val();
      appendMessage(msgData, msgData.uid === user.uid);
    });
  });
});

// Kirim Pesan Teks
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

// Navigasi Kembali
const backBtn = document.getElementById("backBtn");
if (backBtn) backBtn.onclick = () => window.location.href = "home.html";
