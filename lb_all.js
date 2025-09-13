// ==== Firebase SDK v9 (modular) ====
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

/* ===== KONFIG ===== */
const SCRIPT_URL   = "https://logbk.avsecbwx2018.workers.dev"; // 🔒 JANGAN UBAH TANPA PERMINTAAN
const SHARED_TOKEN = "N45p";                                    // 🔒 JANGAN UBAH TANPA PERMINTAAN

// ========= Cloud Functions download PDF (endpoint) =========
const FN = "https://us-central1-avsecbwx-4229c.cloudfunctions.net/downloadPdf";

// ======== Konfigurasi Firebase (samakan dgn auth-guard.js) ========
const firebaseConfig = {
  apiKey: "AIzaSyBc-kE-_q1yoENYECPTLC3EZf_GxBEwrWY",
  authDomain: "avsecbwx-4229c.firebaseapp.com",
  projectId: "avsecbwx-4229c",
  appId: "1:1029406629258:web:53e8f09585cd77823efc73",
  storageBucket: "avsecbwx-4229c.appspot.com",
  messagingSenderId: "1029406629258",
  measurementId: "G-P37F88HGFE",
  databaseURL: "https://avsecbwx-4229c-default-rtdb.firebaseio.com",
};

// Singleton
const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

/* ===== PETA TARGET ===== (key = ?target=...) */
const TARGETS = {
  LB_CCTV:    { label: "LB CCTV" },
  LB_PSCP:    { label: "LB PSCP" },
  LB_HBSCP:   { label: "LB HBSCP" },
  LB_ARRIVAL: { label: "LB Arrival" },
  LB_POS1:    { label: "LB Pos 1 & Patroli" },
  LB_CARGO:   { label: "LB Cargo" },
  LB_MALAM:   { label: "LB Malam" },
};

/* ===== INFO SHEET UNTUK DOWNLOAD PDF ===== */
const SHEET_INFO = {
  LB_CCTV:    { id: "1HLLEyF6EiLOSkdB1t8hdiD9u4re1pKRbxr05lChhWuI", gid: "" },
  LB_PSCP:    { id: "1NiOsO1FLYgSfQGoIm4-xZ5CqdbI92OphU8ENsR1NXOI", gid: "" },
  LB_HBSCP:   { id: "1JT-Yzu91MqXBN-lIHkD68lVyBIaffuVW2CFu19gYoOc", gid: "" },
  LB_ARRIVAL: { id: "1zSJjGHiZeJP7QYwoiW-TRvbqVCBgghDgwmJYaOG3EYA", gid: "" },
  LB_POS1:    { id: "11J_ydWZGdG7jAVpVPWuMfluA3H7Z8pBIQLChZaS0BRg", gid: "" },
  LB_CARGO:   { id: "1nfneesae64VWqcVbcgguMc2Gh2EceyLhbBr1LjOQ_2E", gid: "" },
  LB_MALAM:   { id: "1zf_rqCFVoi3AaQU-9Gb3l91striiQ5dWrD1JTyhdnZk", gid: "" },
};

