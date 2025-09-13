// gun.js (FINAL) — sheet: GUN_FILESPDF, download via CFN, auto-cleanup via Worker
import { requireAuth, getFirebase } from "./auth-guard.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

/* ================== ENDPOINTS ================== */
// Worker untuk proxy ke Apps Script (submit data) + endpoint cleanup
const WORKER_BASE_URL = "https://loggun.avsecbwx2018.workers.dev/";
// Download PDF langsung ke Cloud Functions (sesuai permintaan)
const CFN_DOWNLOAD_PDF_URL = "https://us-central1-avsecbwx-4229c.cloudfunctions.net/downloadPdf";
// Lookup QR/Barcode (Apps Script terpisah untuk ambil data AVSEC)
const LOOKUP_URL   = "https://script.google.com/macros/s/AKfycbzgWQVOzC7cQVoc4TygW3nDJ_9iejZZ_4CBAWBFDrEXvjM5QxZvEiFr4FLKIu0bqs0Hfg/exec";
const SHARED_TOKEN = "N45p";

/* ================== AUTH GUARD ================== */
requireAuth({ loginPath: "index.html", hideWhileChecking: true });

/* ================== DOM ================== */
const nama            = document.getElementById("nama");
const pekerjaan       = document.getElementById("pekerjaan");
const flight          = document.getElementById("flight");
const seat            = document.getElementById("seat");
const kta             = document.getElementById("kta");
const tipe            = document.getElementById("tipe");
const jenisPeluru     = document.getElementById("jenisPeluru");
const jumlahPeluru    = document.getElementById("jumlahPeluru");
const namaAvsec       = document.getElementById("namaAvsec");
const instansiAvsec   = document.getElementById("instansiAvsec");
const petugas         = document.getElementById("petugas");
const supervisor      = document.getElementById("supervisor");
const submitBtn       = document.getElementById("submitBtn");
const btnEvidence     = document.getElementById("btnEvidence");
const evidencePreview = document.getElementById("evidencePreview");
const evidenceImg     = document.getElementById("evidenceImg");
const scanBtn         = document.getElementById("scanBtn");
const imgAvsec        = document.getElementById("imgAvsec");
const fotoIdInp       = document.getElementById("fotoId");
const fotoNote        = document.querySelector(".foto-note");
const downloadPdfBtn  = document.getElementById("downloadPdfBtn");

let evidenceDataUrl = "";

/* ================== Firebase ================== */
const { app, auth } = getFirebase();
const db = getDatabase(app);

onAuthStateChanged(auth, (user) => {
  if (user) petugas.value = (user.displayName || user.email || "").toUpperCase();
});

let supervisorVal = "";
onValue(ref(db, "roster/spvHbs"), (snap) => {
  const val = snap.val();
  supervisorVal = typeof val === "string" ? val.toUpperCase() : "";
  supervisor.value = supervisorVal;
});

/* ================== Overlay (aman-null) ================== */
const overlay = document.getElementById("overlay");
const ovIcon  = document.getElementById("ovIcon");
const ovTitle = document.getElementById("ovTitle");
const ovDesc  = document.getElementById("ovDesc");
const ovClose = document.getElementById("ovClose");

function hideOverlay(){ if (overlay) overlay.classList.add("hidden"); }
if (ovClose) ovClose.addEventListener("click", () => overlay.classList.add("hidden"));

function showOverlay(state, title, desc, autoHide = true){
  if (!overlay || !ovIcon || !ovTitle || !ovDesc) {
    if (state !== "spinner" && title) alert(title + (desc ? "\n" + desc : ""));
    return;
  }
  overlay.classList.remove("hidden");
  ovIcon.className = "icon " + state;
  ovTitle.textContent = title || "";
  ovDesc.textContent  = desc || "";
  if (ovClose) ovClose.classList.toggle("hidden", state === "spinner");
  if (autoHide && state !== "spinner") setTimeout(() => overlay.classList.add("hidden"), 1500);
}

/* ================== Evidence UI ================== */
if (btnEvidence) {
  btnEvidence.addEventListener("click", () => {
    if (scanState.running) return;
    startScan('photo');
  });
}

