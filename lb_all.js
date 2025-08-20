// ==== KONFIG (ganti sesuai deployment Apps Script kamu) ====
const SCRIPT_URL   = 'https://script.google.com/macros/s/AKfycbzJmQtHw9Dw4ChJQ7oDVZ8sFD1P2JhQAsmVrSt7TjOCg0dq-Nqfv8LURqqmDzrpsxg37w/exec'; // GANTI
const SHARED_TOKEN = 'N45p'; // samakan dengan code.gs (TOKEN)

// ==== UTIL ====
function $(s){ return document.querySelector(s); }

function extractDriveId(input){
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{20,})\//,
    /[?&]id=([a-zA-Z0-9_-]{20,})\b/,
    /^([a-zA-Z0-9_-]{20,})$/,
    /\/thumbnail\?id=([a-zA-Z0-9_-]{20,})\b/,
    /\/open\?id=([a-zA-Z0-9_-]{20,})\b/,
  ];
  for (const re of patterns){
    const m = input.match(re);
    if (m) return m[1];
  }
  return '';
}

function toThumbUrl(input){
  const id = extractDriveId(input);
  return id ? `https://drive.google.com/thumbnail?id=${id}` : input;
}

function showMsg(ok, msg){
  const okBox  = $('#statusOk');
  const errBox = $('#statusErr');
  okBox.style.display = 'none';
  errBox.style.display = 'none';
  if (ok) { okBox.textContent = msg; okBox.style.display = 'block'; }
  else { errBox.textContent = msg; errBox.style.display = 'block'; }
}

// ==== MAIN ====
const form = $('#kForm');
const submitBtn = $('#submitBtn');
const timeInput = $('#timeHHMM');

// Auto set default time ke sekarang (HH:MM)
(function setDefaultTime(){
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  timeInput.value = `${hh}:${mm}`;
})();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;

  try{
    const timeHHMM = $('#timeHHMM').value.trim();
    const activity = $('#activity').value.trim();
    const photoRaw = $('#photo').value.trim();

    if (!/^\d{2}:\d{2}$/.test(timeHHMM)) {
      showMsg(false, 'Format waktu harus HH:MM');
      submitBtn.disabled = false;
      return;
    }
    if (!activity) {
      showMsg(false, 'Kegiatan wajib diisi');
      submitBtn.disabled = false;
      return;
    }
    if (!photoRaw) {
      showMsg(false, 'Link/ID foto wajib diisi');
      submitBtn.disabled = false;
      return;
    }

    const body = {
      timeHHMM,
      activity,
      photo: photoRaw // backend akan normalisasi lagi; di sini boleh original
    };

    const res = await fetch(`${SCRIPT_URL}?token=${encodeURIComponent(SHARED_TOKEN)}`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(()=>({ok:false, message:'Bad JSON'}));

    if (data.ok) {
      showMsg(true, `Tersimpan di baris ${data.row}.`);
      form.reset();
      // set ulang default jam
      const now = new Date();
      const hh = String(now.getHours()).padStart(2,'0');
      const mm = String(now.getMinutes()).padStart(2,'0');
      $('#timeHHMM').value = `${hh}:${mm}`;
    } else {
      if (data.code === 'FULL') {
        showMsg(false, 'Slot A18:C28 sudah penuh (10/10). Hapus baris lama dulu.');
      } else if (data.code === 'BAD_TOKEN') {
        showMsg(false, 'Token salah. Cek SHARED_TOKEN & TOKEN di backend.');
      } else {
        showMsg(false, `Gagal: ${data.message || data.code || 'Unknown error'}`);
      }
    }
  } catch (err){
    showMsg(false, `Error: ${err}`);
  } finally {
    submitBtn.disabled = false;
  }
});
