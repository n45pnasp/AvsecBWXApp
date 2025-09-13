import { requireAuth } from "./auth-guard.js";
import { capturePhoto, dataUrlToFile, makePhotoName } from "./camera.js";

// Lindungi halaman: user harus login
requireAuth({ loginPath: "index.html", hideWhileChecking: true });

/* ===== Konfigurasi ===== */
const WORKER_URL   = "https://fuel.avsecbwx2018.workers.dev/";
const SHARED_TOKEN = "N45p";
const COUPON_PAGE  = "https://n45pnasp.github.io/AvsecBWXApp/coupon.html";

/* ===== Helper ===== */
const $  = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));

async function fetchJson(url, options) {
  const res  = await fetch(url, options);
  const ct   = res.headers.get("content-type") || "";
  const text = await res.text();
  if (!ct.includes("application/json")) {
    throw new Error(`Respon bukan JSON (status ${res.status}): ${text.slice(0,120)}`);
  }
  return JSON.parse(text);
}

function rupiah(n) {
  const v = Math.round(Number(n || 0));
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
const round2 = (n)=> Math.round(Number(n||0)*100)/100;

/* ===== Elemen DOM ===== */
const unitSel       = $("#unit");
const jenisSel      = $("#jenis");
const keperluanSel  = $("#keperluan");
const literInput    = $("#liter");
const hargaEl       = $("#harga");
const btnKirim      = $("#btnKirim");
const msg1          = $("#msg1");

const cardInput     = $("#cardInput");
const cardCetak     = $("#cardCetak");
const idList        = $("#idList");
const btnPdf        = $("#btnPdf");

const cardFoto      = $("#cardFoto");
const fileInput     = $("#file");
const preview       = $("#preview");
const msg3          = $("#msg3");
const fotoBtn       = $("#fotoBtn");

const tabInputBtn   = $("#tabInput");
const tabKuponBtn   = $("#tabKupon");
const tabFotoBtn    = $("#tabFoto");

// Overlay spinner (dibuat null-safe)
const overlay = $("#overlay");
const ovTitle = $("#ovTitle");
const ovDesc  = $("#ovDesc");
function showOverlay(title = "Mengambil data…", desc = "") {
  if (ovTitle) ovTitle.textContent = title;
  if (ovDesc)  ovDesc.textContent  = desc;
  if (overlay) overlay.classList.remove("hidden");
}
function hideOverlay() {
  if (overlay) overlay.classList.add("hidden");
}

/* Tambahan: tampilkan Sisa Kuota di bawah Total Harga */
const priceRow = hargaEl.closest(".row");
const quotaRow = document.createElement("div");
quotaRow.className = "row";
quotaRow.innerHTML = `<div class="info">Sisa Kuota</div><div class="badge" id="quotaInfo">-</div>`;
priceRow.after(quotaRow);
const quotaInfo = $("#quotaInfo");

/* Buat dropdown ID untuk foto (disisipkan via JS agar HTML tetap ringkas) */
let photoIdSel = null;
const photoIdWrap = document.getElementById("photoIdWrap");
(function injectPhotoIdSelect(){
  if(!photoIdWrap) return;
  const label = document.createElement("label");
  label.textContent = "Pilih ID (untuk foto)";
  photoIdSel = document.createElement("select");
  photoIdSel.id = "photoId";
  label.appendChild(photoIdSel);
  photoIdWrap.appendChild(label);
})();

/* ===== State ===== */
let unitToNeeds  = {};
let unitToJenis  = {};
let jenisToNeeds = {}; // dari Dropdown A46:B58
let hargaMap     = {};   // jenis → harga
let quotas       = {};   // { Unit: { Jenis: sisaLiters } }
let allRows      = [];   // cache list data
let hasPrintable = false;
let activeTab    = 'form';

/* ===== Init ===== */
init();

async function init() {
  showOverlay("Mengambil data…");
  try {
    await loadDropdowns(false);
    await refreshLists("", false);
  } finally {
    hideOverlay();
  }
  attachListeners();
  setTab('form');
  updateHarga();
  checkForm();
}

/* ===== Event Listeners ===== */
function attachListeners() {
  unitSel.addEventListener("change", onUnitChange);
  jenisSel.addEventListener("change", () => { updateKeperluanOptions(); updateHarga(); updateQuotaInfo(); checkForm(); });
  keperluanSel.addEventListener("change", checkForm);
  literInput.addEventListener("input", () => { updateHarga(); checkForm(); });

  btnKirim.addEventListener("click", onKirim);

  idList.addEventListener("change", onPickId);
  btnPdf.addEventListener("click", onOpenPdf);

  photoIdSel.addEventListener("change", () => { preview.classList.add("hidden"); msg3.textContent = ""; });
  fileInput.addEventListener("change", onPickFile);
  fotoBtn?.addEventListener("click", async ()=>{
    try{
      const dataUrl = await capturePhoto();
      if(!dataUrl) return;
      const file = dataUrlToFile(dataUrl);
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dataset.filename = file.name;
      fileInput.dispatchEvent(new Event("change", {bubbles:true}));
    }catch(e){ console.error(e); }
  });

  tabInputBtn.addEventListener("click", () => setTab('form'));
  tabKuponBtn.addEventListener("click", () => setTab('kupon'));
  tabFotoBtn.addEventListener("click", () => setTab('foto'));
}

function setTab(tab){
  activeTab = tab;
  tabInputBtn.classList.remove('active');
  tabKuponBtn.classList.remove('active');
  tabFotoBtn.classList.remove('active');
  cardInput.classList.add('hidden');
  cardCetak.classList.add('hidden');
  cardFoto.classList.add('hidden');
  if(tab === 'form'){
    tabInputBtn.classList.add('active');
    cardInput.classList.remove('hidden');
  } else if(tab === 'kupon'){
    tabKuponBtn.classList.add('active');
    if(hasPrintable) cardCetak.classList.remove('hidden');
  } else if(tab === 'foto'){
    tabFotoBtn.classList.add('active');
    if(hasPrintable) cardFoto.classList.remove('hidden');
  }
}

/* ===== Dropdowns dari server ===== */
async function loadDropdowns(showSpin = true) {
  if (showSpin) showOverlay("Mengambil data…");
  try {
    const url = `${WORKER_URL}?action=dropdowns&token=${encodeURIComponent(SHARED_TOKEN)}`;
    const res = await fetchJson(url);

    if (!res || !res.ok) throw new Error(res && res.error || "Gagal memuat dropdowns");

    unitToNeeds  = res.unitToNeeds  || {};
    unitToJenis  = res.unitToJenis  || {};
    jenisToNeeds = res.jenisToNeeds || {};
    quotas       = res.quotas       || {};
    const fuels  = res.fuels || [];

    // Unit
    unitSel.innerHTML = '<option value="">Pilih Unit Kerja</option>';
    const units = Object.keys({ ...unitToNeeds, ...unitToJenis, ...quotas }).sort();
    units.forEach(u => unitSel.add(new Option(u, u)));

    // Harga per jenis
    hargaMap = {};
    fuels.forEach(f => {
      const j = String(f.jenis || "").toUpperCase();
      const h = Number(f.harga || 0);
      if (j) hargaMap[j] = h;
    });

    // Jenis & Keperluan akan diisi ketika unit dipilih
    jenisSel.innerHTML     = '<option value="">Pilih Jenis BBM</option>';
    keperluanSel.innerHTML = '<option value="">Pilih Keperluan</option>';
    keperluanSel.disabled  = true;
    jenisSel.disabled      = true;

    updateQuotaInfo();
  } finally {
    if (showSpin) hideOverlay();
  }
}

function onUnitChange() {
  const unit = unitSel.value;

  // Jenis BBM sesuai unit (fallback: semua jenis yg punya harga)
  const allowedJenis = (unit && unitToJenis[unit] && unitToJenis[unit].length)
    ? unitToJenis[unit].map(s => s.toUpperCase())
    : Object.keys(hargaMap);

  jenisSel.innerHTML = '<option value="">Pilih Jenis BBM</option>';
  allowedJenis.forEach(j => jenisSel.add(new Option(j, j)));
  jenisSel.disabled = allowedJenis.length === 0;

  // Keperluan akan di-filter lagi berdasarkan jenis
  updateKeperluanOptions();

  updateHarga();
  updateQuotaInfo();
  checkForm();
}

/* ===== Keperluan (irisan unit & jenis) ===== */
function updateKeperluanOptions(){
  const unit  = unitSel.value;
  const jenis = (jenisSel.value || "").toUpperCase();

  const fromUnit  = unitToNeeds[unit] || [];
  const fromJenis = jenisToNeeds[jenis] || [];

  const setB = new Set(fromJenis.map(x => String(x)));
  const allowed = fromUnit.filter(x => setB.has(String(x)));

  keperluanSel.innerHTML = '<option value="">Pilih Keperluan</option>';
  if (allowed.length) {
    allowed.forEach(k => keperluanSel.add(new Option(k, k)));
    keperluanSel.disabled = false;
  } else {
    keperluanSel.disabled = true;
  }
}

/* ===== Harga ===== */
function updateHarga() {
  const jenis = (jenisSel.value || "").toUpperCase();
  const liter = parseFloat(literInput.value || "0");
  const harga = (hargaMap[jenis] || 0) * (isFinite(liter) ? liter : 0);
  hargaEl.textContent = `Rp ${rupiah(harga)}`;
}

/* ===== Kuota (UI) ===== */
function getSisaQuota(unit, jenis){
  const byUnit = quotas[unit] || {};
  return round2(Number(byUnit[(jenis||"").toUpperCase()] || 0));
}
function updateQuotaInfo(){
  const unit  = unitSel.value;
  const jenis = (jenisSel.value || "").toUpperCase();
  if (!unit || !quotas[unit]) { quotaInfo.textContent = "-"; return; }

  const pertamax = getSisaQuota(unit, "PERTAMAX");
  const dexlite  = getSisaQuota(unit, "DEXLITE");

  if (!jenis) {
    quotaInfo.textContent = `PERTAMAX: ${pertamax.toFixed(2)} L | DEXLITE: ${dexlite.toFixed(2)} L`;
  } else {
    const s = getSisaQuota(unit, jenis);
    quotaInfo.textContent = `${jenis}: ${s.toFixed(2)} L`;
  }
}

/* ===== Validasi Form ===== */
function checkForm() {
  const unit  = unitSel.value;
  const jenis = (jenisSel.value || "").toUpperCase();
  const liter = parseFloat(literInput.value || "0");
  const baseOk = unit && jenis && keperluanSel.value && Number.isFinite(liter) && liter > 0;

  let ok = baseOk;
  if (baseOk){
    const sisa = getSisaQuota(unit, jenis);
    if (liter > sisa) ok = false;
  }
  btnKirim.disabled = !ok;
}

/* ===== Create (POST) ===== */
async function onKirim() {
  if (btnKirim.disabled) return;

  const unit  = unitSel.value;
  const jenis = (jenisSel.value || "").toUpperCase();
  const liter = parseFloat(literInput.value || "0");

  const sisa = getSisaQuota(unit, jenis);
  if (liter > sisa) {
    alert(`Sisa kuota ${jenis} untuk ${unit} tidak mencukupi.\nSisa: ${sisa.toFixed(2)} L, diminta: ${liter} L`);
    return;
  }

  const payload = {
    action   : "create",
    unit     : unit,
    jenis    : jenis,
    liter    : liter,
    keperluan: keperluanSel.value,
    token    : SHARED_TOKEN
  };

  msg1.textContent = "Mengirim…";
  btnKirim.disabled = true;
  showOverlay("Mengirim data…");

  try {
    const res = await fetchJson(WORKER_URL, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify(payload)
    });

    if (res && res.ok) {
      msg1.textContent = `Terkirim (ID: ${res.id})`;

      // update kuota lokal (kurangi) & UI
      if (!quotas[unit]) quotas[unit] = {};
      quotas[unit][jenis] = round2(Math.max(0, (quotas[unit][jenis]||0) - liter));
      updateQuotaInfo();

      // reset form
      unitSel.value = "";
      jenisSel.innerHTML = '<option value="">Pilih Jenis BBM</option>';
      jenisSel.disabled  = true;
      keperluanSel.innerHTML = '<option value="">Pilih Keperluan</option>';
      keperluanSel.disabled  = true;
      literInput.value = "";
      updateHarga();
      checkForm();
      updateQuotaInfo();

      // refresh list ID
      await refreshLists(res.id, false);
    } else {
      msg1.textContent = (res && res.error) || "Gagal mengirim";
      // jika server kirim quotaLeft, sinkronkan
      if (res && typeof res.quotaLeft === "number"){
        if (!quotas[unit]) quotas[unit] = {};
        quotas[unit][jenis] = round2(res.quotaLeft);
        updateQuotaInfo();
      }
    }
  } catch (e) {
    console.error(e);
    msg1.textContent = "Jaringan bermasalah";
  } finally {
    btnKirim.disabled = false;
    hideOverlay();
  }
}