/* ================== Submit ke Sheet ================== */
let fotoAvsecCell = ""; // formula =IMAGE("url")
const SCRIPT_URL = WORKER_BASE_URL; // proxy ke Apps Script

if (submitBtn) submitBtn.addEventListener("click", async () => {
  const requiredInputs = [nama, pekerjaan, flight, seat, kta, tipe, jenisPeluru, jumlahPeluru, petugas, supervisor];
  const someEmpty = requiredInputs.some(el => !el || !el.value || !el.value.trim()) ||
    ["", "-"].includes((namaAvsec?.textContent || "").trim()) ||
    ["", "-"].includes((instansiAvsec?.textContent || "").trim());
  if (someEmpty) {
    showOverlay('stop', 'Data belum lengkap', 'Mohon lengkapi semua data sebelum mengirim.', false);
    return;
  }

  const now = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  const tanggal = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}`;

  const payload = {
    tanggal,
    namaLengkap:   nama.value.trim().toUpperCase(),
    pekerjaan:     pekerjaan.value.trim().toUpperCase(),
    flightNumber:  flight.value.trim().toUpperCase(),
    seatNumber:    seat.value.trim().toUpperCase(),
    nomorKTA:      kta.value.trim().toUpperCase(),
    tipeSenjata:   tipe.value.trim().toUpperCase(),
    jenisPeluru:   jenisPeluru.value.trim().toUpperCase(),
    jumlahPeluru:  (jumlahPeluru.value || "").trim().toUpperCase(),
    namaAvsec:     (namaAvsec?.textContent || "").trim().toUpperCase(),
    instansiAvsec: (instansiAvsec?.textContent || "").trim().toUpperCase(),
    petugas:       petugas.value.trim().toUpperCase(),
    supervisor:    supervisor.value.trim().toUpperCase(),
    fotoId:        (fotoIdInp?.value || "").trim(),
    fotoAvsec:     fotoAvsecCell || "",
    fotoEvidence:  evidenceDataUrl
  };

  submitBtn.disabled = true;
  showOverlay('spinner','Mengirim data…','');

  try {
    await sendToSheet('GUN_FILESPDF', payload);
    await sendToSheet('Files', payload);

    showOverlay('ok','Data berhasil dikirim','');

    // reset form
    [nama, pekerjaan, flight, seat, kta, tipe, jenisPeluru, jumlahPeluru, fotoIdInp].forEach(el => { if (el) el.value = ""; });
    if (namaAvsec) namaAvsec.textContent = "-";
    if (instansiAvsec) instansiAvsec.textContent = "-";
    if (supervisor) supervisor.value = supervisorVal;

    fotoAvsecCell = "";
    if (imgAvsec){ imgAvsec.src=""; imgAvsec.classList.add("hidden"); }
    evidenceDataUrl = "";
    if (btnEvidence) btnEvidence.textContent = "Ambil Foto";
    if (evidenceImg) evidenceImg.removeAttribute("src");
    if (evidencePreview) evidencePreview.classList.add("hidden");
    if (fotoNote) fotoNote.classList.remove("hidden");

  } catch(err){
    showOverlay('err','Gagal', err?.message || err);
  } finally {
    submitBtn.disabled = false;
  }
});

async function sendToSheet(sheet, payload){
  const user = auth.currentUser;
  const headers = { 'Content-Type': 'application/json' };
  if (user){
    try { headers.Authorization = `Bearer ${await user.getIdToken(true)}`; } catch {}
  }
  const body = { token: SHARED_TOKEN, ...payload };
  const url = `${SCRIPT_URL}?sheet=${encodeURIComponent(sheet)}&token=${encodeURIComponent(SHARED_TOKEN)}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j || (!j.success && !j.ok)) {
    throw new Error(j?.error || `Gagal mengirim (${res.status})`);
  }
}

