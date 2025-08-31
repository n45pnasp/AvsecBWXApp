const SHARED_TOKEN = "N45p";
const LOOKUP_URL = "https://rdcheck.avsecbwx2018.workers.dev/";

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
    if(!aksi) return; // remove if aksi empty

    const passenger = (norm.namapemilik||norm.nama||'-').toUpperCase();
    const flight = (norm.flight||'-').toUpperCase();
    const time = flightTimes[flight] || '-';

    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${time}</td><td>${passenger}</td><td>${flight}</td><td>DIPERIKSA HARAP MENGHUBUNGI PETUGAS</td>`;
    body.appendChild(tr);
  });
}

async function loadSuspectList(){
  try{
    await loadFlightTimes();
    const url = `${LOOKUP_URL}?action=list_suspect&token=${encodeURIComponent(SHARED_TOKEN)}&limit=200`;
    const r = await fetch(url,{method:"GET",mode:"cors"});
    const j = await r.json().catch(()=>({}));
    if(j?.ok && Array.isArray(j.rows)) renderList(j.rows);
  }catch(err){ console.error(err); }
}

document.addEventListener('DOMContentLoaded',()=>{
  loadSuspectList();
  setInterval(loadSuspectList,30000);
});
