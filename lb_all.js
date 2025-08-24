/* ===== KONFIG ===== */
const SCRIPT_URL   = "https://logbk.avsecbwx2018.workers.dev"; // 🔒 JANGAN UBAH TANPA PERMINTAAN
const SHARED_TOKEN = "N45p";                                    // 🔒 JANGAN UBAH TANPA PERMINTAAN

/* ===== PETA TARGET ===== (key = ?target=...) */
const TARGETS = {
  cctv:    { label: "LB CCTV" },
  pscp:    { label: "LB PSCP" },
  hbscp:   { label: "LB HBSCP" },
  arrival: { label: "LB Arrival" },
  pos1:    { label: "LB Pos 1 & Patroli" },
  cargo:   { label: "LB Cargo" },
  malam:   { label: "LB Malam" },
};

/* ===== UTIL TARGET ===== */
function getTarget() {
  const u = new URL(location.href);
  let t = (u.searchParams.get("target") || "").toLowerCase().trim();
  if (t && TARGETS[t]) {
    try { localStorage.setItem("lb_target", t); } catch(_) {}
    return t;
  }
  try {
    const saved = (localStorage.getItem("lb_target") || "").toLowerCase().trim();
    if (saved && TARGETS[saved]) return saved;
  } catch(_) {}
  return "cctv"; // default
}
function getTargetLabel(t){ return (TARGETS[t]?.label) || t.toUpperCase(); }
function getHeaderTitle(t){
  const lbl  = getTargetLabel(t);
  const core = lbl.replace(/^LB\s*/i,"");
  return `LOGBOOK ${core.toUpperCase()}`;
}

/* ===== KOMPRESI GAMBAR (opsi) ===== */
const COMPRESS_CFG = { MAX_LONG_EDGE: 800, MIN_SHRINK_RATIO: 0.5 };

/* ===== DOM ===== */
const timeInput    = document.getElementById("timeInput");
const timeLabel    = document.getElementById("timeLabel");
const timeBtn      = document.getElementById("timeBtn");
const pickPhoto    = document.getElementById("pickPhotoBtn");
const fileInput    = document.getElementById("fileInput");
const preview      = document.getElementById("preview");
const uploadInfo   = document.getElementById("uploadInfo");
const uploadName   = document.getElementById("uploadName");
const uploadStatus = document.getElementById("uploadStatus");
const submitBtn    = document.getElementById("submitBtn");
const activityEl   = document.getElementById("activity");
const rowsTbody    = document.getElementById("rows");
const targetLabelEl= document.getElementById("targetLabel"); // optional

// (baru)
const targetPill   = document.getElementById("targetPill");
const downloadBtn  = document.getElementById("downloadPdfBtn");

/* ===== STATE ===== */
let uploaded  = null;   // {fileId, url, name}
let uploading = false;
let editingId = null;
const TARGET  = getTarget();

/* ===== UTIL ===== */
const pad2  = (n)=> String(n).padStart(2,"0");
const clamp = (v,min,max)=> v<min?min : v>max?max : v;

function fmtTimeWIB(s){
  if (!s) return "-";
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m){
    const hh = (+m[1])%24, mm = (+m[2])%60;
    return `${pad2(hh)}:${pad2(mm)} WIB`;
  }
  const d = new Date(s);
  if (!isNaN(d)){
    try{
      const str = new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Jakarta"}).format(d);
      return `${str} WIB`;
    }catch{
      return `${pad2(d.getHours())}:${pad2(d.getMinutes())} WIB`;
    }
  }
  return s;
}

function showOverlay(state, title, desc){
  const overlay = document.getElementById("overlay");
  const icon    = document.getElementById("ovIcon");
  const tEl     = document.getElementById("ovTitle");
  const dEl     = document.getElementById("ovDesc");
  const close   = document.getElementById("ovClose");
  overlay.classList.remove("hidden");
  icon.className = "icon " + (state === "loading" ? "spinner" : state === "ok" ? "ok" : "err");
  tEl.textContent = title;
  dEl.textContent = desc || "";
  close.classList.toggle("hidden", state === "loading");
  close.onclick = () => overlay.classList.add("hidden");
  if (state !== "loading") setTimeout(() => overlay.classList.add("hidden"), 1200);
}

