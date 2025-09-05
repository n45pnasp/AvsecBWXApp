import { requireAuth } from "./auth-guard.js";

// Lindungi halaman: user harus login
requireAuth({ loginPath: "index.html", hideWhileChecking: true });

/* ===== Konfigurasi ===== */
const WORKER_URL   = "https://fuel.avsecbwx2018.workers.dev/";
const SHARED_TOKEN = "N45p";
// const COUPON_PAGE  = "https://n45pnasp.github.io/AvsecBWXApp/coupon.html"; // tidak dipakai lagi

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
(function injectPhotoIdSelect(){
  const label = document.createElement("label");
  label.textContent = "Pilih ID (untuk foto)";
  photoIdSel = document.createElement("select");
  photoIdSel.id = "photoId";
  label.appendChild(photoIdSel);
  cardFoto.insertBefore(label, fileInput);
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

/* ===== Cetak Kupon -> langsung download PDF tanpa membuka coupon.html ===== */
async function onOpenPdf() {
  const id = idList.value || "";
  if (!id) return;

  if (!window.html2pdf) {
    alert("Library html2pdf belum dimuat.");
    return;
  }

  showOverlay("Menyiapkan PDF…", "Mohon tunggu");

  try {
    // Ambil data kupon
    const res = await fetchJson(
      `${WORKER_URL}?action=coupondata&id=${encodeURIComponent(id)}&token=${encodeURIComponent(SHARED_TOKEN)}`
    );
    if (!res || !res.ok) throw new Error((res && res.error) || "Gagal ambil data kupon.");
    const data = res.data;

    // Render layout A4 (2 kupon) ke stage tersembunyi
    const stage = document.getElementById("pdfStage");
    stage.innerHTML = buildCouponA4Html(data);

    // Pastikan layout sudah terpasang
    await new Promise(r => requestAnimationFrame(r));

    // Opsi PDF
    const opt = {
      margin:       [0, 0, 0, 0],
      filename:     `Kupon-${data.id}.pdf`,
      pagebreak:    { mode: ['avoid-all'] },
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    await html2pdf().set(opt).from(stage.firstElementChild).save();

  } catch (err) {
    console.error(err);
    alert(err.message || err);
  } finally {
    document.getElementById("pdfStage").innerHTML = "";
    hideOverlay();
  }
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

/* ===== Builder layout A4 (2 kupon) untuk html2pdf ===== */
function buildCouponA4Html(d){
  const rup = n => 'Rp. ' + (Math.round(Number(n)||0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  const U   = s => String(s||'').toUpperCase();
  const stripe = '#bbbfc4';
  const frame  = '#1d9bf0';
  const ink    = '#0f172a';
  const liter  = `${d.liter} LITER`;

  // 1 halaman A4 landscape berisi 2 kupon + garis putus & ikon gunting
  return `
  <div style="width:297mm;height:210mm;background:#fff;padding:10mm;position:relative;
              font:10pt Calibri,Arial,sans-serif;color:${ink}">
    <!-- dashed center -->
    <div style="position:absolute;top:8mm;bottom:8mm;left:calc(50% - .25mm);width:.5mm;
                background:repeating-linear-gradient(to bottom,transparent 0,transparent 3mm,
                           rgba(107,114,128,.75) 3mm,rgba(107,114,128,.75) 4.5mm);">
      <div style="position:absolute;left:50%;top:0;transform:translate(-50%,-45%);font-size:11pt">✂</div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;height:100%;align-items:center;justify-items:center;column-gap:22mm">
      ${[0,1].map(() => `
      <div style="width:120mm;height:120mm;position:relative;display:flex;align-items:center;justify-content:center">
        <!-- dashed border 1cm di luar kupon -->
        <div style="position:absolute;inset:0;background:
          repeating-linear-gradient(to right, rgba(107,114,128,.75), rgba(107,114,128,.75) 1.5mm, transparent 1.5mm, transparent 4.5mm) top left/100% .5mm no-repeat,
          repeating-linear-gradient(to right, rgba(107,114,128,.75), rgba(107,114,128,.75) 1.5mm, transparent 1.5mm, transparent 4.5mm) bottom left/100% .5mm no-repeat,
          repeating-linear-gradient(to bottom, rgba(107,114,128,.75), rgba(107,114,128,.75) 1.5mm, transparent 1.5mm, transparent 4.5mm) top left/.5mm 100% no-repeat,
          repeating-linear-gradient(to bottom, rgba(107,114,128,.75), rgba(107,114,128,.75) 1.5mm, transparent 1.5mm, transparent 4.5mm) top right/.5mm 100% no-repeat;">
        </div>
        <div style="position:absolute;left:50%;top:0;transform:translate(-50%,-45%);font-size:11pt">✂</div>

        <!-- KUPON 10x10 -->
        <section style="width:100mm;height:100mm;border:3mm solid ${frame};border-radius:3mm;
                         padding:4mm 4mm 8mm;display:grid;grid-template-rows:auto auto auto;overflow:hidden">
          <div style="text-align:center;margin:1mm 0 .8mm;font-weight:900;font-size:14.2pt">KUPON BBM</div>
          <div style="text-align:center;font-weight:800;margin:0 0 3.5mm;line-height:1.08;font-size:8.2pt">
            PT ANGKASA PURA INDONESIA
            <small style="display:block;font-weight:800">KANTOR CABANG BANDARA BANYUWANGI</small>
          </div>

          <div style="background:${stripe};border-radius:3mm;padding:2mm 2.6mm">
            <table style="width:100%;border-collapse:separate;border-spacing:0 .7mm;font-size:7.8pt">
              <tr>
                <td style="width:18mm;font-weight:800">KODE</td><td style="width:2mm">:</td>
                <td colspan="4" style="font-weight:700">${U(d.id)}</td>
              </tr>
              <tr>
                <td style="width:18mm;font-weight:800">KEPERLUAN</td><td style="width:2mm">:</td>
                <td colspan="4" style="font-weight:700">${U(d.keperluan)}</td>
              </tr>
              <tr>
                <td style="width:18mm;font-weight:800">TANGGAL</td><td style="width:2mm">:</td>
                <td style="padding-right:6mm;font-weight:700">${d.tanggal}</td>
                <td style="width:18mm;font-weight:800">UNIT</td><td style="width:2mm">:</td>
                <td style="font-weight:700">${U(d.unit)}</td>
              </tr>
            </table>

            <div style="margin-top:3mm;background:#fff;border:.2mm solid #e5e7eb;border-radius:2.5mm;
                        padding:2.2mm 3mm;text-align:center;font-weight:900;line-height:1.15">
              <div style="text-transform:uppercase;font-size:8.5pt">JENIS ${U(d.jenis)} &nbsp; JUMLAH ${liter}</div>
              <div style="text-transform:uppercase;font-size:8.7pt;margin-top:1.2mm">TOTAL HARGA ${rup(d.harga)}</div>
            </div>
          </div>

          <div style="text-align:center;line-height:1.2;font-size:8.2pt;margin-top:3mm">
            <div style="font-weight:900">AIRPORT SECURITY, RESCUE &amp; FIRE FIGHTING</div>
            <div style="font-weight:900;margin-top:.9mm">DEPARTEMENT HEAD</div>
            <div style="width:72%;border-top:.3mm solid #111;margin:25mm auto 0"></div>
            <div style="font-size:10pt;color:#374151;margin-top:2.5mm;margin-bottom:10mm;font-weight:900">${U(d.signer || '(Nama Jelas & NIP)')}</div>
          </div>
        </section>
      </div>
      `).join('')}
    </div>
  </div>`;
}

