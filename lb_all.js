/* ===== KONFIG ===== */
const SCRIPT_URL   = "https://logbk.avsecbwx2018.workers.dev"; // Worker kamu
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
let uploaded = null;   // {fileId, url, name}
let uploading = false;

/* ===== UTIL ===== */
const pad2 = (n)=> String(n).padStart(2,"0");

/* Format tampilan waktu -> "HH:MM WIB" */
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
      const str = new Intl.DateTimeFormat("id-ID", {hour:"2-digit", minute:"2-digit", hour12:false, timeZone:"Asia/Jakarta"}).format(d);
      return `${str} WIB`;
    }catch(e){
      return `${pad2(d.getHours())}:${pad2(d.getMinutes())} WIB`;
    }
  }
  return s;
}

/* ===== TIME PICKER (WHEEL) ===== */
const ITEM_H = 36;
const VISIBLE = 5;
const SPACER = ((VISIBLE-1)/2) * ITEM_H;

const timeModal = document.getElementById("timeModal");
const wheelHour = document.getElementById("wheelHour");
const wheelMin  = document.getElementById("wheelMin");
const btnCancel = timeModal.querySelector(".t-cancel");
const btnSave   = timeModal.querySelector(".t-save");

let selHour = 0, selMin = 0, wheelsBuilt = false;

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

function snapTopFor(el, value){ el.scrollTop = SPACER + value*ITEM_H; }
function nearestVal(el, max){ return Math.min(Math.max(Math.round((el.scrollTop - SPACER)/ITEM_H), 0), max); }

function enableScroll(el, max, setSel){
  let timer = null;
  el.addEventListener("scroll", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const v = nearestVal(el, max);
      snapTopFor(el, v);
      setSel(v);
    }, 100);
  }, { passive:true });

  // biar trackpad/mousewheel juga halus
  el.addEventListener("wheel", (e) => {
    e.preventDefault();
    el.scrollTop += e.deltaY;
  }, { passive:false });
}

function openTimePicker(){
  if (!wheelsBuilt){
    buildWheel(wheelHour, 24);
    buildWheel(wheelMin, 60);
    enableScroll(wheelHour, 23, v => selHour = v);
    enableScroll(wheelMin, 59,  v => selMin  = v);
    wheelsBuilt = true;
  }
  let h = 0, m = 0;
  if (timeInput.value){
    const [hh, mm] = timeInput.value.split(":"); h = parseInt(hh||"0",10); m = parseInt(mm||"0",10);
  }else{
    const now = new Date(); h = now.getHours(); m = now.getMinutes();
  }
  selHour = h; selMin = m;
  snapTopFor(wheelHour, h);
  snapTopFor(wheelMin, m);
  timeModal.classList.remove("hidden");
}
function closeTimePicker(save){
  if (save){
    const val = `${pad2(selHour)}:${pad2(selMin)}`;
    timeInput.value = val;
    timeLabel.textContent = val;
    setSubmitEnabled();
  }
  timeModal.classList.add("hidden");
}
timeBtn.addEventListener("click", openTimePicker);
btnCancel.addEventListener("click", () => closeTimePicker(false));
btnSave.addEventListener("click",   () => closeTimePicker(true));

/* ===== ENABLING ===== */
function setSubmitEnabled(){
  const ok = !!timeInput.value && !!activityEl.value.trim() && !!uploaded?.fileId && !uploading;
  submitBtn.disabled = !ok;
}
activityEl.addEventListener("input", setSubmitEnabled);

/* ===== UPLOAD FOTO ===== */
pickPhoto.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;

  uploadInfo.classList.remove("hidden");
  uploadName.textContent = file.name;
  uploadStatus.textContent = "Mengunggah foto…";
  const reader = new FileReader();
  reader.onload = (e) => { preview.src = e.target.result; };
  reader.readAsDataURL(file);

  try{
    uploading = true; setSubmitEnabled();
    showOverlay("loading", "Mengunggah foto…", "Mohon tunggu sebentar");

    const base64 = await fileToBase64(file);
    const payload = { token: SHARED_TOKEN, action: "upload", filename: file.name, mimeType: file.type || "image/jpeg", dataUrl: base64 };

    const res = await fetch(SCRIPT_URL, { method: "POST", headers: { "Content-Type":"application/json" }, body: JSON.stringify(payload) });
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

/* ===== SUBMIT LOG ===== */
document.getElementById("submitBtn").addEventListener("click", async () => {
  if (submitBtn.disabled) return;
  const timeStr = timeInput.value;
  const activity = activityEl.value.trim();
  if (!timeStr || !activity || !uploaded?.fileId) return;

  try{
    submitBtn.disabled = true;
    showOverlay("loading", "Menyimpan logbook…", "Mengirim data ke Spreadsheet");

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify({ token: SHARED_TOKEN, action: "createLog", time: timeStr, activity, fileId: uploaded.fileId })
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "Gagal menyimpan");

    showOverlay("ok", "Tersimpan", "Logbook berhasil ditambahkan");

    // reset
    timeInput.value = ""; timeLabel.textContent = "Pilih Waktu";
    activityEl.value = ""; uploaded = null;
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
  rowsTbody.innerHTML = `<tr><td colspan="3">Memuat…</td></tr>`;
  try{
    const url = new URL(SCRIPT_URL);
    url.searchParams.set("action","list");
    url.searchParams.set("token",SHARED_TOKEN);

    const res = await fetch(url.toString(), { method:"GET" });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "Gagal memuat");

    rowsTbody.innerHTML = "";
    if (!json.rows || !json.rows.length) {
      rowsTbody.innerHTML = `<tr><td colspan="3" class="muted">Belum ada data</td></tr>`;
      return;
    }

    for (const r of json.rows){
      const tr = document.createElement("tr");
      const timeDisp = fmtTimeWIB(r.time || r.createdAt || "");
      tr.innerHTML = `
        <td>${timeDisp}</td>
        <td>${escapeHtml(r.activity || "-")}</td>
        <td>${r.fileUrl ? `<button class="btn btn-view" data-url="${r.fileUrl}">Lihat</button>` : "-"}</td>
      `;
      rowsTbody.appendChild(tr);
    }
  }catch(err){
    console.error(err);
    rowsTbody.innerHTML = `<tr><td colspan="3">Gagal memuat data</td></tr>`;
  }
}
rowsTbody.addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-view");
  if (!btn) return;
  openPhoto(btn.dataset.url);
});
function escapeHtml(s){ return (s||"").replace(/[&<>"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c])); }

/* ===== MODAL FOTO ===== */
const photoModal = document.getElementById("photoModal");
const photoImg   = document.getElementById("photoImg");
document.getElementById("photoClose").addEventListener("click", closePhoto);
photoModal.addEventListener("click", (e)=>{ if(e.target===photoModal) closePhoto(); });

function openPhoto(url){
  photoImg.src = url;
  photoModal.classList.remove("hidden");
}
function closePhoto(){
  photoModal.classList.add("hidden");
  photoImg.removeAttribute("src");
}

/* ===== OVERLAY UPLOAD ===== */
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

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", async () => {
  // label awal
  timeLabel.textContent = "Pilih Waktu";
  setSubmitEnabled();
  await loadRows();
});
