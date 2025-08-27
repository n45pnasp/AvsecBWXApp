import { requireAuth } from "./auth-guard.js";

const LOOKUP_URL   = "https://script.google.com/macros/s/AKfycbwqJHoJjXpYCv2UstclVG_vHf5czAxDUfWmsSo6H4lcy3HgGZYSn7g1yAzbb8UFJHtrxw/exec";
const SHARED_TOKEN = "N45p";

requireAuth({ loginPath: "index.html", hideWhileChecking: true });

const passDate   = document.getElementById("passDate");
const passPhoto  = document.getElementById("passPhoto");
const passCode   = document.getElementById("passCode");
const passName   = document.getElementById("passName");
const passRole   = document.getElementById("passRole");
const barcodeImg = document.getElementById("barcodeImg");
const passInstansi = document.getElementById("passInstansi");
const passIdEl = document.getElementById("passId");
const passCard = document.getElementById("passCard");
const scanBtn    = document.getElementById("scanBtn");
const inputBtn   = document.getElementById("inputBtn");

const overlay = document.getElementById("overlay");
const ovIcon  = document.getElementById("ovIcon");
const ovTitle = document.getElementById("ovTitle");
const ovDesc  = document.getElementById("ovDesc");
const ovClose = document.getElementById("ovClose");
ovClose.addEventListener("click", () => overlay.classList.add("hidden"));

function showOverlay(state, title, desc, autoHide = true){
  overlay.classList.remove("hidden");
  ovIcon.className = "icon " + state;
  ovTitle.textContent = title;
  ovDesc.textContent = desc || "";
  ovClose.classList.toggle("hidden", state === "spinner");
  if (autoHide && state !== "spinner") {
    setTimeout(() => overlay.classList.add("hidden"), 1500);
  }
}
function hideOverlay(){ overlay.classList.add("hidden"); }

if (scanBtn) scanBtn.addEventListener("click", () => {
  if (scanState.running) stopScan(); else startScan();
});
if (inputBtn) inputBtn.addEventListener("click", () => {
  console.log("Input Data diklik");
});

let scanState = { stream:null, video:null, canvas:null, ctx:null, running:false, usingDetector:false, detector:null, jsQRReady:false, overlay:null, closeBtn:null };

function injectScanStyles(){
  if (document.getElementById('scan-style')) return;
  const css = `
    .is-waiting { opacity:.7; pointer-events:none }
    body.scan-active{ background:#000; overscroll-behavior:contain; }
    body.scan-active .app-bar,
    body.scan-active .container { display:none !important; }
    #scan-video,#scan-canvas{ position:fixed; inset:0; width:100vw; height:100vh; display:none; background:#000; z-index:9998; }
    body.scan-active #scan-video{ display:block; object-fit:cover; transform:none; touch-action:none; }
    body.scan-active #scan-canvas{ display:none; }
    #scan-overlay{ position:fixed; inset:0; display:none; z-index:10000; pointer-events:none; }
    body.scan-active #scan-overlay{ display:block; }
    .scan-topbar{ position:absolute; top:0; left:0; right:0; height:max(56px, calc(44px + env(safe-area-inset-top,0))); display:flex; align-items:flex-start; justify-content:flex-end; padding: calc(env(safe-area-inset-top,0) + 6px) 10px 8px; background:linear-gradient(to bottom, rgba(0,0,0,.5), rgba(0,0,0,0)); pointer-events:none; }
    .scan-close{ pointer-events:auto; width:42px; height:42px; border-radius:999px; background:rgba(0,0,0,.55); color:#fff; border:1px solid rgba(255,255,255,.25); font-size:22px; line-height:1; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,.35); transition: transform .08s ease, filter .15s ease; }
    .scan-close:active{ transform:scale(.96); }
    .scan-close:focus-visible{ outline:2px solid rgba(255,255,255,.6); outline-offset:2px; }
    .scan-reticle{ position:absolute; top:50%; left:50%; width:min(68vw, 520px); aspect-ratio:1/1; transform:translate(-50%,-50%); border-radius:16px; box-shadow:0 0 0 9999px rgba(0,0,0,.28) inset; pointer-events:none;
      background: linear-gradient(#fff,#fff) left top/28px 2px no-repeat, linear-gradient(#fff,#fff) left top/2px 28px no-repeat, linear-gradient(#fff,#fff) right top/28px 2px no-repeat, linear-gradient(#fff,#fff) right top/2px 28px no-repeat, linear-gradient(#fff,#fff) left bottom/28px 2px no-repeat, linear-gradient(#fff,#fff) left bottom/2px 28px no-repeat, linear-gradient(#fff,#fff) right bottom/28px 2px no-repeat, linear-gradient(#fff,#fff) right bottom/2px 28px no-repeat; outline:2px dashed rgba(255,255,255,0); }
    .scan-hint{ position:absolute; left:50%; bottom:max(18px, calc(16px + env(safe-area-inset-bottom,0))); transform:translateX(-50%); background:rgba(0,0,0,.55); color:#fff; font-weight:600; padding:8px 12px; border-radius:999px; letter-spacing:.2px; pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,.35); }
  `;
  const style = document.createElement('style');
  style.id = 'scan-style';
  style.textContent = css;
  document.head.appendChild(style);
}
injectScanStyles();

