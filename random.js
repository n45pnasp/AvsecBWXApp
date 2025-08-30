// random.js — FINAL (Worker proxy + foto dataURL + BSM parser + list suspect via GET; sinkron code.gs terbaru)
import { requireAuth, getFirebase } from "./auth-guard.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

requireAuth({ loginPath: "index.html", hideWhileChecking: true });

/* ===== KONFIG ===== */
const PROXY_URL    = "https://rdcheck.avsecbwx2018.workers.dev/";
const SHARED_TOKEN = "N45p";
const LOOKUP_URL   = "https://rdcheck.avsecbwx2018.workers.dev/"; // GET: list_suspect, photoraw, get_photo, flight_update

/* ===== DOM (dipersingkat) ===== */
const $ = (s)=>document.querySelector(s);
const btnPSCP=$("#btnPSCP"),btnHBSCP=$("#btnHBSCP"),btnCARGO=$("#btnCARGO");
const scanBtn=$("#scanBtn"),scanResult=$("#scanResult");
const namaEl=$("#namaPenumpang"),flightEl=$("#noFlight");
const manualForm=$("#manualForm"),manualNama=$("#manualNama"),manualFlight=$("#manualFlight");
const manualNamaLabel=manualForm?.querySelector('label[for="manualNama"]');
const metodeSel=$("#jenisPemeriksaan");
const objekSel=$("#objek"),objekField=objekSel?.parentElement;
const barangCard=$("#barangCard");
const tindakanSel=$("#tindakanBarang"),tipePiSel=$("#tipePi");
const tindakanField=tindakanSel?.parentElement,tipePiField=tipePiSel?.parentElement;
const isiBarangInp=$("#isiBarang");
const fotoBtn=$("#fotoBtn"),fotoInput=$("#fotoInput"),fotoPreview=$("#fotoPreview");

// SUSPECT HBSCP
const bagasiCard=$("#bagasiCard"),bagasiListCard=$("#bagasiListCard");
const scanBagBtn=$("#scanBagBtn");
const bagNoEl=$("#bagNo"),bagNamaEl=$("#bagNama"),bagFlightBagEl=$("#bagFlight"),
      bagDestEl=$("#bagDest"),bagDateEl=$("#bagDate");
const bagFotoLayarBtn=$("#bagFotoLayarBtn"),bagFotoLayarInput=$("#bagFotoLayarInput"),
      bagFotoLayarPreview=$("#bagFotoLayarPreview");
const bagFotoBarangBtn=$("#bagFotoBarangBtn"),bagFotoBarangInput=$("#bagFotoBarangInput"),
      bagFotoBarangPreview=$("#bagFotoBarangPreview");
const bagSubmitBtn=$("#bagSubmitBtn");
const bagasiList=$("#bagasiList");
const bagIndikasiInp=$("#bagIndikasi");

// modal foto suspect/barang
const imgOverlay=$("#photoOverlay"),imgClose=$("#photoClose"),suspectImg=$("#suspectPhoto"),barangImg=$("#barangPhoto"),indikasiEl=$("#indikasiText");

const petugasInp=$("#petugas"),supervisorInp=$("#supervisor"),submitBtn=$("#submitBtn");
const overlay=$("#overlay"),ovIcon=$("#ovIcon"),ovTitle=$("#ovTitle"),ovDesc=$("#ovDesc"),ovClose=$("#ovClose");

/* ===== AUTH ===== */
const { app, auth } = getFirebase();
const db = getDatabase(app);
onAuthStateChanged(auth,(u)=>{
  const name=(u?.displayName||u?.email||"").toUpperCase();
  if(petugasInp) petugasInp.value=name;
});

/* ===== OVERLAY ===== */
ovClose?.addEventListener("click",()=>overlay?.classList.add("hidden"));
function showOverlay(state,title="",desc=""){
  const isSpin = (state === "spinner" || state === "loading");
  overlay?.classList.remove("hidden");
  if(ovIcon) ovIcon.className = "icon " + (isSpin ? "spinner" : state);
  if(ovTitle) ovTitle.textContent = title;
  if(ovDesc) ovDesc.textContent = desc;
  ovClose?.classList.toggle("hidden", isSpin);
  if(!isSpin){
    setTimeout(()=>overlay?.classList.add("hidden"), state==="stop"?3500:1500);
  }
}

