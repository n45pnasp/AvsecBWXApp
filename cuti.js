document.documentElement.style.visibility = "visible";

const SCRIPT_URL = "https://example.workers.dev/"; // TODO: replace with real endpoint

const nama         = document.getElementById("nama");
const jenisCuti    = document.getElementById("jenisCuti");
const tanggalAwal  = document.getElementById("tanggalAwal");
const tanggalAkhir = document.getElementById("tanggalAkhir");
const kotaTujuan   = document.getElementById("kotaTujuan");
const kepentingan  = document.getElementById("kepentingan");
const jumlahCuti   = document.getElementById("jumlahCuti");
const submitBtn    = document.getElementById("submitBtn");

submitBtn.addEventListener("click", async () => {
  const payload = {
    nama: nama.value,
    jenisCuti: jenisCuti.value,
    tanggalAwal: tanggalAwal.value,
    tanggalAkhir: tanggalAkhir.value,
    kotaTujuan: kotaTujuan.value,
    kepentingan: kepentingan.value,
    jumlahCuti: jumlahCuti.value
  };

  await sendCutiData(payload);
});

async function sendCutiData(data){
  try{
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return await res.json();
  }catch(err){
    console.error("Gagal mengirim data cuti", err);
  }
}

export async function fetchCutiData(){
  try{
    const res = await fetch(SCRIPT_URL);
    return await res.json();
  }catch(err){
    console.error("Gagal mengambil data cuti", err);
  }
}
