const SHARED_TOKEN = "N45p";
const LOOKUP_URL = "https://rdcheck.avsecbwx2018.workers.dev/";

const translations = {
  id: {
    title: "PEMERIKSAAN BAGASI TERCATAT",
    headers: ["WAKTU", "NAMA PENUMPANG", "PENERBANGAN", "STATUS"],
    status: "DIPERIKSA HARAP MENGHUBUNGI PETUGAS",
    ticker: "HAVE A NICE FLIGHT - SEE YOU SOON!",
  },
  en: {
    title: "CHECKED BAGGAGE INSPECTION",
    headers: ["TIME", "PASSENGER NAME", "FLIGHT", "STATUS"],
    status: "INSPECTED — PLEASE CONTACT OFFICER",
    ticker: "HAVE A NICE FLIGHT - SEE YOU SOON!",
  },
};

let currentLang = "id";
let currentRows = [];
const flightTimes = {}; // map: FLIGHT -> "HH:MM"

/* ===== Utils waktu (konversi ke Asia/Jakarta / GMT+7 bila perlu) ===== */

// Format HH:MM dari Date, selalu render di Asia/Jakarta
function formatHHMMFromDate(d){
  if(!(d instanceof Date) || isNaN(d)) return null;
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(d);
  const hh = parts.find(p=>p.type==="hour")?.value ?? "";
  const mm = parts.find(p=>p.type==="minute")?.value ?? "";
  return `${hh}:${mm}`;
}

// Terima berbagai bentuk waktu → "HH:MM" (konversi ke GMT+7 kalau ada informasi tanggal/zona)
function toHHMMFromAny(v){
  if (v == null || v === "") return null;

  // Number: epoch / serial Google Sheets
  if (typeof v === "number") {
    // Serial Google Sheets (hari sejak 1899-12-30) – treat as UTC lalu render GMT+7
    if (v > 1000 && v < 60000) {
      const ms = (v - 25569) * 86400 * 1000;
      return formatHHMMFromDate(new Date(ms));
    }
    // Epoch seconds
    if (v > 1e9 && v < 1e12) return formatHHMMFromDate(new Date(v * 1000));
    // Epoch milliseconds
    if (v >= 1e12) return formatHHMMFromDate(new Date(v));
  }

  if (typeof v === "string") {
    const s = v.trim().replace(/\./g, ":");

    // Jika hanya "HH:MM" → pakai apa adanya (jadwal lokal)
    const hm = s.match(/^(\d{1,2}):(\d{2})$/);
    if (hm) {
      const h = String(hm[1]).padStart(2,"0");
      const m = String(hm[2]).padStart(2,"0");
      return `${h}:${m}`;
    }

    // Jika punya zona/UTC (ada Z atau offset), biarkan Date parse dan render ke GMT+7
    if (/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) {
      const d = new Date(s);
      if (!isNaN(d)) return formatHHMMFromDate(d);
    }

    // ISO-like tanpa zona: anggap UTC supaya bisa digeser ke GMT+7
    let m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      const [_, Y, M, D, H, Min, S] = m;
      const d = new Date(Date.UTC(+Y, +M - 1, +D, +H, +Min, +(S || 0)));
      return formatHHMMFromDate(d);
    }

    // D/M/Y H:m(:s) tanpa zona → treat as UTC juga
    m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      const [_, D, M, Y, H, Min, S] = m;
      const d = new Date(Date.UTC(+Y, +M - 1, +D, +H, +Min, +(S || 0)));
      return formatHHMMFromDate(d);
    }

    // Fallback: serahkan ke Date; jika valid, render ke GMT+7
    const d = new Date(s);
    if (!isNaN(d)) return formatHHMMFromDate(d);
  }

  return null;
}

