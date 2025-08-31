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

/** Format HH:MM dari Date dalam zona Asia/Jakarta (GMT+7) */
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

/**
 * Parse berbagai bentuk timestamp → "HH:MM" di GMT+7.
 * Aturan:
 * - "HH:MM" (tanpa tanggal) → dipakai apa adanya (tidak digeser)
 * - String tanggal TANPA zona (mis. "2025-08-31 12:07:00") → dianggap UTC lalu dirender ke GMT+7
 * - String dengan zona/offset (…Z atau +07:00) → gunakan offsetnya, hasil dirender ke GMT+7
 * - Number epoch detik/ms & serial Google Sheets → dikonversi ke GMT+7
 */
function toHHMMFromAny(v) {
  if (v == null || v === "") return null;

  if (typeof v === "number") {
    // Serial Google Sheets (hari sejak 1899-12-30) – treat as UTC
    if (v > 1000 && v < 60000) {
      const ms = (v - 25569) * 86400 * 1000;
      return formatHHMMFromDate(new Date(ms));
    }
    // Epoch detik
    if (v > 1e9 && v < 1e12) return formatHHMMFromDate(new Date(v * 1000));
    // Epoch milidetik
    if (v >= 1e12) return formatHHMMFromDate(new Date(v));
  }

  if (typeof v === "string") {
    const s = v.trim().replace(/\./g, ":");

    // Hanya "HH:MM" → jangan geser
    const hm = s.match(/^(\d{1,2}):(\d{2})$/);
    if (hm) {
      const h = String(hm[1]).padStart(2, "0");
      const m = String(hm[2]).padStart(2, "0");
      return `${h}:${m}`;
    }

    // Jika sudah ada zona (Z / +HH:MM / -HH:MM)
    if (/[zZ]|[+-]\d{2}:\d{2}$/.test(s)) {
      const d = new Date(s);
      if (!isNaN(d)) return formatHHMMFromDate(d);
    }

    // ISO-like tanpa zona: YYYY-MM-DD HH:mm(:ss)?
    let m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      const [_, Y, M, D, H, Min, S] = m;
      const d = new Date(Date.UTC(+Y, +M - 1, +D, +H, +Min, +(S || 0))); // treat as UTC
      return formatHHMMFromDate(d);
    }

    // D/M/Y H:m(:s) tanpa zona → treat as UTC
    m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      const [_, D, M, Y, H, Min, S] = m;
      const d = new Date(Date.UTC(+Y, +M - 1, +D, +H, +Min, +(S || 0)));
      return formatHHMMFromDate(d);
    }

    // fallback
    const d = new Date(s);
    if (!isNaN(d)) return formatHHMMFromDate(d);
  }

  return null;
}

/* ========= Jadwal per flight (fallback sumber waktu) ========= */
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
    if(aksi) return; // abaikan yg punya aksi

    const passenger = (norm.namapemilik||norm.nama||'-').toUpperCase();
    const flight = (norm.flight||'-').toUpperCase();

    // Ambil waktu dari timestamp kolom A/serupa → konversi ke GMT+7.
    const tsCandidate =
      norm.timestamp ?? norm.waktu ?? norm.jam ?? norm.createdat ??
      norm.created ?? norm.tanggal ?? norm.tanggalfull ?? norm.a ?? null;

    let timeRaw = toHHMMFromAny(tsCandidate);
    // Fallback: waktu jadwal per flight bila timestamp kosong/tidak valid
    if(!timeRaw) timeRaw = flightTimes[flight] || "-";

    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td>${timeRaw ? `<span class="time">${timeRaw}</span>` : '-'}</td>
      <td>${passenger}</td>
      <td>${flight}</td>
      <td>${translations[currentLang].status}</td>`;
    body.appendChild(tr);
  });
}

/* ========= FETCH ========= */
async function loadSuspectList(){
  try{
    await loadFlightTimes(); // siapkan fallback map waktu
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

/* ========= CLOCK (Header) ========= */
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
