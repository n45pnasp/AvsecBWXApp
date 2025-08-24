import { requireAuth } from "./auth-guard.js";

const SCRIPT_URL   = "https://logbk.avsecbwx2018.workers.dev";
const SHARED_TOKEN = "N45p";

requireAuth({ loginPath: "index.html", hideWhileChecking: true });

const nama       = document.getElementById("nama");
const kodePas    = document.getElementById("kodePas");
const instansi   = document.getElementById("instansi");
const prohibited = document.getElementById("prohibited");
const lokasi     = document.getElementById("lokasi");
const jamMasuk   = document.getElementById("jamMasuk");
const jamKeluar  = document.getElementById("jamKeluar");
const pemeriksa  = document.getElementById("pemeriksa");
const supervisor = document.getElementById("supervisor");
const submitBtn  = document.getElementById("submitBtn");

submitBtn.addEventListener("click", onSubmit);

function fmtTimestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function onSubmit(){
  const data = {
    timestamp: fmtTimestamp(),
    nama_lengkap: nama.value.trim(),
    kode_pas: kodePas.value.trim(),
    instansi: instansi.value.trim(),
    prohibited_item: prohibited.value.trim(),
    lokasi_acp: lokasi.value.trim(),
    jam_masuk: jamMasuk.value.trim(),
    jam_keluar: jamKeluar.value.trim(),
    pemeriksa: pemeriksa.value.trim(),
    supervisor: supervisor.value.trim()
  };

  submitBtn.disabled = true;
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "createAcp", token: SHARED_TOKEN, data })
    });
    const j = await res.json();
    if (!j || (!j.success && !j.ok)) throw new Error(j?.error || "Gagal mengirim");
    alert("Data berhasil dikirim");
    [nama, kodePas, instansi, prohibited, lokasi, jamMasuk, jamKeluar, pemeriksa, supervisor].forEach(el => el.value = "");
  } catch(err){
    alert("Gagal: " + (err?.message || err));
  } finally {
    submitBtn.disabled = false;
  }
}
