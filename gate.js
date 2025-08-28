import { requireAuth, getFirebase } from "./auth-guard.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const SCRIPT_URL   = "https://loggate.avsecbwx2018.workers.dev/";
const LOOKUP_URL   = "https://script.google.com/macros/s/AKfycbzgWQVOzC7cQVoc4TygW3nDJ_9iejZZ_4CBAWBFDrEXvjM5QxZvEiFr4FLKIu0bqs0Hfg/exec";
const SHARED_TOKEN = "N45p";

requireAuth({ loginPath: "index.html", hideWhileChecking: true });
const { auth } = getFirebase();
let authName = "";
onAuthStateChanged(auth, u => { authName = u?.displayName || u?.email || ""; });

const timeInput    = document.getElementById("timeInput");
const timeLabel    = document.getElementById("timeLabel");
const timeBtn      = document.getElementById("timeBtn");
const scanBtn      = document.getElementById("scanBtn");
const namaEl       = document.getElementById("namaPetugas");
const instansiEl   = document.getElementById("instansiPetugas");
const fotoEl       = document.getElementById("fotoPetugas");
const flightSel    = document.getElementById("flight");
const kodeSel      = document.getElementById("kodeKunci");
const submitBtn    = document.getElementById("submitBtn");
const logList      = document.getElementById("logList");

const overlay = document.getElementById("overlay");
const ovIcon  = document.getElementById("ovIcon");
const ovTitle = document.getElementById("ovTitle");
const ovDesc  = document.getElementById("ovDesc");
const ovClose = document.getElementById("ovClose");

const timeModal = document.getElementById("timeModal");
const wheelHour = document.getElementById("wheelHour");
const wheelMin  = document.getElementById("wheelMin");
const btnCancel = timeModal.querySelector(".t-cancel");
const btnSave   = timeModal.querySelector(".t-save");
let wheelsBuilt = false;

let scanState = { stream:null, video:null, canvas:null, ctx:null, running:false, usingDetector:false, detector:null, jsQRReady:false, overlay:null, closeBtn:null };
let kodePas = "";

const pad2 = n => String(n).padStart(2,"0");
const clamp = (v,min,max)=> v<min?min : v>max?max : v;
const ITEM_H=36, VISIBLE=5, SPACER=((VISIBLE-1)/2)*ITEM_H;

timeInput.addEventListener("change", () => {
  timeLabel.textContent = timeInput.value || "Pilih Waktu";
});

scanBtn.addEventListener("click", () => {
  if (scanState.running) {
    stopScan();
  } else {
    startScan();
  }
});

ovClose.addEventListener("click", () => overlay.classList.add("hidden"));
submitBtn.addEventListener("click", onSubmit);

function showOverlay(state, title, desc){
  overlay.classList.remove("hidden");
  ovIcon.className = "icon " + (state === "spinner" ? "spinner" : state);
  ovTitle.textContent = title;
  ovDesc.textContent = desc || "";
  ovClose.classList.toggle("hidden", state === "spinner");
  if (state !== "spinner") {
    const delay = state === "stop" ? 3500 : 1500;
    setTimeout(() => overlay.classList.add("hidden"), delay);
  }
}
function hideOverlay(){ overlay.classList.add("hidden"); }

function clearForm(){
  timeInput.value = ""; timeLabel.textContent = "Pilih Waktu";
  namaEl.textContent = "-"; instansiEl.textContent = "-";
  if(fotoEl){ fotoEl.src = ""; fotoEl.classList.add("hidden"); }
  flightSel.value = ""; kodeSel.value = ""; kodePas = "";
}

