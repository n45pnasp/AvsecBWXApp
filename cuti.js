document.documentElement.style.visibility = "visible";

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

const JENIS_CUTI   = ["CUTI TAHUNAN", "CUTI ALASAN PENTING"];
const JML_CUTI     = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

window.addEventListener("DOMContentLoaded", async () => {
  // isi dropdown statis
  JENIS_CUTI.forEach(v => jenisCuti.add(new Option(v, v)));
  JML_CUTI.forEach(v => jumlahCuti.add(new Option(v, v)));

  // muat daftar nama dari spreadsheet
  await loadNames();
});

submitBtn.addEventListener("click", async () => {
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

  await sendCutiData(payload);
});

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
  }
}

export { loadNames };