/* ===== UTIL DOWNLOAD PDF (Google Sheets) ===== */
const USE_PUB = false;
const PDF_DEFAULT_OPTS = {
  format: "pdf", size: "A4", portrait: "true", scale: "2",
  top_margin: "0.50", bottom_margin: "0.50", left_margin: "0.50", right_margin: "0.50",
  sheetnames: "false", printtitle: "false", pagenumbers: "true", gridlines: "false", fzr: "true"
};
function buildSheetPdfUrl(sheetId, gid, opts = {}) {
  const cacheBuster = { t: Date.now() };
  if (USE_PUB) {
    const params = new URLSearchParams({ gid, single: "true", output: "pdf", ...cacheBuster });
    return `https://docs.google.com/spreadsheets/d/${sheetId}/pub?${params.toString()}`;
  } else {
    const params = new URLSearchParams({ ...PDF_DEFAULT_OPTS, ...opts, gid, ...cacheBuster });
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?${params.toString()}`;
  }
}

/* ===== UTIL TARGET ===== */
function getTarget() {
  const u = new URL(location.href);
  let t = (u.searchParams.get("target") || "").trim().toUpperCase();
  if (t && TARGETS[t]) {
    try { localStorage.setItem("lb_target", t); } catch(_) {}
    return t;
  }
  try {
    const saved = (localStorage.getItem("lb_target") || "").trim().toUpperCase();
    if (saved && TARGETS[saved]) return saved;
  } catch(_) {}
  return "LB_CCTV"; // default
}
function getTargetLabel(t){ return (TARGETS[t]?.label) || t; }
function getHeaderTitle(t){
  const lbl  = getTargetLabel(t);         // e.g. "LB PSCP"
  const core = lbl.replace(/^LB\s*/i,""); // → "PSCP"
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

/* ===== HANDLER DOWNLOAD PDF ===== */
async function onDownloadPdf(){
  const info = SHEET_INFO[TARGET];
  if(!info?.id){
    alert("PDF belum tersedia untuk target ini");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("Harus login terlebih dulu.");
    return;
  }

  const idToken = await user.getIdToken(true);

  try {
    showOverlay("loading", "Menyiapkan PDF…", "Menghubungkan ke server");
    const url = `${FN}?site=${encodeURIComponent(TARGET)}&token=${encodeURIComponent(SHARED_TOKEN)}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Accept": "application/pdf",
      },
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => resp.statusText);
      showOverlay("err", "Gagal mengunduh", txt);
      return;
    }

    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const now = new Date();
    const dateStr = `${pad2(now.getDate())}-${pad2(now.getMonth() + 1)}-${now.getFullYear()}`;
    a.download = `${TARGET}_${dateStr}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    showOverlay("ok", "Berhasil", "PDF telah diunduh");
  } catch (err) {
    showOverlay("err", "Gagal mengunduh", err.message || "Coba lagi");
  }
}

/* ===== Mini Confirm Dialog ===== */
function askConfirm(message="Yakin?", { okText="Hapus", cancelText="Batal" } = {}){
  return new Promise(resolve => {
    let modal = document.getElementById("jsConfirm");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "jsConfirm";
      modal.className = "hidden";
      modal.setAttribute("role","dialog");
      modal.setAttribute("aria-modal","true");
      modal.innerHTML = `
        <div class="jsc-backdrop"></div>
        <div class="jsc-card">
          <button class="jsc-x" aria-label="Tutup" title="Tutup">×</button>
          <div class="jsc-msg"></div>
          <div class="jsc-actions">
            <button class="jsc-cancel" type="button"></button>
            <button class="jsc-ok" type="button"></button>
          </div>
        </div>`;
      const css = document.createElement("style");
      css.textContent = `
        #jsConfirm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9999}
        #jsConfirm.hidden{display:none}
        #jsConfirm .jsc-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.45);backdrop-filter:saturate(120%) blur(2px)}
        #jsConfirm .jsc-card{position:relative;max-width:360px;width:90%;background:#0f172a;color:#e5e7eb;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.35);padding:18px 16px 14px}
        #jsConfirm .jsc-msg{font-size:14px;line-height:1.5;margin:4px 6px 12px;white-space:pre-wrap}
        #jsConfirm .jsc-actions{display:flex;gap:8px;justify-content:flex-end;padding:0 6px}
        #jsConfirm button{appearance:none;border:0;border-radius:10px;padding:8px 12px;font-weight:600;cursor:pointer}
        #jsConfirm .jsc-cancel{background:#374151;color:#e5e7eb}
        #jsConfirm .jsc-ok{background:#ef4444;color:white}
        #jsConfirm button:active{transform:translateY(1px)}
        #jsConfirm .jsc-x{position:absolute;top:8px;right:8px;width:32px;height:32px;line-height:28px;border-radius:999px;background:#111827;color:#e5e7eb;font-size:20px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
        #jsConfirm .jsc-x:active{transform:scale(.98)}
        #jsConfirm, #jsConfirm *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
      `;
      document.head.appendChild(css);
      document.body.appendChild(modal);
      modal.addEventListener("contextmenu", e => e.preventDefault());
    }
    const msgEl = modal.querySelector(".jsc-msg");
    const okBtn = modal.querySelector(".jsc-ok");
    const noBtn = modal.querySelector(".jsc-cancel");
    const xBtn  = modal.querySelector(".jsc-x");

    msgEl.textContent = message;
    okBtn.textContent = okText;
    noBtn.textContent = cancelText;

    function close(val){
      modal.classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      noBtn.removeEventListener("click", onNo);
      xBtn.removeEventListener("click", onNo);
      modal.removeEventListener("click", onBackdrop);
      resolve(val);
    }
    function onOk(){ close(true); }
    function onNo(){ close(false); }
    function onBackdrop(e){ if(e.target === modal) close(false); }

    modal.classList.remove("hidden");
    okBtn.addEventListener("click", onOk);
    noBtn.addEventListener("click", onNo);
    xBtn.addEventListener("click", onNo);
    modal.addEventListener("click", onBackdrop);
    setTimeout(()=> okBtn.focus?.(), 0);
  });
}

/* ===== MODE (Tambah vs Edit) ===== */
function setModeEdit(on){
  submitBtn.textContent = on ? "✏️ Edit" : "✅ Kirim Data";
  pickPhoto.disabled = !!on;
  fileInput.disabled = !!on;
  if (on){
    uploadInfo.classList.add("hidden");
    uploaded = null; // foto tidak boleh diganti saat edit
  }
  setSubmitEnabled();
}
function enterEditMode(id, hhmm, activity){
  editingId = id;
  timeInput.value = hhmm || "";
  timeLabel.textContent = hhmm || "Pilih Waktu";
  activityEl.value = activity || "";
  setModeEdit(true);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function exitEditMode(){
  editingId = null;
  timeInput.value = "";
  timeLabel.textContent = "Pilih Waktu";
  activityEl.value = "";
  setModeEdit(false);
}
function setSubmitEnabled(){
  const timeOk = !!timeInput.value;
  const actOk  = !!activityEl.value.trim();
  const photoOk= !!uploaded?.fileId;
  const ok = editingId ? (timeOk && actOk && !uploading)
                       : (timeOk && actOk && photoOk && !uploading);
  submitBtn.disabled = !ok;
}
activityEl.addEventListener("input", setSubmitEnabled);

/* ===== TIME PICKER (Wheel) ===== */
const ITEM_H  = 36, VISIBLE = 5, SPACER = ((VISIBLE-1)/2) * ITEM_H;
const timeModal = document.getElementById("timeModal");
const wheelHour = document.getElementById("wheelHour");
const wheelMin  = document.getElementById("wheelMin");
const btnCancel = timeModal.querySelector(".t-cancel");
const btnSave   = timeModal.querySelector(".t-save");
let wheelsBuilt = false;

function buildWheel(el, count){
  const frag = document.createDocumentFragment();
  const top = document.createElement("div"); top.style.height = SPACER+"px";
  const bottom = document.createElement("div"); bottom.style.height = SPACER+"px";
  frag.appendChild(top);
  for (let i=0;i<count;i++){
    const it = document.createElement("div");
    it.className = "item";
    it.textContent = pad2(i);
    it.dataset.val = i;
    frag.appendChild(it);
  }
  frag.appendChild(bottom);
  el.innerHTML = "";
  el.appendChild(frag);
}
function centerIndex(el, max){
  const centerTop = el.scrollTop + el.clientHeight/2;
  const relative  = centerTop - SPACER - ITEM_H/2;
  return clamp(Math.round(relative / ITEM_H), 0, max);
}
function snapToCenter(el, idx){ el.scrollTop = idx * ITEM_H; }
function enableWheel(el, max){
  let dragging = false, startY = 0, startTop = 0;
  let isSnapping = false;
  let timer = null;

  el.addEventListener("pointerdown", (e)=>{
    dragging = true;
    startY = e.clientY;
    startTop = el.scrollTop;
    el.setPointerCapture(e.pointerId);
    clearTimeout(timer);
  });
  el.addEventListener("pointermove", (e)=>{
    if (!dragging) return;
    const next = startTop + (e.clientY - startY);
    el.scrollTop = clamp(next, 0, SPACER + max*ITEM_H + SPACER);
  });
  function endDrag(){
    if (!dragging) return;
    dragging = false;
    isSnapping = true;
    snapToCenter(el, centerIndex(el, max));
    requestAnimationFrame(()=>{ isSnapping = false; });
  }
  el.addEventListener("pointerup", endDrag);
  el.addEventListener("pointercancel", endDrag);
  el.addEventListener("pointerleave", endDrag);
  el.addEventListener("scroll", ()=>{
    if (isSnapping) return;
    clearTimeout(timer);
    timer = setTimeout(()=>{
      isSnapping = true;
      snapToCenter(el, centerIndex(el, max));
      requestAnimationFrame(()=>{ isSnapping = false; });
    }, 140);
  }, {passive:true});
  el.addEventListener("click", (e)=>{
    const it = e.target.closest(".item"); if (!it) return;
    isSnapping = true;
    snapToCenter(el, +it.dataset.val);
    requestAnimationFrame(()=>{ isSnapping = false; });
  });
}

function openTimePicker(){
  if (!wheelsBuilt){
    buildWheel(wheelHour, 24);
    buildWheel(wheelMin, 60);
    enableWheel(wheelHour, 23);
    enableWheel(wheelMin, 59);
    wheelsBuilt = true;
  }
  let h = 0, m = 0;
  if (timeInput.value){
    const [hh, mm] = timeInput.value.split(":"); h = parseInt(hh||"0",10); m = parseInt(mm||"0",10);
  }else{
    const now = new Date(); h = now.getHours(); m = now.getMinutes();
  }
  snapToCenter(wheelHour, h);
  snapToCenter(wheelMin,  m);
  timeModal.classList.remove("hidden");
}
function closeTimePicker(save){
  if (save){
    const h = centerIndex(wheelHour, 23);
    const m = centerIndex(wheelMin,  59);
    snapToCenter(wheelHour, h);
    snapToCenter(wheelMin,  m);
    const val = `${pad2(h)}:${pad2(m)}`;
    timeInput.value = val;
    timeLabel.textContent = val;
    setSubmitEnabled();
  }
  timeModal.classList.add("hidden");
}
function disableNativeTimePicker(){
  timeInput.setAttribute("readonly", "");
  timeInput.setAttribute("inputmode","none");
  timeInput.addEventListener("focus", (e)=>{ e.preventDefault(); e.target.blur(); openTimePicker(); });
  timeBtn.addEventListener("click", openTimePicker);
}
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
function stepDownScale(srcCanvas, targetW, targetH){
  let sCan = srcCanvas;
  let sW = sCan.width, sH = sCan.height;
  while (sW * 0.5 > targetW && sH * 0.5 > targetH) {
    const tCan = document.createElement("canvas");
    tCan.width = Math.max(1, Math.round(sW * 0.5));
    tCan.height = Math.max(1, Math.round(sH * 0.5));
    const tCtx = tCan.getContext("2d");
    tCtx.drawImage(sCan, 0, 0, sW, sH, 0, 0, tCan.width, tCan.height);
    sCan = tCan;
    sW = sCan.width; sH = sCan.height;
  }
  if (sW !== targetW || sH !== targetH){
    const fCan = document.createElement("canvas");
    fCan.width  = Math.max(1, Math.round(targetW));
    fCan.height = Math.max(1, Math.round(targetH));
    const fCtx = fCan.getContext("2d");
    fCtx.drawImage(sCan, 0, 0, sW, sH, 0, 0, fCan.width, fCan.height);
    return fCan;
  }
  return sCan;
}
async function normalizeToPNG(file) {
  let source, w, h, revokeUrl = null;
  try {
    source = await createImageBitmap(file);
    w = source.width; h = source.height;
  } catch {
    const url = URL.createObjectURL(file);
    revokeUrl = url;
    source = await new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = url;
    });
    w = source.naturalWidth || source.width;
    h = source.naturalHeight || source.height;
  }

  const longEdge   = Math.max(w, h);
  const scale      = COMPRESS_CFG.MAX_LONG_EDGE / longEdge;
  const needResize = scale < COMPRESS_CFG.MIN_SHRINK_RATIO;

  const baseCanvas = document.createElement("canvas");
  baseCanvas.width  = Math.max(1, w);
  baseCanvas.height = Math.max(1, h);
  const baseCtx = baseCanvas.getContext("2d");
  baseCtx.drawImage(source, 0, 0, baseCanvas.width, baseCanvas.height);

  let outCanvas = baseCanvas;
  if (needResize){
    const tw = Math.round(w * scale);
    const th = Math.round(h * scale);
    outCanvas = stepDownScale(baseCanvas, tw, th);
  }

  const pngBlob = await new Promise((resolve) => {
    if (!outCanvas.toBlob) {
      try {
        const dataUrl = outCanvas.toDataURL("image/png");
        const b64 = dataUrl.split(",")[1];
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type: "image/png" }));
      } catch {
        resolve(file);
      }
      return;
    }
    try { outCanvas.toBlob(b => resolve(b || file), "image/png"); }
    catch { resolve(file); }
  });

  try { if ('close' in source) source.close(); } catch {}
  if (revokeUrl) { try { URL.revokeObjectURL(revokeUrl); } catch {} }
  return pngBlob;
}
async function fileToBase64(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ===== UPLOAD FOTO (hanya saat TAMBAH) ===== */
pickPhoto.addEventListener("click", async () => {
  if (editingId) return;
  forceGalleryPicker();

  try{
    if (window.showOpenFilePicker){
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: true,
        startIn: "pictures",
        types: [{ description: "Foto", accept: { "image/*": [".jpg",".jpeg",".png",".gif",".webp",".heic"] } }]
      });
      const file = await handle.getFile();
      const dt = new DataTransfer(); dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
  }catch{}

  fileInput.click();
});

fileInput.addEventListener("change", async (ev) => {
  if (editingId) return;
  const file = ev.target.files?.[0];
  if (!file) return;

  uploadInfo.classList.remove("hidden");
  uploadStatus.textContent = "Mengunggah foto…";

  try{
    uploading = true; setSubmitEnabled();
    showOverlay("loading", "Mengunggah foto…", `Target: ${getTargetLabel(TARGET)}`);

    const pngBlob = await normalizeToPNG(file);
    const now     = new Date();
    const dateStr = `${pad2(now.getDate())}-${pad2(now.getMonth()+1)}-${now.getFullYear()}`;
    const timeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
    const pngName = `${TARGET}_${dateStr}_${timeStr}.png`;
    uploadName.textContent = pngName;

    const objectUrl = URL.createObjectURL(pngBlob);
    preview.src = objectUrl;

    const base64 = await fileToBase64(pngBlob);
    const payload = { token: SHARED_TOKEN, action: "upload", filename: pngName, mimeType: "image/png", dataUrl: base64 };

    const res = await fetch(SCRIPT_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "Upload gagal");

    uploaded = { fileId: json.fileId, url: json.url, name: pngName };
    uploadStatus.textContent = "Upload selesai ✅";
    showOverlay("ok", "Berhasil diunggah", "Foto tersimpan di Drive");
  }catch(err){
    console.error(err);
    uploaded = null;
    uploadStatus.textContent = "Upload gagal ❌";
    showOverlay("err", "Gagal mengunggah", err.message || "Coba lagi");
  }finally{
    uploading = false; setSubmitEnabled();
  }
});

/* ===== SUBMIT (Create / Update) ===== */
submitBtn.addEventListener("click", async () => {
  if (submitBtn.disabled) return;
  const timeStr  = timeInput.value;
  const activity = activityEl.value.trim();
  if (!timeStr || !activity) return;

  if (editingId){
    try{
      submitBtn.disabled = true;
      showOverlay("loading","Menyimpan perubahan…", `Target: ${getTargetLabel(TARGET)}`);

      const res = await fetch(SCRIPT_URL, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ token: SHARED_TOKEN, target: TARGET, action: "updatelog", id: editingId, time: timeStr, activity })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Gagal mengubah");

      showOverlay("ok","Tersimpan","Perubahan berhasil");
      exitEditMode();
      await loadRows();
    }catch(err){
      console.error(err);
      showOverlay("err","Gagal menyimpan", err.message||"Coba lagi");
    }finally{
      submitBtn.disabled = false;
    }
    return;
  }

  if (!uploaded?.fileId) return;
  try{
    submitBtn.disabled = true;
    showOverlay("loading", "Menyimpan logbook…", `Target: ${getTargetLabel(TARGET)}`);

    const res = await fetch(SCRIPT_URL, {
      method: "POST", headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ token: SHARED_TOKEN, target: TARGET, action: "createlog", time: timeStr, activity, fileId: uploaded.fileId })
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "Gagal menyimpan");

    showOverlay("ok", "Tersimpan", "Logbook berhasil ditambahkan");

    timeInput.value = ""; timeLabel.textContent = "Pilih Waktu";
    activityEl.value = "";
    uploaded = null;
    uploadInfo.classList.add("hidden"); preview.removeAttribute("src");
    setSubmitEnabled();

    await loadRows();
  }catch(err){
    console.error(err);
    showOverlay("err", "Gagal menyimpan", err.message || "Coba lagi");
  }finally{
    submitBtn.disabled = false;
  }
});

/* ===== TABEL (2 kolom) ===== */
async function loadRows(){
  rowsTbody.innerHTML = `<tr><td colspan="2">Memuat…</td></tr>`;
  try{
    const url = new URL(SCRIPT_URL);
    url.searchParams.set("action","list");
    url.searchParams.set("target", TARGET);
    url.searchParams.set("token",SHARED_TOKEN);

    const res = await fetch(url.toString(), { method:"GET" });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "Gagal memuat");

    rowsTbody.innerHTML = "";
    if (!json.rows || !json.rows.length) {
      rowsTbody.innerHTML = `<tr><td colspan="2" class="muted">Belum ada data</td></tr>`;
      return;
    }

    for (const r of json.rows){
      const id     = r.id ?? "";
      const fileId = r.fileId || (r.fileUrl?.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1]
                    || r.fileUrl?.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] || "");
      const time   = r.time || r.createdAt || "";
      const actRaw = r.activity || "";

      const tr = document.createElement("tr");
      tr.dataset.id        = id;
      tr.dataset.fileId    = fileId;
      tr.dataset.url       = toImageUrl(r.fileUrl||"", fileId);
      tr.dataset.time      = time || "";
      tr.dataset.activity  = actRaw;

      tr.innerHTML = `
        <td>${fmtTimeWIB(time)}</td>
        <td>${escapeHtml(actRaw) || "-"}</td>
      `;
      rowsTbody.appendChild(tr);
    }
  }catch(err){
    console.error(err);
    rowsTbody.innerHTML = `<tr><td colspan="2">Gagal memuat data</td></tr>`;
  }
}
function escapeHtml(s){ return (s||"").replace(/[&<>"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c])); }
function toImageUrl(url, fileId){
  const id = fileId
    || (url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1]
    ||   url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1]
    || "");
  return id ? `https://drive.google.com/uc?export=view&id=${id}` : "";
}