// ===== TIME PICKER (Wheel) =====
function buildWheel(el, count){
  const frag = document.createDocumentFragment();
  const top = document.createElement("div"); top.style.height = SPACER+"px";
  const bottom = document.createElement("div"); bottom.style.height = SPACER+"px";
  frag.appendChild(top);
  for(let i=0;i<count;i++){
    const it=document.createElement("div");
    it.className="item"; it.textContent=pad2(i); it.dataset.val=i;
    frag.appendChild(it);
  }
  frag.appendChild(bottom);
  el.innerHTML=""; el.appendChild(frag);
}
function centerIndex(el,max){
  const centerTop=el.scrollTop+el.clientHeight/2;
  const relative=centerTop-SPACER-ITEM_H/2;
  return clamp(Math.round(relative/ITEM_H),0,max);
}
function snapToCenter(el,idx){ el.scrollTop=idx*ITEM_H; }
function enableWheel(el,max){
  let dragging=false,startY=0,startTop=0,isSnapping=false,timer=null;
  el.addEventListener("pointerdown",e=>{ dragging=true; startY=e.clientY; startTop=el.scrollTop; el.setPointerCapture(e.pointerId); clearTimeout(timer); });
  el.addEventListener("pointermove",e=>{ if(!dragging)return; const next=startTop+(e.clientY-startY); el.scrollTop=clamp(next,0,SPACER+max*ITEM_H+SPACER); });
  function endDrag(){ if(!dragging)return; dragging=false; isSnapping=true; snapToCenter(el,centerIndex(el,max)); requestAnimationFrame(()=>{isSnapping=false;}); }
  el.addEventListener("pointerup",endDrag); el.addEventListener("pointercancel",endDrag); el.addEventListener("pointerleave",endDrag);
  el.addEventListener("scroll",()=>{ if(isSnapping)return; clearTimeout(timer); timer=setTimeout(()=>{ isSnapping=true; snapToCenter(el,centerIndex(el,max)); requestAnimationFrame(()=>{isSnapping=false;}); },140); },{passive:true});
  el.addEventListener("click",e=>{ const it=e.target.closest(".item"); if(!it)return; isSnapping=true; snapToCenter(el,+it.dataset.val); requestAnimationFrame(()=>{isSnapping=false;}); });
}
function openTimePicker(){
  if(!wheelsBuilt){ buildWheel(wheelHour,24); buildWheel(wheelMin,60); enableWheel(wheelHour,23); enableWheel(wheelMin,59); wheelsBuilt=true; }
  let h=0,m=0; if(timeInput.value){ const [hh,mm]=timeInput.value.split(":"); h=parseInt(hh||"0",10); m=parseInt(mm||"0",10); } else { const now=new Date(); h=now.getHours(); m=now.getMinutes(); }
  snapToCenter(wheelHour,h); snapToCenter(wheelMin,m); timeModal.classList.remove("hidden");
}
function closeTimePicker(save){
  if(save){ const h=centerIndex(wheelHour,23); const m=centerIndex(wheelMin,59); snapToCenter(wheelHour,h); snapToCenter(wheelMin,m); const val=`${pad2(h)}:${pad2(m)}`; timeInput.value=val; timeLabel.textContent=val; }
  timeModal.classList.add("hidden");
}
function disableNativeTimePicker(){
  timeInput.setAttribute("readonly","");
  timeInput.setAttribute("inputmode","none");
  timeInput.addEventListener("focus",e=>{ e.preventDefault(); e.target.blur(); openTimePicker(); });
  timeBtn.addEventListener("click",openTimePicker);
}
btnCancel.addEventListener("click",()=>closeTimePicker(false));
btnSave.addEventListener("click",()=>closeTimePicker(true));

async function onSubmit(){
  const payload = {
    token: SHARED_TOKEN,
    waktu: timeInput.value.trim(),
    kodePas: kodePas.trim(),
    namaPetugas: namaEl.textContent.trim().toUpperCase(),
    instansiPetugas: instansiEl.textContent.trim().toUpperCase(),
    flight: flightSel.value.trim().toUpperCase(),
    kodeKunci: kodeSel.value.trim().toUpperCase(),
    penyerah: authName
  };
  submitBtn.disabled = true;
  showOverlay('spinner','Mengirim data…','');
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const j = await res.json();
    if (!j || (!j.success && !j.ok)) throw new Error(j?.error || "Gagal mengirim");
    showOverlay('ok','Data berhasil dikirim','');
    clearForm();
    loadLogs();
  } catch(err){
    showOverlay('err','Gagal', err?.message || err);
  } finally {
    submitBtn.disabled = false;
  }
}

