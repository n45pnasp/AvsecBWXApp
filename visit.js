import { requireAuth, getFirebase } from "./auth-guard.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const SCRIPT_URL   = "https://pasvisit.avsecbwx2018.workers.dev/";
const LOOKUP_URL   = "https://script.google.com/macros/s/AKfycbzgWQVOzC7cQVoc4TygW3nDJ_9iejZZ_4CBAWBFDrEXvjM5QxZvEiFr4FLKIu0bqs0Hfg/exec";
const SHARED_TOKEN = "N45p";

requireAuth({ loginPath: "index.html", hideWhileChecking: true });
const { auth } = getFirebase();
let authName = "";
const pemberiPasInput = document.getElementById("pemberiPas");
onAuthStateChanged(auth, u => {
  authName = u?.displayName || u?.email || "";
  if (pemberiPasInput) pemberiPasInput.value = authName;
});

const timeInput    = document.getElementById("timeInput");
const timeLabel    = document.getElementById("timeLabel");
const timeBtn      = document.getElementById("timeBtn");
const scanBtn      = document.getElementById("scanBtn");
const scanPassBtn  = document.getElementById("scanPassBtn");
const scanPassText = scanPassBtn ? scanPassBtn.querySelector('span') : null;
const namaEl       = document.getElementById("namaPendamping");
const instansiEl   = document.getElementById("instansiPendamping");
const pendampingInfo = document.getElementById("pendampingInfo");
const namaPendampingText = document.getElementById("namaPendampingText");
const instansiPendampingText = document.getElementById("instansiPendampingText");
const jenisPasInput  = document.getElementById("jenisPas");
const pickPhoto    = document.getElementById("pickPhotoBtn");
const fileInput    = document.getElementById("fileInput");
const preview      = document.getElementById("preview");
const uploadInfo   = document.getElementById("uploadInfo");
const uploadName   = document.getElementById("uploadName");
const uploadStatus = document.getElementById("uploadStatus");
const submitBtn    = document.getElementById("submitBtn");
const logList      = document.getElementById("logList");

const overlay = document.getElementById("overlay");
const ovIcon  = document.getElementById("ovIcon");
const ovTitle = document.getElementById("ovTitle");
const ovDesc  = document.getElementById("ovDesc");
const ovClose = document.getElementById("ovClose");
ovClose.addEventListener("click", () => overlay.classList.add("hidden"));

let jenisPas = "";
let photoData = "";
let scanMode = "pendamping";

function showOverlay(state, title, desc){
  overlay.classList.remove("hidden");
  ovIcon.className = "icon " + state;
  ovTitle.textContent = title;
  ovDesc.textContent = desc || "";
  ovClose.classList.toggle("hidden", state === "spinner");
  if (state !== "spinner") {
    setTimeout(() => overlay.classList.add("hidden"), 1500);
  }
}
function hideOverlay(){ overlay.classList.add("hidden"); }

// ====== Scan Barcode ======
let scanState = { stream:null, video:null, canvas:null, ctx:null, running:false, usingDetector:false, detector:null, jsQRReady:false, overlay:null, closeBtn:null };

function injectScanStyles(){
  if (document.getElementById('scan-style')) return;
  const css = `
    body.scan-active{ background:#000; overscroll-behavior:contain; }
    body.scan-active .app-bar, body.scan-active .container{ display:none !important; }
    #scan-video,#scan-canvas{ position:fixed; inset:0; width:100vw; height:100vh; display:none; background:#000; z-index:9998; }
    body.scan-active #scan-video{ display:block; object-fit:cover; transform:none; touch-action:none; }
    body.scan-active #scan-canvas{ display:none; }
    #scan-overlay{ position:fixed; inset:0; display:none; z-index:10000; pointer-events:none; }
    body.scan-active #scan-overlay{ display:block; }
    .scan-topbar{ position:absolute; top:0; left:0; right:0; height:max(56px, calc(44px + env(safe-area-inset-top,0))); display:flex; align-items:flex-start; justify-content:flex-end; padding: calc(env(safe-area-inset-top,0) + 6px) 10px 8px; background:linear-gradient(to bottom, rgba(0,0,0,.5), rgba(0,0,0,0)); pointer-events:none; }
    .scan-close{ pointer-events:auto; width:42px; height:42px; border-radius:999px; background:rgba(0,0,0,.55); color:#fff; border:1px solid rgba(255,255,255,.25); font-size:22px; line-height:1; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,.35); }
    .scan-reticle{ position:absolute; top:50%; left:50%; width:min(68vw,520px); aspect-ratio:1/1; transform:translate(-50%,-50%); border-radius:16px; box-shadow:0 0 0 9999px rgba(0,0,0,.28) inset; pointer-events:none; }
    .scan-hint{ position:absolute; left:50%; bottom:max(18px, calc(16px + env(safe-area-inset-bottom,0))); transform:translateX(-50%); background:rgba(0,0,0,.55); color:#fff; font-weight:600; padding:8px 12px; border-radius:999px; pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,.35); }
  `;
  const style = document.createElement('style');
  style.id = 'scan-style';
  style.textContent = css;
  document.head.appendChild(style);
}
injectScanStyles();