/* ===== TAP = lihat foto, LONG-PRESS = Edit/Hapus ===== */
const LONG_MS = 550;
let pressTimer = null, longFired = false;
const actSheet  = document.getElementById("actSheet");
const actEdit   = document.getElementById("actEdit");
const actDelete = document.getElementById("actDelete");
const actClose  = document.getElementById("actClose");
let sheetTarget = null;

function openActionSheetFor(tr){
  sheetTarget = tr;
  actSheet.classList.remove("hidden");
}
function closeActionSheet(){
  actSheet.classList.add("hidden");
  sheetTarget = null;
}
actClose.addEventListener("click", closeActionSheet);
actSheet.addEventListener("click", (e)=>{ if(e.target===actSheet) closeActionSheet(); });

actEdit.addEventListener("click", () => {
  if(!sheetTarget) return;
  const id  = sheetTarget.dataset.id;
  const t   = sheetTarget.dataset.time || "";
  const act = sheetTarget.dataset.activity || "";
  enterEditMode(id, t, act);
  closeActionSheet();
});
actDelete.addEventListener("click", async () => {
  if(!sheetTarget) return;
  const id = sheetTarget.dataset.id;
  closeActionSheet();

  const ok = await askConfirm("Hapus entri ini?", { okText:"Hapus", cancelText:"Batal" });
  if (!ok) return;

  try{
    showOverlay("loading","Menghapus data…", `Target: ${getTargetLabel(TARGET)}`);
    const res = await fetch(SCRIPT_URL, {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ token:SHARED_TOKEN, target: TARGET, action:"deletelog", id })
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "Gagal menghapus");
    showOverlay("ok","Terhapus","Data dihapus");
    if (editingId && editingId == id) exitEditMode();
    await loadRows();
  }catch(err){
    console.error(err);
    showOverlay("err","Gagal menghapus", err.message||"Coba lagi");
  }
});

