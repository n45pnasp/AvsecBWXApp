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
let uploaded   = null;
let uploading  = false;
let editingId  = null;

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
    uploaded = null;
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

/* ===== TIME PICKER (wheel; baca item tepat di garis tengah) ===== */
const ITEM_H = 36;
const VISIBLE = 5;
const SPACER = ((VISIBLE-1)/2) * ITEM_H;

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

/* >>> Perbaikan inti <<<  */
/* Posisi yang benar agar item i tepat di tengah viewport */
function snapToCenter(el, idx){
  el.scrollTop = idx * ITEM_H; // BUKAN SPACER + idx*ITEM_H
}
/* Cari item yg pusatnya paling dekat dgn garis tengah */
function centerIndex(el, max){
  const rect = el.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  let best = Infinity, idx = 0;
  el.querySelectorAll(".item").forEach(n=>{
    const r = n.getBoundingClientRect();
    const d = Math.abs((r.top + r.height/2) - midY);
    if (d < best){ best = d; idx = +n.dataset.val; }
  });
  return clamp(idx, 0, max);
}

function enableWheel(el, max){
  let dragging = false, startY = 0, startTop = 0, pid = 0;
  let timer = null, isSnapping = false;
  const MAX_TOP = max * ITEM_H; // batas keras

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
    let t = startTop + (e.clientY - startY);
    if (t < 0) t = 0;
    if (t > MAX_TOP) t = MAX_TOP;     // stop mentok atas/bawah
    el.scrollTop = t;
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

  el.addEventListener("scroll", ()=>{
    if (isSnapping) return;
    // jaga-jaga kalau ada inertia yang lewat batas
    if (el.scrollTop < 0){ el.scrollTop = 0; return; }
    if (el.scrollTop > MAX_TOP){ el.scrollTop = MAX_TOP; return; }
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
    const [hh, mm] = timeInput.value.split(":");
    h = clamp(parseInt(hh||"0",10), 0, 23);
    m = clamp(parseInt(mm||"0",10), 0, 59);
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
/* selalu pakai wheel */
function disableNativeTimePicker(){
  timeInput.setAttribute("readonly", "");
  timeInput.setAttribute("inputmode","none");
  timeInput.addEventListener("focus", (e)=>{ e.preventDefault(); e.target.blur(); openTimePicker(); });
  timeBtn.addEventListener("click", openTimePicker);
}
btnCancel.addEventListener("click", () => closeTimePicker(false));
btnSave  .addEventListener("click", () => closeTimePicker(true));

/* ===== UPLOAD FOTO (tambah) ===== */
pickPhoto.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async (ev) => {
  if (editingId) return;
  const file = ev.target.files?.[0];
  if (!file) return;

  uploadInfo.classList.remove("hidden");
  uploadName.textContent = file.name;
  uploadStatus.textContent = "Mengunggah foto…";
  const objectUrl = URL.createObjectURL(file);
  preview.src = objectUrl;

  try{
    uploading = true; setSubmitEnabled();
    showOverlay("loading", "Mengunggah foto…", "Mohon tunggu sebentar");

    const base64 = await fileToBase64(file);
    const payload = { token: SHARED_TOKEN, action: "upload", filename: file.name, mimeType: file.type || "image/jpeg", dataUrl: base64 };

    const res = await fetch(SCRIPT_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "Upload gagal");

    uploaded = { fileId: json.fileId, url: json.url, name: file.name };
    uploadStatus.textContent = "Upload selesai ✅";
    showOverlay("ok", "Berhasil diunggah", "Foto tersimpan di Drive");
  }catch(err){
    console.error(err);
    uploaded = null;
    uploadStatus.textContent = "Upload gagal ❌";
    showOverlay("err", "Gagal mengunggah", err.message || "Coba lagi");
  }finally{
    URL.revokeObjectURL(objectUrl);
    uploading = false; setSubmitEnabled();
  }
});
async function fileToBase64(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ===== SUBMIT ===== */
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

/* ===== TABEL ===== */
async function loadRows(){
  rowsTbody.innerHTML = `<tr><td colspan="4">Memuat…</td></tr>`;
  try{
    const url = new URL(SCRIPT_URL);
    url.searchParams.set("action","list");
    url.searchParams.set("token",SHARED_TOKEN);

    const res = await fetch(url.toString(), { method:"GET" });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "Gagal memuat");

    rowsTbody.innerHTML = "";
    if (!json.rows || !json.rows.length) {
      rowsTbody.innerHTML = `<tr><td colspan="4" class="muted">Belum ada data</td></tr>`;
      return;
    }

    for (const r of json.rows){
      const id = r.id ?? "";
      const imgUrl = toImageUrl(r.fileUrl || "", r.fileId || "");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${fmtTimeWIB(r.time || r.createdAt || "")}</td>
        <td>${escapeHtml(r.activity || "-")}</td>
        <td>${imgUrl ? `<button class="icon-btn btn-view" data-url="${imgUrl}" title="Lihat foto">
              <svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>` : "-"}</td>
        <td>
          <div class="actions">
            <button class="icon-btn btn-edit" data-id="${id}" data-time="${r.time||''}" data-activity="${escapeHtml(r.activity||'')}" title="Edit">
              <svg viewBox="0 0 24 24"><path d="M3 21h4l11-11-4-4L3 17v4Z"/><path d="M15 5l4 4"/></svg>
            </button>
            <button class="icon-btn btn-del" data-id="${id}" title="Hapus">
              <svg viewBox="0 0 24 24"><path d="M3 6h18"/><path d="M8 6v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6l1-2h4l1 2"/></svg>
            </button>
          </div>
        </td>
      `;
      rowsTbody.appendChild(tr);
    }
  }catch(err){
    console.error(err);
    rowsTbody.innerHTML = `<tr><td colspan="4">Gagal memuat data</td></tr>`;
  }
}
function escapeHtml(s){ return (s||"").replace(/[&<>"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c])); }
function toImageUrl(url, fileId){
  const id = fileId || (url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] || "");
  return id ? (`https://drive.google.com/uc?export=view&id=${id}`) : (url || "");
}
rowsTbody.addEventListener("click", async (e) => {
  const view = e.target.closest(".btn-view");
  const edit = e.target.closest(".btn-edit");
  const del  = e.target.closest(".btn-del");
  if (view){ openPhoto(view.dataset.url); return; }
  if (edit){
    const id = edit.dataset.id;
    if (!id){ alert("Tidak ada ID data dari server."); return; }
    const t  = edit.dataset.time || "";
    const a  = decodeHTMLEntities(edit.dataset.activity || "");
    enterEditMode(id, t, a);
    return;
  }
  if (del){
    const id = del.dataset.id;
    if (!id){ alert("Tidak ada ID data dari server."); return; }
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
  }
});
function decodeHTMLEntities(s){ const el = document.createElement("textarea"); el.innerHTML = s; return el.value; }

/* ===== MODAL FOTO ===== */
const photoModal = document.getElementById("photoModal");
const photoImg   = document.getElementById("photoImg");
document.getElementById("photoClose").addEventListener("click", closePhoto);
photoModal.addEventListener("click", (e)=>{ if(e.target===photoModal) closePhoto(); });
function openPhoto(url){ if(!url) return; photoImg.src = url; photoModal.classList.remove("hidden"); }
function closePhoto(){ photoModal.classList.add("hidden"); photoImg.removeAttribute("src"); }

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", async () => {
  timeLabel.textContent = "Pilih Waktu";
  setModeEdit(false);
  disableNativeTimePicker();
  await loadRows();
});