async function startScan(){
  try{
    ensureVideo();
    ensureOverlay();
    document.body.classList.add('scan-active');
    const constraints = {
      video:{ facingMode:{ideal:'environment'}, width:{ideal:1280}, height:{ideal:720}, advanced:[{focusMode:'continuous'}]},
      audio:false
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
        const wanted = ['qr_code','pdf417','aztec','data_matrix'];
        const formats = wanted.filter(f=>supported.includes(f));
        if (formats.length){
          scanState.detector = new window.BarcodeDetector({ formats });
          scanState.usingDetector = true;
        }
      }catch(_){ }
    }

    scanState.running = true;
    if (scanState.usingDetector){
      detectLoop_BarcodeDetector();
    } else {
      await ensureJsQR();
      prepareCanvas();
      detectLoop_jsQR();
    }
  }catch(err){
    showOverlay('err','Tidak bisa mengakses kamera','');
    await stopScan();
  }
}

async function stopScan(){
  scanState.running = false;
  if (scanState.stream){
    scanState.stream.getTracks().forEach(t=>{ try{ t.stop(); }catch(_){} });
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
}

function ensureVideo(){
  if (scanState.video) return;
  const v = document.createElement('video');
  v.setAttribute('playsinline','');
  v.muted = true; v.autoplay = true; v.id = 'scan-video';
  document.body.appendChild(v);
  scanState.video = v;
}

function ensureOverlay(){
  if (scanState.overlay) return;
  const overlay = document.createElement('div');
  overlay.id = 'scan-overlay';
  overlay.innerHTML = `
    <div class="scan-topbar">
      <button id="scan-close" class="scan-close" aria-label="Tutup">✕</button>
    </div>
    <div class="scan-reticle" aria-hidden="true"></div>
    <div class="scan-hint">Arahkan ke barcode / QR</div>
  `;
  document.body.appendChild(overlay);
  scanState.overlay = overlay;
  scanState.closeBtn = overlay.querySelector('#scan-close');
  scanState.closeBtn.addEventListener('click', e => { e.preventDefault(); stopScan(); });
}

function prepareCanvas(){
  if (scanState.canvas) return;
  const c = document.createElement('canvas');
  c.id = 'scan-canvas';
  c.width = 640; c.height = 480;
  document.body.appendChild(c);
  scanState.canvas = c;
  scanState.ctx = c.getContext('2d', { willReadFrequently:true });
}

async function ensureJsQR(){
  if (scanState.jsQRReady) return;
  await new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error('Gagal memuat jsQR'));
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

async function handleScanSuccess(raw){
  await stopScan();
  receiveBarcode(raw);
}

async function receiveBarcode(code){
  try{
    showOverlay('spinner','Mengambil data…','');
    const url = LOOKUP_URL + '?token=' + SHARED_TOKEN + '&key=' + encodeURIComponent(code);
    const res = await fetch(url);
    const j = await res.json();
    if (j && j.columns){
      console.log('Hasil scan barcode:', j.columns);
      console.log('Kolom C:', j.columns.C);
      const tanggalRaw = j.columns.G || j.columns.A || '';
      let tanggal = '';
      if (tanggalRaw){
        const dt = new Date(tanggalRaw);
        tanggal = isNaN(dt) ? String(tanggalRaw).toUpperCase() : dt.toLocaleDateString('id-ID',{ day:'2-digit', month:'short', year:'numeric' });
      }
      passDate.textContent = tanggal || '-';
      passName.textContent = (j.columns.B || '-').toUpperCase();
      passRole.textContent = (j.columns.F || '-').toUpperCase();

      const rawKode = j.columns.D || '';
      const kode = rawKode.replace(/\s+/g, '').toUpperCase();
      passCode.textContent = kode;

      const instansiVal = (j.columns.E || '-').toUpperCase();
      if (passInstansi) passInstansi.textContent = instansiVal;
      if (passIdEl) passIdEl.textContent = code.toUpperCase();
      barcodeImg.src = 'https://bwipjs-api.metafloor.com/?bcid=qrcode&scale=5&text=' + encodeURIComponent(code.toUpperCase());

      const rawColor = j.columns.C ?? j.columns.c ?? '-';
      const warna = String(rawColor).replace(/[^a-zA-Z]/g, '').trim().toUpperCase();
      console.log('Kolom C (raw):', rawColor, '=> warna kartu:', warna);
      const colorMap = {
        KUNING:{ bg:'#facc15', text:'#000' },
        PUTIH:{ bg:'#ffffff', text:'#000' },

        BIRU :{ bg:'#3b82f6', text:'#fff' },
        MERAH:{ bg:'#ef4444', text:'#fff' },

      };
      if (passCard){
        const col = colorMap[warna] || colorMap.KUNING;
        passCard.style.background = col.bg;
        passCard.style.color = col.text;
      }

      const rawFoto = (j.columns.H || j.columns.L || j.columns.J || '').trim();
      console.log('Kolom H/L/J (foto mentah):', rawFoto);
      if (rawFoto){
        let fotoUrl = rawFoto;
        if (!/^https?:/i.test(rawFoto)){
          fotoUrl = `https://drive.google.com/thumbnail?id=${rawFoto}`;
        }
        passPhoto.src = fotoUrl;
      } else {
        passPhoto.removeAttribute('src');
      }
      hideOverlay();
    } else {
      showOverlay('err', j?.error || 'Data tidak ditemukan','');
    }
  }catch(err){
    showOverlay('err','Gagal mengambil data', err?.message || err);
  }
}

window.receiveBarcode = receiveBarcode;


