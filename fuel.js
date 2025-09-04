import { requireAuth } from "./auth-guard.js";

// Lindungi halaman: user harus login
requireAuth({ loginPath: "index.html", hideWhileChecking: true });

/** URL proxy Cloudflare Worker */
const SCRIPT_URL = "https://fuel.avsecbwx2018.workers.dev/";
/** Token shared */
const SHARED_TOKEN = "N45p";

/* ===== util fetch JSON robust ===== */
async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (!ct.includes("application/json")) {
    throw new Error(`Respon bukan JSON (status ${res.status}): ${text.slice(0, 160)}`);
  }
  return JSON.parse(text);
}

/* ===== DOM ===== */
const $ = (s) => document.querySelector(s);

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

/* ===== State ===== */
let unitToNeeds = {};       // unit -> [keperluan]
let unitToJenis = {};       // unit -> [jenis bbm]   <-- BARU
let hargaMap    = {};       // jenis -> harga/liter (uppercase key)
let rowsCache   = [];
let currentId   = "";

/* ===== Init ===== */
init();

async function init() {
  await loadDropdowns();
  await refreshListIds();
  attachListeners();
  keperluanSel.disabled = true;
  jenisSel.disabled = true;         // sekarang jenis ikut unit
  checkForm();
}

function attachListeners() {
  unitSel.addEventListener("change", onUnitChange);
  jenisSel.addEventListener("change", () => { updateHarga(); checkForm(); });
  keperluanSel.addEventListener("change", checkForm);
  literInput.addEventListener("input", () => { updateHarga(); checkForm(); });

  btnKirim.addEventListener("click", onKirim);
  idList.addEventListener("change", onPickId);
  btnPdf.addEventListener("click", onOpenPdf);
  fileInput.addEventListener("change", onPickFile);
}

/* =================== Dropdowns =================== */
async function loadDropdowns() {
  const url = `${SCRIPT_URL}?action=dropdowns&token=${encodeURIComponent(SHARED_TOKEN)}`;
  const res = await fetchJson(url);
  if (!res.ok) throw new Error(res.error || "dropdowns: backend error");

  unitToNeeds = res.unitToNeeds || {};
  unitToJenis = res.unitToJenis || {};
  hargaMap = {};
  (res.fuels || []).forEach(f => {
    const key = String(f.jenis || "").toUpperCase().trim();
    if (key) hargaMap[key] = Number(f.harga || 0);
  });

  // Unit
  unitSel.innerHTML = '<option value="">Pilih Unit Kerja</option>';
  const units = res.units && res.units.length ? res.units : Object.keys(unitToJenis);
  units.forEach(u => unitSel.add(new Option(u, u)));

  // Kosongkan jenis; diisi saat unit dipilih
  jenisSel.innerHTML = '<option value="">Pilih Jenis BBM</option>';
  jenisSel.disabled = true;

  updateHarga();
}

/* =================== Dynamic by Unit =================== */
function onUnitChange() {
  const unit = unitSel.value;

  // Keperluan
  keperluanSel.innerHTML = '<option value="">Pilih Keperluan</option>';
  if (unit && unitToNeeds[unit]) {
    // fallback pecah koma kalau ada
    const items = unitToNeeds[unit]
      .flatMap(v => String(v).split(/[,;|]/))
      .map(s => s.trim())
      .filter(Boolean);
    const uniq = [...new Set(items)];
    uniq.forEach(k => keperluanSel.add(new Option(k, k)));
    keperluanSel.disabled = false;
  } else {
    keperluanSel.disabled = true;
  }

  // Jenis BBM (BERGANTUNG UNIT)
  jenisSel.innerHTML = '<option value="">Pilih Jenis BBM</option>';
  if (unit && unitToJenis[unit] && unitToJenis[unit].length) {
    unitToJenis[unit].forEach(j => jenisSel.add(new Option(j, j)));
    jenisSel.disabled = false;
  } else {
    // fallback: gabungan semua jenis yang ada di mapping (kalau unit tidak ditemukan)
    const set = new Set();
    Object.values(unitToJenis).forEach(arr => (arr || []).forEach(x => set.add(x)));
    [...set].forEach(j => jenisSel.add(new Option(j, j)));
    jenisSel.disabled = set.size === 0;
  }

  // reset harga karena jenis bisa berubah
  jenisSel.value = "";
  updateHarga();
  checkForm();
}

