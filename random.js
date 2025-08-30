// random.js — FINAL (via Cloudflare Worker proxy + upload foto ke Drive)
import { requireAuth, getFirebase } from "./auth-guard.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

requireAuth({ loginPath: "index.html", hideWhileChecking: true });

/* ===== KONFIG ===== */
const PROXY_URL    = "https://rdcheck.avsecbwx2018.workers.dev/"; // Worker
const SHARED_TOKEN = "N45p"; // Worker juga akan menambahkan bila kosong

/* ===== DOM ===== */
const $ = (s)=>document.querySelector(s);
const btnPSCP = $("#btnPSCP"), btnHBSCP = $("#btnHBSCP"), btnCARGO = $("#btnCARGO");
const scanBtn = $("#scanBtn"), scanResult = $("#scanResult");
const namaEl = $("#namaPenumpang"), flightEl = $("#noFlight");
const manualForm = $("#manualForm"), manualNama = $("#manualNama"), manualFlight = $("#manualFlight");
const manualNamaLabel = manualForm?.querySelector('label[for="manualNama"]');
const metodeSel = $("#jenisPemeriksaan");
const objekSel = $("#objek"), objekField = objekSel?.parentElement;
const barangCard = $("#barangCard");
const tindakanSel = $("#tindakanBarang"), tipePiSel = $("#tipePi");
const tindakanField = tindakanSel?.parentElement, tipePiField = tipePiSel?.parentElement;
const isiBarangInp = $("#isiBarang");
const fotoBtn = $("#fotoBtn"), fotoInput = $("#fotoInput"), fotoPreview = $("#fotoPreview");
const petugasInp = $("#petugas"), supervisorInp = $("#supervisor"), submitBtn = $("#submitBtn");
const overlay = $("#overlay"), ovIcon = $("#ovIcon"), ovTitle = $("#ovTitle"), ovDesc = $("#ovDesc"), ovClose = $("#ovClose");

/* ===== AUTH ===== */
const { app, auth } = getFirebase();
const db = getDatabase(app);
onAuthStateChanged(auth, (u)=>{
  const name = (u?.displayName || u?.email || "").toUpperCase();
  if (petugasInp) petugasInp.value = name;
});

/* ===== OVERLAY ===== */
ovClose?.addEventListener("click", ()=>overlay?.classList.add("hidden"));
function showOverlay(state, title, desc=""){
  overlay?.classList.remove("hidden");
  if(ovIcon) ovIcon.className = "icon "+state; // state: spinner | ok | err | stop
  if(ovTitle) ovTitle.textContent = title;
  if(ovDesc) ovDesc.textContent = desc;
  ovClose?.classList.toggle("hidden", state === "spinner");
  if(state !== "spinner"){
    const delay = state === "stop" ? 3500 : 1500;
    setTimeout(()=>overlay?.classList.add("hidden"), delay);
  }
}
function hideOverlay(){ overlay?.classList.add("hidden"); }

/* ===== STATE & SUPERVISOR ===== */
let mode = "PSCP";
const supervisors = { PSCP:"", HBSCP:"", CARGO:"" };

onValue(ref(db, "roster/spvCabin"), (s)=>{ supervisors.PSCP=s.val()||""; if(mode==="PSCP") setSupervisor(); });
onValue(ref(db, "roster/spvHbs"),   (s)=>{ supervisors.HBSCP=s.val()||""; if(mode==="HBSCP") setSupervisor(); });
onValue(ref(db, "roster/spvCargo"), (s)=>{ supervisors.CARGO=s.val()||""; if(mode==="CARGO") setSupervisor(); });

function setSupervisor(){ if (supervisorInp) supervisorInp.value = supervisors[mode] || ""; }
function val(e){ return (e?.value||"").trim(); }
function txt(e){ return (e?.textContent||"").trim(); }

/* ===== FOTO (Preview + DataURL) ===== */
let fotoDataUrl = ""; // disiapkan untuk dikirimkan ke GAS (sudah dikompresi)

