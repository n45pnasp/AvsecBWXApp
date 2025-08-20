// ====== KONFIG ======
const SCRIPT_URL   = 'https://script.google.com/macros/s/AKfycbzAV6FM5297R4fqz7JTAb2HM6rVbS9_ltZl7NOXAthas9ZJT2-2tIj3O5NLBLn4VA1Pvg/exec';
const SHARED_TOKEN = 'N45p';
const JPG_QUALITY  = 0.8;
const MAX_SIZE_PX  = 300;

// ====== DOM ======
const $  = (s, el=document) => el.querySelector(s);

const timeInput     = $('#timeHHMM');
const btnPickTime   = $('#btnPickTime');
const modal         = $('#timeModal');
const timeDisplay   = $('#timeDisplay');
const btnTimeClose  = $('#timeClose');
const btnTimeSet    = $('#timeSet');
const keypad        = $('#keypad');

const fileInput     = $('#photoFile');   // galeri
const camInput      = $('#photoCam');    // kamera
const btnPickGallery= $('#btnPickGallery');
const btnPickCamera = $('#btnPickCamera');
const uploadInfo    = $('#uploadInfo');
const canvasPrev    = $('#previewCanvas');
const linkInput     = $('#photoLink');

const form          = $('#kForm');
const submitBtn     = $('#submitBtn');
const refreshBtn    = $('#refreshBtn');

// ====== STATE ======
let pinBuffer = '';              // "HHMM"
let uploadedThumbUrl = '';       // hasil upload-only (thumbnail)
let uploading = false;

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

// ====== TABLE ======
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
      img.alt = 'foto'; img.loading = 'lazy'; img.src = it.photoUrl;
      a.appendChild(img); tdPhoto.appendChild(a);
    } else tdPhoto.innerHTML = '<span class="muted">—</span>';

    tr.appendChild(tdTime); tr.appendChild(tdAct); tr.appendChild(tdPhoto);
    tbody.appendChild(tr);
  }
}

// ====== TIME PICKER ======
// Jangan buka modal kecuali lewat tombol:
timeInput.addEventListener('focus', (e)=> e.target.blur());
timeInput.addEventListener('click', (e)=> e.preventDefault());

btnPickTime.addEventListener('click', async ()=>{
  // Coba native showPicker jika ada dan hasilnya bagus
  if (timeInput.showPicker) {
    try {
      // sementara ubah tipe ke time agar native muncul, lalu kembalikan
      timeInput.setAttribute('type','time');
      timeInput.showPicker();
      // kembalikan readonly behavior setelah sedikit delay
      setTimeout(()=>{ timeInput.setAttribute('type','text'); }, 100);
      return;
    } catch(_) {
      // fallback ke modal
      timeInput.setAttribute('type','text');
    }
  }
  openTimeModal();
});

function openTimeModal(){
  pinBuffer = (timeInput.value || '').replace(':','');
  if (!/^\d{4}$/.test(pinBuffer)) pinBuffer = '';
  modal.hidden = false;
  updateTimeDisplay();
}
function closeTimeModal(){ modal.hidden = true; }

btnTimeClose.addEventListener('click', closeTimeModal);
modal.addEventListener('click', (e)=>{ if (e.target === modal) closeTimeModal(); });

function updateTimeDisplay(){
  const d = pinBuffer.padEnd(4, '_');
  const hh = d.slice(0,2), mm = d.slice(2,4);
  timeDisplay.textContent = `${hh}:${mm}`;
}
// Guard keypad agar valid sepanjang input
keypad.addEventListener('click', (e)=>{
  const k = e.target?.dataset?.k;
  if (!k) return;
  if (k === 'clear'){ pinBuffer=''; updateTimeDisplay(); return; }
  if (k === 'back'){  pinBuffer = pinBuffer.slice(0,-1); updateTimeDisplay(); return; }
  if (!/^\d$/.test(k)) return;

  let next = pinBuffer + k;
  if (next.length === 1) {
    // H: 0-2
    if (+next[0] > 2) return;
  } else if (next.length === 2) {
    // HH: jika H1=2, H2=0-3
    if (pinBuffer[0] === '2' && +next[1] > 3) return;
  } else if (next.length === 3) {
    // M1: 0-5
    if (+next[2] > 5) return;
  } else if (next.length > 4) {
    return;
  }
  pinBuffer = next;
  updateTimeDisplay();
});

