// fuel.js (module)
// ----------------------------------------------------
import { requireAuth } from "./auth-guard.js";

// Wajib login
requireAuth({ loginPath: "index.html", hideWhileChecking: true });

// Proxy Cloudflare ke GAS /exec
const SCRIPT_URL = "https://fuel.avsecbwx2018.workers.dev/";
const SHARED_TOKEN = "N45p";

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  if (!ct.includes("application/json")) {
    throw new Error(`Respon bukan JSON (status ${res.status}): ${text.slice(0, 200)}`);
  }
  return JSON.parse(text);
}

const $ = (s) => document.querySelector(s);

// --------- Card 1 (Input) ----------
const unitSel      = $("#unit");
const jenisSel     = $("#jenis");
const keperluanSel = $("#keperluan");
const literInput   = $("#liter");
const hargaEl      = $("#harga");
const btnKirim     = $("#btnKirim");
const msg1         = $("#msg1");

// --------- Card 2 (Cetak) ----------
const cardCetak = $("#cardCetak");
const idList    = $("#idList");   // hanya ID dengan VERIFIED="cetak"
const verStat   = $("#verStat");
const btnPdf    = $("#btnPdf");

// --------- Card 3 (Foto Struk) ----------
const cardFoto  = $("#cardFoto");
const fileInput = $("#file");
const preview   = $("#preview");
const msg3      = $("#msg3");

// Akan dibuat dinamis di Card 3: <select id="idFoto">
let idFotoSel = null;

// --------- State ----------
let unitToNeeds = {};
let unitToJenis = {};
let hargaMap    = {};    // jenis (UPPER) -> harga/liter
let rowsCache   = [];    // semua baris Data

init();

// ================== INIT ==================
async function init() {
  try {
    await loadDropdowns();
  } catch (e) {
    console.error("Gagal load dropdowns:", e);
  }

  try {
    await refreshLists(); // isi cardCetak & cardFoto dari Data
  } catch (e) {
    console.error("Gagal load list Data:", e);
  }

  attachListeners();

  // Card 3 harus selalu terlihat
  cardFoto.classList.remove("hidden");
  ensureFotoIdSelect();

  keperluanSel.disabled = true;
  jenisSel.disabled     = true;

  updateHarga();
  checkForm();
}

function attachListeners() {
  unitSel.addEventListener("change", onUnitChange);
  jenisSel.addEventListener("change", () => { updateHarga(); checkForm(); });
  keperluanSel.addEventListener("change", checkForm);
  literInput.addEventListener("input", () => { updateHarga(); checkForm(); });

  btnKirim.addEventListener("click", onKirim);

  idList.addEventListener("change", onPickIdForPrint);
  btnPdf.addEventListener("click", onOpenPdf);

  fileInput.addEventListener("change", onPickFile);
}

// ================== DROPDOWNS ==================
async function loadDropdowns() {
  const res = await fetchJson(`${SCRIPT_URL}?action=dropdowns&token=${encodeURIComponent(SHARED_TOKEN)}`);
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
  const units = res.units && res.units.length ? res.units : Object.keys(unitToJenis || {});
  units.forEach(u => unitSel.add(new Option(u, u)));

  // Jenis diisi saat unit dipilih
  jenisSel.innerHTML = '<option value="">Pilih Jenis BBM</option>';
  jenisSel.disabled = true;
}

function onUnitChange() {
  const unit = unitSel.value;

  // Keperluan
  keperluanSel.innerHTML = '<option value="">Pilih Keperluan</option>';
  if (unit && unitToNeeds[unit]) {
    const items = unitToNeeds[unit]
      .flatMap(v => String(v).split(/[,;|]/))
      .map(s => s.trim())
      .filter(Boolean);
    [...new Set(items)].forEach(k => keperluanSel.add(new Option(k, k)));
    keperluanSel.disabled = false;
  } else {
    keperluanSel.disabled = true;
  }

  // Jenis BBM
  jenisSel.innerHTML = '<option value="">Pilih Jenis BBM</option>';
  if (unit && unitToJenis[unit] && unitToJenis[unit].length) {
    unitToJenis[unit].forEach(j => jenisSel.add(new Option(j, j)));
    jenisSel.disabled = false;
  } else {
    // fallback: seluruh jenis yang ada
    const set = new Set();
    Object.values(unitToJenis || {}).forEach(arr => (arr || []).forEach(x => set.add(x)));
    [...set].forEach(j => jenisSel.add(new Option(j, j)));
    jenisSel.disabled = set.size === 0;
  }

  jenisSel.value = "";
  updateHarga();
  checkForm();
}