function ensureVideo(){
  if (!scanState.video){
    scanState.video = document.createElement('video');
    scanState.video.id = 'scan-video';
    document.body.appendChild(scanState.video);
  }
}
function ensureCanvas(){
  if (!scanState.canvas){
    scanState.canvas = document.createElement('canvas');
    scanState.canvas.id = 'scan-canvas';
    document.body.appendChild(scanState.canvas);
    scanState.ctx = scanState.canvas.getContext('2d', { willReadFrequently:true });
  }
}
function ensureOverlay(){
  if (!scanState.overlay){
    const ov = document.createElement('div'); ov.id = 'scan-overlay';
    const top = document.createElement('div'); top.className = 'scan-topbar';
    const close = document.createElement('button'); close.className = 'scan-close'; close.textContent = '✕';
    close.addEventListener('click', stopScan);
    top.appendChild(close); ov.appendChild(top);
    const ret = document.createElement('div'); ret.className = 'scan-reticle'; ov.appendChild(ret);
    const hint = document.createElement('div'); hint.className = 'scan-hint'; hint.textContent = 'Arahkan ke barcode'; ov.appendChild(hint);
    document.body.appendChild(ov);
    scanState.overlay = ov; scanState.closeBtn = close;
  }
}

if (scanBtn) scanBtn.addEventListener('click', () => { if (scanState.running) stopScan(); else { scanMode='pendamping'; startScan(); } });
if (scanPassBtn) scanPassBtn.addEventListener('click', () => { if (scanState.running) stopScan(); else { scanMode='pass'; startScan(); } });

async function startScan(){
  try{
    ensureVideo(); ensureCanvas(); ensureOverlay();
    document.body.classList.add('scan-active');
    const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ideal:'environment'} }, audio:false });
    scanState.stream = stream; scanState.video.srcObject = stream; await scanState.video.play();
    scanState.usingDetector = false; scanState.detector = null;
    if ('BarcodeDetector' in window){
      try{
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const formats = ['qr_code','pdf417','aztec','data_matrix'].filter(f=>supported.includes(f));
        if (formats.length){ scanState.detector = new window.BarcodeDetector({ formats }); scanState.usingDetector = true; }
      }catch(_){ }
    }
    scanState.running = true;
    if (scanState.usingDetector){ detectLoop_BarcodeDetector(); }
    else { await ensureJsQR(); detectLoop_jsQR(); }
  }catch(err){ showOverlay('err','Gagal membuka kamera', err.message||err); }
}

async function stopScan(){
  scanState.running = false;
  if (scanState.stream){ scanState.stream.getTracks().forEach(t=>t.stop()); scanState.stream=null; }
  if (scanState.video){ scanState.video.pause(); scanState.video.removeAttribute('srcObject'); }
  document.body.classList.remove('scan-active');
}

