import { requireAuth } from "./auth-guard.js";

requireAuth({ loginPath: "index.html", hideWhileChecking: true });

// URL Cloudflare Worker yang memproxy Apps Script
const SCRIPT_URL = "https://formcuti.avsecbwx2018.workers.dev/";
const TOKEN = "N45p"; // token minimal guard

const nama         = document.getElementById("nama");
const jenisCuti    = document.getElementById("jenisCuti");
const tanggalAwal  = document.getElementById("tanggalAwal");
const tanggalAkhir = document.getElementById("tanggalAkhir");
const kotaTujuan   = document.getElementById("kotaTujuan");
const kepentingan  = document.getElementById("kepentingan");
const jumlahCuti   = document.getElementById("jumlahCuti");
const submitBtn    = document.getElementById("submitBtn");
const alertBack   = document.getElementById("alertBack");
const alertOk     = document.getElementById("alertOk");
const alertMsg    = document.getElementById("alertMsg");
const spinnerRow  = document.getElementById("spinnerRow");
const spinnerText = document.getElementById("spinnerText");

const fields = [nama, jenisCuti, tanggalAwal, tanggalAkhir, kotaTujuan, kepentingan, jumlahCuti];

function checkFormValidity() {
  const allFilled = fields.every(el => !el.disabled && el.value.trim() !== "");
  submitBtn.disabled = !allFilled;
}

fields.forEach(el => {
  ["input", "change"].forEach(evt => el.addEventListener(evt, checkFormValidity));
});

const Modal = {
  show(msg, title = "Notifikasi", loading = false) {
    if (!alertBack) return;
    alertBack.querySelector("#alertTitle").textContent = title;
    if (loading) {
      if (spinnerRow) spinnerRow.classList.add("show");
      if (spinnerText) spinnerText.textContent = msg;
      if (alertMsg) alertMsg.textContent = "";
      if (alertOk) alertOk.style.display = "none";
    } else {
      if (spinnerRow) spinnerRow.classList.remove("show");
      if (alertMsg) alertMsg.textContent = msg;
      if (alertOk) alertOk.style.display = "";
    }
    alertBack.classList.add("show");
    alertBack.setAttribute("aria-hidden", "false");
  },
  hide() {
    if (!alertBack) return;
    alertBack.classList.remove("show");
    alertBack.setAttribute("aria-hidden", "true");
    if (spinnerRow) spinnerRow.classList.remove("show");
    if (alertMsg) alertMsg.textContent = "";
    if (alertOk) alertOk.style.display = "";
  }
};
alertOk?.addEventListener("click", () => Modal.hide());

const JENIS_CUTI   = ["CUTI TAHUNAN", "CUTI ALASAN PENTING"];
const JML_CUTI     = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const KEPENTINGAN_TAHUNAN = ["URUSAN KELUARGA"];
const KEPENTINGAN_ALASAN = [
  { label: "Orang tua/Mertua Sakit", days: 2 },
  { label: "Keluarga Sakit Keras", days: 5 },
  { label: "Keluarga Meninggal", days: 5 },
  { label: "Mengurus Warisan", days: 3 },
  { label: "Menikah", days: 5 },
  { label: "Anak Menikah", days: 5 },
  { label: "Istri Melahirkan", days: 5 },
  { label: "Musibah", days: 5 },
  { label: "Menunaikan Ibadah Haji", days: 45 },
  { label: "Ibadah Umrah", days: 10 },
  { label: "Ibadah Tirthayatra", days: 10 },
  { label: "Ibadah ke Yerussalem", days: 10 },
  { label: "Ibadah ziarah Buddhis", days: 10 },
  { label: "Anak Potong gigi", days: 3 },
  { label: "Khitanan Anak", days: 2 },
  { label: "Membaptis Anak", days: 2 }
];