// ================== HARGA ==================
function updateHarga() {
  const jenis = (jenisSel.value || "").toUpperCase().trim();
  const liter = parseFloat(literInput.value || "0");
  const hpl   = Number(hargaMap[jenis] || 0);
  const total = Math.round((isNaN(liter) ? 0 : liter) * hpl);
  hargaEl.textContent = `Rp ${total.toLocaleString("id-ID")}`;
}

function checkForm() {
  const ok = unitSel.value && jenisSel.value && keperluanSel.value && Number(literInput.value) > 0;
  btnKirim.disabled = !ok;
}

// ================== CREATE ==================
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
      resetForm();
      await refreshLists(res.id); // refresh card 2 & 3; pilihkan id foto = id baru
    } else {
      msg1.textContent = res.error || "Gagal mengirim";
    }
  } catch (err) {
    console.error("Gagal mengirim:", err);
    msg1.textContent = "Jaringan bermasalah";
  } finally {
    btnKirim.disabled = false;
  }
}

function resetForm() {
  unitSel.value = "";
  keperluanSel.innerHTML = '<option value="">Pilih Keperluan</option>';
  keperluanSel.disabled = true;
  jenisSel.innerHTML = '<option value="">Pilih Jenis BBM</option>';
  jenisSel.disabled = true;
  literInput.value = "";
  updateHarga();
  checkForm();
}

// ================== LIST DATA (Cetak + Foto) ==================
async function refreshLists(selectIdForFoto = "") {
  const res = await fetchJson(`${SCRIPT_URL}?action=list&token=${encodeURIComponent(SHARED_TOKEN)}`);
  rowsCache = res.ok ? (res.rows || []) : [];

  // Card 2: hanya ID yang VERIFIED=cetak
  const cetakRows = rowsCache.filter(r => String(r.verified || "").toLowerCase() === "cetak");
  cardCetak.classList.toggle("hidden", cetakRows.length === 0);

  idList.innerHTML = '<option value="">Pilih ID</option>';
  cetakRows.forEach(r => idList.add(new Option(r.id, r.id)));
  verStat.textContent = "-";
  btnPdf.disabled = true;

  // Card 3: isi dropdown ID untuk foto (semua baris)
  ensureFotoIdSelect();
  idFotoSel.innerHTML = '<option value="">Pilih ID untuk Foto</option>';
  rowsCache.forEach(r => idFotoSel.add(new Option(r.id, r.id)));

  if (selectIdForFoto) {
    idFotoSel.value = selectIdForFoto;
  }
}

function onPickIdForPrint() {
  const id = idList.value || "";
  const row = rowsCache.find(x => x.id === id);
  const v = row ? String(row.verified || "") : "";
  verStat.textContent = row ? (v || "(kosong)") : "-";
  btnPdf.disabled = v.toLowerCase() !== "cetak";
}

// ================== CETAK ==================
function onOpenPdf() {
  const id = idList.value || "";
  if (!id) return;
  const url = `${SCRIPT_URL}?action=coupon&id=${encodeURIComponent(id)}&token=${encodeURIComponent(SHARED_TOKEN)}`;
  // Halaman kupon (server) sudah auto-print onload → buka tab baru
  const win = window.open(url, "_blank");
  if (!win) {
    // fallback jika popup diblok
    location.href = url;
  }
}

// ================== FOTO (UPLOAD) ==================
function ensureFotoIdSelect() {
  if (idFotoSel) return idFotoSel;

  const label = document.createElement("label");
  label.textContent = "Pilih ID (Untuk Foto)";
  const sel = document.createElement("select");
  sel.id = "idFoto";
  sel.innerHTML = '<option value="">Pilih ID untuk Foto</option>';
  label.appendChild(sel);

  // sisipkan sebelum input file
  cardFoto.insertBefore(label, fileInput);
  idFotoSel = sel;
  return idFotoSel;
}

async function onPickFile(e) {
  const file = e.target.files && e.target.files[0];
  const targetId = idFotoSel ? idFotoSel.value : "";
  if (!file) return;

  if (!targetId) {
    msg3.textContent = "Pilih ID terlebih dahulu.";
    fileInput.value = "";
    return;
  }

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
        id: targetId,
        dataUrl,
        token: SHARED_TOKEN,
      }),
    });

    msg3.textContent = res.ok ? "Foto tersimpan" : (res.error || "Gagal upload");
  } catch (err) {
    console.error("Upload gagal:", err);
    msg3.textContent = "Jaringan bermasalah";
  } finally {
    fileInput.value = "";
  }
}

// ================== Utils ==================
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
        canvas.width  = Math.round(img.width  * scale);
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

