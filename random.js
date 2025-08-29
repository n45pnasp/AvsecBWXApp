import { requireAuth } from "./auth-guard.js";
requireAuth({ loginPath: "index.html", hideWhileChecking: true });

const btnPSCP = document.getElementById("btnPSCP");
const btnHBSCP = document.getElementById("btnHBSCP");
const btnCARGO = document.getElementById("btnCARGO");

const scanBtn = document.getElementById("scanBtn");
const scanResult = document.getElementById("scanResult");
const namaEl = document.getElementById("namaPenumpang");
const flightEl = document.getElementById("noFlight");
const manualForm = document.getElementById("manualForm");
const manualNama = document.getElementById("manualNama");
const manualFlight = document.getElementById("manualFlight");
const manualNamaLabel = manualForm.querySelector('label[for="manualNama"]');

const objekSel = document.getElementById("objek");
const objekField = objekSel.parentElement;
const barangCard = document.getElementById("barangCard");
const tindakanSel = document.getElementById("tindakanBarang");
const tipePiSel = document.getElementById("tipePi");
const tindakanField = tindakanSel.parentElement;
const tipePiField = tipePiSel.parentElement;

let mode = "PSCP";

function updateTipePiVisibility(){
  if (mode === "PSCP" && tindakanSel.value === "Ditinggal"){
    tipePiField.classList.remove("hidden");
  }else{
    tipePiField.classList.add("hidden");
  }
}

function updateBarangCard(){
  if (mode === "PSCP"){
    if (objekSel.value === "barang"){
      barangCard.classList.remove("hidden");
      tindakanField.classList.remove("hidden");
      updateTipePiVisibility();
    }else{
      barangCard.classList.add("hidden");
    }
  }else{
    barangCard.classList.remove("hidden");
    tindakanField.classList.add("hidden");
    tipePiField.classList.add("hidden");
  }
}

objekSel.addEventListener("change", updateBarangCard);
tindakanSel.addEventListener("change", updateTipePiVisibility);

function setMode(m){
  mode = m;
  stopScan();
  namaEl.textContent = "-";
  flightEl.textContent = "-";
  manualNama.value = "";
  manualFlight.value = "";
  document.getElementById("isiBarang").value = "";
  tindakanSel.value = "";
  tipePiSel.value = "";

  if (m === "PSCP"){
    scanBtn.classList.remove("hidden");
    scanResult.classList.remove("hidden");
    manualForm.classList.add("hidden");
    manualNamaLabel.textContent = "Nama Penumpang";
    objekField.classList.remove("hidden");
    objekSel.value = "";
    updateBarangCard();
  }else if (m === "HBSCP"){
    scanBtn.classList.remove("hidden");
    scanResult.classList.remove("hidden");
    manualForm.classList.add("hidden");
    manualNamaLabel.textContent = "Nama Penumpang";
    objekField.classList.add("hidden");
    updateBarangCard();
  }else if (m === "CARGO"){
    scanBtn.classList.add("hidden");
    scanResult.classList.add("hidden");
    manualForm.classList.remove("hidden");
    manualNamaLabel.textContent = "Nama Pengirim";
    objekField.classList.add("hidden");
    updateBarangCard();
  }
}

btnPSCP.addEventListener("click", () => setMode("PSCP"));
btnHBSCP.addEventListener("click", () => setMode("HBSCP"));
btnCARGO.addEventListener("click", () => setMode("CARGO"));

setMode("PSCP");

