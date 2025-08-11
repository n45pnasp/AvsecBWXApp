/* ===================== Helpers ===================== */
const $ = (s, el = document) => el.querySelector(s);
const params = new URLSearchParams(location.search);

/* WIB (GMT+7) date utilities */
const ID_DAYS = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const pad2 = n => (n < 10 ? "0" + n : "" + n);

function getWIBDate(d = new Date()){
  // Pakai timezone Asia/Jakarta biar konsisten di semua device
  return new Date(d.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
}

// ===== Banner: "Senin, 11 Agustus 2025" WIB =====
function bannerString(){
  const d = getWIBDate(); // waktu WIB (GMT+7)
  const hari  = d.toLocaleDateString('id-ID', { weekday: 'long' });
  const tanggal = d.getDate();
  const bulan = d.toLocaleDateString('id-ID', { month: 'long' });
  const tahun = d.getFullYear();
  return `${hari}, ${tanggal} ${bulan} ${tahun}`;
}

/* ===================== Greeting ===================== */
function getGreetingID(d = getWIBDate()){
  const h = d.getHours();
  if (h >= 4 && h < 11)  return "Selamat Pagi,";
  if (h >= 11 && h < 15) return "Selamat Siang,";
  if (h >= 15 && h < 18) return "Selamat Sore,";
  return "Selamat Malam,";
}
function updateGreeting(){
  $("#greet").textContent = getGreetingID();
  const k = $("#greet").textContent.split(" ")[1]; // Pagi/Siang/Sore/Malam
  const tips = {
    Pagi:"Fokus & semangat produktif ☕",
    Siang:"Jeda sejenak, tarik napas 🌤️",
    Sore:"Akhiri dengan manis 🌇",
    Malam:"Santai, recharge energi 🌙"
  };
  $("#taglineText").textContent = tips[k] || "Siap bantu aktivitasmu hari ini ✨";
  $("#dateBanner").textContent = bannerString();
}

/* ===================== Profile state ===================== */
let CURRENT_NAME = "Pengguna";
let CURRENT_PHOTO = ""; // url/dataURL terakhir yang dipakai avatar

function applyProfile({ name, photo }){
  if (name){
    CURRENT_NAME = name;
    $("#name").textContent = name;
    localStorage.setItem("tinydb_name", name);
  }
  if (photo){
    CURRENT_PHOTO = photo;
    setAvatarSrc(photo);
    localStorage.setItem("tinydb_photo", photo);
    extractAccentFromImage(photo)
      .then(c => { if (c) setAccent(c.primary, c.secondary); })
      .catch(()=>{});
  } else if (!CURRENT_PHOTO){
    // buat avatar inisial kalau belum ada foto
    const url = makeInitialsAvatar(CURRENT_NAME);
    CURRENT_PHOTO = url;
    setAvatarSrc(url);
  }
}

/* Render avatar image */
function setAvatarSrc(src){
  const img = $("#avatar");
  if (img) img.src = src;
}

/* Buat avatar inisial (dataURL) */
function makeInitialsAvatar(name){
  const initials = (name || "P U").trim().split(/\s+/).map(w => w[0]).slice(0,2).join("").toUpperCase();
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0,0,256,256);
  g.addColorStop(0, "#1b2238"); g.addColorStop(1, "#151b2e");
  x.fillStyle = g; x.fillRect(0,0,256,256);
  x.fillStyle = "#7c9bff"; x.font = "bold 120px ui-sans-serif";
  x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(initials, 128, 140);
  return c.toDataURL("image/png");
}

/* Sumber data awal: Kodular -> URL -> localStorage */
function loadInitialData(){
  const nameFromURL  = (params.get("name")  || "").trim();
  const photoFromURL = (params.get("photo") || "").trim();
  const nameFromLS   = localStorage.getItem("tinydb_name")  || "";
  const photoFromLS  = localStorage.getItem("tinydb_photo") || "";

  const name  = nameFromURL  || nameFromLS  || "Pengguna";
  const photo = photoFromURL || photoFromLS || "";

  applyProfile({ name, photo });

  // optional: override accent via URL
  if (params.get("accent"))  setAccent(params.get("accent"));
  if (params.get("accent2")) setAccent(undefined, params.get("accent2"));
}

