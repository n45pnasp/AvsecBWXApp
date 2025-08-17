// =======================
// DOM refs (tanpa <video>)
// =======================
const parsedOutput   = document.getElementById('parsedOutput');
const beepSound      = document.getElementById('beep-sound');
const historyCard    = document.getElementById('historyCard');
const scanHistoryText= document.getElementById('scanHistoryText');

// =======================
/* Peta maskapai & helpers */
// =======================
const airlineMap = {
  ID: 'BATIK AIR',
  IU: 'SUPER AIR JET',
  QG: 'CITILINK',
  GA: 'GARUDA INDONESIA',
  JT: 'LION AIR',
  IW: 'WINGS AIR',
};

function splitFromBack(str, maxSplits) {
  const parts = [];
  let remaining = str;
  for (let i = 0; i < maxSplits; i++) {
    const lastSpace = remaining.lastIndexOf(' ');
    if (lastSpace === -1) break;
    parts.unshift(remaining.slice(lastSpace + 1));
    remaining = remaining.slice(0, lastSpace);
  }
  parts.unshift(remaining);
  return parts;
}

function julianToDate(julianDay, year) {
  const date = new Date(year, 0);
  date.setDate(julianDay);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// =======================
// Parser boarding pass M1
// =======================
function parseBoardingPass(data) {
  if (!data || typeof data !== "string") return '⚠️ Data kosong / tidak valid.';
  if (!data.startsWith('M1')) return data; // fallback: tampilkan apa adanya

  const parts = splitFromBack(data, 5);
  if (parts.length < 6) return '⚠️ Data barcode tidak lengkap.';

  const namaRaw = parts[0].substring(2);
  const slashIndex = namaRaw.indexOf('/');
  const fullName = (slashIndex === -1)
    ? namaRaw.replace(/_/g, ' ').trim()
    : (namaRaw.substring(slashIndex + 1) + ' ' + namaRaw.substring(0, slashIndex)).replace(/_/g, ' ').trim();

  const routeRaw = parts[2].substring(0, 6);
  const origin = routeRaw.substring(0, 3);
  const destination = routeRaw.substring(3, 6);

  const originDisplay = origin !== 'BWX'
    ? `<span style="color:red;font-weight:bold">${origin}</span>` : origin;

  const airlineCode = parts[2].slice(-2);
  const airlineName = airlineMap[airlineCode] || airlineCode;

  const flightNumber = parts[3];
  const julianDay = parseInt(parts[4].substring(0, 3), 10);
  const seat = parts[4].substring(4, 8);

  const year = new Date().getFullYear();
  const tanggal = julianToDate(julianDay, year);
  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const tanggalFormatted = tanggal !== today
    ? `<span style="color:red;font-weight:bold">${tanggal}</span>` : tanggal;

  return `✈️ Nama : ${fullName}
📅 Tanggal : ${tanggalFormatted}
🛫 Rute : ${originDisplay} → ${destination}
🛩️ Maskapai : ${airlineName}
✈️ Flight : ${airlineCode} ${flightNumber}
💺 No Kursi : ${seat}`;
}

// =======================
// History helpers
// =======================
function saveScanToHistory(parsedText) {
  let history = JSON.parse(localStorage.getItem('scanHistory') || '[]');
  history.unshift({ text: parsedText, time: new Date().toLocaleString('id-ID') });
  if (history.length > 50) history = history.slice(0, 50);
  localStorage.setItem('scanHistory', JSON.stringify(history));
}

function loadScanHistory() {
  const history = JSON.parse(localStorage.getItem('scanHistory') || '[]');
  if (history.length === 0) {
    scanHistoryText.textContent = 'Belum ada riwayat.';
    return;
  }
  scanHistoryText.innerHTML = history
    .map((h, i) => `#${i + 1} (${h.time})<br>${h.text}`)
    .join('<br><br>');
}

function toggleHistory() {
  if (historyCard.classList.contains('hidden')) {
    loadScanHistory();
    historyCard.classList.remove('hidden');
  } else {
    historyCard.classList.add('hidden');
  }
}
function clearHistory() {
  if (confirm('Yakin ingin menghapus semua riwayat scan?')) {
    localStorage.removeItem('scanHistory');
    scanHistoryText.textContent = 'Belum ada riwayat.';
  }
}
window.toggleHistory = toggleHistory;
window.clearHistory  = clearHistory;

// =======================
// Beep util
// =======================
function playBeepTwice() {
  if (!beepSound) return;
  try {
    beepSound.currentTime = 0;
    beepSound.play().catch(()=>{});
    setTimeout(() => {
      beepSound.currentTime = 0;
      beepSound.play().catch(()=>{});
    }, 300);
  } catch (_) {}
}

// =======================
// Kodular integration
// =======================

// Dipanggil tombol “QR” di HTML
function requestScanFromKodular(){
  const message = JSON.stringify({ event: "scan_request" });
  if (window.AppInventor && typeof window.AppInventor.setWebViewString === "function"){
    window.AppInventor.setWebViewString(message);
  } else {
    // Fallback manual: input barcode
    const manual = prompt("Masukkan/Tempel data barcode:");
    if (manual) receiveBarcode(manual);
  }
}
window.requestScanFromKodular = requestScanFromKodular;

// Fungsi yang bisa dipanggil Kodular via EvaluateJavascript:
//   evaluate javascript: window.receiveBarcode('<HASIL>')
// Atau kirim JSON: {"event":"scan_result","data":"<HASIL>"}
function receiveBarcode(payload){
  try{
    let data = payload;
    if (typeof payload === "string") {
      try {
        const j = JSON.parse(payload);
        if (j && j.data) data = j.data;
      } catch(_) { /* bukan JSON, pakai string mentah */ }
    }

    if (!data || typeof data !== "string"){
      parsedOutput.textContent = '⚠️ Data barcode tidak valid.';
      return;
    }

    const parsed = parseBoardingPass(data);
    parsedOutput.innerHTML = parsed;
    saveScanToHistory(parsed);
    playBeepTwice();

  } catch (e){
    console.error(e);
    parsedOutput.textContent = '❌ Terjadi kesalahan saat memproses data.';
  }
}
window.receiveBarcode = receiveBarcode;

// =======================
// Optional: dukung ?barcode= di URL untuk tes cepat
// =======================
(function initFromQuery(){
  const params = new URLSearchParams(location.search);
  const b = params.get('barcode');
  if (b) receiveBarcode(b);
})();
// Tidak ada startCamera(); semua input berasal dari Kodular / manual
