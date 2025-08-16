const video = document.getElementById('video');
const parsedOutput = document.getElementById('parsedOutput');
const beepSound = document.getElementById('beep-sound');
const historyCard = document.getElementById('historyCard');
const scanHistoryText = document.getElementById('scanHistoryText');

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

function parseBoardingPass(data) {
  if (!data.startsWith('M1')) return '❌ Format barcode tidak dikenali.';

  const parts = splitFromBack(data, 5);
  if (parts.length < 6) return '⚠️ Data tidak lengkap.';

  const namaRaw = parts[0].substring(2);
  const slashIndex = namaRaw.indexOf('/');
  let fullName = slashIndex === -1
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
  if (historyCard.style.display === 'none') {
    loadScanHistory();
    historyCard.style.display = 'block';
  } else {
    historyCard.style.display = 'none';
  }
}

function clearHistory() {
  if (confirm('Yakin ingin menghapus semua riwayat scan?')) {
    localStorage.removeItem('scanHistory');
    scanHistoryText.textContent = 'Belum ada riwayat.';
  }
}

const codeReader = new ZXing.BrowserMultiFormatReader();
let lastResult = '';

function playBeepTwice() {
  beepSound.play();
  setTimeout(() => beepSound.play(), 300);
}

function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then((stream) => {
      video.srcObject = stream;
      video.play();
      codeReader.decodeFromVideoDevice(null, video, (result, err) => {
        if (result) {
          const scannedText = result.getText();
          if (scannedText !== lastResult) {
            lastResult = scannedText;
            const parsed = parseBoardingPass(scannedText);
            parsedOutput.innerHTML = parsed;
            saveScanToHistory(parsed);
            playBeepTwice();
          }
        }
      });
    })
    .catch((err) => {
      parsedOutput.textContent = `❌ Kamera tidak bisa diakses: ${err.message}`;
    });
}

startCamera();
