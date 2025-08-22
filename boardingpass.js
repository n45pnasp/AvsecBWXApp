/***** =======================================================
 * BOARDING SCAN (final + overlay: close button & target box)
 * ======================================================= */

/* =======================
   DOM refs
======================= */
const parsedOutput    = document.getElementById('parsedOutput');
const beepSound       = document.getElementById('beep-sound');
const historyCard     = document.getElementById('historyCard');
const scanHistoryText = document.getElementById('scanHistoryText');
const qrBtn           = document.querySelector('.qr-btn');

/* =======================
   Peta maskapai & helpers
======================= */
const airlineMap = {
  ID: 'BATIK AIR', IU: 'SUPER AIR JET', QG: 'CITILINK',
  GA: 'GARUDA INDONESIA', JT: 'LION AIR', IW: 'WINGS AIR',
};

function splitFromBack(str, maxSplits){
  const parts = []; let remaining = str;
  for (let i=0; i<maxSplits; i++){
    const j = remaining.lastIndexOf(' '); if (j === -1) break;
    parts.unshift(remaining.slice(j+1)); remaining = remaining.slice(0, j);
  }
  parts.unshift(remaining); return parts;
}
function julianToDate(j, y){
  const d = new Date(y,0); d.setDate(j);
  return d.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
}

/* =======================
   Parser boarding pass (IATA BCBP M1)
======================= */
function parseBoardingPass(data){
  if (!data || typeof data!=="string") return '⚠️ Data kosong / tidak valid.';
  if (!data.startsWith('M1')) return data; // tampilkan apa adanya jika bukan M1

  const parts = splitFromBack(data, 5);
  if (parts.length < 6) return '⚠️ Data barcode tidak lengkap.';

  const namaRaw = parts[0].substring(2);
  const slash   = namaRaw.indexOf('/');
  const fullName = (slash === -1)
    ? namaRaw.replace(/_/g,' ').trim()
    : (namaRaw.substring(slash+1)+' '+namaRaw.substring(0,slash)).replace(/_/g,' ').trim();

  const routeRaw = parts[2].substring(0,6);
  const origin = routeRaw.substring(0,3);
  const destination = routeRaw.substring(3,6);
  const originDisplay = origin !== 'BWX'
    ? `<span style="color:red;font-weight:bold">${origin}</span>` : origin;

  const airlineCode = parts[2].slice(-2);
  const airlineName = airlineMap[airlineCode] || airlineCode;
  const flightNumber = parts[3];
  const julianDay = parseInt(parts[4].substring(0,3),10);
  const seat = parts[4].substring(4,8);

  const year = new Date().getFullYear();
  const tanggal = julianToDate(julianDay, year);
  const today = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
  const tanggalFormatted = tanggal !== today
    ? `<span style="color:red;font-weight:bold">${tanggal}</span>` : tanggal;

  return `✈️ Nama : ${fullName}
📅 Tanggal : ${tanggalFormatted}
🛫 Rute : ${originDisplay} → ${destination}
🛩️ Maskapai : ${airlineName}
✈️ Flight : ${airlineCode} ${flightNumber}
💺 No Kursi : ${seat}`;
}

/* =======================
   Riwayat
======================= */
function saveScanToHistory(text){
  let h = JSON.parse(localStorage.getItem('scanHistory') || '[]');
  h.unshift({ text, time: new Date().toLocaleString('id-ID') });
  if (h.length > 50) h = h.slice(0,50);
  localStorage.setItem('scanHistory', JSON.stringify(h));
}
function loadScanHistory(){
  const h = JSON.parse(localStorage.getItem('scanHistory') || '[]');
  if (!h.length){ scanHistoryText.textContent='Belum ada riwayat.'; return; }
  scanHistoryText.innerHTML = h.map((it,i)=>`#${i+1} (${it.time})<br>${it.text}`).join('<br><br>');
}
function toggleHistory(){
  if (historyCard.classList.contains('hidden')){
    loadScanHistory(); historyCard.classList.remove('hidden');
  } else {
    historyCard.classList.add('hidden');
  }
}
function clearHistory(){
  if (confirm('Yakin ingin menghapus semua riwayat scan?')){
    localStorage.removeItem('scanHistory'); scanHistoryText.textContent='Belum ada riwayat.';
  }
}
window.toggleHistory = toggleHistory;
window.clearHistory  = clearHistory;

/* =======================
   Beep
======================= */
function playBeepTwice(){
  if (!beepSound) return;
  try{
    beepSound.currentTime=0; beepSound.play().catch(()=>{});
    setTimeout(()=>{ beepSound.currentTime=0; beepSound.play().catch(()=>{}); }, 300);
  }catch(_){}
}

