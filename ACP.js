// ACP.js — FINAL (sinkron dengan code.gs v1.4.0)
import { requireAuth } from "./auth-guard.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const SCRIPT_URL   = "https://logacp.avsecbwx2018.workers.dev/";
const LOOKUP_URL   = "https://script.google.com/macros/s/AKfycbzgWQVOzC7cQVoc4TygW3nDJ_9iejZZ_4CBAWBFDrEXvjM5QxZvEiFr4FLKIu0bqs0Hfg/exec";
const SHARED_TOKEN = "N45p";

requireAuth({ loginPath: "index.html", hideWhileChecking: true });

const nama       = document.getElementById("nama");
const kodePas    = document.getElementById("kodePas");
const instansi   = document.getElementById("instansi");
const prohibited = document.getElementById("prohibited");
const lokasi     = document.getElementById("lokasi");
const jamMasuk   = document.getElementById("jamMasuk");
const pemeriksa  = document.getElementById("pemeriksa");
const supervisor = document.getElementById("supervisor");
const submitBtn  = document.getElementById("submitBtn");
const scanBtn    = document.getElementById("scanBtn");
const imgModal   = document.getElementById("imgModal");
const imgPreview = document.getElementById("imgPreview");
const imgClose   = document.getElementById("imgClose");
const imgLinks   = Array.from(document.querySelectorAll('.img-link'));
const ROSTER_ENDPOINT = "https://roster-proxy.avsecbwx2018.workers.dev";

// === 9 checkbox area (urutan fallback jika tidak ada data-area di HTML)
const AREA_FIELDS = [
  "bagasiMobil","bawahMobil","sekitarRoda","kantongPintu","visor",
  "laciDashboard","bawahKursi","kapMobil","areaLain"
];
const inspectionChecks = Array.from(document.querySelectorAll('.insp-table tbody input[type="checkbox"]'));

// overlay ala lb_all
const overlay = document.getElementById("overlay");
const ovIcon  = document.getElementById("ovIcon");
const ovTitle = document.getElementById("ovTitle");
const ovDesc  = document.getElementById("ovDesc");
const ovClose = document.getElementById("ovClose");
let scanState = { stream:null, video:null, canvas:null, ctx:null, running:false, usingDetector:false, detector:null, jsQRReady:false, overlay:null, closeBtn:null };

const auth = getAuth();
onAuthStateChanged(auth, setAuthName);

// paksa huruf besar pada input pemeriksa
pemeriksa.addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase(); });

ovClose.addEventListener("click", () => overlay.classList.add("hidden"));
imgClose.addEventListener("click", closeImgModal);
imgModal.addEventListener("click", (e)=>{ if(e.target===imgModal) closeImgModal(); });
imgLinks.forEach(link=>{
  link.addEventListener('click', e=>{
    e.preventDefault();
    const src = link.dataset.img;
    if(src) openImgModal(src);
  });
});

function showOverlay(state, title, desc){
  overlay.classList.remove("hidden");
  ovIcon.className = "icon " + state;
  ovTitle.textContent = title;
  ovDesc.textContent = desc || "";
  ovClose.classList.toggle("hidden", state === "spinner");
  if (state !== "spinner") {
    const delay = state === "stop" ? 3500 : 1500;
    setTimeout(() => overlay.classList.add("hidden"), delay);
  }
}
function hideOverlay(){ overlay.classList.add("hidden"); }

function openImgModal(src){
  imgPreview.src = src;
  imgModal.classList.remove('hidden');
}
function closeImgModal(){
  imgModal.classList.add('hidden');
  imgPreview.removeAttribute('src');
}

function setAuthName(){
  const user = auth.currentUser;
  const name = user?.displayName?.trim() || (user?.email ? user.email.split("@")[0] : "");
  pemeriksa.value = (name || "").toUpperCase();
  fetchRoster();
}

function clearInputs(){
  nama.textContent = "-";
  kodePas.textContent = "-";
  instansi.textContent = "-";
  [prohibited,lokasi,jamMasuk,supervisor,pemeriksa].forEach(el=>el.value="");
  inspectionChecks.forEach(cb => cb.checked = false);
  setAuthName();
}
clearInputs();

// === Kolektor nilai checkbox → {bagasiMobil: true/false, ...}
function getInspectionState(){
  const out = {};
  inspectionChecks.forEach((cb, idx) => {
    const key = (cb.dataset.area || AREA_FIELDS[idx] || "").trim();
    if (key) out[key] = !!cb.checked;
  });
  // pastikan semua key ada (default false)
  AREA_FIELDS.forEach(k => { if (!(k in out)) out[k] = false; });
  return out;
}

