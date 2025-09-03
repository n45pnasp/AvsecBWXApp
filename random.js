// random.js — FINAL (Safari/iOS → ZXing; lainnya → BarcodeDetector/jsQR, sinkron code.gs + aksi suspect)
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
const scanCard=$("#scanCard"),scanBtn=$("#scanBtn"),scanResult=$("#scanResult");
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
const bagasiCard=$("#bagasiCard"),bagasiListCard=$("#bagasiListCard"),bagasiToggle=$("#bagasiToggle");
const scanBagBtn=$("#scanBagBtn");
const bagNoEl=$("#bagNo"),bagNamaEl=$("#bagNama"),bagFlightBagEl=$("#bagFlight"),
      bagDestEl=$("#bagDest"),bagDateEl=$("#bagDate");
const bagFotoLayarBtn=$("#bagFotoLayarBtn"),bagFotoLayarInput=$("#bagFotoLayarInput"),
      bagFotoLayarPreview=$("#bagFotoLayarPreview");
const bagFotoBarangBtn=$("#bagFotoBarangBtn"),bagFotoBarangInput=$("#bagFotoBarangInput"),
      bagFotoBarangPreview=$("#bagFotoBarangPreview");
const bagSubmitBtn=$("#bagSubmitBtn");
const bagSubmitAksiBtn=$("#bagSubmitAksiBtn");
const bagasiList=$("#bagasiList");
const bagIndikasiInp=$("#bagIndikasi");
bagasiToggle?.addEventListener("click",()=>{
  bagasiCard?.classList.toggle("collapsed");
  const exp=!bagasiCard.classList.contains("collapsed");
  bagasiToggle.setAttribute("aria-expanded",exp);
  const chev=bagasiToggle.querySelector(".chevron");
  if(chev) chev.textContent=exp?"▲":"▼";
  if(exp){ hbsCardsVisible=false; scanCard?.classList.add("hidden"); barangCard?.classList.add("hidden"); }
});

document.addEventListener("copy",e=>e.preventDefault());

// modal foto suspect/barang
const imgOverlay=$("#photoOverlay"),imgClose=$("#photoClose"),suspectImg=$("#suspectPhoto"),barangImg=$("#barangPhoto"),indikasiEl=$("#indikasiText");
const delOverlay=$("#deleteOverlay"),delClose=$("#deleteClose"),delConfirm=$("#deleteConfirm"),delAction=$("#deleteAction"),delMsg=$("#deleteMsg");
let deleteTarget=null;

const petugasInp=$("#petugas"),supervisorInp=$("#supervisor"),submitBtn=$("#submitBtn");
const overlay=$("#overlay"),ovIcon=$("#ovIcon"),ovTitle=$("#ovTitle"),ovDesc=$("#ovDesc"),ovClose=$("#ovClose");

/* ===== AUTH ===== */
const { app, auth } = getFirebase();
const db = getDatabase(app);
onAuthStateChanged(auth,(u)=>{
  const name=(u?.displayName||u?.email||"").toUpperCase();
  if(petugasInp) petugasInp.value=name;
});

/* ===== OVERLAY & ALERT ===== */
ovClose?.addEventListener("click",()=>overlay?.classList.add("hidden"));
function showOverlay(state,title="",desc=""){
  const isSpin = (state === "spinner" || state === "loading");
  overlay?.classList.remove("hidden");
  if(ovIcon) ovIcon.className = "icon " + (isSpin ? "spinner" : state);
  if(ovTitle) ovTitle.textContent = title;
  if(ovDesc) ovDesc.textContent = desc;
  ovClose?.classList.toggle("hidden", isSpin);
  if(!isSpin){ setTimeout(()=>overlay?.classList.add("hidden"), state==="stop"?3500:1500); }
}
function showAlert(msg, title="Perhatian"){ showOverlay("stop", title, msg); }