/* ===== Mini Confirm Dialog ===== */
// ... (tidak berubah; kode confirm tetap sama dari versi kamu)
function askConfirm(message="Yakin?", { okText="Hapus", cancelText="Batal" } = {}){ /* ...kode asli kamu... */ }

/* ===== MODE (Tambah vs Edit) ===== */
// ... (tidak berubah)
function setModeEdit(on){ /* ... */ }
function enterEditMode(id, hhmm, activity){ /* ... */ }
function exitEditMode(){ /* ... */ }
function setSubmitEnabled(){ /* ... */ }
activityEl.addEventListener("input", setSubmitEnabled);

/* ===== TIME PICKER (Wheel) ===== */
// ... (tidak berubah)
const ITEM_H=36, VISIBLE=5, SPACER=((VISIBLE-1)/2)*ITEM_H;
const timeModal=document.getElementById("timeModal");
const wheelHour=document.getElementById("wheelHour");
const wheelMin=document.getElementById("wheelMin");
const btnCancel=timeModal.querySelector(".t-cancel");
const btnSave=timeModal.querySelector(".t-save");
let wheelsBuilt=false;
// buildWheel/centerIndex/snapToCenter/enableWheel/open/close/disableNative...
function buildWheel(el,count){ /* ... */ }
function centerIndex(el,max){ /* ... */ }
function snapToCenter(el,idx){ /* ... */ }
function enableWheel(el,max){ /* ... */ }
function openTimePicker(){ /* ... */ }
function closeTimePicker(save){ /* ... */ }
function disableNativeTimePicker(){ /* ... */ }
btnCancel.addEventListener("click", () => closeTimePicker(false));
btnSave  .addEventListener("click", () => closeTimePicker(true));

/* ===== GALERI MODE ===== */
function forceGalleryPicker(){
  try{
    fileInput.setAttribute("accept","image/*");
    fileInput.removeAttribute("capture");
  }catch{}
}

/* ====== PNG + KOMPRES ====== */
// ... (tidak berubah)
function stepDownScale(srcCanvas, targetW, targetH){ /* ... */ }
async function normalizeToPNG(file){ /* ... */ }
async function fileToBase64(file){ /* ... */ }

/* ===== UPLOAD FOTO (hanya saat TAMBAH) ===== */
// ... (tetap sama)
pickPhoto.addEventListener("click", async () => { /* ... */ });
fileInput.addEventListener("change", async (ev) => { /* ... */ });

/* ===== SUBMIT (Create / Update) ===== */
// ... (tetap sama)
submitBtn.addEventListener("click", async () => { /* ... */ });

/* ===== TABEL (2 kolom) ===== */
// ... (tetap sama)
async function loadRows(){ /* ... */ }
function escapeHtml(s){ /* ... */ }
function toImageUrl(url, fileId){ /* ... */ }

/* ===== TAP/LONG-PRESS & MODAL FOTO ===== */
// ... (tetap sama)
const LONG_MS=550; let pressTimer=null, longFired=false;
const actSheet=document.getElementById("actSheet");
const actEdit=document.getElementById("actEdit");
const actDelete=document.getElementById("actDelete");
const actClose=document.getElementById("actClose");
let sheetTarget=null;
// open/close sheet, handlers, rowsTbody events...
function openActionSheetFor(tr){ /* ... */ }
function closeActionSheet(){ /* ... */ }
actClose.addEventListener("click", closeActionSheet);
actSheet.addEventListener("click", (e)=>{ if(e.target===actSheet) closeActionSheet(); });
actEdit.addEventListener("click", () => { /* ... */ });
actDelete.addEventListener("click", async () => { /* ... */ });
rowsTbody.addEventListener("pointerdown", (e)=>{ /* ... */ });
["pointerup","pointercancel","pointerleave"].forEach(ev=>{
  rowsTbody.addEventListener(ev, ()=>{ clearTimeout(pressTimer); }, {passive:true});
});
rowsTbody.addEventListener("click", async (e)=>{ /* ... */ });