submitBtn.addEventListener("click", onSubmit);
if (scanBtn) scanBtn.addEventListener("click", () => { if (scanState.running) stopScan(); else startScan(); });

async function fetchRoster(){
  try{
    const url = new URL(ROSTER_ENDPOINT);
    url.searchParams.set("action", "getRoster");
    url.searchParams.set("token", SHARED_TOKEN);
    url.searchParams.set("_", Date.now());
    const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
    const j = await res.json();
    const spv = (j?.config?.supervisor_pos1 || "").toString().trim().toUpperCase();
    if (spv) supervisor.value = spv;

    const normalize = s => (s || "").toString().toUpperCase().replace(/[^A-Z]/g,"");
    const loginName = normalize(pemeriksa.value || "");

    const spvPos1 = normalize(j?.config?.supervisor_pos1);
    const spvHbs  = normalize(j?.config?.supervisor_hbscp);
    if (loginName && loginName === spvPos1){
      lokasi.value = "POS 1";
      return;
    }
    if (loginName && loginName === spvHbs){
      lokasi.value = "TERMINAL";
      return;
    }

    const roster = Array.isArray(j?.rosters) ? j.rosters : [];
    const me = roster.find(r => {
      const nm = normalize(r?.nama);
      return nm === loginName || nm.startsWith(loginName) || loginName.startsWith(nm);
    });
    const section = (me?.section || "").toUpperCase();
    if (section.includes("HBSCP")) {
      lokasi.value = "TERMINAL";
    } else if (section.includes("POS")) {
      lokasi.value = "POS 1";
    }
  }catch(err){ console.warn("Failed to load roster", err); }
}

async function onSubmit(){
  // set jamMasuk otomatis WIB saat submit
  jamMasuk.value = new Intl.DateTimeFormat('en-GB', {
    hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Asia/Jakarta'
  }).format(new Date());

  const areaState = getInspectionState();
  const prohibitedItem = (prohibited.value || "").trim();
  const payload = {
    token: SHARED_TOKEN,
    namaLengkap: nama.textContent.trim().toUpperCase(),
    kodePas:     kodePas.textContent.trim().toUpperCase(),
    instansi:    instansi.textContent.trim().toUpperCase(),
    prohibitedItem: prohibitedItem ? prohibitedItem.toUpperCase() : "TIDAK BAWA",
    lokasiAcp:      (lokasi.value     || "").trim().toUpperCase(),
    jamMasuk:  (jamMasuk.value  || "").trim(),
    pemeriksa:  (pemeriksa.value  || "").trim().toUpperCase(),
    supervisor: (supervisor.value || "").trim().toUpperCase(),
    // spread 9 field area di root (sesuai code.gs)
    ...areaState
  };

  submitBtn.disabled = true;
  showOverlay('spinner','Mengirim data…','');
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const j = await res.json();
    if (!j || (!j.success && !j.ok)) throw new Error(j?.error || "Gagal mengirim");
    showOverlay('ok','Data berhasil dikirim','');
    clearInputs();
  } catch(err){
    showOverlay('err','Gagal', err?.message || err);
  } finally {
    submitBtn.disabled = false;
  }
}