/* ===================== Kodular hooks ===================== */
window.setTinyData = function(obj){
  try{
    if (typeof obj === "string") obj = JSON.parse(obj);
    const { name, photo } = obj || {};
    applyProfile({ name, photo });
  }catch(e){ console.warn("TinyData parse error:", e); }
};

window.addEventListener("message", (ev)=>{
  try{
    const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
    if (data && (data.type === "tinydb" || data.type === "profile")){
      applyProfile({ name: data.name, photo: data.photo });
    }
  }catch(e){}
});

/* ===================== Accent dari foto ===================== */
async function extractAccentFromImage(src){
  return new Promise((resolve,reject)=>{
    const img = new Image(); img.crossOrigin = "anonymous"; img.decoding = "async";
    img.onload = ()=>{
      try{
        const w = 80, h = 80;
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const x = c.getContext("2d", { willReadFrequently: true });
        x.drawImage(img,0,0,w,h);
        const { data } = x.getImageData(0,0,w,h);
        const bins = {};
        for (let i=0;i<data.length;i+=16){
          const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
          if (a < 128) continue;
          const key = [(r/24|0),(g/24|0),(b/24|0)].join(",");
          bins[key] = (bins[key]||0) + 1;
        }
        let topKey=null, max=-1;
        for (const k in bins){ if (bins[k] > max){ max = bins[k]; topKey = k; } }
        if (!topKey) return resolve(null);
        const [br,bg,bb] = topKey.split(",").map(n => Number(n)*24+12);
        const sec = rotateHue(br,bg,bb,30);
        resolve({ primary:`rgb(${br},${bg},${bb})`,
                  secondary:`rgb(${sec[0]},${sec[1]},${sec[2]})` });
      }catch(e){ resolve(null); }
    };
    img.onerror = reject;
    img.src = src;
  });
}
function rotateHue(r,g,b,deg){
  const u = Math.cos(deg*Math.PI/180), w = Math.sin(deg*Math.PI/180);
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  return [
    clamp((.299+.701*u+.168*w)*r + (.587-.587*u+.330*w)*g + (.114-.114*u-.497*w)*b),
    clamp((.299-.299*u-.328*w)*r + (.587+.413*u+.035*w)*g + (.114-.114*u+.292*w)*b),
    clamp((.299-.3*u+1.25*w)*r + (.587-.588*u-1.05*w)*g + (.114+.886*u-.203*w)*b)
  ];
}
function setAccent(a1, a2){
  const root = document.documentElement.style;
  if (a1) root.setProperty("--accent", a1);
  if (a2) root.setProperty("--accent-2", a2);
}

/* ===================== Greet Card: toggle avatar ↔ logout ===================== */
(function setupGreetCard(){
  const card        = $("#greetCard");
  const profileSlot = $("#profileSlot");

  // render helper
  function renderProfileSlot(showLogout){
    if (showLogout){
      profileSlot.innerHTML =
        '<button id="logoutBtn" class="logout-btn" title="Logout" aria-label="Logout">✖</button>';
      $("#logoutBtn").addEventListener("click", (e)=>{
        e.stopPropagation(); // jangan toggle balik
        try{
          // kirim sinyal ke Kodular (opsional)
          window.parent && window.parent.postMessage(JSON.stringify({ type:"logout" }), "*");
        }catch(_){}
        if (typeof window.onLogout === "function") window.onLogout();
      });
    }else{
      profileSlot.innerHTML =
        `<img id="avatar" class="avatar-large" alt="Foto pengguna" src="${CURRENT_PHOTO || ""}" />`;
    }
  }

  // initial view: avatar (logout tidak dibuat di DOM)
  renderProfileSlot(false);
  card.setAttribute("aria-pressed", "false");

  card.addEventListener("click", ()=>{
    const active = card.getAttribute("aria-pressed") === "true";
    const next = !active;
    card.setAttribute("aria-pressed", String(next));
    renderProfileSlot(next);
  });
})();

/* ===================== Init ===================== */
function tick(){ updateGreeting(); }
tick();
loadInitialData();
setInterval(tick, 60 * 1000);