const photoModal=document.getElementById("photoModal");
const photoImg=document.getElementById("photoImg");
document.getElementById("photoClose").addEventListener("click", closePhoto);
photoModal.addEventListener("click", (e)=>{ if(e.target===photoModal) closePhoto(); });
function openPhoto(url, overlayAlreadyShown = false){ /* ... */ }
function closePhoto(){ /* ... */ }

/* ====== DOWNLOAD PDF (BARU) ====== */
function todayStamp(){
  const d = new Date();
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}
function safeFilename(s){
  return (s||"")
    .replace(/[^\w\s\-()+.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
async function downloadPdf(){
  const label = getTargetLabel(TARGET); // contoh: "LB PSCP"
  const core  = label.replace(/^LB\s*/i,"");
  const fileName = safeFilename(`Logbook ${core} ${todayStamp()}.pdf`);

  try{
    showOverlay("loading", "Menyiapkan PDF…", `Target: ${label}`);

    // 1) Coba POST (JSON) -> respon blob PDF
    let res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({
        token: SHARED_TOKEN,
        action: "downloadPdf",  // SESUAIKAN di Worker/Cloud Functions-mu
        target: TARGET,
        label
      })
    });

    // Jika backend malah mengembalikan {url: "..."} → follow
    if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
      const j = await res.json();
      if (j?.url) {
        // 2) Ambil PDF dari URL yang diberikan
        res = await fetch(j.url);
      } else if (j?.success && j?.dataUrl?.startsWith("data:application/pdf")) {
        // 3) data URL langsung
        const a = document.createElement("a");
        a.href = j.dataUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        showOverlay("ok", "PDF siap diunduh", fileName);
        return;
      }
    }

    // 4) Jika res adalah PDF langsung → simpan
    if (res.ok && res.headers.get("content-type")?.includes("application/pdf")) {
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=> URL.revokeObjectURL(url), 1500);
      showOverlay("ok", "PDF siap diunduh", fileName);
      return;
    }

    // 5) Fallback GET query param (kalau kamu lebih suka GET)
    const url = new URL(SCRIPT_URL);
    url.searchParams.set("action", "downloadPdf");
    url.searchParams.set("target", TARGET);
    url.searchParams.set("token", SHARED_TOKEN);
    url.searchParams.set("label", label);
    const res2 = await fetch(url.toString());
    if (res2.ok && res2.headers.get("content-type")?.includes("application/pdf")) {
      const blob = await res2.blob();
      const durl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = durl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=> URL.revokeObjectURL(durl), 1500);
      showOverlay("ok", "PDF siap diunduh", fileName);
      return;
    }

    throw new Error("Gagal menyiapkan PDF");
  }catch(err){
    console.error(err);
    showOverlay("err", "Gagal menyiapkan PDF", err.message || "Coba lagi");
  }
}

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", async () => {
  if (targetLabelEl) targetLabelEl.textContent = getTargetLabel(TARGET);

  // Set judul header + tab title sesuai target
  const headerEl = document.getElementById("appTitle")
                 || document.querySelector(".app-title")
                 || document.querySelector("header h1");
  if (headerEl) headerEl.textContent = getHeaderTitle(TARGET);
  try { document.title = getHeaderTitle(TARGET); } catch {}

  // Badge klasifikasi target (baru)
  if (targetPill) targetPill.textContent = getTargetLabel(TARGET);

  // Tombol PDF (baru)
  if (downloadBtn) downloadBtn.addEventListener("click", downloadPdf);

  timeLabel.textContent = "Pilih Waktu";
  setModeEdit(false);
  disableNativeTimePicker();
  forceGalleryPicker();
  await loadRows();
});