/* ================== SCAN BARCODE (tidak diubah) ================== */
function injectScanStyles(){
  if (document.getElementById('scan-style')) return;
  const css = `
    .is-waiting { opacity:.7; pointer-events:none }
    body.scan-active{ background:#000; overscroll-behavior:contain; }
    body.scan-active .app-bar, body.scan-active .container { display:none !important; }
    #scan-video,#scan-canvas{ position:fixed; inset:0; width:100vw; height:100vh; display:none; background:#000; z-index:9998; }
    body.scan-active #scan-video{ display:block; object-fit:cover; transform:none; touch-action:none; }
    body.scan-active #scan-canvas{ display:none; }
    #scan-overlay{ position:fixed; inset:0; display:none; z-index:10000; pointer-events:none; }
    body.scan-active #scan-overlay{ display:block; }
    .scan-topbar{ position:absolute; top:0; left:0; right:0; height:max(56px, calc(44px + env(safe-area-inset-top,0)));
      display:flex; align-items:flex-start; justify-content:flex-end; padding: calc(env(safe-area-inset-top,0) + 6px) 10px 8px;
      background:linear-gradient(to bottom, rgba(0,0,0,.5), rgba(0,0,0,0)); pointer-events:none; }
    .scan-close{ pointer-events:auto; width:42px; height:42px; border-radius:999px; background:rgba(0,0,0,.55); color:#fff;
      border:1px solid rgba(255,255,255,.25); font-size:22px; line-height:1; display:flex; align-items:center; justify-content:center;
      box-shadow:0 4px 12px rgba(0,0,0,.35); transition: transform .08s ease, filter .15s ease; }
    .scan-close:active{ transform:scale(.96); }
    .scan-close:focus-visible{ outline:2px solid rgba(255,255,255,.6); outline-offset:2px; }
    .scan-reticle{ position:absolute; top:50%; left:50%; width:min(68vw, 520px); aspect-ratio:1/1; transform:translate(-50%,-50%);
      border-radius:16px; box-shadow:0 0 0 9999px rgba(0,0,0,.28) inset; pointer-events:none;
      background: linear-gradient(#fff,#fff) left top/28px 2px no-repeat,
                  linear-gradient(#fff,#fff) left top/2px 28px no-repeat,
                  linear-gradient(#fff,#fff) right top/28px 2px no-repeat,
                  linear-gradient(#fff,#fff) right top/2px 28px no-repeat,
                  linear-gradient(#fff,#fff) left bottom/28px 2px no-repeat,
                  linear-gradient(#fff,#fff) left bottom/2px 28px no-repeat,
                  linear-gradient(#fff,#fff) right bottom/28px 2px no-repeat,
                  linear-gradient(#fff,#fff) right bottom/2px 28px no-repeat; outline:2px dashed rgba(255,255,255,0); }
    .scan-hint{ position:absolute; left:50%; bottom:max(18px, calc(16px + env(safe-area-inset-bottom,0))); transform:translateX(-50%);
      background:rgba(0,0,0,.55); color:#fff; font-weight:600; padding:8px 12px; border-radius:999px; letter-spacing:.2px;
      pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,.35); }
  `;
  const style = document.createElement('style');
  style.id = 'scan-style';
  style.textContent = css;
  document.head.appendChild(style);
}
injectScanStyles();