async function compressImage(file, max=480, quality=0.7){
  const img = await new Promise((resolve, reject)=>{
    const i = new Image();
    i.onload = ()=>resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

function resetFoto(){
  if(!fotoInput||!fotoPreview) return;
  fotoInput.value = "";
  fotoPreview.src = "";
  fotoPreview.classList.add("hidden");
  fotoDataUrl = "";
}
fotoBtn?.addEventListener("click", ()=>fotoInput?.click());
fotoInput?.addEventListener("change", async ()=>{
  const file = fotoInput.files?.[0];
  if(!file){ resetFoto(); return; }
  // Preview
  fotoPreview.src = URL.createObjectURL(file);
  fotoPreview.classList.remove("hidden");
  try{
    const dataUrl = await compressImage(file, 480, 0.7);
    if(dataUrl.length > 49000){
      alert("Foto terlalu besar, gunakan resolusi lebih rendah.");
      resetFoto();
    }else{
      fotoDataUrl = dataUrl;
    }
  }catch(err){
    console.error(err);
    resetFoto();
  }
});

/* ===== UI Rules ===== */
function updateTipePiVisibility(){
  const t = val(tindakanSel).toLowerCase();
  const need = (mode==="PSCP" && val(objekSel)==="barang" && t==="ditinggal") || (mode==="HBSCP" && t==="ditinggal");
  tipePiField?.classList.toggle("hidden", !need);
}
function updateBarangCard(){
  if(!barangCard) return;
  if (mode==="PSCP"){
    if(val(objekSel)==="barang"){
      barangCard.classList.remove("hidden");
      tindakanField?.classList.remove("hidden");
      updateTipePiVisibility();
    } else { barangCard.classList.add("hidden"); resetFoto(); }
  } else if (mode==="HBSCP"){
    barangCard.classList.remove("hidden");
    tindakanField?.classList.remove("hidden");
    updateTipePiVisibility();
  } else { // CARGO
    barangCard.classList.remove("hidden");
    tindakanField?.classList.add("hidden");
    tipePiField?.classList.add("hidden");
  }
}
objekSel?.addEventListener("change", updateBarangCard);
tindakanSel?.addEventListener("change", updateTipePiVisibility);

function setMode(m){
  mode = m;
  [btnPSCP, btnHBSCP, btnCARGO].forEach(b=>b?.classList.remove("active"));
  if(m==="PSCP") btnPSCP?.classList.add("active");
  else if(m==="HBSCP") btnHBSCP?.classList.add("active");
  else btnCARGO?.classList.add("active");
  stopScan?.();
  if(namaEl) namaEl.textContent="-";
  if(flightEl) flightEl.textContent="-";
  if(manualNama) manualNama.value="";
  if(manualFlight) manualFlight.value="";
  if(metodeSel) metodeSel.value="";
  if(isiBarangInp) isiBarangInp.value="";
  if(tindakanSel) tindakanSel.value="";
  if(tipePiSel) tipePiSel.value="";
  resetFoto();
  setSupervisor();

  if (m==="PSCP"){
    scanBtn?.classList.remove("hidden"); scanResult?.classList.remove("hidden");
    manualForm?.classList.add("hidden"); if (manualNamaLabel) manualNamaLabel.textContent="Nama Penumpang";
    objekField?.classList.remove("hidden"); if (objekSel) objekSel.value=""; updateBarangCard();
  } else if (m==="HBSCP"){
    scanBtn?.classList.remove("hidden"); scanResult?.classList.remove("hidden");
    manualForm?.classList.add("hidden"); if (manualNamaLabel) manualNamaLabel.textContent="Nama Penumpang";
    objekField?.classList.add("hidden"); updateBarangCard();
  } else { // CARGO
    scanBtn?.classList.add("hidden"); scanResult?.classList.add("hidden");
    manualForm?.classList.remove("hidden"); if (manualNamaLabel) manualNamaLabel.textContent="Nama Pengirim";
    objekField?.classList.add("hidden"); updateBarangCard();
  }
}
btnPSCP?.addEventListener("click", ()=>setMode("PSCP"));
btnHBSCP?.addEventListener("click", ()=>setMode("HBSCP"));
btnCARGO?.addEventListener("click", ()=>setMode("CARGO"));
setMode("PSCP");

/* ===== SCANNER ===== */
let scanState = {
  stream: null, video: null, canvas: null, ctx: null,
  running: false, usingDetector: false, detector: null, jsQRReady: false,
  overlay: null, closeBtn: null,
};
function splitFromBack(str, maxSplits){
  const parts = []; let remaining = str;
  for (let i=0; i<maxSplits; i++){
    const j = remaining.lastIndexOf(' '); if (j === -1) break;
    parts.unshift(remaining.slice(j+1)); remaining = remaining.slice(0, j);
  }
  parts.unshift(remaining); return parts;
}
function parseBoardingPass(data){
  if (!data || typeof data!=="string" || !data.startsWith("M1")) return null;
  const parts = splitFromBack(data, 5);
  if (parts.length < 6) return null;
  const namaRaw = parts[0].substring(2);
  const slash = namaRaw.indexOf('/');
  const fullName = (slash === -1)
    ? namaRaw.replace(/_/g,' ').trim()
    : (namaRaw.substring(slash+1)+' '+namaRaw.substring(0,slash)).replace(/_/g,' ').trim();
  const airlineCode = parts[2].slice(-2);
  const flightNumber = parts[3];
  return { fullName, flight: `${airlineCode} ${flightNumber}` };
}
function receiveBarcode(payload){
  try{
    let data = payload;
    if (typeof payload === "string"){
      try{ const j = JSON.parse(payload); if (j && j.data) data = j.data; }catch(_){}}
    if (!data || typeof data !== "string") return;
    const parsed = parseBoardingPass(data);
    if (parsed){
      if (namaEl)   namaEl.textContent = parsed.fullName;
      if (flightEl) flightEl.textContent = parsed.flight;
      scanResult?.classList.remove('hidden');
      manualForm?.classList.add('hidden');
    }
  }catch(e){ console.error(e); }
}
window.receiveBarcode = receiveBarcode;

function setWaitingUI(on){
  if (!scanBtn) return;
  scanBtn.classList.toggle('is-waiting', !!on);
  scanBtn.disabled = !!on;
  scanBtn.setAttribute('aria-busy', on ? 'true' : 'false');
}
injectScanStyles();
scanBtn?.addEventListener('click', async () => {
  if (scanState.running){ await stopScan(); return; }
  await startScan();
});

async function startScan(){
  try{
    manualForm?.classList.add('hidden');
    scanResult?.classList.remove('hidden');
    setWaitingUI(true);
    ensureVideo(); ensureOverlay();
    if (!scanState.video) throw new Error('Video element tidak tersedia');
    document.body.classList.add('scan-active');

    const constraints = {
      video: { facingMode: { ideal: "environment" }, width:{ideal:1280}, height:{ideal:720}, advanced:[{focusMode:"continuous"}] },
      audio: false
    };
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Kamera tidak didukung');
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    scanState.stream = stream;
    const vid = scanState.video; if (!vid) throw new Error('Video element hilang');
    vid.srcObject = stream; await vid.play();

    scanState.usingDetector = false;
    scanState.detector = null;
    if ('BarcodeDetector' in window){
      try{
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const wanted = ['pdf417','aztec','qr_code','data_matrix'];
        const formats = wanted.filter(f => supported.includes(f));
        if (formats.length){ scanState.detector = new window.BarcodeDetector({ formats }); scanState.usingDetector = true; }
      }catch(_){ }
    }
    scanState.running = true;
    if (scanState.usingDetector) detectLoop_BarcodeDetector();
    else { await ensureJsQR(); prepareCanvas(); detectLoop_jsQR(); }
  }catch(err){
    console.error(err);
    setWaitingUI(false);
    showOverlay('err','Tidak bisa mengakses kamera', err?.message || String(err));
    await stopScan();
  }
}
async function stopScan(){
  scanState.running = false;
  if (scanState.stream){ for (const t of scanState.stream.getTracks()){ try{ t.stop(); }catch(_){} } }
  scanState.stream = null;
  if (scanState.video){ scanState.video.srcObject = null; scanState.video.remove(); scanState.video = null; }
  if (scanState.canvas){ scanState.canvas.remove(); scanState.canvas = null; scanState.ctx = null; }
  document.body.classList.remove('scan-active');
  setWaitingUI(false);
}
function ensureVideo(){
  if (scanState.video) return;
  const v = document.createElement('video');
  v.setAttribute('playsinline',''); v.muted = true; v.autoplay = true; v.id = 'scan-video';
  document.body.appendChild(v); scanState.video = v;
}
function ensureOverlay(){
  if (scanState.overlay) return;
  const overlayEl = document.createElement('div');
  overlayEl.id = 'scan-overlay';
  overlayEl.innerHTML = `
    <div class="scan-topbar"><button id="scan-close" class="scan-close" aria-label="Tutup pemindaian">✕</button></div>
    <div class="scan-reticle" aria-hidden="true"></div>
    <div class="scan-hint">Arahkan ke barcode / QR</div>`;
  document.body.appendChild(overlayEl);
  scanState.overlay = overlayEl;
  scanState.closeBtn = overlayEl.querySelector('#scan-close');
  scanState.closeBtn.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    await stopScan();
    manualForm?.classList.remove('hidden');
    scanResult?.classList.add('hidden');
    manualNama?.focus();
  });
}
function prepareCanvas(){
  if (scanState.canvas) return;
  const c = document.createElement('canvas'); c.id = 'scan-canvas'; c.width = 640; c.height = 480;
  document.body.appendChild(c); scanState.canvas = c;
  scanState.ctx = c.getContext('2d', { willReadFrequently: true });
}
async function ensureJsQR(){
  if (scanState.jsQRReady) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload = resolve; s.onerror = () => reject(new Error('Gagal memuat jsQR'));
    document.head.appendChild(s);
  });
  scanState.jsQRReady = true;
}
function detectLoop_BarcodeDetector(){
  const loop = async () => {
    if (!scanState.running || !scanState.video) return;
    try{
      const barcodes = await scanState.detector.detect(scanState.video);
      if (barcodes?.length){
        const value = (barcodes[0].rawValue || '').trim();
        if (value){ await handleScanSuccess(value); return; }
      }
    }catch(e){
      console.warn('Detector error:', e);
      if (!scanState.canvas){
        try{ await ensureJsQR(); prepareCanvas(); scanState.usingDetector = false; detectLoop_jsQR(); return; }catch(_){ }
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
    const cw = (scanState.canvas.width  = vid.videoWidth  || 640);
    const ch = (scanState.canvas.height = vid.videoHeight || 480);
    scanState.ctx.drawImage(vid, 0, 0, cw, ch);
    const img = scanState.ctx.getImageData(0, 0, cw, ch);
    const result = window.jsQR ? window.jsQR(img.data, cw, ch, { inversionAttempts: 'dontInvert' }) : null;
    if (result?.data){ handleScanSuccess(result.data); return; }
    if (scanState.running) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
async function handleScanSuccess(raw){
  try{ await stopScan(); receiveBarcode(raw); }catch(e){ console.error(e); }
}
function injectScanStyles(){
  if (document.getElementById('scan-style')) return;
  const css = `
    .is-waiting{opacity:.7;pointer-events:none}
    body.scan-active{background:#000;overscroll-behavior:contain}
    body.scan-active .app-bar, body.scan-active .container{display:none!important}
    #scan-video,#scan-canvas{position:fixed;inset:0;width:100vw;height:100vh;display:none;background:#000;z-index:9998}
    body.scan-active #scan-video{display:block;object-fit:cover;transform:none;touch-action:none}
    body.scan-active #scan-canvas{display:none}
    #scan-overlay{position:fixed;inset:0;display:none;z-index:10000;pointer-events:none}
    body.scan-active #scan-overlay{display:block}
    .scan-topbar{position:absolute;top:0;left:0;right:0;height:max(56px,calc(44px + env(safe-area-inset-top,0)));\n      display:flex;align-items:flex-start;justify-content:flex-end;padding:calc(env(safe-area-inset-top,0)+6px) 10px 8px;\n      background:linear-gradient(to bottom,rgba(0,0,0,.5),rgba(0,0,0,0));pointer-events:none}
    .scan-close{pointer-events:auto;width:42px;height:42px;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;\n      border:1px solid rgba(255,255,255,.25);font-size:22px;line-height:1;display:flex;align-items:center;justify-content:center;\n      box-shadow:0 4px 12px rgba(0,0,0,.35);transition:transform .08s ease, filter .15s ease}
    .scan-close:active{transform:scale(.96)} .scan-close:focus-visible{outline:2px solid rgba(255,255,255,.6);outline-offset:2px}
    .scan-reticle{position:absolute;top:50%;left:50%;width:min(68vw,520px);aspect-ratio:1/1;transform:translate(-50%,-50%);\n      border-radius:16px;box-shadow:0 0 0 9999px rgba(0,0,0,.28) inset;pointer-events:none;\n      background:linear-gradient(#fff,#fff) left top/28px 2px no-repeat,linear-gradient(#fff,#fff) left top/2px 28px no-repeat,\n      linear-gradient(#fff,#fff) right top/28px 2px no-repeat,linear-gradient(#fff,#fff) right top/2px 28px no-repeat,\n      linear-gradient(#fff,#fff) left bottom/28px 2px no-repeat,linear-gradient(#fff,#fff) left bottom/2px 28px no-repeat,\n      linear-gradient(#fff,#fff) right bottom/28px 2px no-repeat,linear-gradient(#fff,#fff) right bottom/2px 28px no-repeat}
    .scan-hint{position:absolute;left:50%;bottom:max(18px,calc(16px + env(safe-area-inset-bottom,0)));transform:translateX(-50%);\n      background:rgba(0,0,0,.55);color:#fff;font-weight:600;padding:8px 12px;border-radius:999px;letter-spacing:.2px;pointer-events:none;\n      box-shadow:0 4px 12px rgba(0,0,0,.35)}
  `;
  const style = document.createElement('style');
  style.id = 'scan-style'; style.textContent = css; document.head.appendChild(style);
}

/* =========================================================
   SUBMISSION LOGIC
   ========================================================= */
function getNameAndFlight(){
  if (mode==="CARGO") return { nama: val(manualNama), flight: val(manualFlight) };
  const usingManual = !scanResult || scanResult.classList.contains("hidden");
  return {
    nama: usingManual ? val(manualNama) : txt(namaEl),
    flight: usingManual ? val(manualFlight) : txt(flightEl)
  };
}
async function fetchJSON(url, opts = {}, timeoutMs = 15000){
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), timeoutMs);
  try{
    const res = await fetch(url, { ...opts, signal: controller.signal, mode: "cors" });
    const text = await res.text();
    let data={};
    try{ data = text ? JSON.parse(text) : {}; }catch{ data = { raw:text }; }
    if(!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  }catch(e){
    if(e.name === "AbortError") throw new Error("Timeout: server lambat merespons.");
    throw e;
  }finally{
    clearTimeout(t);
  }
}

async function submitRandom(){
  try{
    submitBtn.disabled = true; submitBtn.setAttribute("aria-busy","true");
    showOverlay('spinner','Mengirim data…','');

    const { nama, flight } = getNameAndFlight();
    const jenisBarang = val(isiBarangInp);
    const tindakan    = val(tindakanSel).toLowerCase();
    const tipePi      = val(tipePiSel);
    const petugas     = val(petugasInp);
    const supervisor  = val(supervisorInp);
    const metode      = val(metodeSel);

    if(!nama) throw new Error("Nama tidak boleh kosong.");
    if(!flight) throw new Error("Flight tidak boleh kosong.");
    if(mode==="PSCP" && val(objekSel)==="") throw new Error("Pilih objek pemeriksaan.");
    if((mode==="PSCP" && val(objekSel)==="barang") || mode!=="PSCP"){ if(!jenisBarang) throw new Error("Isi/Jenis barang belum diisi."); }
    if(!metode) throw new Error("Metode pemeriksaan belum dipilih.");

    const fotoUrl = fotoDataUrl ? `=IMAGE("${fotoDataUrl}")` : "";

    const payload = {
      action: "submit",
      token: SHARED_TOKEN,
      target: mode,
      data: {
        nama,
        flight,
        ...(mode === "PSCP" ? { objekPemeriksaan: val(objekSel) || "" } : {}),
        jenisBarang,
        petugas,
        metode,
        supervisor,
        fotoUrl
      }
    };

    if ((mode === "PSCP" || mode === "HBSCP") && tindakan === "ditinggal") {
      payload.data.tindakanBarang = "ditinggal";
      payload.data.namaBarang = jenisBarang;
      payload.data.jenisDGDA = tipePi;
      if (fotoUrl) payload.data.fotoPiUrl = fotoUrl;
    } else if (mode !== "CARGO") {
      payload.data.tindakanBarang = tindakan; // "dibawa" / ""
    }

    const j = await fetchJSON(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload),
      credentials: "omit",
    });

    if(!j?.ok) throw new Error(j?.error || "Gagal menyimpan");
    showOverlay('ok','Data tersimpan', `Sheet ${j.targetSheet} (row ${j.targetRow})${j.piListWritten ? ` + PI_LIST (row ${j.piListRow})` : ''}`);

    if (mode==="CARGO"){ manualNama.value=""; manualFlight.value=""; }
    else { if(namaEl) namaEl.textContent="-"; if(flightEl) flightEl.textContent="-"; }
    if (isiBarangInp) isiBarangInp.value = "";
    if (tindakanSel)  tindakanSel.value  = "";
    if (tipePiSel)    tipePiSel.value    = "";
    if (mode==="PSCP" && objekSel) objekSel.value = "";
    resetFoto(); updateBarangCard();

  }catch(err){
    console.error(err);
    const raw = err?.message || String(err);
    const friendly = raw.includes('Timeout') ? 'Koneksi lambat atau server tidak merespons.' : raw;
    showOverlay('err','Gagal', friendly);
  }finally{
    submitBtn.disabled = false; submitBtn.setAttribute("aria-busy","false");
  }
}
submitBtn?.addEventListener("click", (e)=>{ e.preventDefault(); if(!submitBtn.disabled) submitRandom(); });