/* =================== Harga =================== */
function updateHarga() {
  const jenis = (jenisSel.value || "").toUpperCase().trim();
  const liter = parseFloat(literInput.value || "0");
  const hpl   = Number(hargaMap[jenis] || 0);
  const total = Math.round(hpl * (isNaN(liter) ? 0 : liter));
  hargaEl.textContent = `Rp ${total.toLocaleString("id-ID")}`;
}

function checkForm() {
  const ok = unitSel.value && jenisSel.value && keperluanSel.value && Number(literInput.value) > 0;
  btnKirim.disabled = !ok;
}

/* =================== Create record =================== */
async function onKirim() {
  if (btnKirim.disabled) return;

  const payload = {
    action: "create",
    unit: unitSel.value,
    jenis: jenisSel.value,
    liter: parseFloat(literInput.value || "0"),
    keperluan: keperluanSel.value,
    token: SHARED_TOKEN,
  };

  msg1.textContent = "Mengirim…";
  btnKirim.disabled = true;

  try {
    const res = await fetchJson(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      msg1.textContent = `Terkirim (ID: ${res.id})`;
      currentId = res.id || "";
      resetForm();
      await refreshListIds(currentId);
      cardFoto.classList.toggle("hidden", !currentId);
    } else {
      msg1.textContent = res.error || "Gagal mengirim";
    }
  } catch (err) {
    console.error("Gagal mengirim data", err);
    msg1.textContent = "Jaringan bermasalah";
  } finally {
    btnKirim.disabled = false;
  }
}

function resetForm() {
  unitSel.value = "";
  jenisSel.innerHTML = '<option value="">Pilih Jenis BBM</option>';
  jenisSel.disabled = true;
  keperluanSel.innerHTML = '<option value="">Pilih Keperluan</option>';
  keperluanSel.disabled = true;
  literInput.value = "";
  updateHarga();
  checkForm();
}

/* =================== List ID =================== */
async function refreshListIds(selectId = "") {
  const res = await fetchJson(`${SCRIPT_URL}?action=list&token=${encodeURIComponent(SHARED_TOKEN)}`);
  rowsCache = res.ok ? (res.rows || []) : [];
  idList.innerHTML = '<option value="">Pilih ID</option>';
  rowsCache.forEach(r => idList.add(new Option(r.id, r.id)));
  cardCetak.classList.toggle("hidden", rowsCache.length === 0);

  if (selectId) {
    idList.value = selectId;
    onPickId();
  }
}

function onPickId() {
  const val = idList.value || "";
  currentId = val;
  verStat.textContent = "-";
  btnPdf.disabled = true;
  cardFoto.classList.toggle("hidden", !val);
  preview.classList.add("hidden");
  msg3.textContent = "";

  if (!val) return;

  const row = rowsCache.find(x => x.id === val);
  const v = row ? String(row.verified || "") : "";
  verStat.textContent = row ? (v || "(kosong)") : "-";
  btnPdf.disabled = v.toLowerCase() !== "cetak";
}

/* =================== Kupon =================== */
function onOpenPdf() {
  const id = idList.value || "";
  if (!id) return;
  window.open(`${SCRIPT_URL}?action=coupon&id=${encodeURIComponent(id)}&token=${encodeURIComponent(SHARED_TOKEN)}`, "_blank");
}

/* =================== Upload Foto =================== */
async function onPickFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file || !currentId) return;

  try {
    const dataUrl = await readAsDataURL(file, 1280);
    preview.src = dataUrl;
    preview.classList.remove("hidden");
    msg3.textContent = "Mengunggah…";

    const res = await fetchJson(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "uploadphoto",
        id: currentId,
        dataUrl,
        token: SHARED_TOKEN,
      }),
    });

    msg3.textContent = res.ok ? "Foto tersimpan" : (res.error || "Gagal upload");
  } catch (err) {
    console.error("Upload gagal", err);
    msg3.textContent = "Jaringan bermasalah";
  } finally {
    fileInput.value = "";
  }
}

/* =================== Utils =================== */
function readAsDataURL(file, maxSize = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