/* =======================
   UI helpers
======================= */
function setWaitingUI(on){
  if (!qrBtn) return;
  qrBtn.classList.toggle('is-waiting', !!on);
  qrBtn.disabled = !!on;
  qrBtn.setAttribute('aria-busy', on ? 'true' : 'false');
}

/* =========================================================
   CAMERA & SCAN (BarcodeDetector → fallback jsQR)
========================================================= */
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

if (qrBtn){
  qrBtn.addEventListener('click', async () => {
    if (scanState.running){
      await stopScan();
      return;
    }
    await startScan();
  });
}

async function startScan(){
  try{
    setWaitingUI(true);
    parsedOutput.textContent = 'Mengaktifkan kamera…';

    ensureVideo();      // siapkan elemen <video>
    ensureOverlay();    // siapkan overlay (close + target box)

    // Tampilkan UI kamera lebih awal agar iOS nyaman play()
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

    await scanState.video.play(); // iOS perlu user gesture

    // Cek dukungan BarcodeDetector + format
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
      await ensureJsQR(); // fallback QR
      prepareCanvas();
      detectLoop_jsQR();
    }
  }catch(err){
    console.error(err);
    parsedOutput.textContent = '❌ Tidak bisa mengakses kamera. Izinkan kamera di browser.';
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

  document.body.classList.remove('scan-active'); // kembali ke halaman
  setWaitingUI(false);
}

function ensureVideo(){
  if (scanState.video) return;
  const v = document.createElement('video');
  v.setAttribute('playsinline',''); // penting utk iOS
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
        }catch(_) {}
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
    await stopScan(); // matikan kamera dulu
    const parsed = parseBoardingPass(raw);
    parsedOutput.innerHTML = parsed;   // hasil tampil setelah kembali
    saveScanToHistory(parsed);
    playBeepTwice();
  }catch(e){
    console.error(e);
    parsedOutput.textContent = '❌ Gagal memproses hasil scan.';
  }
}

/* =======================
   Public helper (opsional)
======================= */
function receiveBarcode(payload){
  try{
    let data = payload;
    if (typeof payload === "string"){
      try{
        const j = JSON.parse(payload);
        if (j && j.data) data = j.data;
      }catch(_){}
    }
    if (!data || typeof data !== "string"){
      parsedOutput.textContent = '⚠️ Data barcode tidak valid.';
      return;
    }
    const parsed = parseBoardingPass(data);
    parsedOutput.innerHTML = parsed;
    saveScanToHistory(parsed);
    playBeepTwice();
  }catch(e){
    console.error(e);
    parsedOutput.textContent = '❌ Terjadi kesalahan saat memproses data.';
  }
}
window.receiveBarcode = receiveBarcode;

/* =======================
   Opsional: ?barcode= untuk tes cepat
======================= */
(function(){
  const b = new URLSearchParams(location.search).get('barcode');
  if (b) receiveBarcode(b);
})();

/* =======================
   Styles (disuntikkan) — overlay + target box
======================= */
function injectScanStyles(){
  if (document.getElementById('scan-style')) return;
  const css = `
    .is-waiting { opacity:.7; pointer-events:none }

    /* Saat scan aktif: sembunyikan konten halaman, tampilkan kamera */
    body.scan-active{ background:#000; overscroll-behavior:contain; }
    body.scan-active .app-bar,
    body.scan-active .container { display:none !important; }

    /* Video full-screen */
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

    /* Overlay UI di atas video */
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

    /* Kotak target (reticle) di tengah */
    .scan-reticle{
      position:absolute; top:50%; left:50%;
      width:min(68vw, 520px); aspect-ratio:1/1;
      transform:translate(-50%, -50%);
      border-radius:16px;
      box-shadow: 0 0 0 9999px rgba(0,0,0,.28) inset;
      pointer-events:none;
      /* sudut-sudut (4 corner) */
      background:
        linear-gradient(#fff,#fff) left top / 28px 2px no-repeat,
        linear-gradient(#fff,#fff) left top / 2px 28px no-repeat,
        linear-gradient(#fff,#fff) right top / 28px 2px no-repeat,
        linear-gradient(#fff,#fff) right top / 2px 28px no-repeat,
        linear-gradient(#fff,#fff) left bottom / 28px 2px no-repeat,
        linear-gradient(#fff,#fff) left bottom / 2px 28px no-repeat,
        linear-gradient(#fff,#fff) right bottom / 28px 2px no-repeat,
        linear-gradient(#fff,#fff) right bottom / 2px 28px no-repeat;
      outline: 2px dashed rgba(255,255,255,.0); /* pegangan untuk aksesibilitas */
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