/* ================== SCAN (BarcodeDetector/jsQR) ================== */
let scanState = { stream:null, video:null, canvas:null, ctx:null, running:false, usingDetector:false, detector:null, jsQRReady:false, overlay:null, closeBtn:null, shutterBtn:null, mode:'scan', _orientationHandler:null, _deviceOrientationHandler:null };
// null menandakan belum ada pembacaan tilt dari DeviceOrientationEvent
let deviceTilt = null;
if (scanBtn) scanBtn.addEventListener("click", () => { if (scanState.running) stopScan(); else startScan('scan'); });

function injectScanStyles(){
  if (document.getElementById('scan-style')) return;
  const css = `
    .is-waiting{opacity:.7;pointer-events:none}
    body.scan-active{background:#000;overscroll-behavior:contain}
    body.scan-active .app-bar, body.scan-active .container{display:none!important}
    #scan-video,#scan-canvas{position:fixed;inset:0;width:100vw;height:100vh;display:none;background:#000;z-index:9998}
    body.scan-active #scan-video{display:block;object-fit:cover;touch-action:none}
    #scan-overlay{position:fixed;inset:0;display:none;z-index:10000;pointer-events:none}
    body.scan-active #scan-overlay{display:block}
    .scan-topbar{position:absolute;top:0;left:0;right:0;height:max(56px,calc(44px + env(safe-area-inset-top,0)));display:flex;align-items:flex-start;justify-content:flex-end;padding:calc(env(safe-area-inset-top,0) + 6px) 10px 8px;background:linear-gradient(to bottom,rgba(0,0,0,.5),rgba(0,0,0,0));pointer-events:none}
    .scan-close{pointer-events:auto;width:42px;height:42px;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.25);font-size:22px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.35)}
    .scan-reticle{position:absolute;top:50%;left:50%;width:min(76vw,560px);aspect-ratio:1/1;transform:translate(-50%,-50%);border-radius:20px;box-shadow:0 0 0 9999px rgba(0,0,0,.32) inset;background:
      linear-gradient(#fff,#fff) left top/28px 2px no-repeat,
      linear-gradient(#fff,#fff) left top/2px 28px no-repeat,
      linear-gradient(#fff,#fff) right top/28px 2px no-repeat,
      linear-gradient(#fff,#fff) right top/2px 28px no-repeat,
      linear-gradient(#fff,#fff) left bottom/28px 2px no-repeat,
      linear-gradient(#fff,#fff) left bottom/2px 28px no-repeat,
      linear-gradient(#fff,#fff) right bottom/28px 2px no-repeat,
      linear-gradient(#fff,#fff) right bottom/2px 28px no-repeat}
    .scan-hint{position:absolute;left:50%;bottom:max(18px,calc(16px + env(safe-area-inset-bottom,0)));transform:translateX(-50%);background:rgba(0,0,0,.55);color:#fff;font-weight:600;padding:8px 12px;border-radius:999px;letter-spacing:.2px}
    .scan-shutter{position:absolute;left:50%;bottom:max(24px,calc(18px + env(safe-area-inset-bottom,0)));transform:translateX(-50%);width:74px;height:74px;border-radius:999px;background:#fff;border:4px solid rgba(255,255,255,.35);box-shadow:0 6px 22px rgba(0,0,0,.45), inset 0 0 0 4px #fff;pointer-events:auto;transition: transform .06s ease, opacity .15s ease, filter .15s ease}
    .scan-shutter:active{transform:translateX(-50%) scale(.96)}
    .scan-shutter.disabled,.scan-shutter:disabled{opacity:.45;filter:grayscale(60%);pointer-events:auto}
    .scan-msg-portrait{
      position:absolute;
      left:50%;
      bottom:max(110px,calc(96px + env(safe-area-inset-bottom,0)));
      transform:translateX(-50%);
      background:rgba(0,0,0,.55);
      color:#fff;
      font-weight:600;
      padding:10px 14px;
      border-radius:12px;
      display:none;
      flex-direction:column;
      align-items:center;
      gap:4px;
      box-shadow:0 4px 12px rgba(0,0,0,.35);
    }
    .scan-msg-portrait .rotate-icon{width:40px;height:40px;display:block}
    .scan-msg-portrait .rotate-icon path,
    .scan-msg-portrait .rotate-icon polyline{stroke:#fff;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}
    .scan-msg-portrait .rotate-text{font-size:12px}
  `;
  const style = document.createElement('style'); style.id='scan-style'; style.textContent = css; document.head.appendChild(style);
}
injectScanStyles();

