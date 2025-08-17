// =======================
// DOM refs
// =======================
const parsedOutput    = document.getElementById('parsedOutput');
const beepSound       = document.getElementById('beep-sound');
const historyCard     = document.getElementById('historyCard');
const scanHistoryText = document.getElementById('scanHistoryText');
const qrBtn           = document.querySelector('.qr-btn');

// =======================
// Peta maskapai & helpers
// =======================
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
function julianToDate(j, y){ const d=new Date(y,0); d.setDate(j);
  return d.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}); }

// =======================
// Parser boarding pass (IATA BCBP M1)
// =======================
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

// =======================
// Riwayat
// =======================
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
  if (historyCard.classList.contains('hidden')){ loadScanHistory(); historyCard.classList.remove('hidden'); }
  else historyCard.classList.add('hidden');
}
function clearHistory(){
  if (confirm('Yakin ingin menghapus semua riwayat scan?')){
    localStorage.removeItem('scanHistory'); scanHistoryText.textContent='Belum ada riwayat.';
  }
}
window.toggleHistory = toggleHistory;
window.clearHistory  = clearHistory;

// =======================
// Beep
// =======================
function playBeepTwice(){
  if (!beepSound) return;
  try{
    beepSound.currentTime=0; beepSound.play().catch(()=>{});
    setTimeout(()=>{ beepSound.currentTime=0; beepSound.play().catch(()=>{}); }, 300);
  }catch(_){}
}

// =======================
// Kodular integration
// =======================
function setWaitingUI(on){
  if (!qrBtn) return;
  qrBtn.classList.toggle('is-waiting', !!on);
  qrBtn.disabled = !!on;
  qrBtn.setAttribute('aria-busy', on ? 'true' : 'false');
}

// Dipanggil tombol “QR” di HTML — hanya mengirim sinyal ke Kodular
function requestScanFromKodular(){
  const message = JSON.stringify({ event: "scan_request" });
  if (window.AppInventor && typeof window.AppInventor.setWebViewString === "function"){
    window.AppInventor.setWebViewString(message);
  }
  // Selalu masuk mode menunggu (baik di WebView Kodular maupun di browser biasa)
  parsedOutput.textContent = 'Menunggu pemindaian dari aplikasi…';
  setWaitingUI(true);
}
window.requestScanFromKodular = requestScanFromKodular;

// Dipanggil Kodular setelah selesai scan
function receiveBarcode(payload){
  try{
    let data = payload;
    if (typeof payload === "string"){
      try{ const j = JSON.parse(payload); if (j && j.data) data = j.data; }catch(_){}
    }
    if (!data || typeof data !== "string"){
      parsedOutput.textContent = '⚠️ Data barcode tidak valid.';
      setWaitingUI(false);
      return;
    }
    const parsed = parseBoardingPass(data);
    parsedOutput.innerHTML = parsed;
    saveScanToHistory(parsed);
    playBeepTwice();
  }catch(e){
    console.error(e);
    parsedOutput.textContent = '❌ Terjadi kesalahan saat memproses data.';
  }finally{
    setWaitingUI(false);
  }
}
window.receiveBarcode = receiveBarcode;

// Opsional: dukung ?barcode= untuk tes cepat (tanpa prompt)
(function(){
  const b = new URLSearchParams(location.search).get('barcode');
  if (b) receiveBarcode(b);
})();
