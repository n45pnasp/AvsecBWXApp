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

const flightTimes = {};

/* ========= UTIL WAKTU ========= */

/** Format HH:MM dari Date (WIB) */
function formatHHMMFromDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return null;
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hh = parts.find(p => p.type === "hour")?.value ?? "";
  const mm = parts.find(p => p.type === "minute")?.value ?? "";
  return `${hh}:${mm}`;
}

/** Coba parse berbagai bentuk timestamp (string/number/serial Google Sheets) → HH:MM */
function toHHMMFromAny(v) {
  if (v == null || v === "") return null;

  // Number: bisa jadi epoch ms / detik / serial Google Sheets
  if (typeof v === "number") {
    // Serial Google Sheets (hari sejak 1899-12-30)
    if (v > 1000 && v < 60000) {
      const ms = (v - 25569) * 86400 * 1000;
      return formatHHMMFromDate(new Date(ms));
    }
    // Epoch detik
    if (v > 1e9 && v < 1e12) {
      return formatHHMMFromDate(new Date(v * 1000));
    }
    // Epoch milidetik
    if (v >= 1e12) {
      return formatHHMMFromDate(new Date(v));
    }
  }

  // String ISO/locale
  if (typeof v === "string") {
    const s = v.trim().replace(/\./g, ":");
    // Jika mengandung HH:MM langsung pakai
    const m = s.match(/(\d{1,2})[:](\d{2})/);
    if (m) {
      const h = String(m[1]).padStart(2, "0");
      const mm = String(m[2]).padStart(2, "0");
      return `${h}:${mm}`;
    }
    const d = new Date(s);
    if (!isNaN(d)) return formatHHMMFromDate(d);
  }

  return null;
}

/* ========= OPSIONAL: map waktu terjadwal per flight (tetap ada sbg fallback) ========= */
async function loadFlightTimes(){
  if(Object.keys(flightTimes).length) return;
  try{
    const url = `${LOOKUP_URL}?action=flight_update&token=${encodeURIComponent(SHARED_TOKEN)}`;
    const r = await fetch(url,{method:"GET",mode:"cors"});
    const j = await r.json().catch(()=>({}));
    if(j?.ok && Array.isArray(j.rows)){
      j.rows.forEach(it=>{
        const fl = (it.flight||"").toUpperCase();
        const raw = it.departure||it.dep||it.time||it.jam||"";
        const tm = toHHMMFromAny(raw);
        if(fl && tm) flightTimes[fl]=tm;
      });
    }
  }catch(err){ console.error(err); }
}

/* ========= RENDER ========= */
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
    if(aksi) return; // abaikan yg punya aksi (sesuai logic awal)

    const passenger = (norm.namapemilik||norm.nama||'-').toUpperCase();
    const flight = (norm.flight||'-').toUpperCase();

    // === AMBIL WAKTU DARI TIMESTAMP KOLOM A / SEJENIS ===
    const tsCandidate =
      norm.timestamp ?? norm.waktu ?? norm.jam ?? norm.createdat ??
      norm.created ?? norm.tanggal ?? norm.tanggalfull ?? norm.a ?? null;

    let timeRaw = toHHMMFromAny(tsCandidate);
    // Fallback ke waktu jadwal flight bila timestamp kosong
    if(!timeRaw) timeRaw = flightTimes[flight] || "-";

    // Render: tanpa WIB (hanya HH:MM)
    let timeHTML = "-";
    if (timeRaw && timeRaw !== "-") {
      timeHTML = `<span class="time">${timeRaw}</span>`;
    }

    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td>${timeHTML}</td>
      <td>${passenger}</td>
      <td>${flight}</td>
      <td>${translations[currentLang].status}</td>`;
    body.appendChild(tr);
  });
}

/* ========= FETCH ========= */
async function loadSuspectList(){
  try{
    await loadFlightTimes(); // tetap ada, hanya sebagai fallback
    const url = `${LOOKUP_URL}?action=list_suspect&token=${encodeURIComponent(SHARED_TOKEN)}&limit=200`;
    const r = await fetch(url,{method:"GET",mode:"cors"});
    const j = await r.json().catch(()=>({}));
    if(j?.ok && Array.isArray(j.rows)){
      currentRows = j.rows;
      renderList(currentRows);
    }
  }catch(err){ console.error(err); }
}

/* ========= UI TEXT ========= */
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

/* ========= CLOCK ========= */
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

/* ========= BOOT ========= */
document.addEventListener('DOMContentLoaded',()=>{
  applyTranslations();
  loadSuspectList();
  setInterval(loadSuspectList,30000);
  setInterval(toggleLanguage,10000);
  updateClock();
  setInterval(updateClock,1000);
});