async function startScan(mode = 'scan'){
  scanState.mode = mode;
  // reset tilt setiap kali scan dimulai
  deviceTilt = null;
  try{
    ensureVideo(); ensureOverlay();
    document.body.classList.add('scan-active');
    const stream = await navigator.mediaDevices.getUserMedia({
      video:{ facingMode:{ideal:'environment'}, width:{ideal:1280}, height:{ideal:720}, advanced:[{focusMode:'continuous'}]},
      audio:false
    });
    scanState.stream = stream;
    scanState.video.srcObject = stream;
    await scanState.video.play();
    scanState.usingDetector = false; scanState.detector = null;
    if (mode === 'scan' && 'BarcodeDetector' in window){
      try{
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const wanted = ['qr_code','pdf417','aztec','data_matrix'];
        const fmts = wanted.filter(f=>supported.includes(f));
        if (fmts.length){ scanState.detector = new window.BarcodeDetector({ formats: fmts }); scanState.usingDetector = true; }
      }catch(_){}}

    scanState.running = true;
    if (mode === 'scan'){
      if (scanState.usingDetector) detectLoop_BarcodeDetector();
      else { await ensureJsQR(); prepareCanvas(); detectLoop_jsQR(); }
    }
  }catch(_){
    showOverlay('err','Tidak bisa mengakses kamera','');
    await stopScan();
  }
}
async function stopScan(){
  scanState.running = false;
  if (scanState.stream){ scanState.stream.getTracks().forEach(t=>{ try{t.stop();}catch(_){}}); }
  scanState.stream = null;
  if (scanState.video){ scanState.video.srcObject = null; scanState.video.remove(); scanState.video = null; }
  if (scanState.canvas){ scanState.canvas.remove(); scanState.canvas = null; scanState.ctx = null; }
  if (scanState.overlay){ scanState.overlay.remove(); scanState.overlay = null; scanState.closeBtn = null; scanState.shutterBtn = null; }
  if (scanState._orientationHandler){
    window.removeEventListener('orientationchange', scanState._orientationHandler);
    window.removeEventListener('resize', scanState._orientationHandler);
    if (screen.orientation && screen.orientation.removeEventListener){
      screen.orientation.removeEventListener('change', scanState._orientationHandler);
    }
    scanState._orientationHandler = null;
  }
  if (scanState._deviceOrientationHandler){
    window.removeEventListener('deviceorientation', scanState._deviceOrientationHandler);
    scanState._deviceOrientationHandler = null;
  }
  // reset nilai tilt agar isLandscape menggunakan fallback lain
  deviceTilt = null;
  document.body.classList.remove('scan-active');
}
function ensureVideo(){ if (scanState.video) return; const v=document.createElement('video'); v.setAttribute('playsinline',''); v.muted=true; v.autoplay=true; v.id='scan-video'; document.body.appendChild(v); scanState.video=v; }
function ensureOverlay(){
  if (scanState.overlay) return;
  const overlay = document.createElement("div");
  overlay.id = "scan-overlay";
  if (scanState.mode === "photo"){
    overlay.innerHTML = `
      <div class="scan-topbar">
        <button id="scan-close" class="scan-close" aria-label="Tutup pemindaian">✕</button>
      </div>
      <div class="scan-msg-portrait" role="alert" aria-live="assertive" aria-label="Putar perangkat ke mode horizontal">
        <svg class="rotate-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <polyline points="21 3 21 9 15 9" />
        </svg>
        <div class="rotate-text">putar horizontal</div>
      </div>
      <button id="scan-shutter" class="scan-shutter" aria-label="Ambil gambar" title="Ambil gambar"></button>
    `;
  } else {
    overlay.innerHTML = `
      <div class="scan-topbar"><button id="scan-close" class="scan-close" aria-label="Tutup">✕</button></div>
      <div class="scan-reticle" aria-hidden="true"></div>
      <div class="scan-hint">Arahkan ke barcode / QR</div>
    `;
  }
  document.body.appendChild(overlay);
  scanState.overlay = overlay;
  scanState.closeBtn = overlay.querySelector("#scan-close");
  if (scanState.closeBtn){
    scanState.closeBtn.addEventListener("click", async (e)=>{ e.preventDefault(); await stopScan(); });
  }
  if (scanState.mode === "photo"){
    const shutterBtn = overlay.querySelector("#scan-shutter");
    scanState.shutterBtn = shutterBtn;
    if (shutterBtn){
      shutterBtn.addEventListener("click", async (e)=>{
        e.preventDefault();
        if (!isLandscape()) { alert("Perangkat masih portrait. Putar perangkat ke horizontal untuk memotret."); return; }
        try {
          const dataUrl = await captureFrame();
          evidenceDataUrl = dataUrl;
          if (evidenceImg) evidenceImg.src = dataUrl;
          if (evidencePreview) evidencePreview.classList.remove("hidden");
          if (fotoNote) fotoNote.classList.add("hidden");
          if (btnEvidence) btnEvidence.textContent = "Ulangi Foto";
          await stopScan();
        } catch (err) {
          console.error("Gagal capture:", err);
          alert("Gagal mengambil gambar.");
        }
      });
    }
    const update = () => updateCaptureState();
    scanState._orientationHandler = update;
    window.addEventListener("orientationchange", update);
    window.addEventListener("resize", update);
    if (screen.orientation && screen.orientation.addEventListener) {
      screen.orientation.addEventListener("change", update);
    }
    if (window.DeviceOrientationEvent){
      const handler = (e)=>{
        if (typeof e.gamma === 'number') {
          deviceTilt = e.gamma;
          updateCaptureState();
        }
      };
      // iOS 13+ requires permission
      try { DeviceOrientationEvent.requestPermission && DeviceOrientationEvent.requestPermission().catch(()=>{}); } catch(_){ }
      window.addEventListener('deviceorientation', handler);
      scanState._deviceOrientationHandler = handler;
    }
    updateCaptureState();
  }
}


