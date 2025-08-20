// ====== KONFIG ======
const SCRIPT_URL   = 'https://script.google.com/macros/s/AKfycbzpdITOiPbuiI7UlmRs3JC2IWIgMjLN9zdTsPDXIS17eJZpxbSZy4UYFx7YMsoB60VVjA/exec'; // GANTI
const SHARED_TOKEN = 'N45p';         // Samakan dgn TOKEN di code.gs
const JPG_QUALITY  = 0.8;            // kualitas kompres
const MAX_SIZE_PX  = 300;            // sisi terpanjang 300px

// ====== DOM ======
const $  = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];

const timeInput     = $('#timeHHMM');
const btnPickTime   = $('#btnPickTime');
const modal         = $('#timeModal');
const timeDisplay   = $('#timeDisplay');
const btnTimeClose  = $('#timeClose');
const btnTimeSet    = $('#timeSet');

const fileInput     = $('#photoFile');
const btnUploadPick = $('#btnUploadPick');
const uploadInfo    = $('#uploadInfo');
const canvasPrev    = $('#previewCanvas');
const linkInput     = $('#photoLink');

const form          = $('#kForm');
const submitBtn     = $('#submitBtn');
const refreshBtn    = $('#refreshBtn');

// ====== STATUS MSG ======
function showMsg(ok, msg){
  const okBox  = $('#statusOk');
  const errBox = $('#statusErr');
  okBox.style.display = 'none';
  errBox.style.display = 'none';
  if (ok) { okBox.textContent = msg; okBox.style.display = 'block'; }
  else    { errBox.textContent = msg; errBox.style.display = 'block'; }
}

// ====== DEFAULT TIME ======
(function setDefaultTime(){
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  timeInput.value = `${hh}:${mm}`;
})();

// ====== TABLE RENDER ======
function renderRows(items){
  const tbody = $('#resultTBody');
  tbody.innerHTML = '';

  if (!items?.length){
    tbody.innerHTML = `<tr><td colspan="3" class="empty">Belum ada entri pada A18:C28.</td></tr>`;
    return;
  }

  for (const it of items){
    const tr = document.createElement('tr');

    const tdTime = document.createElement('td');
    tdTime.textContent = it.time || '';
    tdTime.className = 'mono';

    const tdAct = document.createElement('td');
    tdAct.textContent = it.activity || '';

    const tdPhoto = document.createElement('td');
    tdPhoto.className = 'photo-cell';
    if (it.photoUrl){
      const a = document.createElement('a');
      a.href = it.photoUrl; a.target = '_blank'; a.rel = 'noopener';
      const img = document.createElement('img');
      img.alt = 'foto'; img.loading = 'lazy';
      img.src = it.photoUrl;
      a.appendChild(img);
      tdPhoto.appendChild(a);
    } else {
      tdPhoto.innerHTML = '<span class="muted">—</span>';
    }

    tr.appendChild(tdTime);
    tr.appendChild(tdAct);
    tr.appendChild(tdPhoto);
    tbody.appendChild(tr);
  }
}

// ====== FETCH TABLE ======
async function refreshTable(){
  const tbody = $('#resultTBody');
  tbody.innerHTML = `<tr><td colspan="3" class="empty">Memuat data…</td></tr>`;
  try{
    const res = await fetch(`${SCRIPT_URL}?token=${encodeURIComponent(SHARED_TOKEN)}`);
    const data = await res.json();
    if (!data.ok){
      if (data.code === 'BAD_TOKEN') throw new Error('Token salah. Cek SHARED_TOKEN & TOKEN.');
      throw new Error(data.message || data.code || 'Gagal memuat data');
    }
    renderRows(data.items || []);
  }catch(err){
    tbody.innerHTML = `<tr><td colspan="3" class="empty err">Gagal memuat: ${String(err.message || err)}</td></tr>`;
  }
}

// ====== PIN TIME PICKER ======
let pinBuffer = ''; // simpan digit "HHMM"
function updateTimeDisplay(){
  const d = pinBuffer.padEnd(4, '_');
  const hh = d.slice(0,2);
  const mm = d.slice(2,4);
  timeDisplay.textContent = `${hh}:${mm}`;
}
function openTimeModal(){
  pinBuffer = (timeInput.value || '').replace(':','');
  if (!/^\d{4}$/.test(pinBuffer)) pinBuffer = '';
  modal.hidden = false;
  updateTimeDisplay();
}
function closeTimeModal(){
  modal.hidden = true;
}
btnPickTime.addEventListener('click', openTimeModal);
btnTimeClose.addEventListener('click', closeTimeModal);

