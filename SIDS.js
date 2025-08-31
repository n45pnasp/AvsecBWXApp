const SHARED_TOKEN = "N45p";
const LOOKUP_URL = "https://rdcheck.avsecbwx2018.workers.dev/";

const translations = {
  id: {
    title: "PEMERIKSAAN BAGASI TERCATAT",
    headers: ["WAKTU", "PENUMPANG", "PENERBANGAN", "STATUS"],
    status: "DIPERIKSA HARAP MENGHUBUNGI PETUGAS",
    ticker: "HAVE A NICE FLIGHT - SEE YOU SOON!",
  },
  en: {
    title: "CHECKED BAGGAGE INSPECTION",
    headers: ["TIME", "PASSENGER", "FLIGHT", "STATUS"],
    status: "INSPECTED — PLEASE CONTACT OFFICER",
    ticker: "HAVE A NICE FLIGHT - SEE YOU SOON!",
  },
};

let currentLang = "id";
let currentRows = [];

const flightTimes = {};

function formatWib(timeStr){
  const m = String(timeStr || "").match(/(\d{1,2}):(\d{2})/);
  if(m){
    const h = m[1].padStart(2,"0");
    const mm = m[2].padStart(2,"0");
    return `${h}:${mm} WIB`;
  }
  return String(timeStr||"");
}

async function loadFlightTimes(){
  if(Object.keys(flightTimes).length) return;
  try{
    const url = `${LOOKUP_URL}?action=flight_update&token=${encodeURIComponent(SHARED_TOKEN)}`;
    const r = await fetch(url,{method:"GET",mode:"cors"});
    const j = await r.json().catch(()=>({}));
    if(j?.ok && Array.isArray(j.rows)){
      j.rows.forEach(it=>{
        const fl = (it.flight||"").toUpperCase();
        const tm = formatWib(it.departure||it.dep||it.time||it.jam||"");
        if(fl) flightTimes[fl]=tm;
      });
    }
  }catch(err){ console.error(err); }
}

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
    if(aksi) return; // remove if aksi empty

    const passenger = (norm.namapemilik||norm.nama||'-').toUpperCase();
    const flight = (norm.flight||'-').toUpperCase();
    const time = flightTimes[flight] || '-';

    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${time}</td><td>${passenger}</td><td>${flight}</td><td>${translations[currentLang].status}</td>`;
    body.appendChild(tr);
  });
}

async function loadSuspectList(){
  try{
    await loadFlightTimes();
    const url = `${LOOKUP_URL}?action=list_suspect&token=${encodeURIComponent(SHARED_TOKEN)}&limit=200`;
    const r = await fetch(url,{method:"GET",mode:"cors"});
    const j = await r.json().catch(()=>({}));
    if(j?.ok && Array.isArray(j.rows)){
      currentRows = j.rows;
      renderList(currentRows);
    }
  }catch(err){ console.error(err); }
}

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

document.addEventListener('DOMContentLoaded',()=>{
  applyTranslations();
  loadSuspectList();
  setInterval(loadSuspectList,30000);
  setInterval(toggleLanguage,10000);
  updateClock();
  setInterval(updateClock,1000);
});

function updateClock(){
  const now = new Date();
  const optsTime = { hour:'2-digit', minute:'2-digit', hour12:false, timeZone:'Asia/Jakarta' };
  const optsDate = { day:'2-digit', month:'long', year:'numeric', timeZone:'Asia/Jakarta' };
  const time = new Intl.DateTimeFormat('id-ID', optsTime).format(now).replace('.', ':');
  const date = new Intl.DateTimeFormat('id-ID', optsDate).format(now);
  const timeEl = document.getElementById('clockTime');
  const dateEl = document.getElementById('clockDate');
  if(timeEl) timeEl.textContent = `${time} WIB`;
  if(dateEl) dateEl.textContent = date;
}
