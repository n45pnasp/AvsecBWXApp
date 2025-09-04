import { requireAuth } from "./auth-guard.js";

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

/* ===== Elemen DOM ===== */
const unitSel       = $("#unit");
const jenisSel      = $("#jenis");
const keperluanSel  = $("#keperluan");
const literInput    = $("#liter");
const hargaEl       = $("#harga");
const btnKirim      = $("#btnKirim");
const msg1          = $("#msg1");

const cardCetak     = $("#cardCetak");
const idList        = $("#idList");
const verStat       = $("#verStat");
const btnPdf        = $("#btnPdf");

const cardFoto      = $("#cardFoto");
const fileInput     = $("#file");
const preview       = $("#preview");
const msg3          = $("#msg3");

// Overlay spinner
const overlay = $("#overlay");
const ovTitle = $("#ovTitle");
const ovDesc  = $("#ovDesc");

function showOverlay(title = "Memuat…", desc = "") {
  ovTitle.textContent = title;
  ovDesc.textContent = desc;
  overlay.classList.remove("hidden");
}
function hideOverlay() {
  overlay.classList.add("hidden");
}

/* Buat dropdown ID untuk foto (disisipkan via JS agar HTML tetap ringkas) */
let photoIdSel = null;
(function injectPhotoIdSelect(){
  const label = document.createElement("label");
  label.textContent = "Pilih ID (untuk foto)";
  photoIdSel = document.createElement("select");
  photoIdSel.id = "photoId";
  label.appendChild(photoIdSel);
  cardFoto.insertBefore(label, fileInput);
})();

/* ===== State ===== */
let unitToNeeds = {};
let unitToJenis = {};
let hargaMap    = {};   // jenis → harga
let allRows     = [];   // cache list data

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
  updateHarga();
  checkForm();
}

/* ===== Event Listeners ===== */
function attachListeners() {
  unitSel.addEventListener("change", onUnitChange);
  jenisSel.addEventListener("change", () => { updateHarga(); checkForm(); });
  keperluanSel.addEventListener("change", checkForm);
  literInput.addEventListener("input", () => { updateHarga(); checkForm(); });

  btnKirim.addEventListener("click", onKirim);

  idList.addEventListener("change", onPickId);
  btnPdf.addEventListener("click", onOpenPdf);

  photoIdSel.addEventListener("change", () => { preview.classList.add("hidden"); msg3.textContent = ""; });
  fileInput.addEventListener("change", onPickFile);
}

/* ===== Dropdowns dari server ===== */
async function loadDropdowns(showSpin = true) {
  if (showSpin) showOverlay("Mengambil data…");
  try {
    const url = `${WORKER_URL}?action=dropdowns&token=${encodeURIComponent(SHARED_TOKEN)}`;
    const res = await fetchJson(url);

    if (!res || !res.ok) throw new Error(res && res.error || "Gagal memuat dropdowns");

    unitToNeeds = res.unitToNeeds || {};
    unitToJenis = res.unitToJenis || {};
    const fuels = res.fuels || [];

    // Unit
    unitSel.innerHTML = '<option value="">Pilih Unit Kerja</option>';
    const units = Object.keys({ ...unitToNeeds, ...unitToJenis }).sort();
    units.forEach(u => unitSel.add(new Option(u, u)));

    // Harga per jenis
    hargaMap = {};
    fuels.forEach(f => {
      const j = String(f.jenis || "").toUpperCase();
      const h = Number(f.harga || 0);
      if (j) hargaMap[j] = h;
    });

    // Jenis & keperluan akan diisi ketika unit dipilih
    jenisSel.innerHTML     = '<option value="">Pilih Jenis BBM</option>';
    keperluanSel.innerHTML = '<option value="">Pilih Keperluan</option>';
    keperluanSel.disabled  = true;
    jenisSel.disabled      = true;
  } finally {
    if (showSpin) hideOverlay();
  }
}