$('#keypad').addEventListener('click', (e)=>{
  const k = e.target?.dataset?.k;
  if (!k) return;
  if (k === 'clear'){ pinBuffer=''; updateTimeDisplay(); return; }
  if (k === 'back'){ pinBuffer = pinBuffer.slice(0,-1); updateTimeDisplay(); return; }
  if (/^\d$/.test(k)){
    if (pinBuffer.length < 4) {
      pinBuffer += k;
      updateTimeDisplay();
    }
  }
});
btnTimeSet.addEventListener('click', ()=>{
  if (pinBuffer.length !== 4) { showMsg(false,'Lengkapi HHMM pada keypad'); return; }
  let hh = parseInt(pinBuffer.slice(0,2),10);
  let mm = parseInt(pinBuffer.slice(2,4),10);
  if (hh>23) hh=23; if (mm>59) mm=59;
  timeInput.value = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  closeTimeModal();
});
modal.addEventListener('click', (e)=>{ if (e.target === modal) closeTimeModal(); });

// ====== UPLOAD + KOMPRES ======
btnUploadPick.addEventListener('click', ()=> fileInput.click());

fileInput.addEventListener('change', async ()=>{
  const file = fileInput.files?.[0];
  if (!file) return;
  uploadInfo.textContent = `Memuat ${file.name}…`;

  try{
    const dataUrl = await compressToJpegDataUrl(file, MAX_SIZE_PX, JPG_QUALITY);
    await drawPreview(dataUrl);
    uploadInfo.textContent = `Siap diunggah (${Math.round(dataUrl.length/1024)} KB ~ kompres)`;
    linkInput.value = ''; // jika upload dipakai, kosongkan link fallback
  }catch(err){
    uploadInfo.textContent = 'Gagal memproses gambar';
    showMsg(false, `Kompresi gagal: ${String(err)}`);
  }
});

function drawPreview(dataUrl){
  return new Promise((resolve)=>{
    const img = new Image();
    img.onload = ()=>{
      const { width, height } = img;
      const scale = Math.min(MAX_SIZE_PX/Math.max(width,height), 1);
      const w = Math.round(width*scale), h = Math.round(height*scale);
      canvasPrev.width = w; canvasPrev.height = h;
      const ctx = canvasPrev.getContext('2d');
      ctx.clearRect(0,0,w,h);
      ctx.drawImage(img, 0, 0, w, h);
      canvasPrev.hidden = false;
      resolve();
    };
    img.src = dataUrl;
  });
}

function compressToJpegDataUrl(file, maxSizePx, quality){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        const maxSide = Math.max(img.width, img.height);
        const scale = Math.min(maxSizePx / maxSide, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL('image/jpeg', quality);
        resolve(out);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ====== SUBMIT ======
form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  submitBtn.disabled = true;

  try{
    const timeHHMM = timeInput.value.trim();
    const activity = $('#activity').value.trim();

    if (!/^\d{2}:\d{2}$/.test(timeHHMM)) throw new Error('Format waktu harus HH:MM');
    if (!activity) throw new Error('Kegiatan wajib diisi');

    let body = { timeHHMM, activity };
    let photoMode = 'link';

    // Prioritas: jika ada data upload (canvas preview sudah aktif) gunakan upload
    let hasUpload = !canvasPrev.hidden && canvasPrev.width > 0 && canvasPrev.height > 0 && fileInput.files?.length;
    if (hasUpload){
      const dataUrl = canvasPrev.toDataURL('image/jpeg', JPG_QUALITY);
      photoMode = 'upload';
      body.photoMode = photoMode;
      body.photoDataUrl = dataUrl;
    } else {
      // fallback ke link (kalau diisi)
      const link = linkInput.value.trim();
      if (!link) throw new Error('Pilih foto untuk upload atau isi link/ID Google Drive.');
      photoMode = 'link';
      body.photoMode = photoMode;
      body.photo = link;
    }

    const res = await fetch(`${SCRIPT_URL}?token=${encodeURIComponent(SHARED_TOKEN)}`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (!data.ok){
      if (data.code === 'FULL')     throw new Error('Slot A18:C28 sudah penuh (10/10). Hapus baris lama dulu.');
      if (data.code === 'BAD_TOKEN') throw new Error('Token salah. Cek SHARED_TOKEN & TOKEN.');
      throw new Error(data.message || data.code || 'Gagal menyimpan');
    }

    showMsg(true, `Tersimpan di baris ${data.row}.`);

    // Reset form ringan
    form.reset();
    canvasPrev.hidden = true; canvasPrev.width = 0; canvasPrev.height = 0;
    uploadInfo.textContent = 'Belum ada gambar';
    const now = new Date();
    timeInput.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    // Refresh tabel
    await refreshTable();

  }catch(err){
    showMsg(false, String(err.message || err));
  }finally{
    submitBtn.disabled = false;
  }
});

// ====== INIT ======
refreshBtn.addEventListener('click', refreshTable);
refreshTable();
