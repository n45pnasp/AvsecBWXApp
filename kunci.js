const qrBtn    = document.querySelector('.qr-btn');
const mapCode  = document.getElementById('mapCode');
const mapImage = document.getElementById('mapImage');
const beepSound = document.getElementById('beep-sound');

// Mapping barcode value -> {file,label}
const iconMap = {
  "aHR0cHM6Ly9maXJlYmFzZXN0b3JhZ2UuZ29vZ2xlYXBpcy5jb20vdjAvYi9hdnNlY2J3eC1hZDI4ZS5hcHBzcG90LmNvbS9vL1ZHVnliV2x1WVd3Z1FsZFk/YWx0PW1lZGlhJnRva2VuPWY0MzAyZDM3LWQxZTEtNGI3NC1iNjFlLTc1NDg1NTJjMjQ3Mw==": { file: 'Terminal.png', label: 'Terminal' },
  "https://firebasestorage.googleapis.com/v0/b/avsecbwx-ad28e.appspot.com/o/VGVybWluYWwgQldY?alt=media&token=f4302d37-d1e1-4b74-b61e-7548552c2473": { file: 'Terminal.png', label: 'Terminal' },
  "aHR0cHM6Ly9maXJlYmFzZXN0b3JhZ2UuZ29vZ2xlYXBpcy5jb20vdjAvYi9hdnNlY2J3eC1hZDI4ZS5hcHBzcG90LmNvbS9vL1RHRnVaSE5wWkdVZ1FsZFk/YWx0PW1lZGlhJnRva2VuPThiNmJiZGMzLWFiMjctNGFkOC1iNTRlLWE3ZDI5OGYxNzg4NA==": { file: 'Landside.png', label: 'Landside' },
  "https://firebasestorage.googleapis.com/v0/b/avsecbwx-ad28e.appspot.com/o/TGFuZHNpZGUgQldY?alt=media&token=8b6bbdc3-ab27-4ad8-b54e-a7d298f17884": { file: 'Landside.png', label: 'Landside' }
};

function playBeep(){
  try{ beepSound.currentTime=0; beepSound.play().catch(()=>{}); }catch(_){ }
}

function showMap(entry){
  const imgPath = 'icons/' + entry.file;
  const img = new Image();
  img.onload = () => {
    mapImage.src = imgPath;
    mapImage.classList.remove('hidden');
    mapCode.textContent = entry.label;
  };
  img.onerror = () => {
    mapImage.classList.add('hidden');
    mapCode.textContent = 'Icon tidak ditemukan';
  };
  img.src = imgPath;
}

function receiveBarcode(code){
  let val = code;
  if (iconMap[val]) {
    playBeep();
    showMap(iconMap[val]);
    return;
  }
  try{
    const decoded = atob(code);
    if (iconMap[decoded]){
      playBeep();
      showMap(iconMap[decoded]);
      return;
    }
  }catch(_){ }
  mapImage.classList.add('hidden');
  mapCode.textContent = code || '⚠️ Data barcode tidak valid.';
}
window.receiveBarcode = receiveBarcode;

// ======== Scanning overlay & camera ========
const scanState = {
  running:false,
  video:null,
  canvas:null,
  ctx:null,
  detector:null,
  overlay:null,
  closeBtn:null,
  usingDetector:true,
  jsQRReady:false
};

function setWaitingUI(on){
  qrBtn.disabled = !!on;
  qrBtn.classList.toggle('is-waiting', !!on);
  qrBtn.setAttribute('aria-busy', on ? 'true' : 'false');
}

async function startScan(){
  if (scanState.running) return;
  setWaitingUI(true);
  injectScanStyles();
  ensureVideo();
  ensureOverlay();
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'environment' } });
    scanState.video.srcObject = stream;
    await scanState.video.play();
    document.body.classList.add('scan-active');
    scanState.running = true;
    if ('BarcodeDetector' in window){
      scanState.detector = new BarcodeDetector({ formats:['qr_code','code_128','code_39','code_93','codabar'] });
      detectLoop_BarcodeDetector();
    } else {
      await ensureJsQR();
      prepareCanvas();
      scanState.usingDetector = false;
      detectLoop_jsQR();
    }
  }catch(err){
    console.error(err);
    mapCode.textContent = '❌ Tidak dapat mengakses kamera';
    stopScan();
  }
  setWaitingUI(false);
}