/* ===== List IDs ===== */
async function refreshLists(selectId = "", showSpin = true) {
  if (showSpin) showOverlay("Memuat daftar…");
  try {
    const res = await fetchJson(`${WORKER_URL}?action=list&token=${encodeURIComponent(SHARED_TOKEN)}`);
    allRows = res.rows || [];

    // --- Data berstatus cetak
    const printable = allRows.filter(r => String(r.verified || "").toLowerCase() === "cetak");
    hasPrintable = printable.length > 0;
    idList.innerHTML = '<option value="">Pilih ID</option>';
    printable.forEach(row => idList.add(new Option(row.id, row.id)));

    photoIdSel.innerHTML = '<option value="">Pilih ID</option>';
    printable.forEach(row => photoIdSel.add(new Option(row.id, row.id)));

    // auto-select ID baru pada kedua dropdown jika ada
    if (selectId && printable.find(r => r.id === selectId)) {
      idList.value = selectId;
      photoIdSel.value = selectId;
      if (idList.value) onPickId();
    } else {
      btnPdf.disabled = true;
    }
  } finally {
    if (showSpin) hideOverlay();
    setTab(activeTab);
  }
}

function onPickId() {
  const id = idList.value || "";
  const row = allRows.find(r => r.id === id);
  const v   = (row && row.verified) ? String(row.verified) : "";

  btnPdf.disabled = v.toLowerCase() !== "cetak";
  if (photoIdSel) photoIdSel.value = id;
}

