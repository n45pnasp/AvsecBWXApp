import { getFirebase } from "./auth-guard.js";
import { ref, push, set, onValue, serverTimestamp, query, limitToLast, get, child } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const { auth, db } = getFirebase();
const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const msgInput = document.getElementById("messageInput");
const imageInput = document.getElementById("imageInput");

// URL Apps Script Anda
const GAS_URL = "https://script.google.com/macros/s/AKfycby2c7DhfswDR7t8k65YRkQ3EZwWx5VpDGkwzBHw46Y1vXbBwxTueRglQVlVbQJIQ4xS/exec";
const DEFAULT_AVATAR = "icons/idperson.png";

let myProfile = { name: "User", photoURL: DEFAULT_AVATAR };

function getOptimizedPhotoURL(url, size = 128) {
  if (!url || typeof url !== 'string') return DEFAULT_AVATAR;
  if (url.includes("googleusercontent.com")) return url.split('=')[0] + `=s${size}-c`;
  if (url.includes("drive.google.com")) {
    const fileId = url.match(/id=([-\w]+)/) || url.match(/\/d\/([-\w]+)/);
    if (fileId) return `https://drive.google.com/thumbnail?id=${fileId[1]}&sz=w${size}-h${size}`;
  }
  return url;
}

// Kompres gambar ke "Bit Kecil" sebelum upload
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
        resolve({ base64: canvas.toDataURL('image/jpeg', 0.8).split(',')[1], type: 'image/jpeg' });
      };
    };
  });
}

async function uploadToDrive(file) {
  const resized = await resizeImage(file);
  try {
    const response = await fetch(GAS_URL, {
      method: "POST",
      mode: "no-cors", // Mengatasi masalah CORS pada GAS redirect
      body: JSON.stringify({ 
        name: `chat_${Date.now()}.jpg`, 
        type: resized.type, 
        base64: resized.base64 
      })
    });
    
    // Karena no-cors, kita tidak bisa membaca JSON respon. 
    // Kita harus memprediksi ID-nya atau menggunakan cara upload yang me-return data (CORS enabled di GAS).
    // Jika GAS Anda sudah benar, gunakan mode: "cors" dan baca res.url.
    
    // ASUMSI: Jika GAS Anda menggunakan cara standar, kita butuh respon JSON.
    // Mari gunakan fetch standar untuk mendapatkan URL-nya.
    const resNormal = await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ name: `chat_${Date.now()}.jpg`, type: resized.type, base64: resized.base64 })
    });
    return await resNormal.json();
  } catch (err) {
    console.error("Upload Error:", err);
    return { error: true };
  }
}

function appendMessage(data, isMe) {
  const div = document.createElement("div");
  div.className = `msg ${isMe ? 'me' : 'other'}`;
  const photo = getOptimizedPhotoURL(data.photoURL);
  
  let contentHTML = data.imageURL 
    ? `<img src="${getOptimizedPhotoURL(data.imageURL, 400)}" class="chat-img" onclick="window.open('${data.imageURL}')" title="Klik untuk memperbesar">`
    : `<div class="bubble">${data.text}</div>`;

  div.innerHTML = `<img src="${photo}" class="avatar" onerror="this.src='${DEFAULT_AVATAR}'"><div class="content">${contentHTML}</div>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

imageInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  msgInput.placeholder = "Sedang mengunggah...";
  msgInput.disabled = true;

  try {
    const res = await uploadToDrive(file);
    if (res && res.url) {
      const newMsgRef = push(ref(db, 'group_messages'));
      await set(newMsgRef, {
        uid: auth.currentUser.uid,
        name: myProfile.name,
        photoURL: myProfile.photoURL,
        imageURL: res.url,
        timestamp: serverTimestamp()
      });
    } else {
      alert("Gagal mendapatkan link gambar dari Drive.");
    }
  } catch (err) {
    alert("Koneksi gagal saat upload.");
  }

  msgInput.placeholder = "Ketik pesan...";
  msgInput.disabled = false;
  imageInput.value = "";
});

auth.onAuthStateChanged(async (user) => {
  if (!user) return;
  myProfile.name = user.displayName || user.email.split('@')[0];
  myProfile.photoURL = getOptimizedPhotoURL(user.photoURL);
  
  // Ambil data profile tambahan dari DB jika ada
  const userSnap = await get(child(ref(db), `users/${user.uid}`));
  if(userSnap.exists()) {
      myProfile.name = userSnap.val().name || myProfile.name;
      myProfile.photoURL = getOptimizedPhotoURL(userSnap.val().photoURL) || myProfile.photoURL;
  }

  onValue(query(ref(db, 'group_messages'), limitToLast(50)), (snapshot) => {
    chatBox.innerHTML = "";
    snapshot.forEach((s) => appendMessage(s.val(), s.val().uid === user.uid));
  });
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  if (!text) return;
  await set(push(ref(db, 'group_messages')), {
    uid: auth.currentUser.uid,
    name: myProfile.name,
    photoURL: myProfile.photoURL,
    text: text,
    timestamp: serverTimestamp()
  });
  msgInput.value = "";
});

document.getElementById("backBtn").onclick = () => window.location.href = "home.html";