/* Long-press handler */
rowsTbody.addEventListener("pointerdown", (e)=>{
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;
  longFired = false;
  clearTimeout(pressTimer);
  pressTimer = setTimeout(()=>{ longFired = true; openActionSheetFor(tr); }, LONG_MS);
});
["pointerup","pointercancel","pointerleave"].forEach(ev=>{
  rowsTbody.addEventListener(ev, ()=>{ clearTimeout(pressTimer); }, {passive:true});
});

/* Klik baris → tampil foto */
rowsTbody.addEventListener("click", async (e)=>{
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;
  if (longFired){ longFired = false; return; }

  if (tr.dataset.fileId){
    try{
      showOverlay("loading","Memuat foto…","");
      const u = `${SCRIPT_URL}?action=photo&token=${encodeURIComponent(SHARED_TOKEN)}&id=${encodeURIComponent(tr.dataset.fileId)}&t=${Date.now()}`;
      const res = await fetch(u);
      const j = await res.json();
      if (!res.ok || !j.success || !j.dataUrl) throw new Error(j.error || "Gagal memuat foto");
      openPhoto(j.dataUrl, true);
      return;
    }catch(err){
      console.error(err);
    }
  }
  if (tr.dataset.url){
    openPhoto(tr.dataset.url);
  }
});