/* ===== STATE & SUPERVISOR ===== */
let mode="PSCP";
let hbsCardsVisible=false;
let selectedSuspect=null; // { rowItems, bagNo, flight, expectedName }
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
    if(d.length>200_000){ showAlert("Foto terlalu besar, turunkan resolusi."); resetFoto(); }
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
    if(d.length>200_000){ showAlert("Foto terlalu besar."); resetBagFotoLayar(); }
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
    if(d.length>200_000){ showAlert("Foto terlalu besar."); resetBagFotoBarang(); }
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
  if(m){ return `${m[1].padStart(2,"0")}:${m[2].padStart(2,"0")} WIB`; }
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
function stripImageFormula(s){ const m=String(s||"").match(/^=?IMAGE\(["'](.+?)["']\)$/i); return m?m[1]:s; }
function normalizeDriveUrl(u){ const m=String(u||"").match(/(?:id=|\/d\/)([A-Za-z0-9_-]{20,})/); return m?`https://lh3.googleusercontent.com/d/${m[1]}`:u; }
function extractIndikasi(norm){
  const keys=Object.keys(norm||{}); let key=keys.find(k=>k.includes("indikasi")&&(k.includes("suspect")||k.includes("suspek")));
  if(!key) key="indikasi"; return String(norm[key]||"").trim();
}

async function openPhoto(suspect, barang, indikasi="", bagNo="", rowItems=""){
  if(!imgOverlay) return;
  showOverlay("loading","Memuat foto…");
  imgOverlay.classList.remove("hidden");

  if(!indikasi && (bagNo || rowItems)){
    try{
      const url=`${LOOKUP_URL}?action=list_suspect&token=${encodeURIComponent(SHARED_TOKEN)}&limit=200`;
      const r=await fetch(url,{method:"GET",mode:"cors"});
      const j=await r.json().catch(()=>({}));
      if(j?.ok && Array.isArray(j.rows) && j.rows.length){
        const bUpper=bagNo.toUpperCase(), ri=Number(rowItems||0);
        let found=null;
        for(const raw of j.rows){
          const norm={}; for(const k in raw){ norm[k.replace(/[^a-z0-9]/gi,"").toLowerCase()]=raw[k]; }
          const bagMatch=String(norm.bagno||norm.nomorbagasi||norm.nobagasi||"").trim().toUpperCase();
          const rowMatch=Number(raw.rowItems||raw.rowitems||norm.rowitems||0);
          if((ri && rowMatch===ri) || (bUpper && bagMatch===bUpper)){ found=norm; break; }
        }
        if(!found){ const first={}; for(const k in j.rows[0]){first[k.replace(/[^a-z0-9]/gi,"").toLowerCase()]=j.rows[0][k];} found=first; }
        indikasi = extractIndikasi(found);
      }
    }catch(err){ console.error(err); }
  }

  const entries=[]; if(suspect) entries.push({img:suspectImg,val:suspect}); if(barang) entries.push({img:barangImg,val:barang});
  if(!entries.length) return;

  if(indikasiEl){ indikasiEl.textContent = `INDIKASI SUSPECT: ${indikasi || '-'}`; indikasiEl.classList.remove("hidden"); }
  if(suspectImg) suspectImg.removeAttribute("src");
  if(barangImg)  barangImg.removeAttribute("src");

  let pending=entries.length;
  const done=()=>{ pending--; if(pending<=0) overlay?.classList.add("hidden"); };

  entries.forEach(({img,val})=>{
    if(!img){ done(); return; }
    val=normalizeDriveUrl(stripImageFormula(val));
    let final="";
    if(isDirectUrl(val)) final=val;
    else if(looksLikeFileId(val)) final=`${LOOKUP_URL}?action=photoraw&token=${encodeURIComponent(SHARED_TOKEN)}&id=${encodeURIComponent(val)}`;
    else final=`${LOOKUP_URL}?action=get_photo&token=${encodeURIComponent(SHARED_TOKEN)}&id=${encodeURIComponent(val)}`;
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
    const norm={}; for(const k in it){ norm[k.replace(/[^a-z0-9]/gi,"").toLowerCase()] = it[k]; }
    const aksi=(norm.aksi||norm.action||"").trim(); if(aksi) return;
    const bagNo  = norm.bagno || norm.nomorbagasi || norm.nobagasi || "-";
    const rowItems = Number(it.rowItems || it.rowitems || 0);
    const flight = norm.flight || "-";
    const dest   = norm.tujuan || "-";
    const dep    = flightTimes[String(flight).toUpperCase()] || "-";
    const sUrl   = norm.fotosuspecturl || norm.fotosuspectid || "";
    const bUrl   = norm.fotobarangurl  || norm.fotobarangid  || "";
    const owner  = norm.namapemilik || norm.nama || "";
    const indikasi = extractIndikasi(norm);

    const tr=document.createElement("tr");
    tr.dataset.suspect=sUrl; tr.dataset.barang=bUrl; tr.dataset.indikasi=indikasi;
    tr.dataset.bagno=bagNo; tr.dataset.rowitems=String(rowItems); tr.dataset.flight=flight; tr.dataset.nama=owner;
    tr.title = indikasi ? `Indikasi: ${indikasi}` : "";
    tr.innerHTML=`<td>${bagNo}</td><td>${flight}</td><td>${dest}</td><td>${dep}</td>`;

    let timer; let longPress=false;
    tr.addEventListener("pointerdown",()=>{ longPress=false; timer=setTimeout(()=>{ longPress=true; showDeleteModal(tr); },600); });
    ["pointerup","pointerleave","pointercancel"].forEach(ev=>tr.addEventListener(ev,()=>{ if(timer) clearTimeout(timer); }));
    tr.addEventListener("click",()=>{ if(longPress) return;
      openPhoto(tr.dataset.suspect,tr.dataset.barang,tr.dataset.indikasi,tr.dataset.bagno,tr.dataset.rowitems);
    });
    tr.addEventListener("contextmenu",e=>{ e.preventDefault(); if(timer) clearTimeout(timer); longPress=true; showDeleteModal(tr); });
    bagasiList.appendChild(tr);
  });
}

function showDeleteModal(row){
  deleteTarget=row;
  const bagNo=row?.dataset?.bagno||"";
  if(delMsg) delMsg.textContent=`Anda yakin akan menghapus data suspect dengan no. bagasi ${bagNo}?`;
  delOverlay?.classList.remove("hidden");
}
delClose?.addEventListener("click",()=>delOverlay?.classList.add("hidden"));
async function deleteSuspect(){
  if(!deleteTarget) return;
  try{
    const bagNo=deleteTarget.dataset.bagno||"";
    delOverlay?.classList.add("hidden");
    showOverlay("spinner","Menghapus suspect…","" );
    const payload={action:"delete_suspect",token:SHARED_TOKEN,bagNo};
    const j=await fetchJSON(PROXY_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload),credentials:"omit"});
    if(!j?.ok) throw new Error(j?.error||"Gagal menghapus");
    showOverlay("ok","Data terhapus","");
    loadSuspectList();
  }catch(err){ console.error(err); showOverlay("err","Gagal hapus",err?.message||"Gagal"); }
}
delConfirm?.addEventListener("click",deleteSuspect);

async function markAksi(){
  if(!deleteTarget) return;
  selectedSuspect = {
    rowItems: Number(deleteTarget.dataset.rowitems || 0),
    bagNo: deleteTarget.dataset.bagno || "",
    flight: deleteTarget.dataset.flight || "",
    expectedName: (deleteTarget.dataset.nama || "").toUpperCase()
  };
  delOverlay?.classList.add("hidden");
  hbsCardsVisible=true;
  scanCard?.classList.remove("hidden");
  barangCard?.classList.remove("hidden");
  scanResult?.classList.remove("hidden");
  manualForm?.classList.add("hidden");
  if(flightEl) flightEl.textContent = selectedSuspect.flight || "-";
  if(namaEl) namaEl.textContent = "-";
  bagasiCard?.classList.add("collapsed");
  bagasiToggle?.setAttribute("aria-expanded","false");
  const chev=bagasiToggle?.querySelector(".chevron"); if(chev) chev.textContent="▼";
  updateBarangCard();
}
delAction?.addEventListener("click",markAksi);

async function loadSuspectList(){
  showOverlay("spinner","Memuat daftar suspect…"," ");
  try{
    await loadFlightTimes();
    const url = `${LOOKUP_URL}?action=list_suspect&token=${encodeURIComponent(SHARED_TOKEN)}&limit=200`;
    const r = await fetch(url, { method:"GET", mode:"cors" });
    const j = await r.json().catch(()=>({}));
    if (j?.ok && Array.isArray(j.rows)) renderSuspectList(j.rows);
  }catch(err){ console.error(err); }
  finally{ overlay?.classList.add("hidden"); }
}

/* ===== UI ===== */
function setAksiOptions(opts){
  if(!tindakanSel) return;
  tindakanSel.innerHTML = '<option value="">Pilih</option>' + opts.map(o=>`<option>${o}</option>`).join('');
}
function updateAksiVisibility(){
  if(mode==="PSCP"){
    const showTindakan = val(objekSel)==="barang";
    tindakanField?.classList.toggle("hidden",!showTindakan);
    if(!showTindakan) tindakanSel.value="";
    const showPi = showTindakan && val(tindakanSel).toLowerCase()==="ditinggal";
    tipePiField?.classList.toggle("hidden",!showPi);
    if(!showPi) tipePiSel.value="";
  }else if(mode==="HBSCP"){
    const showPi = val(tindakanSel).toLowerCase()==="ditinggal";
    tipePiField?.classList.toggle("hidden",!showPi);
    if(!showPi) tipePiSel.value="";
  }
}
function updateBarangCard(){
  if(!barangCard) return;
  if(mode==="PSCP"){
    if(val(objekSel)==="barang"){ barangCard.classList.remove("hidden"); tindakanField?.classList.remove("hidden"); tipePiField?.classList.add("hidden"); }
    else { barangCard.classList.add("hidden"); resetFoto(); }
  }else if(mode==="HBSCP"){
    if(hbsCardsVisible){ barangCard.classList.remove("hidden"); }
    else { barangCard.classList.add("hidden"); }
    tindakanField?.classList.remove("hidden");
    tipePiField?.classList.add("hidden");
  }else{
    barangCard?.classList.remove("hidden"); tindakanField?.classList.add("hidden"); tipePiField?.classList.add("hidden");
  }
  updateAksiVisibility();
}
objekSel?.addEventListener("change",updateBarangCard);
tipePiSel?.addEventListener("change",updateAksiVisibility);
tindakanSel?.addEventListener("change",updateAksiVisibility);

function setMode(m){
  mode=m; selectedSuspect=null;
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
  if(m==="HBSCP"){ loadSuspectList(); bagasiCard?.classList.add("collapsed"); hbsCardsVisible=false;
    bagasiToggle?.setAttribute("aria-expanded","false");
    const chev=bagasiToggle?.querySelector(".chevron"); if(chev) chev.textContent="▼"; }

  if(m==="PSCP"){
    setAksiOptions(["Dibawa","Ditinggal"]);
    scanCard?.classList.remove("hidden"); barangCard?.classList.remove("hidden");
    scanBtn?.classList.remove("hidden"); scanResult?.classList.remove("hidden");
    manualForm?.classList.add("hidden"); if(manualNamaLabel) manualNamaLabel.textContent="Nama Penumpang";
    objekField?.classList.remove("hidden"); if(objekSel) objekSel.value=""; updateBarangCard();
  }else if(m==="HBSCP"){
    setAksiOptions(["Dibawa","Ditinggal","Pemilik Tidak Ada"]);
    if(!hbsCardsVisible){ scanCard?.classList.add("hidden"); barangCard?.classList.add("hidden"); }
    else { scanCard?.classList.remove("hidden"); barangCard?.classList.remove("hidden"); }
    scanBtn?.classList.remove("hidden"); scanResult?.classList.remove("hidden");
    manualForm?.classList.add("hidden"); if(manualNamaLabel) manualNamaLabel.textContent="Nama Penumpang";
    objekField?.classList.add("hidden"); updateBarangCard();
  }else{
    setAksiOptions([]);
    scanCard?.classList.remove("hidden"); barangCard?.classList.remove("hidden");
    scanBtn?.classList.add("hidden"); scanResult?.classList.add("hidden");
    manualForm?.classList.remove("hidden"); if(manualNamaLabel) manualNamaLabel.textContent="Nama Pengirim";
    objekField?.classList.add("hidden"); updateBarangCard();
  }
}
btnPSCP?.addEventListener("click",()=>setMode("PSCP"));
btnHBSCP?.addEventListener("click",()=>setMode("HBSCP"));
btnCARGO?.addEventListener("click",()=>setMode("CARGO"));

/* ===== PARSER ===== */
function splitFromBack(str,maxSplits){ const parts=[]; let r=str; for(let i=0;i<maxSplits;i++){ const j=r.lastIndexOf(' '); if(j===-1) break; parts.unshift(r.slice(j+1)); r=r.slice(0,j);} parts.unshift(r); return parts; }
function parseBoardingPass(data){
  if(!data||typeof data!=="string"||!data.startsWith("M1")) return null;
  const parts=splitFromBack(data,5); if(parts.length<6) return null;
  const namaRaw=parts[0].substring(2); const slash=namaRaw.indexOf('/');
  const fullName=(slash===-1)?namaRaw.replace(/_/g,' ').trim():(namaRaw.substring(slash+1)+' '+namaRaw.substring(0,slash)).replace(/_/g,' ').trim();
  const airlineCode=parts[2].slice(-2); const flightNumber=parts[3];
  return { fullName, flight:`${airlineCode}${flightNumber}`.replace(/\s+/g,'') };
}
function normalizeSlashName(s){ s=String(s||"").trim().replace(/\s+/g," "); const [last="",first=""]=s.split("/"); return ((first.replace(/_/g," ").trim())+" "+(last.replace(/_/g," ").trim())).trim(); }
function parseBagTagBSM(str){
  const p=String(str||"").split("|");
  const tagNo=(p[0]||"").trim().replace(/\D/g,"");
  const paxName=normalizeSlashName(p[1]||"").toUpperCase();
  const seg=(p[3]||"").split(";").map(x=>x.trim());
  const dest=(seg[0]||"").toUpperCase();
  const flightRaw=(seg[1]||"").toUpperCase();
  const flight=flightRaw.replace(/\s+/g,"");
  const date=(seg[2]||"").toUpperCase();
  return { tagNo, paxName, flight, dest, date };
}

/* ===== RECEIVE SCAN ===== */
function receiveBarcode(payload){
  try{
    let data=payload;
    if(typeof payload==="string"){ try{ const j=JSON.parse(payload); if(j&&j.data) data=j.data; }catch{} }
    if(!data||typeof data!=="string") return;
    const parsed=parseBoardingPass(data);
    if(parsed){
      const scannedName = parsed.fullName.toUpperCase();
      if(namaEl) namaEl.textContent = scannedName;
      if(mode!=="HBSCP" || !selectedSuspect?.expectedName){
        if(flightEl) flightEl.textContent = parsed.flight.toUpperCase();
      }
      scanResult?.classList.remove("hidden"); manualForm?.classList.add("hidden");
      if(mode==="HBSCP" && selectedSuspect?.expectedName){
        const expected = selectedSuspect.expectedName;
        const words = expected.split(/\s+/).filter(Boolean);
        const match = words.some(w=>scannedName.includes(w));
        if(!match){ showAlert("Boarding pass salah, harap scan ulang"); if(namaEl) namaEl.textContent = "-"; }
      }
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
window.receiveBarcode=receiveBarcode; window.receiveBagBarcode=receiveBagBarcode;

/* ===== FETCH HELPERS & SUBMIT ===== */
function setWaitingUI(on){ if(!scanBtn && !scanBagBtn) return; const btn=activeScanBtn||scanBtn; if(!btn) return; btn.classList.toggle("is-waiting",!!on); btn.disabled=!!on; btn.setAttribute("aria-busy",on?"true":"false"); }
async function fetchJSON(u,opts={},timeoutMs=15000){
  const c=new AbortController(); const t=setTimeout(()=>c.abort(),timeoutMs);
  try{ const r=await fetch(u,{...opts,signal:c.signal,mode:"cors"}); const tx=await r.text(); let d={}; try{ d=tx?JSON.parse(tx):{}; }catch{ d={raw:tx}; } if(!r.ok) throw new Error(d?.error||`HTTP ${r.status}`); return d; }
  finally{ clearTimeout(t); }
}
function getNameAndFlight(){
  if(mode==="CARGO") return { nama:val(manualNama).toUpperCase(), flight:val(manualFlight).toUpperCase() };
  const usingManual=!scanResult||scanResult.classList.contains("hidden");
  return { nama:(usingManual?val(manualNama):txt(namaEl)).toUpperCase(), flight:(usingManual?val(manualFlight):txt(flightEl)).toUpperCase() };
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
      payload.data.tindakanBarang="ditinggal"; payload.data.namaBarang=jenisBarang; payload.data.jenisDGDA=tipePi;
      if(fotoDataUrl) payload.data.fotoPiDataUrl=fotoDataUrl;
    }else if(mode!=="CARGO"){ payload.data.tindakanBarang=tindakan; }

    const j=await fetchJSON(PROXY_URL,{ method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(payload), credentials:"omit" });
    if(!j?.ok) throw new Error(j?.error||"Gagal menyimpan");
    showOverlay("ok","Data tersimpan", `Sheet ${j.targetSheet} (row ${j.targetRow})${j.piListWritten?` + PI_LIST (row ${j.piListRow})`:""}`);

    // Optional: set aksi pada suspect terpilih (HBSCP)
    if (mode==="HBSCP" && selectedSuspect?.bagNo && val(tindakanSel)) {
      try{
        await fetchJSON(PROXY_URL,{ method:"POST", headers:{ "Content-Type":"application/json" }, credentials:"omit",
          body: JSON.stringify({ action:"set_suspect_action", token:SHARED_TOKEN, bagNo:selectedSuspect.bagNo, rowItems:Number(selectedSuspect.rowItems||0), aksi: val(tindakanSel).toUpperCase() })
        });
        await loadSuspectList(); selectedSuspect=null;
      }catch(e){ console.error("Gagal set aksi suspect:", e); }
    }

    if(mode==="CARGO"){ manualNama.value=""; manualFlight.value=""; }
    else { if(namaEl) namaEl.textContent="-"; if(flightEl) flightEl.textContent="-"; }
    isiBarangInp&&(isiBarangInp.value=""); tindakanSel&&(tindakanSel.value=""); tipePiSel&&(tipePiSel.value="");
    if(mode==="PSCP" && objekSel) objekSel.value="";
    if(mode==="HBSCP"){ hbsCardsVisible=false; scanCard?.classList.add("hidden"); barangCard?.classList.add("hidden"); await loadSuspectList(); }
    resetFoto(); updateBarangCard();

  }catch(err){ console.error(err); showOverlay("err","Gagal", err?.message||String(err)); }
  finally{ submitBtn.disabled=false; submitBtn.setAttribute("aria-busy","false"); }
}
submitBtn?.addEventListener("click",(e)=>{ e.preventDefault(); if(!submitBtn.disabled) submitRandom(); });

async function submitSuspectHBSCP(){
  try{
    if(mode!=="HBSCP"){ showAlert("Menu SUSPECT hanya di HBSCP."); return; }
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
    hbsCardsVisible=false; scanCard?.classList.add("hidden"); barangCard?.classList.add("hidden");
    resetBagasiCard(); loadSuspectList();
  }catch(err){ console.error(err); showOverlay("err","Gagal simpan suspect", err?.message||String(err)); }
}
bagSubmitBtn?.addEventListener("click",(e)=>{ e.preventDefault(); submitSuspectHBSCP(); });

async function submitAksiSuspect(){
  try{
    if(mode!=="HBSCP"){ showAlert("Menu SUSPECT hanya di HBSCP."); return; }
    if(!selectedSuspect?.bagNo){ showAlert("Pilih item suspect dari daftar terlebih dahulu."); return; }
    const aksi = (val(tindakanSel) || "").trim(); if(!aksi){ showAlert("Pilih tindakan/aksi terlebih dahulu."); return; }
    showOverlay("spinner","Menyimpan aksi…","");
    const payload = { action:"set_suspect_action", token:SHARED_TOKEN, bagNo:selectedSuspect.bagNo, rowItems:Number(selectedSuspect.rowItems||0), aksi };
    const j = await fetchJSON(PROXY_URL,{ method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload), credentials:"omit" });
    if(!j?.ok) throw new Error(j?.error||"Gagal menyimpan aksi");
    showOverlay("ok","Aksi tersimpan","");
    selectedSuspect=null; tindakanSel&&(tindakanSel.value=""); if(namaEl) namaEl.textContent="-"; if(flightEl) flightEl.textContent="-";
    hbsCardsVisible=false; scanCard?.classList.add("hidden"); barangCard?.classList.add("hidden"); updateBarangCard(); await loadSuspectList();
  }catch(err){ console.error(err); showOverlay("err","Gagal simpan aksi", err?.message||"Gagal"); }
}
bagSubmitAksiBtn?.addEventListener("click",(e)=>{ e.preventDefault(); submitAksiSuspect(); });

/* ===== SCANNER (FINAL: Safari/iOS → ZXing; lainnya → BarcodeDetector/jsQR) ===== */
let activeScanBtn=scanBtn;
let scanTarget="boarding";
let scanState={stream:null,video:null,canvas:null,ctx:null,running:false,usingDetector:false,detector:null,jsQRReady:false,overlay:null,closeBtn:null};

function isSafariLike(){
  const ua = navigator.userAgent || "";
  const isIOS = /iP(hone|ad|od)/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/(Chrom(e|ium)|Edg|OPR)/i.test(ua);
  const isWebKit = /AppleWebKit/i.test(ua) && isIOS;
  return isIOS || isSafari || isWebKit;
}
function neededFormatsFor(target){ return (target==="boarding"||target==="bagasi")?["pdf417"]:["qr_code"]; }

let zxingReady=false, zxingReader=null;
async function ensureZXing(){
  if (zxingReady) return;
  await new Promise((res, rej)=>{ const s=document.createElement("script"); s.src="https://unpkg.com/@zxing/library@0.20.0"; s.onload=res; s.onerror=()=>rej(new Error("Gagal load ZXing")); document.head.appendChild(s); });
  zxingReader = new ZXing.BrowserMultiFormatReader();
  zxingReady = true;
}
async function ensureJsQR(){
  if (scanState.jsQRReady) return;
  await new Promise((res,rej)=>{ const s=document.createElement("script"); s.src='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'; s.onload=res; s.onerror=()=>rej(new Error("Gagal memuat jsQR")); document.head.appendChild(s); });
  scanState.jsQRReady=true;
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

scanBtn?.addEventListener("click",async()=>{ activeScanBtn=scanBtn; scanTarget="boarding"; if(scanState.running){await stopScan();return;} await startScan(); });
scanBagBtn?.addEventListener("click",async()=>{ activeScanBtn=scanBagBtn; scanTarget="bagasi";  if(scanState.running){await stopScan();return;} await startScan(); });

async function startScan(){
  try{
    if(scanTarget==='boarding'){ manualForm?.classList.add("hidden"); scanResult?.classList.remove("hidden"); }
    setWaitingUI(true); ensureVideo(); ensureOverlay();
    if(!scanState.video) throw new Error("Video element tidak tersedia");
    document.body.classList.add("scan-active");
    const constraints={ video:{ facingMode:{ideal:"environment"}, width:{ideal:1280}, height:{ideal:720} }, audio:false };
    if(!navigator.mediaDevices?.getUserMedia) throw new Error("Kamera tidak didukung");
    const stream=await navigator.mediaDevices.getUserMedia(constraints);
    scanState.stream=stream; const vid=scanState.video; if(!vid) throw new Error("Video element hilang");
    vid.srcObject=stream; await vid.play();

    const needed = neededFormatsFor(scanTarget);

    // Selalu gunakan ZXing jika membutuhkan PDF417
    if (needed.includes("pdf417")) {
      await ensureZXing();
      scanState.running = true;
      detectLoop_ZXing();
      return;
    }

    if (isSafariLike()) {           // Safari/iOS → ZXing
      await ensureZXing(); scanState.running = true; detectLoop_ZXing(); return;
    }

    // Chromium/Firefox desktop & Android
    scanState.usingDetector=false; scanState.detector=null;
    if ("BarcodeDetector" in window) {
      try{
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const ok = needed.every(fmt => supported.includes(fmt));
        if (ok) { scanState.detector = new window.BarcodeDetector({ formats: needed }); scanState.usingDetector = true; }
      }catch{}
    }

    scanState.running = true;
    if (scanState.usingDetector){ detectLoop_BarcodeDetector(); }
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
function detectLoop_BarcodeDetector(){
  const loop=async()=>{ if(!scanState.running||!scanState.video) return;
    try{
      const codes=await scanState.detector.detect(scanState.video);
      if(codes?.length){ const v=(codes[0].rawValue||'').trim(); if(v){ await stopScan(); (scanTarget==='bagasi'?receiveBagBarcode:receiveBarcode)(v); return; } }
    }catch(e){
      if(scanState.running){
        const needed = neededFormatsFor(scanTarget);
        try{
          if (needed.includes("pdf417")){ await ensureZXing(); detectLoop_ZXing(); return; }
          else { await ensureJsQR(); prepareCanvas(); detectLoop_jsQR(); return; }
        }catch(_){}
      }
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
function detectLoop_ZXing(){
  if(!zxingReader || !scanState.video) return;
  zxingReader.decodeFromVideoDevice(undefined, scanState.video, (result, err) => {
    if (!scanState.running) return;
    if (result && result.getText) {
      const text = (result.getText() || "").trim();
      if (text) stopScan().then(()=> (scanTarget==='bagasi' ? receiveBagBarcode(text) : receiveBarcode(text)));
    }
  });
}

/* ===== SCAN STYLES ===== */
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
injectScanStyles();

/* ===== INIT ===== */
setMode("PSCP");