async function ensureJsQR(){
  if (scanState.jsQRReady) return;
  await new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error('Gagal memuat jsQR'));
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
        if (value){ handleScanSuccess(value); return; }
      }
    }catch(e){ console.warn('detector error', e); }
    if (scanState.running) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function detectLoop_jsQR(){
  const loop = () => {
    if (!scanState.running || !scanState.video) return;
    const vid = scanState.video;
    const cw = scanState.canvas.width = vid.videoWidth || 640;
    const ch = scanState.canvas.height = vid.videoHeight || 480;
    scanState.ctx.drawImage(vid,0,0,cw,ch);
    const img = scanState.ctx.getImageData(0,0,cw,ch);
    const res = window.jsQR ? window.jsQR(img.data,cw,ch,{inversionAttempts:'dontInvert'}) : null;
    if (res && res.data){ handleScanSuccess(res.data); return; }
    if (scanState.running) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

async function handleScanSuccess(code){
  await stopScan();
  if (scanMode === 'pendamping') receiveBarcode(code);
  else receivePass(code);
}

async function receiveBarcode(code){
  try{
    showOverlay('spinner','Mengambil data…','');
    const url = LOOKUP_URL + '?token=' + SHARED_TOKEN + '&key=' + encodeURIComponent(code);
    const res = await fetch(url);
    const j = await res.json();
    if (j && j.columns){
      const nama = (j.columns.B || '-').toUpperCase();
      const inst = (j.columns.E || '-').toUpperCase();
      namaEl.value = nama;
      instansiEl.value = inst;
      if(namaPendampingText) namaPendampingText.textContent = nama;
      if(instansiPendampingText) instansiPendampingText.textContent = inst;
      hideOverlay();
    } else {
      showOverlay('err', j?.error || 'Data tidak ditemukan','');
    }
  }catch(err){
    showOverlay('err','Gagal mengambil data', err.message||err);
  }
}

async function receivePass(code){
  try{
    showOverlay('spinner','Mengambil data…','');
    const url = LOOKUP_URL + '?token=' + SHARED_TOKEN + '&key=' + encodeURIComponent(code);
    const res = await fetch(url);
    const j = await res.json();
    if (j && j.columns){
      jenisPas = (j.columns.B || j.columns.C || '').toUpperCase();
      if (scanPassText) scanPassText.textContent = jenisPas || 'Scan Pas Visitor';
      if (jenisPasInput) jenisPasInput.value = jenisPas;
      hideOverlay();
    } else {
      showOverlay('err', j?.error || 'Data tidak ditemukan','');
    }
  }catch(err){
    showOverlay('err','Gagal mengambil data', err.message || err);
  }
}

// ====== Photo Upload ======
if (pickPhoto) pickPhoto.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file){ return; }
  const reader = new FileReader();
  reader.onload = () => {
    photoData = reader.result;
    preview.src = photoData;
    uploadInfo.classList.remove('hidden');
    uploadStatus.textContent = 'Foto siap diunggah';
    uploadName.textContent = file.name;
  };
  reader.readAsDataURL(file);
});

// ====== Time Picker ======
const timeModal = document.getElementById('timeModal');
const wheelHour = document.getElementById('wheelHour');
const wheelMin  = document.getElementById('wheelMin');
const btnCancel = timeModal.querySelector('.t-cancel');
const btnSave   = timeModal.querySelector('.t-save');
let wheelsBuilt = false;

const pad2 = n => String(n).padStart(2,'0');
const clamp = (v,min,max)=> v<min?min : v>max?max : v;
const ITEM_H=36, VISIBLE=5, SPACER=((VISIBLE-1)/2)*ITEM_H;