/* ===== STATE & SUPERVISOR ===== */
let mode="PSCP";
const supervisors={PSCP:"",HBSCP:"",CARGO:""};
onValue(ref(db,"roster/spvCabin"),s=>{supervisors.PSCP=s.val()||"";if(mode==="PSCP")setSupervisor();});
onValue(ref(db,"roster/spvHbs"),  s=>{supervisors.HBSCP=s.val()||"";if(mode==="HBSCP")setSupervisor();});
onValue(ref(db,"roster/spvCargo"),s=>{supervisors.CARGO=s.val()||"";if(mode==="CARGO")setSupervisor();});
function setSupervisor(){ if(supervisorInp) supervisorInp.value=supervisors[mode]||""; }

const val=e=>(e?.value||"").trim();
const txt=e=>(e?.textContent||"").trim();

/* ===== FOTO utama ===== */
let fotoDataUrl="";
async function compressImage(file,max=480,quality=0.7){
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=URL.createObjectURL(file);});
  const s=Math.min(1,max/Math.max(img.width,img.height));
  const c=document.createElement("canvas"); c.width=Math.max(1,Math.round(img.width*s)); c.height=Math.max(1,Math.round(img.height*s));
  c.getContext("2d").drawImage(img,0,0,c.width,c.height);
  return c.toDataURL("image/jpeg",quality);
}
function resetFoto(){ if(!fotoInput||!fotoPreview)return; fotoInput.value=""; fotoPreview.src=""; fotoPreview.classList.add("hidden"); fotoDataUrl=""; }
fotoBtn?.addEventListener("click",()=>fotoInput?.click());
fotoInput?.addEventListener("change",async()=>{
  const f=fotoInput.files?.[0]; if(!f){resetFoto();return;}
  fotoPreview.src=URL.createObjectURL(f); fotoPreview.classList.remove("hidden");
  try{
    const d=await compressImage(f,480,0.7);
    if(d.length>200_000){ alert("Foto terlalu besar, turunkan resolusi."); resetFoto(); }
    else fotoDataUrl=d;
  }catch{ resetFoto(); }
});

/* ===== FOTO suspect (dua foto) ===== */
let bagFotoSuspectDataUrl="",bagFotoBarangDataUrl="";
function resetBagFotoLayar(){ if(!bagFotoLayarInput||!bagFotoLayarPreview)return; bagFotoLayarInput.value=""; bagFotoLayarPreview.src=""; bagFotoLayarPreview.classList.add("hidden"); bagFotoSuspectDataUrl=""; }
bagFotoLayarBtn?.addEventListener("click",()=>bagFotoLayarInput?.click());
bagFotoLayarInput?.addEventListener("change",async()=>{
  const f=bagFotoLayarInput.files?.[0]; if(!f){resetBagFotoLayar();return;}
  bagFotoLayarPreview.src=URL.createObjectURL(f); bagFotoLayarPreview.classList.remove("hidden");
  try{
    const d=await compressImage(f,480,0.7);
    if(d.length>200_000){ alert("Foto terlalu besar."); resetBagFotoLayar(); }
    else bagFotoSuspectDataUrl=d;
  }catch{ resetBagFotoLayar(); }
});
function resetBagFotoBarang(){ if(!bagFotoBarangInput||!bagFotoBarangPreview)return; bagFotoBarangInput.value=""; bagFotoBarangPreview.src=""; bagFotoBarangPreview.classList.add("hidden"); bagFotoBarangDataUrl=""; }
bagFotoBarangBtn?.addEventListener("click",()=>bagFotoBarangInput?.click());
bagFotoBarangInput?.addEventListener("change",async()=>{
  const f=bagFotoBarangInput.files?.[0]; if(!f){resetBagFotoBarang();return;}
  bagFotoBarangPreview.src=URL.createObjectURL(f); bagFotoBarangPreview.classList.remove("hidden");
  try{
    const d=await compressImage(f,480,0.7);
    if(d.length>200_000){ alert("Foto terlalu besar."); resetBagFotoBarang(); }
    else bagFotoBarangDataUrl=d;
  }catch{ resetBagFotoBarang(); }
});

function resetBagasiCard(){
  if(bagNoEl) bagNoEl.textContent="-";
  if(bagNamaEl) bagNamaEl.textContent="-";
  if(bagFlightBagEl) bagFlightBagEl.textContent="-";
  if(bagDestEl) bagDestEl.textContent="-";
  if(bagDateEl) bagDateEl.textContent="-";
  if(bagIndikasiInp) bagIndikasiInp.value="";
  resetBagFotoLayar(); resetBagFotoBarang();
}

