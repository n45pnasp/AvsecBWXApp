const SCRIPT_URL   = "https://fuel.avsecbwx2018.workers.dev/"; // URL Worker
const SHARED_TOKEN = "N45p";

const $ = s => document.querySelector(s);
// ... (variabel DOM sama seperti sebelumnya)

let unitToNeeds = {};
let fuels = [];
let currentId = '';

init();
async function init(){
  await loadDropdowns();
  await refreshListIds();
  // listeners sama seperti sebelumnya...
}

/* ===== Dropdowns ===== */
async function loadDropdowns(){
  const url = `${SCRIPT_URL}?action=dropdowns&token=${encodeURIComponent(SHARED_TOKEN)}`;
  const res = await fetch(url).then(r=>r.json());
  unitToNeeds = res.unitToNeeds || {};
  fuels = res.fuels || [];
  // render options ... (sama)
}

/* ===== Harga/Sync ===== */
// (sama persis)

/* ===== Create record (POST + token) ===== */
async function onKirim(){
  // validasi sama ...
  const payload = { action:'create', unit, jenis, liter, keperluan, token: SHARED_TOKEN };
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r=>r.json()).catch(()=>({ok:false,error:'Network'}));
  // lanjut sama ...
}

/* ===== List ID (GET + token) ===== */
async function refreshListIds(){
  const res = await fetch(`${SCRIPT_URL}?action=list&token=${encodeURIComponent(SHARED_TOKEN)}`)
                    .then(r=>r.json());
  // isi dropdown id ... (sama)
}

function onPickId(){
  const val = idList.value || '';
  if(!val){ verStat.textContent='-'; btnPdf.disabled = true; return; }
  fetch(`${SCRIPT_URL}?action=list&token=${encodeURIComponent(SHARED_TOKEN)}`)
    .then(r=>r.json())
    .then(res=>{
      const row = (res.rows||[]).find(x=>x.id===val);
      const v = (row && row.verified || '').toLowerCase();
      verStat.textContent = row ? (row.verified||'(kosong)') : '-';
      btnPdf.disabled = v !== 'cetak';
    });
}

function onOpenPdf(){
  const id = idList.value || '';
  if(!id) return;
  // buka kupon (GET + token). Ini akan lewat Worker → GAS
  window.open(`${SCRIPT_URL}?action=coupon&id=${encodeURIComponent(id)}&token=${encodeURIComponent(SHARED_TOKEN)}`, '_blank');
}

/* ===== Foto (POST + token) ===== */
async function onPickFile(e){
  // ... (resize sama)
  const res = await fetch(SCRIPT_URL, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ action:'uploadphoto', id, dataUrl, token: SHARED_TOKEN })
  }).then(r=>r.json()).catch(()=>({ok:false,error:'Network'}));
  // ...
}

/* ===== Utils ===== */
// (sama)