async function stopScan(){
  scanState.running = false;
  if (scanState.video && scanState.video.srcObject){
    scanState.video.srcObject.getTracks().forEach(t=>t.stop());
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
  scanState.closeBtn.addEventListener('click', async (e)=>{ e.preventDefault(); await stopScan(); });
}

function prepareCanvas(){
  if (scanState.canvas) return;
  const c = document.createElement('canvas');
  c.id = 'scan-canvas';
  c.width = 640; c.height = 480;
  document.body.appendChild(c);
  scanState.canvas = c;
  scanState.ctx = c.getContext('2d',{ willReadFrequently:true });
}

async function ensureJsQR(){
  if (scanState.jsQRReady) return;
  await new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload=()=>res();
    s.onerror=()=>rej(new Error('Gagal memuat jsQR'));
    document.head.appendChild(s);
  });
  scanState.jsQRReady = true;
}

function detectLoop_BarcodeDetector(){
  const loop = async () => {
    if (!scanState.running || !scanState.video) return;
    try{
      const codes = await scanState.detector.detect(scanState.video);
      if (codes && codes.length){
        const value = (codes[0].rawValue || '').trim();
        if (value){ await handleScanSuccess(value); return; }
      }
    }catch(e){
      console.warn('Detector error', e);
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

function injectScanStyles(){
  if (document.getElementById('scan-style')) return;
  const css = `
    .is-waiting { opacity:.7; pointer-events:none }
    body.scan-active{ background:#000; overscroll-behavior:contain; }
    body.scan-active .app-bar,
    body.scan-active .container { display:none !important; }
    #scan-video, #scan-canvas{
      position:fixed; inset:0; width:100vw; height:100vh;
      display:none; background:#000; z-index:9998;
    }
    body.scan-active #scan-video{ display:block; object-fit:cover; transform:none; touch-action:none; }
    body.scan-active #scan-canvas{ display:none; }
    #scan-overlay{ position:fixed; inset:0; display:none; z-index:10000; pointer-events:none; }
    body.scan-active #scan-overlay{ display:block; }
    .scan-topbar{ position:absolute; top:0; left:0; right:0; height:max(56px, calc(44px + env(safe-area-inset-top,0))); display:flex; align-items:flex-start; justify-content:flex-end; padding: calc(env(safe-area-inset-top,0) + 6px) 10px 8px; background:linear-gradient(to bottom, rgba(0,0,0,.5), rgba(0,0,0,0)); pointer-events:none; }
    .scan-close{ pointer-events:auto; width:42px; height:42px; border-radius:999px; background:rgba(0,0,0,.55); color:#fff; border:1px solid rgba(255,255,255,.25); font-size:22px; line-height:1; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,.35); transition: transform .08s ease, filter .15s ease; }
    .scan-close:active{ transform:scale(.96); }
    .scan-close:focus-visible{ outline:2px solid rgba(255,255,255,.6); outline-offset:2px; }
    .scan-reticle{ position:absolute; top:50%; left:50%; width:min(68vw, 520px); aspect-ratio:1/1; transform:translate(-50%,-50%); border-radius:16px; box-shadow:0 0 0 9999px rgba(0,0,0,.28) inset; pointer-events:none; background: linear-gradient(#fff,#fff) left top / 28px 2px no-repeat, linear-gradient(#fff,#fff) left top / 2px 28px no-repeat, linear-gradient(#fff,#fff) right top / 28px 2px no-repeat, linear-gradient(#fff,#fff) right top / 2px 28px no-repeat, linear-gradient(#fff,#fff) left bottom / 28px 2px no-repeat, linear-gradient(#fff,#fff) left bottom / 2px 28px no-repeat, linear-gradient(#fff,#fff) right bottom / 28px 2px no-repeat, linear-gradient(#fff,#fff) right bottom / 2px 28px no-repeat; }
    .scan-hint{ position:absolute; left:50%; bottom:max(18px, calc(16px + env(safe-area-inset-bottom,0))); transform:translateX(-50%); background:rgba(0,0,0,.55); color:#fff; font-weight:600; padding:8px 12px; border-radius:999px; letter-spacing:.2px; pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,.35); }
  `;
  const style=document.createElement('style');
  style.id='scan-style';
  style.textContent=css;
  document.head.appendChild(style);
}

qrBtn.addEventListener('click', ()=>{
  if (scanState.running) stopScan(); else startScan();
});