/* ===== Cetak Kupon ===== */
function onOpenPdf() {
  const id = idList.value || "";
  if (!id) return;
  const url = `${COUPON_PAGE}?id=${encodeURIComponent(id)}`;
  const win = window.open(url, "_blank");
  if (!win) location.href = url; // fallback jika popup diblok
}

/* ===== Upload Foto ===== */
async function onPickFile(e) {
  const id = photoIdSel.value || "";
  const file = e.target.files && e.target.files[0];

  if (!id) {
    msg3.textContent = "Pilih ID terlebih dulu.";
    fileInput.value = "";
    return;
  }
  if (!file) return;

  try {
    const dataUrl = await readAsDataURL(file, 1280);
    preview.src = dataUrl;
    preview.classList.remove("hidden");
    msg3.textContent = "Mengunggah…";
    showOverlay("Mengunggah foto…");

    const filename = fileInput.dataset.filename || makePhotoName();
    const res = await fetchJson(WORKER_URL, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({
        action: "uploadphoto",
        id,
        filename,
        dataUrl,
        token: SHARED_TOKEN
      })
    });

    msg3.textContent = (res && res.ok) ? "Foto tersimpan" : ((res && res.error) || "Gagal upload");
  } catch (err) {
    console.error(err);
    msg3.textContent = "Jaringan bermasalah";
  } finally {
    fileInput.value = "";
    hideOverlay();
    fileInput.dataset.filename = "";
  }
}

/* ===== Utils ===== */
function readAsDataURL(file, maxSize = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
