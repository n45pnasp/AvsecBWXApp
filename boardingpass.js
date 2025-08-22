/***** =======================================================
 * BOARDING SCAN (final, no Kodular)
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
  stopLoop: null,
  usingDetector: false,
  detector: null,
  jsQRReady: false,
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

    // Siapkan elemen video + overlay
    ensureVideo();

    // Minta kamera belakang bila ada
    const constraints = {
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        // beberapa device support continuous focus via advanced
        advanced: [{ focusMode: "continuous" }]
      },
      audio: false
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    scanState.stream = stream;
    scanState.video.srcObject = stream;

    // iOS Safari butuh playsinline + play() setelah user gesture
    await scanState.video.play();

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
    document.body.classList.add('scan-active');

    if (scanState.usingDetector){
      parsedOutput.textContent = 'Memindai… (deteksi native)';
      detectLoop_BarcodeDetector();
    }else{
      parsedOutput.textContent = 'Memindai… (fallback QR)';
      await ensureJsQR(); // hanya QR
      prepareCanvas();
      detectLoop_jsQR();
    }
  }catch(err){
    console.error(err);
    parsedOutput.textContent = '❌ Tidak bisa mengakses kamera. Izinkan kamera di browser.';
    setWaitingUI(false);
    await stopScan(); // pastikan bersih
  }
}

async function stopScan(){
  // hentikan loop
  scanState.running = false;

  // hentikan track kamera
  if (scanState.stream){
    for (const t of scanState.stream.getTracks()){
      try { t.stop(); } catch(_) {}
    }
  }
  scanState.stream = null;

  // bersihkan video
  if (scanState.video){
    scanState.video.srcObject = null;
    scanState.video.remove(); // buang dari DOM
    scanState.video = null;
  }

  // bersihkan canvas
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
  // dibikin transparan tapi tetap di-DOM (iOS memerlukan elemen ada)
  document.body.appendChild(v);
  scanState.video = v;
}

function prepareCanvas(){
  if (scanState.canvas) return;
  const c = document.createElement('canvas');
  c.id = 'scan-canvas';
  c.width  = 640;
  c.height = 480;
  document.body.appendChild(c); // tersembunyi via CSS
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
          return; // stop loop setelah sukses
        }
      }
    }catch(e){
      console.warn('Detector error:', e);
      // jika detektor gagal terus, fallback ke jsQR (QR only)
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
    // jsQR global dari CDN
    const result = window.jsQR ? window.jsQR(img.data, cw, ch, { inversionAttempts: 'dontInvert' }) : null;
    if (result && result.data){
      handleScanSuccess(result.data);
      return; // stop loop setelah sukses
    }

    if (scanState.running) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function handleScanSuccess(raw){
  try{
    // Matikan kamera lebih dulu, baru olah data
    await stopScan();

    // Proses hasil
    const parsed = parseBoardingPass(raw);
    parsedOutput.innerHTML = parsed;
    saveScanToHistory(parsed);
    playBeepTwice();
  }catch(e){
    console.error(e);
    parsedOutput.textContent = '❌ Gagal memproses hasil scan.';
  }
}

/* =======================
   Public: bisa dipakai library lain
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
   Opsional: dukung ?barcode= untuk tes cepat
======================= */
(function(){
  const b = new URLSearchParams(location.search).get('barcode');
  if (b) receiveBarcode(b);
})();

/* =======================
   Styles (disuntikkan)
======================= */
function injectScanStyles(){
  if (document.getElementById('scan-style')) return;
  const css = `
    .is-waiting { opacity: .7; pointer-events:none }
    #scan-video, #scan-canvas {
      position: fixed; inset: 0;
      width: 1px; height: 1px;
      opacity: 0; pointer-events: none; z-index: -1;
    }
    body.scan-active { cursor: progress; }
  `;
  const style = document.createElement('style');
  style.id = 'scan-style';
  style.textContent = css;
  document.head.appendChild(style);
                                                             }