/* ===== MODAL FOTO ===== */
const photoModal = document.getElementById("photoModal");
const photoImg   = document.getElementById("photoImg");
document.getElementById("photoClose").addEventListener("click", closePhoto);
photoModal.addEventListener("click", (e)=>{ if(e.target===photoModal) closePhoto(); });

function openPhoto(url, overlayAlreadyShown = false){
  if(!url) return;
  if (!overlayAlreadyShown){
    showOverlay("loading","Memuat foto…","");
  }
  photoModal.classList.remove("hidden");
  let finalUrl = url;
  if (!/^data:/.test(url) && !/^blob:/.test(url)){
    finalUrl = url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
  }
  photoImg.onload = () => {
    document.getElementById("overlay").classList.add("hidden");
    photoImg.onload = photoImg.onerror = null;
  };
  photoImg.onerror = () => {
    document.getElementById("overlay").classList.add("hidden");
    photoImg.onload = photoImg.onerror = null;
    showOverlay("err","Gagal memuat foto","Coba lagi");
  };
  photoImg.src = finalUrl;
}
function closePhoto(){
  photoModal.classList.add("hidden");
  photoImg.removeAttribute("src");
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

  timeLabel.textContent = "Pilih Waktu";
  setModeEdit(false);
  disableNativeTimePicker();
  forceGalleryPicker();
  downloadBtn?.addEventListener("click", onDownloadPdf);
  await loadRows();
});
