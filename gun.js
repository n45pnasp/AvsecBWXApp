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
const fotoEvidenceInp = document.getElementById("fotoEvidence");
const btnEvidence     = document.getElementById("btnEvidence");
const evidencePreview = document.getElementById("evidencePreview");
const evidenceImg     = document.getElementById("evidenceImg");
const scanBtn         = document.getElementById("scanBtn");
const imgAvsec        = document.getElementById("imgAvsec");
const fotoIdInp       = document.getElementById("fotoId");
const fotoNote        = document.querySelector(".foto-note");
const downloadPdfBtn  = document.getElementById("downloadPdfBtn");

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

/* ================== Evidence UI (guarded) ================== */
if (btnEvidence && fotoEvidenceInp) {
  btnEvidence.addEventListener("click", () => fotoEvidenceInp.click());
  fotoEvidenceInp.addEventListener("change", () => {
    const file = fotoEvidenceInp.files[0];
    btnEvidence.textContent = "Ambil Foto";
    if (file) {
      if (evidenceImg) evidenceImg.src = URL.createObjectURL(file);
      if (evidencePreview) evidencePreview.classList.remove("hidden");
      if (fotoNote) fotoNote.classList.add("hidden");
    } else {
      if (evidenceImg) evidenceImg.removeAttribute("src");
      if (evidencePreview) evidencePreview.classList.add("hidden");
      if (fotoNote) fotoNote.classList.remove("hidden");
    }
  });
}

/* ================== Util Gambar ================== */
async function getImageDataUrl(file){
  if(!file) return "";
  try { return await readAndCompressToDataUrl(file); } catch { return ""; }
}
async function readAndCompressToDataUrl(file){
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = dataUrl;
  });
  let { width, height } = img;
  const max = Math.max(width, height);
  const scale = max > 800 ? 800 / max : 1;
  width = Math.round(width * scale); height = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.8);
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
    fotoEvidence:  await getImageDataUrl(fotoEvidenceInp?.files?.[0])
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
    if (fotoEvidenceInp) fotoEvidenceInp.value = "";
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
let scanState = { stream:null, video:null, canvas:null, ctx:null, running:false, usingDetector:false, detector:null, jsQRReady:false, overlay:null, closeBtn:null };
if (scanBtn) scanBtn.addEventListener("click", () => { if (scanState.running) stopScan(); else startScan(); });

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
    .scan-reticle{position:absolute;top:50%;left:50%;width:min(68vw,520px);aspect-ratio:1/1;transform:translate(-50%,-50%);border-radius:16px;box-shadow:0 0 0 9999px rgba(0,0,0,.28) inset;background:
      linear-gradient(#fff,#fff) left top/28px 2px no-repeat,
      linear-gradient(#fff,#fff) left top/2px 28px no-repeat,
      linear-gradient(#fff,#fff) right top/28px 2px no-repeat,
      linear-gradient(#fff,#fff) right top/2px 28px no-repeat,
      linear-gradient(#fff,#fff) left bottom/28px 2px no-repeat,
      linear-gradient(#fff,#fff) left bottom/2px 28px no-repeat,
      linear-gradient(#fff,#fff) right bottom/28px 2px no-repeat,
      linear-gradient(#fff,#fff) right bottom/2px 28px no-repeat}
    .scan-hint{position:absolute;left:50%;bottom:max(18px,calc(16px + env(safe-area-inset-bottom,0)));transform:translateX(-50%);background:rgba(0,0,0,.55);color:#fff;font-weight:600;padding:8px 12px;border-radius:999px;letter-spacing:.2px}
  `;
  const style = document.createElement('style'); style.id='scan-style'; style.textContent = css; document.head.appendChild(style);
}
injectScanStyles();

async function startScan(){
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
    if ('BarcodeDetector' in window){
      try{
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const wanted = ['qr_code','pdf417','aztec','data_matrix'];
        const fmts = wanted.filter(f=>supported.includes(f));
        if (fmts.length){ scanState.detector = new window.BarcodeDetector({ formats: fmts }); scanState.usingDetector = true; }
      }catch(_){}}

    scanState.running = true;
    if (scanState.usingDetector) detectLoop_BarcodeDetector();
    else { await ensureJsQR(); prepareCanvas(); detectLoop_jsQR(); }
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
  document.body.classList.remove('scan-active');
}
function ensureVideo(){ if (scanState.video) return; const v=document.createElement('video'); v.setAttribute('playsinline',''); v.muted=true; v.autoplay=true; v.id='scan-video'; document.body.appendChild(v); scanState.video=v; }
function ensureOverlay(){
  if (scanState.overlay) return;
  const overlay = document.createElement('div');
  overlay.id = 'scan-overlay';
  overlay.innerHTML = `
    <div class="scan-topbar"><button id="scan-close" class="scan-close" aria-label="Tutup">✕</button></div>
    <div class="scan-reticle" aria-hidden="true"></div>
    <div class="scan-hint">Arahkan ke barcode / QR</div>
  `;
  document.body.appendChild(overlay);
  scanState.overlay = overlay;
  scanState.closeBtn = overlay.querySelector('#scan-close');
  scanState.closeBtn.addEventListener('click', e => { e.preventDefault(); stopScan(); });
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