// ====== SCAN BARCODE ======
function injectScanStyles(){
  if (document.getElementById('scan-style')) return;
  const css = `
    .is-waiting { opacity:.7; pointer-events:none }
    body.scan-active{ background:#000; overscroll-behavior:contain; }
    body.scan-active .app-bar,
    body.scan-active .container { display:none !important; }
    #scan-video,#scan-canvas{ position:fixed; inset:0; width:100vw; height:100vh; display:none; background:#000; z-index:9998; }
    body.scan-active #scan-video{ display:block; object-fit:cover; transform:none; touch-action:none; }
    body.scan-active #scan-canvas{ display:none; }
    #scan-overlay{ position:fixed; inset:0; display:none; z-index:10000; pointer-events:none; }
    body.scan-active #scan-overlay{ display:block; }
    .scan-topbar{ position:absolute; top:0; left:0; right:0; height:max(56px, calc(44px + env(safe-area-inset-top,0))); display:flex; align-items:flex-start; justify-content:flex-end; padding: calc(env(safe-area-inset-top,0) + 6px) 10px 8px; background:linear-gradient(to bottom, rgba(0,0,0,.5), rgba(0,0,0,0)); pointer-events:none; }
    .scan-close{ pointer-events:auto; width:42px; height:42px; border-radius:999px; background:rgba(0,0,0,.55); color:#fff; border:1px solid rgba(255,255,255,.25); font-size:22px; line-height:1; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 12px rgba(0,0,0,.35); transition: transform .08s ease, filter .15s ease; }
    .scan-close:active{ transform:scale(.96); }
    .scan-close:focus-visible{ outline:2px solid rgba(255,255,255,.6); outline-offset:2px; }
    .scan-reticle{ position:absolute; top:50%; left:50%; width:min(68vw, 520px); aspect-ratio:1/1; transform:translate(-50%,-50%); border-radius:16px; box-shadow:0 0 0 9999px rgba(0,0,0,.28) inset; pointer-events:none; background: linear-gradient(#fff,#fff) left top/28px 2px no-repeat, linear-gradient(#fff,#fff) left top/2px 28px no-repeat, linear-gradient(#fff,#fff) right top/28px 2px no-repeat, linear-gradient(#fff,#fff) right top/2px 28px no-repeat, linear-gradient(#fff,#fff) left bottom/28px 2px no-repeat, linear-gradient(#fff,#fff) left bottom/2px 28px no-repeat, linear-gradient(#fff,#fff) right bottom/28px 2px no-repeat, linear-gradient(#fff,#fff) right bottom/2px 28px no-repeat; outline:2px dashed rgba(255,255,255,0); }
    .scan-hint{ position:absolute; left:50%; bottom:max(18px, calc(16px + env(safe-area-inset-bottom,0))); transform:translateX(-50%); background:rgba(0,0,0,.55); color:#fff; font-weight:600; padding:8px 12px; border-radius:999px; letter-spacing:.2px; pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,.35); }
  `;
  const style = document.createElement('style');
  style.id = 'scan-style';
  style.textContent = css;
  document.head.appendChild(style);
}

injectScanStyles();

