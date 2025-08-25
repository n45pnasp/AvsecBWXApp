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

const overlay = document.getElementById("overlay");
const ovIcon  = document.getElementById("ovIcon");
const ovTitle = document.getElementById("ovTitle");
const ovDesc  = document.getElementById("ovDesc");
const ovClose = document.getElementById("ovClose");

ovClose.addEventListener("click", () => overlay.classList.add("hidden"));

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
  const payload = {
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
    supervisor: supervisor.value.trim()
  };
  submitBtn.disabled = true;
  showOverlay('spinner','Mengirim data…','');
  try {
    await sendToSheet('GunFilesPDF', payload);
    await sendToSheet('Files', payload);
    showOverlay('ok','Data berhasil dikirim','');
    [nama,pekerjaan,flight,seat,kta,tipe,jenisPeluru,jumlahPeluru,namaAvsec,instansiAvsec,petugas,supervisor]
      .forEach(el=>el.value="");
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