function isLandscape(){
  // prioritaskan API orientasi layar bila tersedia
  if (screen.orientation && typeof screen.orientation.type === "string") {
    if (screen.orientation.type.startsWith("landscape")) return true;
  }
  if (typeof window.orientation === "number") {
    if (Math.abs(window.orientation) === 90) return true;
  }
  // gunakan tilt perangkat sebagai fallback tambahan (>=60° dianggap landscape)
  if (typeof deviceTilt === 'number' && !Number.isNaN(deviceTilt)) {
    if (Math.abs(deviceTilt) >= 60) return true;
  }
  return (window.matchMedia && window.matchMedia('(orientation: landscape)').matches)
         || (window.innerWidth > window.innerHeight);
}

function updateCaptureState(){
  const btn   = document.getElementById('scan-shutter');
  const msg   = document.querySelector('#scan-overlay .scan-msg-portrait');
  const onLS  = isLandscape();

  if (btn){
    btn.disabled = !onLS;
    btn.classList.toggle('disabled', !onLS);
  }
  if (msg){
    msg.style.display = onLS ? 'none' : 'flex';
  }
}

async function captureFrame(){
  if (!scanState.video) throw new Error('Video belum siap');

  const vid = scanState.video;
  let w   = vid.videoWidth  || 1280;
  let h   = vid.videoHeight || 720;

  const c   = document.createElement('canvas');
  let ctx;

  if (h > w){
    c.width = h;
    c.height = w;
    ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.translate(h/2, w/2);
    ctx.rotate(-Math.PI/2);
    ctx.drawImage(vid, -w/2, -h/2, w, h);
    [w, h] = [h, w];
  } else {
    c.width = w;
    c.height = h;
    ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(vid, 0, 0, w, h);
  }

  // Kompres gambar maksimal 800px pada sisi terpanjang
  const max = Math.max(w, h);
  let dataCanvas = c;
  if (max > 800){
    const scale = 800 / max;
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    const c2 = document.createElement('canvas');
    c2.width = cw; c2.height = ch;
    c2.getContext('2d').drawImage(c, 0, 0, cw, ch);
    dataCanvas = c2;
  }
  return dataCanvas.toDataURL('image/jpeg', 0.8);
}
function prepareCanvas(){ if (scanState.canvas) return; const c=document.createElement('canvas'); c.id='scan-canvas'; c.width=640; c.height=480; document.body.appendChild(c); scanState.canvas=c; scanState.ctx=c.getContext("2d",{willReadFrequently:true}); }
async function ensureJsQR(){
  if (scanState.jsQRReady) return;
  await new Promise((resolve,reject)=>{ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'; s.onload=()=>resolve(); s.onerror=()=>reject(new Error('Gagal memuat jsQR')); document.head.appendChild(s); });
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
      if (!scanState.canvas){
        try{ await ensureJsQR(); prepareCanvas(); scanState.usingDetector=false; detectLoop_jsQR(); return; }catch(_){ }
      }
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

/* ================== Lookup receive ================== */
async function receiveBarcode(code){
  try{
    showOverlay('spinner','Mengambil data…','');
    const url = LOOKUP_URL + '?token=' + SHARED_TOKEN + '&key=' + encodeURIComponent(code);
    const res = await fetch(url);
    const j = await res.json();
    if (j && j.columns){
      const namaVal = (j.columns.B || '').toUpperCase();
      if (namaAvsec) namaAvsec.textContent = namaVal || '-';
      const instansiVal = (j.columns.E || '').toUpperCase();
      if (instansiAvsec) instansiAvsec.textContent = instansiVal || '-';

      const rawFoto = (j.columns.H || '').trim();
      let fotoUrl = "", fotoId = "";
      if (rawFoto) {
        if (/^https?:/i.test(rawFoto)) { fotoUrl = rawFoto; const m = rawFoto.match(/id=([^&]+)/); fotoId = m ? m[1] : ""; }
        else { fotoId = rawFoto; fotoUrl = `https://drive.google.com/thumbnail?id=${rawFoto}`; }
      }
      if (fotoIdInp) fotoIdInp.value = fotoId;
      fotoAvsecCell = fotoUrl ? `=IMAGE("${fotoUrl}")` : "";

      if (fotoUrl && imgAvsec){ imgAvsec.src = fotoUrl; imgAvsec.classList.remove('hidden'); }
      else if (imgAvsec){ imgAvsec.src = ""; imgAvsec.classList.add('hidden'); }

      hideOverlay();
    } else {
      showOverlay('err', j?.error || 'Data tidak ditemukan','');
    }
  }catch(err){
    showOverlay('err','Gagal mengambil data', err?.message || err);
  }
}

/* ================== DOWNLOAD PDF (via CFN) + AUTO CLEANUP ================== */
function initPdfDownload(){
  if (!downloadPdfBtn) return;
  downloadPdfBtn.addEventListener("click", async () => {
    try{
      showOverlay("spinner","Menyiapkan PDF…","" );
      const user = auth.currentUser;
      if (!user) return alert("Silakan login ulang.");

      const idToken = await user.getIdToken(true);
      const url = `${CFN_DOWNLOAD_PDF_URL}?site=GUN_FILESPDF`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
      if (!res.ok){
        const txt = await res.text().catch(()=> "");
        throw new Error(`Gagal export (${res.status}). ${txt}`);
      }

      // Unduh PDF dengan nama berformat GunFiles_<tglBlnTahun>.pdf
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const filename = `GunFiles_${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}.pdf`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);

      // Trigger cleanup ke Worker (yang meneruskan ke Apps Script ?action=cleanup)
      try {
        await fetch(`${WORKER_BASE_URL}cleanup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        });
      } catch (e) {
        console.warn("Cleanup gagal dipanggil:", e);
      }

      showOverlay("ok","Download siap","PDF telah diunduh");
    }catch(err){
      console.error(err);
      showOverlay("err","Download gagal", err.message || "Coba lagi");
    }
  });
}

/* ================== STARTUP ================== */
window.addEventListener("DOMContentLoaded", () => {
  initPdfDownload();
});