function buildWheel(el,count){
  const frag=document.createDocumentFragment();
  const top=document.createElement('div'); top.style.height=SPACER+'px';
  const bottom=document.createElement('div'); bottom.style.height=SPACER+'px';
  frag.appendChild(top);
  for(let i=0;i<count;i++){ const it=document.createElement('div'); it.className='item'; it.textContent=pad2(i); it.dataset.val=i; frag.appendChild(it); }
  frag.appendChild(bottom); el.appendChild(frag);
}
function enableWheel(el,max){
  let startY=0,startTop=0,dragging=false,isSnapping=false,timer;
  const maxScroll= (max+1)*ITEM_H;
  function snapTo(val){ val=clamp(val,0,max); el.scrollTo({top:val*ITEM_H,behavior:'instant'}); }
  function centerIndex(){ return clamp(Math.round(el.scrollTop/ITEM_H),0,max); }
  function snapToCenter(){ snapTo(centerIndex()); }
  el.addEventListener('pointerdown',e=>{ dragging=true; startY=e.clientY; startTop=el.scrollTop; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove',e=>{ if(!dragging)return; const dy=e.clientY-startY; el.scrollTop=startTop-dy; });
  function end(){ if(!dragging)return; dragging=false; isSnapping=true; snapToCenter(); requestAnimationFrame(()=>{isSnapping=false;}); }
  el.addEventListener('pointerup',end); el.addEventListener('pointercancel',end); el.addEventListener('pointerleave',end);
  el.addEventListener('scroll',()=>{ if(isSnapping)return; clearTimeout(timer); timer=setTimeout(()=>{ isSnapping=true; snapToCenter(); requestAnimationFrame(()=>{isSnapping=false;}); },140); },{passive:true});
  el.addEventListener('click',e=>{ const it=e.target.closest('.item'); if(!it)return; isSnapping=true; snapTo(+it.dataset.val); requestAnimationFrame(()=>{isSnapping=false;}); });
}
function openTimePicker(){
  if(!wheelsBuilt){ buildWheel(wheelHour,24); buildWheel(wheelMin,60); enableWheel(wheelHour,23); enableWheel(wheelMin,59); wheelsBuilt=true; }
  let h=0,m=0; if(timeInput.value){ const [hh,mm]=timeInput.value.split(':'); h=parseInt(hh||'0',10); m=parseInt(mm||'0',10); } else { const now=new Date(); h=now.getHours(); m=now.getMinutes(); }
  wheelHour.scrollTop=h*ITEM_H; wheelMin.scrollTop=m*ITEM_H; timeModal.classList.remove('hidden');
}
function closeTimePicker(save){
  if(save){ const h=Math.round(wheelHour.scrollTop/ITEM_H); const m=Math.round(wheelMin.scrollTop/ITEM_H); const val=`${pad2(h)}:${pad2(m)}`; timeInput.value=val; timeLabel.textContent=val; }
  timeModal.classList.add('hidden');
}
function disableNativeTimePicker(){
  timeInput.setAttribute('readonly','');
  timeInput.setAttribute('inputmode','none');
  timeInput.addEventListener('focus',e=>{ e.preventDefault(); e.target.blur(); openTimePicker(); });
  timeBtn.addEventListener('click',openTimePicker);
}
btnCancel.addEventListener('click',()=>closeTimePicker(false));
btnSave.addEventListener('click',()=>closeTimePicker(true));

disableNativeTimePicker();

// ====== Submit ======
submitBtn.addEventListener('click', onSubmit);

async function onSubmit(){
  const waktu = timeInput.value.trim();
  const nama  = namaEl.value.trim();
  const inst  = instansiEl.value.trim();
  const jenis = jenisPas.trim();
  if (!waktu || !photoData || !nama || !inst || !jenis){ showOverlay('err','Data belum lengkap',''); return; }
  const payload = { token:SHARED_TOKEN, waktu, namaPendamping:nama, instansiPendamping:inst, jenisPas:jenis, pemberiPas:authName, photo:photoData };
  submitBtn.disabled=true;
  showOverlay('spinner','Mengirim data…','');
  try{
    const res = await fetch(SCRIPT_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const j = await res.json();
    if(!j || !j.ok) throw new Error(j?.error || 'Gagal');
    showOverlay('ok','Data terkirim','');
    clearForm();
    loadLogs();
  }catch(err){ showOverlay('err','Gagal', err.message||err); }
  submitBtn.disabled=false;
}

function clearForm(){
  timeInput.value=""; timeLabel.textContent="Pilih Waktu"; photoData=""; jenisPas="";
  uploadInfo.classList.add('hidden'); uploadName.textContent=""; uploadStatus.textContent="Menunggu foto…";
  namaEl.value=""; instansiEl.value="";
  if (scanPassText) scanPassText.textContent = 'Scan Pas Visitor';
  if (jenisPasInput) jenisPasInput.value = '';
  if (namaPendampingText) namaPendampingText.textContent = '-';
  if (instansiPendampingText) instansiPendampingText.textContent = '-';
}

// ====== Load list ======
async function loadLogs(){
  logList.innerHTML = '<li class="muted">Memuat…</li>';
  try{
    const url = new URL(SCRIPT_URL);
    url.searchParams.set('action','list');
    url.searchParams.set('token',SHARED_TOKEN);
    const res = await fetch(url);
    const j = await res.json();
    logList.innerHTML='';
    if(!res.ok || !j.rows || !j.rows.length){ logList.innerHTML='<li class="muted">Belum ada data</li>'; return; }
    for(const r of j.rows){
      const li=document.createElement('li'); li.className='log-item';
      const timeStr = r.waktu ? `${r.waktu} WIB` : '-';
      li.textContent = `${timeStr} - ${r.jenisPas || '-'} - ${r.pemberiPas || '-'}`;
      logList.appendChild(li);
    }
  }catch(err){ logList.innerHTML='<li class="muted">Gagal memuat</li>'; }
}

loadLogs();

