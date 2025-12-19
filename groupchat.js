import { getFirebase } from "./auth-guard.js";
import { ref, push, set, onValue, serverTimestamp, query, limitToLast, get, child } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const { auth, db } = getFirebase();
const chatBox = document.getElementById("chatBox");
const chatForm = document.getElementById("chatForm");
const msgInput = document.getElementById("messageInput");
const imageInput = document.getElementById("imageInput");

// URL Script Baru Anda
const GAS_URL = "https://script.google.com/macros/s/AKfycbyDQ1v1HceTmUf-aqyfIlN00csDMeptO879Zb58jTdR64GWN2rpEzhSiKYHULtOMXzd/exec";
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
 * Upload ke Drive: Membaca respon sebagai teks untuk mencegah CORS Error
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
      }),
      redirect: "follow"
    });
    
    const resultText = await response.text(); 
    return JSON.parse(resultText); 
  } catch (err) {
    console.error("Gagal Upload:", err);
    return null;
  }
}

function appendMessage(data, isMe) {
  const div = document.createElement("div");
  div.className = `msg ${isMe ? 'me' : 'other'}`;
  const photo = getOptimizedPhotoURL(data.photoURL);
  
  let contentHTML = data.imageURL 
    ? `<img src="${getOptimizedPhotoURL(data.imageURL, 400)}" class="chat-img" onclick="window.open('${data.imageURL}')">`
    : `<div class="bubble">${data.text}</div>`;

  div.innerHTML = `<img src="${photo}" class="avatar" onerror="this.src='${DEFAULT_AVATAR}'"><div class="content">${contentHTML}</div>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

imageInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  msgInput.placeholder = "Mengirim gambar...";
  msgInput.disabled = true;

  const res = await uploadToDrive(file);
  if (res && res.url) {
    await set(push(ref(db, 'group_messages')), {
      uid: auth.currentUser.uid,
      photoURL: myProfile.photoURL,
      imageURL: res.url,
      timestamp: serverTimestamp()
    });
  }

  msgInput.placeholder = "Ketik pesan Anda...";
  msgInput.disabled = false;
  imageInput.value = "";
});

auth.onAuthStateChanged(async (user) => {
  if (!user) return;
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