/* ===== SUSPECT LIST (read via GET) ===== */
function formatWib(timeStr){
  const m=String(timeStr||"").match(/(\d{1,2}):(\d{2})/);
  if(m){
    const h=m[1].padStart(2,"0");
    const mm=m[2].padStart(2,"0");
    return `${h}:${mm} WIB`;
  }
  return String(timeStr||"");
}
const flightTimes={};
async function loadFlightTimes(){
  if(Object.keys(flightTimes).length) return;
  try{
    const url=`${LOOKUP_URL}?action=flight_update&token=${encodeURIComponent(SHARED_TOKEN)}`;
    const r=await fetch(url,{method:"GET",mode:"cors"});
    const j=await r.json().catch(()=>({}));
    if(j?.ok && Array.isArray(j.rows)){
      j.rows.forEach(it=>{
        const fl=(it.flight||"").toUpperCase();
        const tm=formatWib(it.departure||it.dep||it.time||it.jam||"");
        if(fl) flightTimes[fl]=tm;
      });
    }
  }catch(err){ console.error(err); }
}

function isDirectUrl(s){ return /^(?:https?:|data:|blob:)/i.test(String(s||"")); }
function looksLikeFileId(s){ return /^[A-Za-z0-9_-]{20,}$/.test(String(s||"")); }
function stripImageFormula(s){
  const m=String(s||"").match(/^=?IMAGE\(["'](.+?)["']\)$/i);
  return m?m[1]:s;
}
function normalizeDriveUrl(u){
  const m=String(u||"").match(/(?:id=|\/d\/)([A-Za-z0-9_-]{20,})/);
  return m?`https://lh3.googleusercontent.com/d/${m[1]}`:u;
}

async function openPhoto(suspect, barang, indikasi=""){
  if(!imgOverlay) return;

  const entries=[];
  if(suspect) entries.push({img:suspectImg,val:suspect,label:"suspect"});
  if(barang)  entries.push({img:barangImg,val:barang,label:"barang"});
  if(!entries.length) return;

  showOverlay("loading","Memuat foto…");
  imgOverlay.classList.remove("hidden");
  if(indikasiEl){
    indikasiEl.textContent=indikasi||"";
    indikasiEl.classList.toggle("hidden",!indikasi);
  }
  if(suspectImg) suspectImg.removeAttribute("src");
  if(barangImg)  barangImg.removeAttribute("src");

  let pending=entries.length;
  const done=()=>{ pending--; if(pending<=0) overlay?.classList.add("hidden"); };

  entries.forEach(({img,val,label})=>{
    if(!img){ done(); return; }
    val=normalizeDriveUrl(stripImageFormula(val));
    let final="";
    if(isDirectUrl(val)){
      final=val;
    }else if(looksLikeFileId(val)){
      final=`${LOOKUP_URL}?action=photoraw&token=${encodeURIComponent(SHARED_TOKEN)}&id=${encodeURIComponent(val)}`;
    }else{
      final=`${LOOKUP_URL}?action=get_photo&token=${encodeURIComponent(SHARED_TOKEN)}&id=${encodeURIComponent(val)}`;
    }
    console.log(`URL foto ${label}:`, final);
    img.onload=()=>{ done(); img.onload=img.onerror=null; };
    img.onerror=()=>{ done(); img.onload=img.onerror=null; showOverlay("err","Gagal memuat foto","Coba lagi"); };
    img.src=final+(final.includes("?")?"&":"?")+"t="+Date.now();
  });
}
imgClose?.addEventListener("click",()=>imgOverlay?.classList.add("hidden"));
imgOverlay?.addEventListener("click",(e)=>{ if(e.target===imgOverlay) imgOverlay.classList.add("hidden"); });
document.addEventListener("keydown",(e)=>{ if(e.key==="Escape") imgOverlay?.classList.add("hidden"); });

function renderSuspectList(rows){
  if(!bagasiList) return; bagasiList.innerHTML="";
  rows.forEach(it=>{
    const bagNo   = it.nomorBagasi || "-";
    const flight  = it.flight      || "-";
    const dest    = it.tujuan      || "-";
    const dep     = flightTimes[flight.toUpperCase()] || "-";
    const sUrl    = it.fotoSuspectUrl || it.fotoSuspectId || "";
    const bUrl    = it.fotoBarangUrl  || it.fotoBarangId  || "";
    const indikasi= it.indikasi || it.indikasiSuspect || "";

    const tr=document.createElement("tr");
    tr.dataset.suspect=sUrl;
    tr.dataset.barang=bUrl;
    tr.dataset.indikasi=indikasi;
    tr.title = indikasi ? `Indikasi: ${indikasi}` : "";
    tr.innerHTML=`<td>${bagNo}</td><td>${flight}</td><td>${dest}</td><td>${dep}</td>`;
    const open=()=>openPhoto(tr.dataset.suspect,tr.dataset.barang,tr.dataset.indikasi);
    tr.addEventListener("click",open);
    tr.addEventListener("contextmenu",e=>{e.preventDefault();open();});
    let timer;
    tr.addEventListener("pointerdown",()=>{timer=setTimeout(open,600);});
    ["pointerup","pointerleave","pointercancel"].forEach(ev=>tr.addEventListener(ev,()=>clearTimeout(timer)));
    bagasiList.appendChild(tr);
  });
}

async function loadSuspectList(){
  try{
    await loadFlightTimes();
    const url = `${LOOKUP_URL}?action=list_suspect&token=${encodeURIComponent(SHARED_TOKEN)}&limit=200`;
    const r = await fetch(url, { method:"GET", mode:"cors" });
    const j = await r.json().catch(()=>({}));
    if (j?.ok && Array.isArray(j.rows)) renderSuspectList(j.rows);
  }catch(err){ console.error(err); }
}

/* ===== UI ===== */
function updateTipePiVisibility(){
  const t=val(tindakanSel).toLowerCase();
  const need=(mode==="PSCP"&&val(objekSel)==="barang"&&t==="ditinggal")||(mode==="HBSCP"&&t==="ditinggal");
  tipePiField?.classList.toggle("hidden",!need);
}
function updateBarangCard(){
  if(!barangCard) return;
  if(mode==="PSCP"){
    if(val(objekSel)==="barang"){ barangCard.classList.remove("hidden"); tindakanField?.classList.remove("hidden"); updateTipePiVisibility(); }
    else { barangCard.classList.add("hidden"); resetFoto(); }
  }else if(mode==="HBSCP"){
    barangCard.classList.remove("hidden"); tindakanField?.classList.remove("hidden"); updateTipePiVisibility();
  }else{
    barangCard.classList.remove("hidden"); tindakanField?.classList.add("hidden"); tipePiField?.classList.add("hidden");
  }
}
objekSel?.addEventListener("change",updateBarangCard);
tindakanSel?.addEventListener("change",updateTipePiVisibility);

function setMode(m){
  mode=m;
  btnPSCP?.classList.toggle("active",m==="PSCP");
  btnHBSCP?.classList.toggle("active",m==="HBSCP");
  btnCARGO?.classList.toggle("active",m==="CARGO");
  stopScan?.();

  if(namaEl) namaEl.textContent="-";
  if(flightEl) flightEl.textContent="-";
  if(manualNama) manualNama.value="";
  if(manualFlight) manualFlight.value="";
  if(metodeSel) metodeSel.value="";
  if(isiBarangInp) isiBarangInp.value="";
  if(tindakanSel) tindakanSel.value="";
  if(tipePiSel) tipePiSel.value="";
  resetFoto(); resetBagasiCard(); setSupervisor();

  bagasiCard?.classList.toggle("hidden", m!=="HBSCP");
  bagasiListCard?.classList.toggle("hidden", m!=="HBSCP");
  if(m==="HBSCP") loadSuspectList();

  if(m==="PSCP"){
    scanBtn?.classList.remove("hidden"); scanResult?.classList.remove("hidden");
    manualForm?.classList.add("hidden"); if(manualNamaLabel) manualNamaLabel.textContent="Nama Penumpang";
    objekField?.classList.remove("hidden"); if(objekSel) objekSel.value=""; updateBarangCard();
  }else if(m==="HBSCP"){
    scanBtn?.classList.remove("hidden"); scanResult?.classList.remove("hidden");
    manualForm?.classList.add("hidden"); if(manualNamaLabel) manualNamaLabel.textContent="Nama Penumpang";
    objekField?.classList.add("hidden"); updateBarangCard();
  }else{
    scanBtn?.classList.add("hidden"); scanResult?.classList.add("hidden");
    manualForm?.classList.remove("hidden"); if(manualNamaLabel) manualNamaLabel.textContent="Nama Pengirim";
    objekField?.classList.add("hidden"); updateBarangCard();
  }
}
btnPSCP?.addEventListener("click",()=>setMode("PSCP"));
btnHBSCP?.addEventListener("click",()=>setMode("HBSCP"));
btnCARGO?.addEventListener("click",()=>setMode("CARGO"));

/* ===== SCANNER ===== */
let activeScanBtn=scanBtn;
let scanTarget="boarding";
let scanState={stream:null,video:null,canvas:null,ctx:null,running:false,usingDetector:false,detector:null,jsQRReady:false,overlay:null,closeBtn:null};

function splitFromBack(str,maxSplits){
  const parts=[]; let r=str;
  for(let i=0;i<maxSplits;i++){ const j=r.lastIndexOf(' '); if(j===-1) break; parts.unshift(r.slice(j+1)); r=r.slice(0,j); }
  parts.unshift(r); return parts;
}
function parseBoardingPass(data){
  if(!data||typeof data!=="string"||!data.startsWith("M1")) return null;
  const parts=splitFromBack(data,5); if(parts.length<6) return null;
  const namaRaw=parts[0].substring(2);
  const slash=namaRaw.indexOf('/');
  const fullName=(slash===-1)?namaRaw.replace(/_/g,' ').trim():(namaRaw.substring(slash+1)+' '+namaRaw.substring(0,slash)).replace(/_/g,' ').trim();
  const airlineCode=parts[2].slice(-2); const flightNumber=parts[3];
  return { fullName, flight:`${airlineCode}${flightNumber}`.replace(/\s+/g,'') };
}

/* === BAG TAG BSM PARSER === */
function normalizeSlashName(s){
  s=String(s||"").trim().replace(/\s+/g," ");
  const [last="",first=""]=s.split("/");
  const f=first.replace(/_/g," ").trim();
  const l=last.replace(/_/g," ").trim();
  return (f+" "+l).trim();
}
function parseBagTagBSM(str){
  const p=String(str||"").split("|");
  const tagNo=(p[0]||"").trim().replace(/\D/g,"");
  const paxName=normalizeSlashName(p[1]||"").toUpperCase();
  const seg=(p[3]||"").split(";").map(x=>x.trim());
  const origin=(seg[0]||"").toUpperCase();
  const flightRaw=(seg[1]||"").toUpperCase();
  const flight=flightRaw.replace(/\s+/g,"");
  const date=(seg[2]||"").toUpperCase();
  const dest=((p[7]||"").trim().toUpperCase()) || "";
  return { tagNo, paxName, origin, flight, date, dest };
}

function receiveBarcode(payload){
  try{
    let data=payload;
    if(typeof payload==="string"){ try{ const j=JSON.parse(payload); if(j&&j.data) data=j.data; }catch{} }
    if(!data||typeof data!=="string") return;
    const parsed=parseBoardingPass(data);
    if(parsed){
      if(namaEl)   namaEl.textContent=parsed.fullName.toUpperCase();
      if(flightEl) flightEl.textContent=parsed.flight.toUpperCase();
      scanResult?.classList.remove("hidden");
      manualForm?.classList.add("hidden");
    }
  }catch(e){ console.error(e); }
}
function receiveBagBarcode(data){
  try{
    const s=(typeof data==="string"?data:String(data)).trim();
    const { tagNo, paxName, flight, dest, date } = parseBagTagBSM(s);
    if(tagNo && bagNoEl)        bagNoEl.textContent = tagNo;
    if(paxName && bagNamaEl)    bagNamaEl.textContent = paxName;
    if(flight && bagFlightBagEl)bagFlightBagEl.textContent = flight;
    if(dest && bagDestEl)       bagDestEl.textContent = dest;
    if(bagDateEl)               bagDateEl.textContent = date || new Date().toLocaleDateString("id-ID");
  }catch(e){ console.error(e); }
}
window.receiveBarcode=receiveBarcode;
window.receiveBagBarcode=receiveBagBarcode;

function setWaitingUI(on){ if(!activeScanBtn) return; activeScanBtn.classList.toggle("is-waiting",!!on); activeScanBtn.disabled=!!on; activeScanBtn.setAttribute("aria-busy",on?"true":"false"); }
injectScanStyles();
scanBtn?.addEventListener("click",async()=>{ activeScanBtn=scanBtn; scanTarget="boarding"; if(scanState.running){await stopScan();return;} await startScan(); });
scanBagBtn?.addEventListener("click",async()=>{ activeScanBtn=scanBagBtn; scanTarget="bagasi";  if(scanState.running){await stopScan();return;} await startScan(); });

async function startScan(){
  try{
    if(scanTarget==='boarding'){ manualForm?.classList.add("hidden"); scanResult?.classList.remove("hidden"); }
    setWaitingUI(true); ensureVideo(); ensureOverlay();
    if(!scanState.video) throw new Error("Video element tidak tersedia");
    document.body.classList.add("scan-active");
    const constraints={ video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720},advanced:[{focusMode:"continuous"}]}, audio:false };
    if(!navigator.mediaDevices?.getUserMedia) throw new Error("Kamera tidak didukung");
    const stream=await navigator.mediaDevices.getUserMedia(constraints);
    scanState.stream=stream; const vid=scanState.video; if(!vid) throw new Error("Video element hilang");
    vid.srcObject=stream; await vid.play();

    scanState.usingDetector=false; scanState.detector=null;
    if("BarcodeDetector" in window){
      try{
        const supported=await window.BarcodeDetector.getSupportedFormats();
        const wanted=['pdf417','aztec','qr_code','data_matrix'];
        const formats=wanted.filter(f=>supported.includes(f));
        if(formats.length){ scanState.detector=new window.BarcodeDetector({formats}); scanState.usingDetector=true; }
      }catch{}
    }
    scanState.running=true;
    if(scanState.usingDetector) detectLoop_BarcodeDetector();
    else { await ensureJsQR(); prepareCanvas(); detectLoop_jsQR(); }
  }catch(err){
    console.error(err); setWaitingUI(false);
    showOverlay('err','Tidak bisa mengakses kamera', err?.message||String(err));
    await stopScan();
  }
}
async function stopScan(){
  scanState.running=false;
  if(scanState.stream){ for(const t of scanState.stream.getTracks()){ try{t.stop();}catch{} } }
  scanState.stream=null;
  if(scanState.video){ scanState.video.srcObject=null; scanState.video.remove(); scanState.video=null; }
  if(scanState.canvas){ scanState.canvas.remove(); scanState.canvas=null; scanState.ctx=null; }
  document.body.classList.remove("scan-active"); setWaitingUI(false);
}
function ensureVideo(){ if(scanState.video) return; const v=document.createElement("video"); v.setAttribute("playsinline",""); v.muted=true; v.autoplay=true; v.id="scan-video"; document.body.appendChild(v); scanState.video=v; }
function ensureOverlay(){
  if(scanState.overlay) return;
  const el=document.createElement("div"); el.id="scan-overlay";
  el.innerHTML=`<div class="scan-topbar"><button id="scan-close" class="scan-close" aria-label="Tutup pemindaian">✕</button></div>
  <div class="scan-reticle" aria-hidden="true"></div><div class="scan-hint">Arahkan ke barcode / QR</div>`;
  document.body.appendChild(el); scanState.overlay=el;
  scanState.closeBtn=el.querySelector("#scan-close");
  scanState.closeBtn.addEventListener("click",async(e)=>{ e.preventDefault(); e.stopPropagation(); await stopScan();
    if(scanTarget==='boarding'){ manualForm?.classList.remove("hidden"); scanResult?.classList.add("hidden"); manualNama?.focus(); }
  });
}
function prepareCanvas(){ if(scanState.canvas) return; const c=document.createElement("canvas"); c.id="scan-canvas"; c.width=640; c.height=480; document.body.appendChild(c); scanState.canvas=c; scanState.ctx=c.getContext("2d",{willReadFrequently:true}); }
async function ensureJsQR(){ if(scanState.jsQRReady) return; await new Promise((res,rej)=>{ const s=document.createElement("script"); s.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'; s.onload=res; s.onerror(()=>rej(new Error("Gagal memuat jsQR"))); document.head.appendChild(s); }); scanState.jsQRReady=true; }
function detectLoop_BarcodeDetector(){
  const loop=async()=>{ if(!scanState.running||!scanState.video) return;
    try{
      const codes=await scanState.detector.detect(scanState.video);
      if(codes?.length){ const v=(codes[0].rawValue||'').trim(); if(v){ await stopScan(); (scanTarget==='bagasi'?receiveBagBarcode:receiveBarcode)(v); return; } }
    }catch(e){
      if(!scanState.canvas){ try{ await ensureJsQR(); prepareCanvas(); scanState.usingDetector=false; detectLoop_jsQR(); return; }catch{} }
    }
    if(scanState.running) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function detectLoop_jsQR(){
  const loop=()=>{ if(!scanState.running||!scanState.video) return;
    const vid=scanState.video; const cw=(scanState.canvas.width=vid.videoWidth||640); const ch=(scanState.canvas.height=vid.videoHeight||480);
    scanState.ctx.drawImage(vid,0,0,cw,ch);
    const img=scanState.ctx.getImageData(0,0,cw,ch);
    const result=window.jsQR?window.jsQR(img.data,cw,ch,{inversionAttempts:"dontInvert"}):null;
    if(result?.data){ stopScan().then(()=> (scanTarget==='bagasi'?receiveBagBarcode:receiveBarcode)(result.data)); return; }
    if(scanState.running) requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function injectScanStyles(){
  if(document.getElementById("scan-style")) return;
  const css=`.is-waiting{opacity:.7;pointer-events:none}
  body.scan-active{background:#000;overscroll-behavior:contain}
  body.scan-active .app-bar,body.scan-active .container{display:none!important}
  #scan-video,#scan-canvas{position:fixed;inset:0;width:100vw;height:100vh;display:none;background:#000;z-index:9998}
  body.scan-active #scan-video{display:block;object-fit:cover}
  body.scan-active #scan-canvas{display:none}
  #scan-overlay{position:fixed;inset:0;display:none;z-index:10000;pointer-events:none}
  body.scan-active #scan-overlay{display:block}
  .scan-topbar{position:absolute;top:0;left:0;right:0;height:max(56px,calc(44px + env(safe-area-inset-top,0)));display:flex;align-items:flex-start;justify-content:flex-end;padding:calc(env(safe-area-inset-top,0)+6px) 10px 8px;background:linear-gradient(to bottom,rgba(0,0,0,.5),rgba(0,0,0,0));pointer-events:none}
  .scan-close{pointer-events:auto;width:42px;height:42px;border-radius:999px;background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.25);font-size:22px;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.35)}
  .scan-reticle{position:absolute;top:50%;left:50%;width:min(68vw,520px);aspect-ratio:1/1;transform:translate(-50%,-50%);border-radius:16px;box-shadow:0 0 0 9999px rgba(0,0,0,.28) inset;pointer-events:none;
  background:linear-gradient(#fff,#fff) left top/28px 2px no-repeat,linear-gradient(#fff,#fff) left top/2px 28px no-repeat,linear-gradient(#fff,#fff) right top/28px 2px no-repeat,linear-gradient(#fff,#fff) right top/2px 28px no-repeat,linear-gradient(#fff,#fff) left bottom/28px 2px no-repeat,linear-gradient(#fff,#fff) left bottom/2px 28px no-repeat,linear-gradient(#fff,#fff) right bottom/28px 2px no-repeat,linear-gradient(#fff,#fff) right bottom/2px 28px no-repeat}
  .scan-hint{position:absolute;left:50%;bottom:max(18px,calc(16px + env(safe-area-inset-bottom,0)));transform:translateX(-50%);background:rgba(0,0,0,.55);color:#fff;font-weight:600;padding:8px 12px;border-radius:999px}`;
  const st=document.createElement("style"); st.id="scan-style"; st.textContent=css; document.head.appendChild(st);
}

/* =========================================================
   SUBMIT LOGIC (selaras code.gs terbaru)
   ========================================================= */
function getNameAndFlight(){
  if(mode==="CARGO") return { nama:val(manualNama).toUpperCase(), flight:val(manualFlight).toUpperCase() };
  const usingManual=!scanResult||scanResult.classList.contains("hidden");
  return { nama:(usingManual?val(manualNama):txt(namaEl)).toUpperCase(), flight:(usingManual?val(manualFlight):txt(flightEl)).toUpperCase() };
}
async function fetchJSON(u,opts={},timeoutMs=15000){
  const c=new AbortController(); const t=setTimeout(()=>c.abort(),timeoutMs);
  try{
    const r=await fetch(u,{...opts,signal:c.signal,mode:"cors"}); const tx=await r.text();
    let d={}; try{ d=tx?JSON.parse(tx):{}; }catch{ d={raw:tx}; }
    if(!r.ok) throw new Error(d?.error||`HTTP ${r.status}`); return d;
  }finally{ clearTimeout(t); }
}

async function submitRandom(){
  try{
    submitBtn.disabled=true; submitBtn.setAttribute("aria-busy","true");
    showOverlay("spinner","Mengirim data…","");

    const { nama, flight } = getNameAndFlight();
    const jenisBarang=val(isiBarangInp).toUpperCase();
    const tindakan=val(tindakanSel).toLowerCase();
    const tipePi=val(tipePiSel).toUpperCase();
    const petugas=val(petugasInp).toUpperCase();
    const supervisor=val(supervisorInp).toUpperCase();
    const metode=val(metodeSel).toUpperCase();
    const objek=val(objekSel).toUpperCase();

    if(!nama) throw new Error("Nama tidak boleh kosong.");
    if(!flight) throw new Error("Flight tidak boleh kosong.");
    if(mode==="PSCP" && val(objekSel)==="") throw new Error("Pilih objek pemeriksaan.");
    if((mode==="PSCP" && val(objekSel)==="barang") || mode!=="PSCP"){ if(!jenisBarang) throw new Error("Isi/Jenis barang belum diisi."); }
    if(!metode) throw new Error("Metode pemeriksaan belum dipilih.");

    const payload={ action:"submit", token:SHARED_TOKEN, target:mode, data:{
      nama, flight, ...(mode==="PSCP"?{objekPemeriksaan:objek||""}:{}) , jenisBarang, petugas, metode, supervisor, ...(fotoDataUrl?{fotoDataUrl}:{} )
    }};

    if((mode==="PSCP"||mode==="HBSCP") && tindakan==="ditinggal"){
      payload.data.tindakanBarang="ditinggal";
      payload.data.namaBarang=jenisBarang;
      payload.data.jenisDGDA=tipePi;
      if(fotoDataUrl) payload.data.fotoPiDataUrl=fotoDataUrl;
    }else if(mode!=="CARGO"){
      payload.data.tindakanBarang=tindakan;
    }

    const j=await fetchJSON(PROXY_URL,{ method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(payload), credentials:"omit" });
    if(!j?.ok) throw new Error(j?.error||"Gagal menyimpan");
    showOverlay("ok","Data tersimpan", `Sheet ${j.targetSheet} (row ${j.targetRow})${j.piListWritten?` + PI_LIST (row ${j.piListRow})`:""}`);

    if(mode==="CARGO"){ manualNama.value=""; manualFlight.value=""; }
    else { if(namaEl) namaEl.textContent="-"; if(flightEl) flightEl.textContent="-"; }
    isiBarangInp && (isiBarangInp.value=""); tindakanSel && (tindakanSel.value=""); tipePiSel && (tipePiSel.value="");
    if(mode==="PSCP" && objekSel) objekSel.value="";
    resetFoto(); updateBarangCard();

  }catch(err){
    console.error(err); showOverlay("err","Gagal", err?.message||String(err));
  }finally{
    submitBtn.disabled=false; submitBtn.setAttribute("aria-busy","false");
  }
}
submitBtn?.addEventListener("click",(e)=>{ e.preventDefault(); if(!submitBtn.disabled) submitRandom(); });

/* ---- Submit SUSPECT HBSCP ---- */
async function submitSuspectHBSCP(){
  try{
    if(mode!=="HBSCP"){ alert("Menu SUSPECT hanya di HBSCP."); return; }
    const nomorBagasi=(bagNoEl?.textContent||"").trim().toUpperCase();
    const namaPemilik=(bagNamaEl?.textContent||"").trim().toUpperCase();
    const flight=(bagFlightBagEl?.textContent||"").trim().toUpperCase();
    const tujuan=(bagDestEl?.textContent||"").trim().toUpperCase();
    const indikasi=(bagIndikasiInp?.value||"").trim().toUpperCase();
    const petugas=val(petugasInp).toUpperCase();
    if(!nomorBagasi||!namaPemilik||!flight||!tujuan) throw new Error("Data suspect belum lengkap.");
    showOverlay("spinner","Menyimpan suspect…","");
    const payload={ action:"submit", token:SHARED_TOKEN, target:"SUSPECT_HBSCP", data:{
      flight, petugas, nomorBagasi, namaPemilik, tujuan, indikasi,
      ...(bagFotoSuspectDataUrl?{fotoSuspectDataUrl:bagFotoSuspectDataUrl}:{ }),
      ...(bagFotoBarangDataUrl ?{fotoBarangDataUrl :bagFotoBarangDataUrl }:{ })
    }};
    const j=await fetchJSON(PROXY_URL,{ method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(payload), credentials:"omit" });
    if(!j?.ok) throw new Error(j?.error||"Gagal menyimpan suspect");
    showOverlay("ok","Suspect tersimpan", `Row ${j.targetRow||"-"}`);
    resetBagasiCard(); loadSuspectList();
  }catch(err){
    console.error(err); showOverlay("err","Gagal simpan suspect", err?.message||String(err));
  }
}
bagSubmitBtn?.addEventListener("click",(e)=>{ e.preventDefault(); submitSuspectHBSCP(); });

setMode("PSCP");