function onUnitChange() {
  const unit = unitSel.value;

  // Keperluan
  keperluanSel.innerHTML = '<option value="">Pilih Keperluan</option>';
  if (unit && unitToNeeds[unit] && unitToNeeds[unit].length) {
    unitToNeeds[unit].forEach(k => keperluanSel.add(new Option(k, k)));
    keperluanSel.disabled = false;
  } else {
    keperluanSel.disabled = true;
  }

  // Jenis BBM sesuai unit (fallback: semua jenis yg punya harga)
  const allowedJenis = (unit && unitToJenis[unit] && unitToJenis[unit].length)
    ? unitToJenis[unit].map(s => s.toUpperCase())
    : Object.keys(hargaMap);

  jenisSel.innerHTML = '<option value="">Pilih Jenis BBM</option>';
  allowedJenis.forEach(j => jenisSel.add(new Option(j, j)));
  jenisSel.disabled = allowedJenis.length === 0;

  updateHarga();
  checkForm();
}

/* ===== Harga ===== */
function updateHarga() {
  const jenis = (jenisSel.value || "").toUpperCase();
  const liter = parseFloat(literInput.value || "0");
  const harga = (hargaMap[jenis] || 0) * (isFinite(liter) ? liter : 0);
  hargaEl.textContent = `Rp ${rupiah(harga)}`;
}

function checkForm() {
  const ok = unitSel.value && jenisSel.value && keperluanSel.value && Number(literInput.value) > 0;
  btnKirim.disabled = !ok;
}

/* ===== Create (POST) ===== */
async function onKirim() {
  if (btnKirim.disabled) return;

  const payload = {
    action   : "create",
    unit     : unitSel.value,
    jenis    : jenisSel.value,
    liter    : parseFloat(literInput.value || "0"),
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

      // reset form
      unitSel.value = "";
      jenisSel.innerHTML = '<option value="">Pilih Jenis BBM</option>';
      jenisSel.disabled  = true;
      keperluanSel.innerHTML = '<option value="">Pilih Keperluan</option>';
      keperluanSel.disabled  = true;
      literInput.value = "";
      updateHarga();
      checkForm();

      // refresh list ID
      await refreshLists(res.id, false);
    } else {
      msg1.textContent = (res && res.error) || "Gagal mengirim";
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
  let res;
  try {
    res = await fetchJson(`${WORKER_URL}?action=list&token=${encodeURIComponent(SHARED_TOKEN)}`);
    allRows = res.rows || [];

  // --- Card Cetak (hanya tampil kalau ada yg VERIFIED=cetak)
  const printable = allRows.filter(r => String(r.verified || "").toLowerCase() === "cetak");
  if (printable.length === 0) {
    cardCetak.classList.add("hidden");
  } else {
    cardCetak.classList.remove("hidden");
    idList.innerHTML = '<option value="">Pilih ID</option>';
    printable.forEach(row => idList.add(new Option(row.id, row.id)));
  }

  // --- Dropdown ID untuk foto: hanya baris verified=cetak
  photoIdSel.innerHTML = '<option value="">Pilih ID</option>';
  printable.forEach(row => photoIdSel.add(new Option(row.id, row.id)));
  cardFoto.classList.toggle("hidden", printable.length === 0);

  // auto-select ID baru pada kedua dropdown jika ada
  if (selectId && printable.find(r => r.id === selectId)) {
    idList.value = selectId;
    photoIdSel.value = selectId;
    if (idList.value) onPickId();
  } else {
    verStat.textContent = "-";
    btnPdf.disabled = true;
  }
  } finally {
    if (showSpin) hideOverlay();
  }
}

function onPickId() {
  const id = idList.value || "";
  const row = allRows.find(r => r.id === id);
  const v   = (row && row.verified) ? String(row.verified) : "";

  verStat.textContent = row ? (v || "(kosong)") : "-";
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

    const res = await fetchJson(WORKER_URL, {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({
        action: "uploadphoto",
        id,
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