window.addEventListener("DOMContentLoaded", async () => {
  // isi dropdown statis
  JENIS_CUTI.forEach(v => jenisCuti.add(new Option(v, v)));
  JML_CUTI.forEach(v => jumlahCuti.add(new Option(v, v)));

  // muat daftar nama dari spreadsheet
  await loadNames();
  checkFormValidity();
});

jenisCuti.addEventListener("change", handleJenisCutiChange);
kepentingan.addEventListener("change", handleKepentinganChange);

submitBtn.addEventListener("click", async () => {
  if (!nama.value || !jenisCuti.value || !tanggalAwal.value || !tanggalAkhir.value ||
      !kotaTujuan.value || !kepentingan.value || !jumlahCuti.value) {
    Modal.show("Harap lengkapi semua field wajib", "Validasi");
    return;
  }

  const payload = {
    token: TOKEN,
    nama: nama.value,
    jenisCuti: jenisCuti.value,
    tglAwal: tanggalAwal.value,
    tglAkhir: tanggalAkhir.value,
    jumlahCuti: Number(jumlahCuti.value || 0),
    kotaTujuan: kotaTujuan.value,
    alasanCuti: kepentingan.value
  };

  submitBtn.disabled = true;
  Modal.show("Mengirim data…", "Harap tunggu", true);
  const res = await sendCutiData(payload);
  submitBtn.disabled = false;

  if (res && res.ok) {
    resetForm();
    Modal.show("Data cuti berhasil dikirim", "Berhasil");
  } else {
    const msg = res && res.error ? res.error : "Gagal mengirim data";
    Modal.show(msg, "Kesalahan");
  }
});

function handleJenisCutiChange(){
  kepentingan.innerHTML = "";
  const placeholder = new Option("Pilih Kepentingan Cuti", "");
  kepentingan.add(placeholder);
  kepentingan.value = "";
  kepentingan.disabled = !jenisCuti.value;
  jumlahCuti.value = "";

  if(jenisCuti.value === "CUTI TAHUNAN"){
    KEPENTINGAN_TAHUNAN.forEach(v => kepentingan.add(new Option(v, v)));
  } else if(jenisCuti.value === "CUTI ALASAN PENTING"){
    KEPENTINGAN_ALASAN.forEach(o => kepentingan.add(new Option(o.label, o.label)));
  }
  checkFormValidity();
}

function handleKepentinganChange(){
  if(jenisCuti.value !== "CUTI ALASAN PENTING") return;
  const opt = KEPENTINGAN_ALASAN.find(o => o.label === kepentingan.value);
  if(!opt) return;
  if(![...jumlahCuti.options].some(o => Number(o.value) === opt.days)){
    jumlahCuti.add(new Option(opt.days, opt.days));
  }
  jumlahCuti.value = opt.days;
  checkFormValidity();
}

async function loadNames() {
  try {
    const res = await fetch(`${SCRIPT_URL}?token=${TOKEN}&action=names`);
    const json = await res.json();
    if (json.ok && Array.isArray(json.names)) {
      json.names.forEach(n => nama.add(new Option(n, n)));
    }
  } catch (err) {
    console.error("Gagal mengambil daftar nama", err);
  }
}

async function sendCutiData(data) {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (err) {
    console.error("Gagal mengirim data cuti", err);
    return { ok: false, error: "Jaringan bermasalah" };
  }
}

function resetForm() {
  nama.value = "";
  jenisCuti.value = "";
  tanggalAwal.value = "";
  tanggalAkhir.value = "";
  kotaTujuan.value = "";

  kepentingan.innerHTML = "";
  const kepOpt = new Option("Pilih Kepentingan Cuti", "");
  kepentingan.add(kepOpt);
  kepentingan.value = "";
  kepentingan.disabled = true;

  jumlahCuti.innerHTML = "";
  const jmlOpt = new Option("Pilih Jumlah Cuti", "");
  jumlahCuti.add(jmlOpt);
  JML_CUTI.forEach(v => jumlahCuti.add(new Option(v, v)));
  jumlahCuti.value = "";
  checkFormValidity();
}

export { loadNames };