// =========================
//  Scan Boarding Pass
// =========================

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
      try{
        const j = JSON.parse(payload);
        if (j && j.data) data = j.data;
      }catch(_){ }
    }
    if (!data || typeof data !== "string") return;
    const parsed = parseBoardingPass(data);
    if (parsed){
      namaEl.textContent = parsed.fullName;
      flightEl.textContent = parsed.flight;
      scanResult.classList.remove('hidden');
      manualForm.classList.add('hidden');
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

let scanState = {
  stream: null,
  video: null,
  canvas: null,
  ctx: null,
  running: false,
  usingDetector: false,
  detector: null,
  jsQRReady: false,
  overlay: null,
  closeBtn: null,
};

injectScanStyles();

if (scanBtn){
  scanBtn.addEventListener('click', async () => {
    if (scanState.running){
      await stopScan();
      return;
    }
    await startScan();
  });
}

async function startScan(){
  try{
    manualForm.classList.add('hidden');
    scanResult.classList.remove('hidden');
    setWaitingUI(true);
    ensureVideo();
    ensureOverlay();
    document.body.classList.add('scan-active');

    const constraints = {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        advanced: [{ focusMode: "continuous" }]
      },
      audio: false
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    scanState.stream = stream;
    scanState.video.srcObject = stream;

    await scanState.video.play();

    scanState.usingDetector = false;
    scanState.detector = null;
    if ('BarcodeDetector' in window){
      try{
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const wanted = ['pdf417','aztec','qr_code','data_matrix'];
        const formats = wanted.filter(f => supported.includes(f));
        if (formats.length){
          scanState.detector = new window.BarcodeDetector({ formats });
          scanState.usingDetector = true;
        }
      }catch(_){}
    }

    scanState.running = true;

    if (scanState.usingDetector){
      detectLoop_BarcodeDetector();
    }else{
      await ensureJsQR();
      prepareCanvas();
      detectLoop_jsQR();
    }
  }catch(err){
    console.error(err);
    setWaitingUI(false);
    await stopScan();
  }
}

async function stopScan(){
  scanState.running = false;

  if (scanState.stream){
    for (const t of scanState.stream.getTracks()){
      try { t.stop(); } catch(_) {}
    }
  }
  scanState.stream = null;

  if (scanState.video){
    scanState.video.srcObject = null;
    scanState.video.remove();
    scanState.video = null;
  }
  if (scanState.canvas){
    scanState.canvas.remove();
    scanState.canvas = null;
    scanState.ctx = null;
  }

  document.body.classList.remove('scan-active');
  setWaitingUI(false);
}

function ensureVideo(){
  if (scanState.video) return;
  const v = document.createElement('video');
  v.setAttribute('playsinline','');
  v.muted = true;
  v.autoplay = true;
  v.id = 'scan-video';
  document.body.appendChild(v);
  scanState.video = v;
}

function ensureOverlay(){
  if (scanState.overlay) return;
  const overlay = document.createElement('div');
  overlay.id = 'scan-overlay';
  overlay.innerHTML = `
    <div class="scan-topbar">
      <button id="scan-close" class="scan-close" aria-label="Tutup pemindaian">✕</button>
    </div>
    <div class="scan-reticle" aria-hidden="true"></div>
    <div class="scan-hint">Arahkan ke barcode / QR</div>
  `;
  document.body.appendChild(overlay);
  scanState.overlay = overlay;
  scanState.closeBtn = overlay.querySelector('#scan-close');
  scanState.closeBtn.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    await stopScan();
    manualForm.classList.remove('hidden');
    scanResult.classList.add('hidden');
    manualNama.focus();
  });
}

function prepareCanvas(){
  if (scanState.canvas) return;
  const c = document.createElement('canvas');
  c.id = 'scan-canvas';
  c.width  = 640;
  c.height = 480;
  document.body.appendChild(c);
  scanState.canvas = c;
  scanState.ctx = c.getContext('2d', { willReadFrequently: true });
}

