// ===== Utils =====
const $ = (s, el = document) => el.querySelector(s);

// ===== Waktu WIB (GMT+7) =====
function getWIBDate(d = new Date()) {
  return new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
}

// Banner: "senin, 12 agustus 2025"
function bannerString() {
  const d = getWIBDate();
  const hari = d.toLocaleDateString('id-ID', { weekday: 'long' }).toLowerCase();
  const tanggal = d.getDate();
  const bulan = d.toLocaleDateString('id-ID', { month: 'long' }).toLowerCase();
  const tahun = d.getFullYear();
  return `${hari}, ${tanggal} ${bulan} ${tahun}`;
}

// ===== Greeting (ID) =====
function getGreetingID(d = getWIBDate()) {
  const h = d.getHours();
  if (h >= 4 && h < 11)  return "Selamat Pagi,";
  if (h >= 11 && h < 15) return "Selamat Siang,";
  if (h >= 15 && h < 18) return "Selamat Sore,";
  return "Selamat Malam,";
}

function updateGreeting() {
  $("#greet").textContent = getGreetingID();
  const k = $("#greet").textContent.split(" ")[1]; // Pagi/Siang/Sore/Malam
  const t = {
    Pagi:  "Fokus & semangat produktif ☕",
    Siang: "Jeda sejenak, tarik napas 🌤️",
    Sore:  "Akhiri dengan manis 🌇",
    Malam: "Santai, recharge energi 🌙"
  };
  $("#taglineText").textContent = t[k] || "Siap bantu aktivitasmu hari ini ✨";
  $("#dateBanner").textContent = bannerString();
}

// ===== Profil (dari RTDB via sessionStorage oleh login.js) =====
function applyProfile({ name, photoURL }) {
  if (name) {
    $("#name").textContent = name;
    // Isi localStorage agar toggle (yang tak boleh diubah) tetap berfungsi
    localStorage.setItem('tinydb_name', name);
  }
  if (photoURL) {
    const avatar = $("#avatar");
    if (avatar) avatar.src = photoURL;
    localStorage.setItem('tinydb_photo', photoURL);
    // (opsional) ekstrak warna aksen dari foto
    extractAccentFromImage(photoURL).then(c => {
      if (c) setAccent(c.primary, c.secondary);
    }).catch(() => {});
  } else {
    // Fallback avatar inisial
    const n = (name || 'P U').trim();
    const initials = n.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 256, 256);
    g.addColorStop(0, '#1b2238'); g.addColorStop(1, '#151b2e');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.fillStyle = '#7c9bff'; x.font = 'bold 120px ui-sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(initials, 128, 140);
    const avatar = $("#avatar");
    if (avatar) avatar.src = c.toDataURL('image/png');
    localStorage.setItem('tinydb_photo', $("#avatar")?.src || "");
  }
}

// Ambil data dari sessionStorage (diset login.js setelah fetch RTDB)
function loadInitialDataFromSession() {
  const raw = sessionStorage.getItem("authProfile");
  if (!raw) {
    // Jika tidak ada, paksa kembali ke login untuk ambil ulang & signOut
    location.href = "login.html?logout=1";
    return;
  }
  try {
    const p = JSON.parse(raw);
    const name  = (p.name || "Pengguna").trim();
    const photo = (p.photoURL || "").trim();
    applyProfile({ name, photoURL: photo });

    // (opsional) override aksen dari query
    const params = new URLSearchParams(location.search);
    if (params.get('accent'))  setAccent(params.get('accent'));
    if (params.get('accent2')) setAccent(undefined, params.get('accent2'));
  } catch (e) {
    console.warn("authProfile parse error:", e);
    location.href = "login.html?logout=1";
  }
}

// ===== Accent dari foto (ringan, no-lib) =====
async function extractAccentFromImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.crossOrigin = 'anonymous'; img.decoding = 'async';
    img.onload = () => {
      try {
        const w = 80, h = 80;
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, 0, 0, w, h);
        const { data } = x.getImageData(0, 0, w, h);
        const bins = {};
        for (let i = 0; i < data.length; i += 16) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 128) continue;
          const key = [(r / 24 | 0), (g / 24 | 0), (b / 24 | 0)].join(',');
          bins[key] = (bins[key] || 0) + 1;
        }
        let topKey = null, max = -1;
        for (const k in bins) { if (bins[k] > max) { max = bins[k]; topKey = k; } }
        if (!topKey) return resolve(null);
        const [br, bg, bb] = topKey.split(',').map(n => Number(n) * 24 + 12);
        const sec = rotateHue(br, bg, bb, 30);
        resolve({
          primary: `rgb(${br},${bg},${bb})`,
          secondary: `rgb(${sec[0]},${sec[1]},${sec[2]})`
        });
      } catch (e) { resolve(null); }
    };
    img.onerror = reject;
    img.src = src;
  });
}

function rotateHue(r, g, b, deg) {
  const u = Math.cos(deg * Math.PI / 180), w = Math.sin(deg * Math.PI / 180);
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  return [
    clamp((.299 + .701 * u + .168 * w) * r + (.587 - .587 * u + .330 * w) * g + (.114 - .114 * u - .497 * w) * b),
    clamp((.299 - .299 * u - .328 * w) * r + (.587 + .413 * u + .035 * w) * g + (.114 - .114 * u + .292 * w) * b),
    clamp((.299 - .3 * u + 1.25 * w) * r + (.587 - .588 * u - 1.05 * w) * g + (.114 + .886 * u - .203 * w) * b)
  ];
}

function setAccent(a1, a2) {
  const root = document.documentElement.style;
  if (a1) root.setProperty('--accent', a1);
  if (a2) root.setProperty('--accent-2', a2);
}

// ===== Toggle foto ↔ logout (DOM swap, tombol tak ada sebelum diklik) =====
// [PERMINTAANMU: bagian ini TIDAK DIUBAH sama sekali]
(function setupGreetCard() {
  const card = $("#greetCard");
  const profileSlot = $("#profileSlot");

  card.addEventListener('click', () => {
    const active = card.getAttribute('aria-pressed') === 'true';
    const next = !active;
    card.setAttribute('aria-pressed', String(next));

    if (next) {
      // Tampilkan tombol logout (ganti avatar)
      profileSlot.innerHTML =
        '<button id="logoutBtn" class="logout-btn" title="Logout" aria-label="Logout">✖</button>';

      $("#logoutBtn").addEventListener('click', (e) => {
        e.stopPropagation();
        try { window.parent && window.parent.postMessage(JSON.stringify({ type: 'logout' }), '*'); } catch (_) {}
        if (typeof window.onLogout === 'function') window.onLogout();
      });
    } else {
      // Balik ke avatar
      const photo = localStorage.getItem('tinydb_photo') || '';
      profileSlot.innerHTML =
        `<img id="avatar" class="avatar-large" alt="Foto pengguna" src="${photo}" />`;
    }
  });
})();

// ===== Hook Logout untuk tombol di atas =====
window.onLogout = function () {
  try {
    sessionStorage.removeItem("authProfile");
    // Biar aman, bersihkan juga cache local
    localStorage.removeItem("tinydb_name");
    localStorage.removeItem("tinydb_photo");
  } catch (_) {}
  // Kembali ke login & paksa signOut lewat query
  location.href = "login.html?logout=1";
};

// ===== Init =====
function tick() { updateGreeting(); }
tick();
loadInitialDataFromSession();
setInterval(tick, 60 * 1000);