/* ===== Ambil jadwal per flight (sumber waktu yang benar versi sebelumnya) ===== */
async function loadFlightTimes(){
  if(Object.keys(flightTimes).length) return;
  try{
    const url = `${LOOKUP_URL}?action=flight_update&token=${encodeURIComponent(SHARED_TOKEN)}`;
    const r = await fetch(url,{method:"GET",mode:"cors"});
    const j = await r.json().catch(()=>({}));
    if(j?.ok && Array.isArray(j.rows)){
      j.rows.forEach(it=>{
        const fl = (it.flight||"").toUpperCase();
        const raw = it.departure || it.dep || it.time || it.jam || ""; // sumber lama
        const hhmm = toHHMMFromAny(raw); // konversi ke GMT+7 bila timestamp, atau pakai HH:MM apa adanya
        if (fl && hhmm) flightTimes[fl] = hhmm; // simpan tanpa "WIB"
      });
    }
  }catch(err){ console.error(err); }
}

/* ===== Render list ===== */
function renderList(rows){
  const body = document.getElementById('sidsBody');
  if(!body) return;
  body.innerHTML='';

  rows.forEach(it=>{
    const norm={};
    for(const k in it){
      norm[k.replace(/[^a-z0-9]/gi,'').toLowerCase()] = it[k];
    }

    const aksi=(norm.aksi||norm.action||'').trim();
    if(aksi) return;

    const passenger = (norm.namapemilik||norm.nama||'-').toUpperCase();
    const flight = (norm.flight||'-').toUpperCase();

    // Pakai waktu dari mapping per flight (sesuai versi sebelumnya)
    const timeRaw = flightTimes[flight] || "-";

    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td>${timeRaw !== "-" ? `<span class="time">${timeRaw}</span>` : "-"}</td>
      <td>${passenger}</td>
      <td>${flight}</td>
      <td>${translations[currentLang].status}</td>`;
    body.appendChild(tr);
  });
}

/* ===== Fetch list ===== */
async function loadSuspectList(){
  try{
    await loadFlightTimes(); // pastikan mapping waktu siap
    const url = `${LOOKUP_URL}?action=list_suspect&token=${encodeURIComponent(SHARED_TOKEN)}&limit=200`;
    const r = await fetch(url,{method:"GET",mode:"cors"});
    const j = await r.json().catch(()=>({}));
    if(j?.ok && Array.isArray(j.rows)){
      currentRows = j.rows;
      renderList(currentRows);
    }
  }catch(err){ console.error(err); }
}

/* ===== UI text ===== */
function applyTranslations(){
  const t = translations[currentLang];
  document.title = t.title;
  document.documentElement.lang = currentLang;

  const pageTitleEl = document.getElementById('pageTitle');
  if(pageTitleEl) pageTitleEl.textContent = t.title;

  const headCells = [
    document.getElementById('thTime'),
    document.getElementById('thPassenger'),
    document.getElementById('thFlight'),
    document.getElementById('thStatus')
  ];
  headCells.forEach((el,idx)=>{ if(el) el.textContent = t.headers[idx]; });

  const tick=document.getElementById('tickerText');
  if(tick) tick.textContent = t.ticker;
}

function toggleLanguage(){
  currentLang = currentLang === 'id' ? 'en' : 'id';
  applyTranslations();
  renderList(currentRows);
}

/* ===== Clock header (WIB) ===== */
function updateClock(){
  const now = new Date();
  const optsTime = { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Asia/Jakarta' };
  const optsDate = { day:'2-digit', month:'long', year:'numeric', timeZone:'Asia/Jakarta' };
  const time = new Intl.DateTimeFormat('id-ID', optsTime).format(now).replace('.', ':');
  const date = new Intl.DateTimeFormat('id-ID', optsDate).format(now);
  const timeEl = document.getElementById('clockTime');
  const dateEl = document.getElementById('clockDate');
  if(timeEl) timeEl.innerHTML = `${time} <span class="wib">WIB</span>`;
  if(dateEl) dateEl.textContent = date;
}

/* ===== Boot ===== */
document.addEventListener('DOMContentLoaded',()=>{
  applyTranslations();
  loadSuspectList();
  setInterval(loadSuspectList,30000);
  setInterval(toggleLanguage,10000);
  updateClock();
  setInterval(updateClock,1000);
});
