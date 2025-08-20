/* ===== KONFIG ===== */
const SCRIPT_URL   = "https://logbk.avsecbwx2018.workers.dev"; // URL WORKER kamu
const SHARED_TOKEN = "N45p";

/* ===== DOM ===== */
const timeInput   = document.getElementById("timeInput");
const timeLabel   = document.getElementById("timeLabel");
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
function setSubmitEnabled(){
  const timeOk = !!timeInput.value;
  const actOk  = !!activityEl.value.trim();
  const photoOk= !!uploaded?.fileId;
  submitBtn.disabled = !(timeOk && actOk && photoOk && !uploading);
}

/* ===== UI BINDINGS ===== */
// Buka time picker walau input disembunyikan
const timeBtnLike = document.querySelector(".btn-like");
timeBtnLike.addEventListener("click", () => {
  if (typeof timeInput.showPicker === "function") timeInput.showPicker();
  else timeInput.focus();
});
// Sebagian browser emit 'input' (bukan 'change') saat memilih waktu
function syncTimeLabel(){ timeLabel.textContent = timeInput.value || "Pilih Waktu"; setSubmitEnabled(); }
timeInput.addEventListener("input",  syncTimeLabel);
timeInput.addEventListener("change", syncTimeLabel);

// Enable tombol saat user mengetik kegiatan
activityEl.addEventListener("input", setSubmitEnabled);

// Upload foto
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
    const payload = {
      token: SHARED_TOKEN,
      action: "upload",
      filename: file.name,
      mimeType: file.type || "image/jpeg",
      dataUrl: base64
    };

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
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
      body: JSON.stringify({
        token: SHARED_TOKEN,
        action: "createLog",
        time: timeStr,
        activity,
        fileId: uploaded.fileId
      })
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || "Gagal menyimpan");

    showOverlay("ok", "Tersimpan", "Logbook berhasil ditambahkan");
    timeInput.value = "";
    timeLabel.textContent = "Pilih Waktu";
    activityEl.value = "";
    uploaded = null;
    uploadInfo.classList.add("hidden");
    preview.removeAttribute("src");
    setSubmitEnabled();

    await loadRows();
  }catch(err){
    console.error(err);
    showOverlay("err", "Gagal menyimpan", err.message || "Coba lagi");
  }finally{
    submitBtn.disabled = false;
  }
});

/* ===== LOAD TABLE ===== */
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
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(r.time || "-")}</td>
        <td>${escapeHtml(r.activity || "-")}</td>
        <td>${r.fileUrl ? `<a href="${r.fileUrl}" target="_blank" rel="noopener">Buka</a>` : "-"}</td>
        <td>${escapeHtml(r.createdAt || "-")}</td>
      `;
      rowsTbody.appendChild(tr);
    }
  }catch(err){
    console.error(err);
    rowsTbody.innerHTML = `<tr><td colspan="4">Gagal memuat data</td></tr>`;
  }
}
function escapeHtml(s){ return (s||"").replace(/[&<>"]/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c])); }

/* ===== INIT ===== */
document.addEventListener("DOMContentLoaded", async () => {
  setSubmitEnabled();
  await loadRows();
});