async function startScan(){
  try{
    ensureVideo();
    ensureOverlay();
    document.body.classList.add('scan-active');
    const constraints = {
      video:{ facingMode:{ideal:'environment'}, width:{ideal:1280}, height:{ideal:720}, advanced:[{focusMode:'continuous'}]},
      audio:false
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    scanState.stream = stream;
    scanState.video.srcObject = stream;
    await scanState.video.play();

    scanState.usingDetector = false;
    scanState.detector = null;
    if ('BarcodeDetector' in window){
      try{
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const wanted = ['qr_code','pdf417','aztec','data_matrix'];
        const formats = wanted.filter(f=>supported.includes(f));
        if (formats.length){
          scanState.detector = new window.BarcodeDetector({ formats });
          scanState.usingDetector = true;
        }
      }catch(_){ }
    }

    scanState.running = true;
    if (scanState.usingDetector){
      detectLoop_BarcodeDetector();
    } else {
      await ensureJsQR();
      prepareCanvas();
      detectLoop_jsQR();
    }
  }catch(err){
    showOverlay('err','Tidak bisa mengakses kamera','');
    await stopScan();
  }
}

async function stopScan(){
  scanState.running = false;
  if (scanState.stream){
    scanState.stream.getTracks().forEach(t=>{ try{ t.stop(); }catch(_){} });
  }
  scanState.stream = null;
  if (scanState.video){
    scanState.video.srcObject = null;
    scanState.video.remove();
    scanState.video = null;
  }
  if (scanState.canvas){
    scanState.canvas.remove();
    scanState.canvas = null;
    scanState.ctx = null;
  }
  document.body.classList.remove('scan-active');
}

function ensureVideo(){
  if (scanState.video) return;
  const v = document.createElement('video');
  v.id = 'scan-video'; v.muted = true; v.autoplay = true;
  document.body.appendChild(v);
  scanState.video = v;
}
function ensureOverlay(){
  if (scanState.overlay) return;
  const overlay = document.createElement('div');
  overlay.id = 'scan-overlay';
  overlay.innerHTML = `
    <div class="scan-topbar">
      <button id="scan-close" class="scan-close" aria-label="Tutup">✕</button>
    </div>
    <div class="scan-reticle" aria-hidden="true"></div>
    <div class="scan-hint">Arahkan ke barcode / QR</div>`;
  document.body.appendChild(overlay);
  scanState.overlay = overlay;
  scanState.closeBtn = overlay.querySelector('#scan-close');
  scanState.closeBtn.addEventListener('click', e => { e.preventDefault(); stopScan(); });
}
function prepareCanvas(){
  if (scanState.canvas) return;
  const c = document.createElement('canvas');
  c.id = 'scan-canvas';
  document.body.appendChild(c);
  scanState.canvas = c;
  scanState.ctx = c.getContext('2d', { willReadFrequently:true });
}
async function ensureJsQR(){
  if (scanState.jsQRReady) return;
  await import('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js');
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
    }catch(e){
      console.warn('detector error', e);
      if (!scanState.canvas){
        try{ await ensureJsQR(); prepareCanvas(); scanState.usingDetector=false; detectLoop_jsQR(); return; }catch(_){ }
      }
    }
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

async function handleScanSuccess(raw){
  await stopScan();
  receiveBarcode(raw);
}

async function receiveBarcode(code){
  try{
    kodePas = code.trim();
    showOverlay('spinner','Mengambil data…','');
    const url = LOOKUP_URL + '?token=' + SHARED_TOKEN + '&key=' + encodeURIComponent(code);
    const res = await fetch(url);
    const j = await res.json();
    if (j && j.columns){
      namaEl.textContent     = (j.columns.B || '-').toUpperCase();
      instansiEl.textContent = (j.columns.E || '-').toUpperCase();
      const rawFoto = (j.columns.H || '').trim();
      let fotoUrl = '';
      if(rawFoto){
        if(/^https?:/i.test(rawFoto)){
          fotoUrl = rawFoto;
        } else {
          fotoUrl = `https://drive.google.com/thumbnail?id=${rawFoto}`;
        }
      }
      if(fotoEl){
        if(fotoUrl){
          fotoEl.src = fotoUrl;
          fotoEl.classList.remove('hidden');
        } else {
          fotoEl.src = '';
          fotoEl.classList.add('hidden');
        }
      }
      hideOverlay();
    } else {
      showOverlay('err', j?.error || 'Data tidak ditemukan','');
    }
  }catch(err){
    showOverlay('err','Gagal mengambil data', err?.message || err);
  }
}

async function editReturn(li){
  const id = li.dataset.id;
  if(!id) return;
  const time = prompt("Jam pengembalian (HH:MM)", "");
  if(!time) return;
  try{
    showOverlay('spinner','Mengirim data…','');
    const res = await fetch(SCRIPT_URL, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ token: SHARED_TOKEN, action:'updateReturn', id, jamKembali: time })
    });
    const j = await res.json();
    if(!j || (!j.success && !j.ok)) throw new Error(j?.error || 'Gagal');
    showOverlay('ok','Tersimpan','');
    loadLogs();
  }catch(err){
    showOverlay('err','Gagal', err?.message || err);
  }
}

async function loadLogs(){
  logList.innerHTML = '<li>Memuat…</li>';
  try{
    const url = new URL(SCRIPT_URL);
    url.searchParams.set('action','list');
    url.searchParams.set('token',SHARED_TOKEN);
    const res = await fetch(url);
    const j = await res.json();
    logList.innerHTML = '';
    if(!res.ok || !j.rows || !j.rows.length){
      logList.innerHTML = '<li class="muted">Belum ada data</li>';
      return;
    }
    for(const r of j.rows){
      const gate = r.gate || (r.kodeKunci === '1139' ? 'GATE 1' : (r.kodeKunci === '1140' ? 'GATE 2' : ''));
      const li = document.createElement('li');
      li.className = 'log-item';
      li.dataset.id = r.id || '';
      li.innerHTML = `
        <div class="log-main">${r.kodePas || '-'} - ${r.namaPetugas || '-'}</div>
        <div class="log-meta">
          <div>Kode Kunci: ${r.kodeKunci || '-'}</div>
          <div>Gate: ${gate || '-'}</div>
          <div>Penyerah: ${r.penyerah || '-'}</div>
          <div>Jam pengembalian: <span class="ret">${r.jamKembali || ''}</span></div>
        </div>`;
      li.addEventListener('click',()=>editReturn(li));
      logList.appendChild(li);
    }
  }catch(err){
    logList.innerHTML = '<li>Gagal memuat</li>';
  }
}

disableNativeTimePicker();
loadLogs();

window.receiveBarcode = receiveBarcode;
