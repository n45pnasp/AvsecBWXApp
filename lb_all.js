/* ===== KONFIG ===== */
const SCRIPT_URL   = "https://logbk.avsecbwx2018.workers.dev";
const SHARED_TOKEN = "N45p";

/* ===== DOM ===== */
const timeInput   = document.getElementById("timeInput");
const timeLabel   = document.getElementById("timeLabel");
const timeBtn     = document.getElementById("timeBtn");

const pickPhoto   = document.getElementById("pickPhotoBtn");
const fileInput   = document.getElementById("fileInput");
const preview     = document.getElementById("preview");
const uploadInfo  = document.getElementById("uploadInfo");
const uploadName  = document.getElementById("uploadName");
const uploadStatus= document.getElementById("uploadStatus");
const submitBtn   = document.getElementById("submitBtn");
const activityEl  = document.getElementById("activity");
const rowsTbody   = document.getElementById("rows");

/* ===== STATE ===== */
let uploaded   = null;  // {fileId, url, name} (saat tambah)
let uploading  = false;
let editingId  = null;  // id baris saat edit

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
    }catch(_){
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

/* ===== TIME PICKER (Wheel – baca nilai dari GARIS TENGAH) ===== */
const ITEM_H  = 36;
const VISIBLE = 5;
const SPACER  = ((VISIBLE-1)/2) * ITEM_H;

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
  let dragging = false, startY = 0, startTop = 0, pid = 0;
  let isSnapping = false;
  let timer = null;

  el.addEventListener("pointerdown", (e)=>{
    dragging = true;
    startY = e.clientY;
    startTop = el.scrollTop;
    pid = e.pointerId;
    el.setPointerCapture(pid);
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

/* ===== GALERI MODE: pastikan file input buka galeri, bukan kamera ===== */
function forceGalleryPicker(){
  try{
    fileInput.setAttribute("accept","image/*");
    fileInput.removeAttribute("capture"); // <— penting: hilangkan hint kamera
  }catch(_){}
}

/* ====== Paksa PNG dari sisi klien (untuk HP) ====== */
/** Render file ke <canvas> → ambil blob PNG
 *  Jika browser tak bisa decode (HEIC dll), akan fallback kirim file asli.
 */
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

  // (Opsional) resize di sini bila mau batasi dimensi
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  const pngBlob = await new Promise((resolve) => {
    if (!canvas.toBlob) {
      try {
        const dataUrl = canvas.toDataURL("image/png");
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
    try { canvas.toBlob(b => resolve(b || file), "image/png"); }
    catch { resolve(file); }
  });

  try { if ('close' in source) source.close(); } catch {}
  if (revokeUrl) { try { URL.revokeObjectURL(revokeUrl); } catch {} }

  return pngBlob;
}

async function fileToBase64(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ===== UPLOAD FOTO (hanya saat TAMBAH) ===== */
// UBAHAN: File System Access API → galeri; fallback input file tanpa "capture"
pickPhoto.addEventListener("click", async () => {
  if (editingId) return;
  forceGalleryPicker();

  try{
    if (window.showOpenFilePicker){
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: true,
        startIn: "pictures",
        types: [{
          description: "Foto",
          accept: { "image/*": [".jpg",".jpeg",".png",".gif",".webp",".heic"] }
        }]
      });
      const file = await handle.getFile();
      const dt = new DataTransfer(); dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
  }catch(_){
    // fallback
  }

  fileInput.click();
});

fileInput.addEventListener("change", async (ev) => {
  if (editingId) return;
  const file = ev.target.files?.[0];
  if (!file) return;

  uploadInfo.classList.remove("hidden");
  uploadName.textContent = file.name;
  uploadStatus.textContent = "Mengunggah foto…";

  try{
    uploading = true; setSubmitEnabled();
    showOverlay("loading", "Mengunggah foto…", "Mohon tunggu sebentar");

    // === UBAHAN PENTING: paksa PNG untuk preview & upload ===
    const pngBlob = await normalizeToPNG(file);
    const pngName = (file.name.replace(/\.[^.]+$/,"") || "photo") + ".png";

    // Preview gunakan PNG yang sama dengan yang diupload
    const objectUrl = URL.createObjectURL(pngBlob);
    preview.src = objectUrl;

    // Upload base64 PNG
    const base64 = await fileToBase64(pngBlob);
    const payload = { token: SHARED_TOKEN, action: "upload", filename: pngName, mimeType: "image/png", dataUrl: base64 };

    const res = await fetch(SCRIPT_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "Upload gagal");

    uploaded = { fileId: json.fileId, url: json.url, name: pngName };
    uploadStatus.textContent = "Upload selesai ✅";
    showOverlay("ok", "Berhasil diunggah", "Foto tersimpan di Drive");

    // (Opsional) URL.revokeObjectURL(objectUrl); // kalau sudah tidak perlu preview
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
      showOverlay("loading","Menyimpan perubahan…","");

      const res = await fetch(SCRIPT_URL, {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ token: SHARED_TOKEN, action: "updateLog", id: editingId, time: timeStr, activity })
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
    showOverlay("loading", "Menyimpan logbook…", "Mengirim data ke Spreadsheet");

    const res = await fetch(SCRIPT_URL, {
      method: "POST", headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ token: SHARED_TOKEN, action: "createLog", time: timeStr, activity, fileId: uploaded.fileId })
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
let pressTimer = null;
let longFired  = false;

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
  if (!confirm("Hapus entri ini?")) return;
  try{
    showOverlay("loading","Menghapus data…","");
    const res = await fetch(SCRIPT_URL, {
      method:"POST", headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ token:SHARED_TOKEN, action:"deleteLog", id })
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

/* deteksi long-press pada baris */
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
  timeLabel.textContent = "Pilih Waktu";
  setModeEdit(false);
  disableNativeTimePicker();
  forceGalleryPicker(); // pastikan input siap galeri
  await loadRows();
});
