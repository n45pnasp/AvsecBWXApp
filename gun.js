import { requireAuth } from "./auth-guard.js";

const SCRIPT_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"; // ganti dengan URL Apps Script

requireAuth({ loginPath: "index.html", hideWhileChecking: true });

const nama          = document.getElementById("nama");
const pekerjaan     = document.getElementById("pekerjaan");
const flight        = document.getElementById("flight");
const seat          = document.getElementById("seat");
const kta           = document.getElementById("kta");
const tipe          = document.getElementById("tipe");
const jenisPeluru   = document.getElementById("jenisPeluru");
const jumlahPeluru  = document.getElementById("jumlahPeluru");
const namaAvsec     = document.getElementById("namaAvsec");
const instansiAvsec = document.getElementById("instansiAvsec");
const petugas       = document.getElementById("petugas");
const supervisor    = document.getElementById("supervisor");
const submitBtn     = document.getElementById("submitBtn");
const fotoAvsecInp  = document.getElementById("fotoAvsec");
const fotoEvidenceInp = document.getElementById("fotoEvidence");
const btnFotoAvsec  = document.getElementById("btnFotoAvsec");
const btnEvidence   = document.getElementById("btnEvidence");

const overlay = document.getElementById("overlay");
const ovIcon  = document.getElementById("ovIcon");
const ovTitle = document.getElementById("ovTitle");
const ovDesc  = document.getElementById("ovDesc");
const ovClose = document.getElementById("ovClose");

ovClose.addEventListener("click", () => overlay.classList.add("hidden"));

btnFotoAvsec.addEventListener("click", () => fotoAvsecInp.click());
btnEvidence.addEventListener("click", () => fotoEvidenceInp.click());
fotoAvsecInp.addEventListener("change", () => {
  btnFotoAvsec.textContent = fotoAvsecInp.files[0] ? "1 Foto Dipilih" : "Ambil Foto";
});
fotoEvidenceInp.addEventListener("change", () => {
  btnEvidence.textContent = fotoEvidenceInp.files[0] ? "1 Foto Dipilih" : "Ambil Foto";
});

function showOverlay(state, title, desc){
  overlay.classList.remove("hidden");
  ovIcon.className = "icon " + state;
  ovTitle.textContent = title;
  ovDesc.textContent = desc || "";
  ovClose.classList.toggle("hidden", state === "spinner");
  if (state !== "spinner") {
    setTimeout(() => overlay.classList.add("hidden"), 1500);
  }
}

submitBtn.addEventListener("click", async () => {
  const now = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  const tanggal = `${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}`;

  const payload = {
    tanggal,
    namaLengkap: nama.value.trim(),
    pekerjaan: pekerjaan.value.trim(),
    flightNumber: flight.value.trim(),
    seatNumber: seat.value.trim(),
    nomorKTA: kta.value.trim(),
    tipeSenjata: tipe.value.trim(),
    jenisPeluru: jenisPeluru.value.trim(),
    jumlahPeluru: jumlahPeluru.value.trim(),
    namaAvsec: namaAvsec.value.trim(),
    instansiAvsec: instansiAvsec.value.trim(),
    petugas: petugas.value.trim(),
    supervisor: supervisor.value.trim(),
    fotoAvsec: await getImageFormula(fotoAvsecInp.files[0]),
    fotoEvidence: await getImageFormula(fotoEvidenceInp.files[0])
  };
  submitBtn.disabled = true;
  showOverlay('spinner','Mengirim data…','');
  try {
    await sendToSheet('GunFilesPDF', payload);
    await sendToSheet('Files', payload);
    showOverlay('ok','Data berhasil dikirim','');
    [nama,pekerjaan,flight,seat,kta,tipe,jenisPeluru,jumlahPeluru,namaAvsec,instansiAvsec,petugas,supervisor]
      .forEach(el=>el.value="");
    [fotoAvsecInp,fotoEvidenceInp].forEach(el=>el.value="");
    btnFotoAvsec.textContent = "Ambil Foto";
    btnEvidence.textContent = "Ambil Foto";
  } catch(err){
    showOverlay('err','Gagal', err?.message || err);
  } finally {
    submitBtn.disabled = false;
  }
});

async function sendToSheet(sheet, payload){
  const res = await fetch(`${SCRIPT_URL}?sheet=${encodeURIComponent(sheet)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const j = await res.json();
  if (!j || (!j.success && !j.ok)) throw new Error(j?.error || 'Gagal mengirim');
}

async function getImageFormula(file){
  if(!file) return "";
  try {
    const b64 = await readAndCompress(file);
    return `=IMAGE("data:image/jpeg;base64,${b64}")`;
  } catch {
    return "";
  }
}

async function readAndCompress(file){
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  let { width, height } = img;
  const max = Math.max(width, height);
  const scale = max > 800 ? 800 / max : 1;
  width = Math.round(width * scale);
  height = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
}