btnTimeSet.addEventListener('click', ()=>{
  if (pinBuffer.length !== 4) { showMsg(false,'Lengkapi HHMM pada keypad'); return; }
  let hh = parseInt(pinBuffer.slice(0,2),10);
  let mm = parseInt(pinBuffer.slice(2,4),10);
  if (hh>23) hh=23; if (mm>59) mm=59;
  timeInput.value = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  closeTimeModal();
});

// ====== UPLOAD: pilih sumber ======
btnPickGallery.addEventListener('click', ()=> fileInput.click());
btnPickCamera .addEventListener('click', ()=> camInput.click());

// Kompres → Upload segera → simpan uploadedThumbUrl
fileInput.addEventListener('change', ()=> handleChosenFile(fileInput.files?.[0]));
camInput .addEventListener('change', ()=> handleChosenFile(camInput.files?.[0]));

async function handleChosenFile(file){
  if (!file) return;
  try{
    uploading = true;
    uploadInfo.textContent = `Memproses ${file.name}…`;

    // Kompres
    const dataUrl = await compressToJpegDataUrl(file, MAX_SIZE_PX, JPG_QUALITY);
    await drawPreview(dataUrl);

    // Upload-only
    uploadInfo.textContent = 'Mengunggah…';
    const up = await fetch(`${SCRIPT_URL}?token=${encodeURIComponent(SHARED_TOKEN)}`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ op: 'upload', photoDataUrl: dataUrl })
    }).then(r=>r.json());

    if (!up.ok) throw new Error(up.message || up.code || 'Upload gagal');
    uploadedThumbUrl = up.photoUrl || '';
    uploadInfo.textContent = 'Upload selesai ✔';
    // Kosongkan fallback link bila ada
    linkInput.value = '';
  }catch(err){
    uploadedThumbUrl = '';
    uploadInfo.textContent = 'Gagal upload';
    showMsg(false, `Upload gagal: ${String(err.message || err)}`);
  }finally{
    uploading = false;
  }
}

function drawPreview(dataUrl){
  return new Promise((resolve)=>{
    const img = new Image();
    img.onload = ()=>{
      const maxSide = Math.max(img.width, img.height);
      const scale = Math.min(MAX_SIZE_PX/maxSide, 1);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
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
    const r = new FileReader();
    r.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        const maxSide = Math.max(img.width, img.height);
        const scale = Math.min(maxSizePx / maxSide, 1);
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = r.result;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ====== SUBMIT ======
form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if (uploading) { showMsg(false,'Tunggu upload gambar selesai dulu.'); return; }

  submitBtn.disabled = true;
  try{
    const timeHHMM = timeInput.value.trim();
    const activity = $('#activity').value.trim();
    if (!/^\d{2}:\d{2}$/.test(timeHHMM)) throw new Error('Format waktu harus HH:MM');
    if (!activity) throw new Error('Kegiatan wajib diisi');

    let body = { timeHHMM, activity };

    if (uploadedThumbUrl) {
      body.photoMode     = 'thumbUrl';
      body.photoThumbUrl = uploadedThumbUrl;
    } else {
      const link = linkInput.value.trim();
      if (!link) throw new Error('Pilih/ambil foto atau isi link/ID Google Drive.');
      body.photoMode = 'link';
      body.photo     = link;
    }

    const res  = await fetch(`${SCRIPT_URL}?token=${encodeURIComponent(SHARED_TOKEN)}`, {
      method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.ok){
      if (data.code === 'FULL')     throw new Error('Slot A18:C28 sudah penuh (10/10). Hapus baris lama dulu.');
      if (data.code === 'BAD_TOKEN') throw new Error('Token salah. Cek SHARED_TOKEN & TOKEN.');
      throw new Error(data.message || data.code || 'Gagal menyimpan');
    }

    showMsg(true, `Tersimpan di baris ${data.row}.`);
    // Reset ringan
    form.reset();
    uploadedThumbUrl = '';
    canvasPrev.hidden = true; canvasPrev.width = 0; canvasPrev.height = 0;
    uploadInfo.textContent = 'Belum ada gambar';
    const now = new Date();
    timeInput.value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

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
