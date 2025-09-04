import { requireAuth } from "./auth-guard.js";

// Lindungi halaman: user harus login
requireAuth({ loginPath: "index.html", hideWhileChecking: true });

const SCRIPT_URL = "https://fuel.avsecbwx2018.workers.dev/";
const SHARED_TOKEN = "N45p"; // token wajib dikirim ke Apps Script

const $ = (s) => document.querySelector(s);

// ---- Elemen DOM ----
const unitSel = $("#unit");
const jenisSel = $("#jenis");
const keperluanSel = $("#keperluan");
const literInput = $("#liter");
const hargaEl = $("#harga");
const btnKirim = $("#btnKirim");
const msg1 = $("#msg1");

const cardCetak = $("#cardCetak");
const idList = $("#idList");
const verStat = $("#verStat");
const btnPdf = $("#btnPdf");

const cardFoto = $("#cardFoto");
const fileInput = $("#file");
const preview = $("#preview");
const msg3 = $("#msg3");

// ---- Data dinamis ----
let unitToNeeds = {};
let fuels = [];
let hargaMap = {};
let currentId = "";

init();

async function init() {
  await loadDropdowns();
  await refreshListIds();
  attachListeners();
  checkForm();
}

function attachListeners() {
  unitSel.addEventListener("change", onUnitChange);
  jenisSel.addEventListener("change", () => {
    updateHarga();
    checkForm();
  });
  keperluanSel.addEventListener("change", checkForm);
  literInput.addEventListener("input", () => {
    updateHarga();
    checkForm();
  });
  btnKirim.addEventListener("click", onKirim);
  idList.addEventListener("change", onPickId);
  btnPdf.addEventListener("click", onOpenPdf);
  fileInput.addEventListener("change", onPickFile);
}

/* ===== Dropdowns ===== */
async function loadDropdowns() {
  try {
    const url = `${SCRIPT_URL}?action=dropdowns&token=${encodeURIComponent(
      SHARED_TOKEN,
    )}`;
    const res = await fetch(url).then((r) => r.json());
    unitToNeeds = res.unitToNeeds || {};
    fuels = res.fuels || [];

    // isi dropdown unit
    unitSel.innerHTML = '<option value="">Pilih Unit Kerja</option>';
    Object.keys(unitToNeeds).forEach((u) =>
      unitSel.add(new Option(u, u)),
    );

    // isi dropdown jenis BBM
    jenisSel.innerHTML = '<option value="">Pilih Jenis BBM</option>';
    fuels.forEach((f) => {
      const j = f.jenis || f.name || f.nama;
      jenisSel.add(new Option(j, j));
      hargaMap[j] = Number(f.harga || f.price || 0);
    });
  } catch (err) {
    console.error("Gagal mengambil dropdown", err);
  }
}

function onUnitChange() {
  const unit = unitSel.value;
  keperluanSel.innerHTML = '<option value="">Pilih Keperluan</option>';
  if (unit && unitToNeeds[unit]) {
    unitToNeeds[unit].forEach((k) => keperluanSel.add(new Option(k, k)));
    keperluanSel.disabled = false;
  } else {
    keperluanSel.disabled = true;
  }
  checkForm();
}

/* ===== Harga ===== */
function updateHarga() {
  const jenis = jenisSel.value;
  const liter = parseFloat(literInput.value || "0");
  const harga = (hargaMap[jenis] || 0) * liter;
  hargaEl.textContent = `Rp ${harga.toLocaleString("id-ID")}`;
}

function checkForm() {
  const ok =
    unitSel.value && jenisSel.value && keperluanSel.value && literInput.value;
  btnKirim.disabled = !ok;
}

/* ===== Create record (POST + token) ===== */
async function onKirim() {
  if (btnKirim.disabled) return;
  const unit = unitSel.value;
  const jenis = jenisSel.value;
  const keperluan = keperluanSel.value;
  const liter = parseFloat(literInput.value || "0");

  msg1.textContent = "Mengirim...";
  btnKirim.disabled = true;
  try {
    const payload = {
      action: "create",
      unit,
      jenis,
      liter,
      keperluan,
      token: SHARED_TOKEN,
    };
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json());

    if (res && res.ok) {
      msg1.textContent = "Terkirim";
      currentId = res.id || "";
      resetForm();
      await refreshListIds(currentId);
      cardFoto.classList.toggle("hidden", !currentId);
    } else {
      msg1.textContent = (res && res.error) || "Gagal mengirim";
    }
  } catch (err) {
    console.error("Gagal mengirim data", err);
    msg1.textContent = "Jaringan bermasalah";
  }
  btnKirim.disabled = false;
}

function resetForm() {
  unitSel.value = "";
  keperluanSel.innerHTML = '<option value="">Pilih Keperluan</option>';
  keperluanSel.disabled = true;
  jenisSel.value = "";
  literInput.value = "";
  updateHarga();
  checkForm();
}

/* ===== List ID (GET + token) ===== */
async function refreshListIds(selectId = "") {
  try {
    const res = await fetch(
      `${SCRIPT_URL}?action=list&token=${encodeURIComponent(SHARED_TOKEN)}`,
    ).then((r) => r.json());
    const rows = res.rows || [];
    idList.innerHTML = '<option value="">Pilih ID</option>';
    rows.forEach((row) => idList.add(new Option(row.id, row.id)));
    cardCetak.classList.toggle("hidden", rows.length === 0);
    if (selectId) {
      idList.value = selectId;
      onPickId();
    }
  } catch (err) {
    console.error("Gagal mengambil list id", err);
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

  fetch(
    `${SCRIPT_URL}?action=list&token=${encodeURIComponent(SHARED_TOKEN)}`,
  )
    .then((r) => r.json())
    .then((res) => {
      const row = (res.rows || []).find((x) => x.id === val);
      const v = (row && row.verified) || "";
      verStat.textContent = row ? v || "(kosong)" : "-";
      btnPdf.disabled = v.toLowerCase() !== "cetak";
    })
    .catch((err) => {
      console.error("Gagal cek status", err);
    });
}

function onOpenPdf() {
  const id = idList.value || "";
  if (!id) return;
  window.open(
    `${SCRIPT_URL}?action=coupon&id=${encodeURIComponent(
      id,
    )}&token=${encodeURIComponent(SHARED_TOKEN)}`,
    "_blank",
  );
}

/* ===== Foto (POST + token) ===== */
async function onPickFile(e) {
  const file = e.target.files[0];
  if (!file || !currentId) return;

  try {
    const dataUrl = await readAsDataURL(file, 1280);
    preview.src = dataUrl;
    preview.classList.remove("hidden");
    msg3.textContent = "Mengunggah…";

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "uploadphoto",
        id: currentId,
        dataUrl,
        token: SHARED_TOKEN,
      }),
    }).then((r) => r.json());

    if (res && res.ok) {
      msg3.textContent = "Foto tersimpan";
    } else {
      msg3.textContent = (res && res.error) || "Gagal upload";
    }
  } catch (err) {
    console.error("Upload gagal", err);
    msg3.textContent = "Jaringan bermasalah";
  } finally {
    fileInput.value = "";
  }
}

/* ===== Utils ===== */
function readAsDataURL(file, maxSize = 1024) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