async function ensureJsQR(){
  if (scanState.jsQRReady) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Gagal memuat jsQR'));
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
        if (value){
          await handleScanSuccess(value);
          return;
        }
      }
    }catch(e){
      console.warn('Detector error:', e);
      if (!scanState.canvas){
        try{
          await ensureJsQR();
          prepareCanvas();
          scanState.usingDetector = false;
          detectLoop_jsQR();
          return;
        }catch(_){ }
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
    const cw = scanState.canvas.width  = vid.videoWidth  || 640;
    const ch = scanState.canvas.height = vid.videoHeight || 480;
    scanState.ctx.drawImage(vid, 0, 0, cw, ch);
    const img = scanState.ctx.getImageData(0, 0, cw, ch);
    const result = window.jsQR ? window.jsQR(img.data, cw, ch, { inversionAttempts: 'dontInvert' }) : null;
    if (result && result.data){
      handleScanSuccess(result.data);
      return;
    }
    if (scanState.running) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function handleScanSuccess(raw){
  try{
    await stopScan();
    receiveBarcode(raw);
  }catch(e){
    console.error(e);
  }
}

function injectScanStyles(){
  if (document.getElementById('scan-style')) return;
  const css = `
    .is-waiting { opacity:.7; pointer-events:none }

    body.scan-active{ background:#000; overscroll-behavior:contain; }
    body.scan-active .app-bar,
    body.scan-active .container { display:none !important; }

    #scan-video, #scan-canvas{
      position:fixed; inset:0;
      width:100vw; height:100vh;
      display:none; background:#000; z-index:9998;
    }
    body.scan-active #scan-video{
      display:block;
      object-fit:cover;
      transform:none;
      touch-action:none;
    }
    body.scan-active #scan-canvas{ display:none; }

    #scan-overlay{
      position:fixed; inset:0; display:none; z-index:10000; pointer-events:none;
    }
    body.scan-active #scan-overlay{ display:block; }

    .scan-topbar{
      position:absolute; top:0; left:0; right:0; height:max(56px, calc(44px + env(safe-area-inset-top,0)));
      display:flex; align-items:flex-start; justify-content:flex-end;
      padding: calc(env(safe-area-inset-top,0) + 6px) 10px 8px;
      background:linear-gradient(to bottom, rgba(0,0,0,.5), rgba(0,0,0,0));
      pointer-events:none;
    }
    .scan-close{
      pointer-events:auto;
      width:42px; height:42px; border-radius:999px;
      background:rgba(0,0,0,.55); color:#fff;
      border:1px solid rgba(255,255,255,.25);
      font-size:22px; line-height:1; display:flex; align-items:center; justify-content:center;
      box-shadow:0 4px 12px rgba(0,0,0,.35);
      transition: transform .08s ease, filter .15s ease;
    }
    .scan-close:active{ transform:scale(.96); }
    .scan-close:focus-visible{ outline:2px solid rgba(255,255,255,.6); outline-offset:2px; }

    .scan-reticle{
      position:absolute; top:50%; left:50%;
      width:min(68vw, 520px); aspect-ratio:1/1;
      transform:translate(-50%, -50%);
      border-radius:16px;
      box-shadow: 0 0 0 9999px rgba(0,0,0,.28) inset;
      pointer-events:none;
      background:
        linear-gradient(#fff,#fff) left top / 28px 2px no-repeat,
        linear-gradient(#fff,#fff) left top / 2px 28px no-repeat,
        linear-gradient(#fff,#fff) right top / 28px 2px no-repeat,
        linear-gradient(#fff,#fff) right top / 2px 28px no-repeat,
        linear-gradient(#fff,#fff) left bottom / 28px 2px no-repeat,
        linear-gradient(#fff,#fff) left bottom / 2px 28px no-repeat,
        linear-gradient(#fff,#fff) right bottom / 28px 2px no-repeat,
        linear-gradient(#fff,#fff) right bottom / 2px 28px no-repeat;
      outline: 2px dashed rgba(255,255,255,.0);
    }

    .scan-hint{
      position:absolute; left:50%; bottom:max(18px, calc(16px + env(safe-area-inset-bottom,0)));
      transform:translateX(-50%);
      background:rgba(0,0,0,.55); color:#fff; font-weight:600;
      padding:8px 12px; border-radius:999px;
      letter-spacing:.2px; pointer-events:none;
      box-shadow:0 4px 12px rgba(0,0,0,.35);
    }
  `;
  const style = document.createElement('style');
  style.id = 'scan-style';
  style.textContent = css;
  document.head.appendChild(style);
}

document.getElementById("submitBtn").addEventListener("click", () => {
  // TODO: submission logic will be implemented later
});