async function startScan(){
  try{
    ensureVideo(); ensureOverlay();
    document.body.classList.add('scan-active');
    const constraints = { video:{ facingMode:{ideal:'environment'}, width:{ideal:1280}, height:{ideal:720}, advanced:[{focusMode:'continuous'}]}, audio:false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    scanState.stream = stream;
    scanState.video.srcObject = stream;
    await scanState.video.play();

    scanState.usingDetector = false; scanState.detector = null;
    if ('BarcodeDetector' in window){
      try{
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const wanted = ['qr_code','pdf417','aztec','data_matrix'];
        const formats = wanted.filter(f=>supported.includes(f));
        if (formats.length){ scanState.detector = new window.BarcodeDetector({ formats }); scanState.usingDetector = true; }
      }catch(_){ }
    }

    scanState.running = true;
    if (scanState.usingDetector){ detectLoop_BarcodeDetector(); }
    else { await ensureJsQR(); prepareCanvas(); detectLoop_jsQR(); }
  }catch(err){
    showOverlay('err','Tidak bisa mengakses kamera','');
    await stopScan();
  }
}

async function stopScan(){
  scanState.running = false;
  if (scanState.stream){ scanState.stream.getTracks().forEach(t=>{ try{ t.stop(); }catch(_){} }); }
  scanState.stream = null;
  if (scanState.video){ scanState.video.srcObject = null; scanState.video.remove(); scanState.video = null; }
  if (scanState.canvas){ scanState.canvas.remove(); scanState.canvas = null; scanState.ctx = null; }
  document.body.classList.remove('scan-active');
}

function ensureVideo(){
  if (scanState.video) return;
  const v = document.createElement('video');
  v.setAttribute('playsinline',''); v.muted = true; v.autoplay = true; v.id = 'scan-video';
  document.body.appendChild(v); scanState.video = v;
}
function ensureOverlay(){
  if (scanState.overlay) return;
  const overlay = document.createElement('div');
  overlay.id = 'scan-overlay';
  overlay.innerHTML = `
    <div class="scan-topbar"><button id="scan-close" class="scan-close" aria-label="Tutup">✕</button></div>
    <div class="scan-reticle" aria-hidden="true"></div>
    <div class="scan-hint">Arahkan ke barcode / QR</div>`;
  document.body.appendChild(overlay);
  scanState.overlay = overlay;
  scanState.closeBtn = overlay.querySelector('#scan-close');
  scanState.closeBtn.addEventListener('click', e => { e.preventDefault(); stopScan(); });
}
function prepareCanvas(){
  if (scanState.canvas) return;
  const c = document.createElement('canvas');
  c.id = 'scan-canvas'; c.width = 640; c.height = 480;
  document.body.appendChild(c);
  scanState.canvas = c; scanState.ctx = c.getContext('2d', { willReadFrequently:true });
}
async function ensureJsQR(){
  if (scanState.jsQRReady) return;
  await new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload=()=>resolve(); s.onerror=()=>reject(new Error('Gagal memuat jsQR'));
    document.head.appendChild(s);
  });
  scanState.jsQRReady = true;
}
function detectLoop_BarcodeDetector(){
  const loop = async () => {
    if (!scanState.running || !scanState.video) return;
    try{
      const barcodes = await scanState.detector.detect(scanState.video);
      if (barcodes && barcodes.length){
        const value = (barcodes[0].rawValue || '').trim();
        if (value){ handleScanSuccess(value); return; }
      }
    }catch(e){
      console.warn('detector error', e);
      if (!scanState.canvas){
        try{ await ensureJsQR(); prepareCanvas(); scanState.usingDetector=false; detectLoop_jsQR(); return; }catch(_){}}
    }
    if (scanState.running) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function detectLoop_jsQR(){
  const loop = () => {
    if (!scanState.running || !scanState.video) return;
    const vid = scanState.video;
    const cw = scanState.canvas.width = vid.videoWidth || 640;
    const ch = scanState.canvas.height = vid.videoHeight || 480;
    scanState.ctx.drawImage(vid,0,0,cw,ch);
    const img = scanState.ctx.getImageData(0,0,cw,ch);
    const res = window.jsQR ? window.jsQR(img.data,cw,ch,{inversionAttempts:'dontInvert'}) : null;
    if (res && res.data){ handleScanSuccess(res.data); return; }
    if (scanState.running) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
async function handleScanSuccess(raw){ await stopScan(); receiveBarcode(raw); }

async function receiveBarcode(code){
  try{
    showOverlay('spinner','Mengambil data…','');
    // isi jamMasuk otomatis WIB
    jamMasuk.value = new Intl.DateTimeFormat('en-GB', {
      hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Asia/Jakarta'
    }).format(new Date());

    const url = LOOKUP_URL + '?token=' + SHARED_TOKEN + '&key=' + encodeURIComponent(code);
    const res = await fetch(url);
    const j = await res.json();
    if (j && j.columns){
      const status = (j.columns.K || '').trim().toUpperCase();
      const rawKode = j.columns.D || '';
      let kode = rawKode;
      try {
        let decoded = atob(rawKode);
        try { decoded = decodeURIComponent(decoded); } catch(__){}
        if (/^[\x20-\x7E]+$/.test(decoded)) kode = decoded;
      } catch (_){ }
      kode = kode.toUpperCase().trim();
      const hasP = kode.includes('P') || rawKode.toUpperCase().includes('P');

      if (status === 'MATI'){
        const raw = j.columns.G || '';
        let exp = '';
        const dt = raw ? new Date(raw) : null;
        if (dt && !isNaN(dt)){
          exp = dt.toLocaleDateString('id-ID',{ day:'2-digit', month:'long', year:'numeric'}).toUpperCase();
        } else {
          exp = raw.toUpperCase();
        }
        clearInputs();
        showOverlay('stop', `PAS ANDA HABIS MASA BERLAKUNYA ${exp}`, '');
      } else if (!hasP){
        clearInputs();
        showOverlay('stop','KODE PAS ANDA TIDAK MEMILIKI DAERAH SISI UDARA, MAKA ANDA DILARANG MASUK!','');
      } else {
        nama.textContent     = (j.columns.B || '-').toUpperCase();
        kodePas.textContent  = kode;
        instansi.textContent = (j.columns.E || '-').toUpperCase();
        prohibited.value = '';
        lokasi.value     = '';
        supervisor.value = '';
        hideOverlay();
      }
    } else {
      showOverlay('err', j?.error || 'Data tidak ditemukan','');
    }
  }catch(err){
    showOverlay('err','Gagal mengambil data', err?.message || err);
  }
}
window.receiveBarcode = receiveBarcode;
