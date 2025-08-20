// ==== KONFIG: sesuaikan dengan deployment Apps Script kamu ====
const SCRIPT_URL   = 'https://script.google.com/macros/s/AKfycbykEpoX-fKWM5jtIKGJPfgIE1fU8cSqGTRY90RwYvhFgJ6RvBaEvk6zoiWWFAlbDYbdpw/exec'; // GANTI
const SHARED_TOKEN = 'N45p'; // samakan dgn TOKEN di code.gs

// ===== UTIL DOM =====
const $ = (s, el = document) => el.querySelector(s);

// ===== MESSAGE UI =====
function showMsg(ok, msg){
  const okBox  = $('#statusOk');
  const errBox = $('#statusErr');
  okBox.style.display = 'none';
  errBox.style.display = 'none';
  if (ok) { okBox.textContent = msg; okBox.style.display = 'block'; }
  else    { errBox.textContent = msg; errBox.style.display = 'block'; }
}

// ===== DEFAULT TIME =====
(function setDefaultTime(){
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  $('#timeHHMM').value = `${hh}:${mm}`;
})();

// ===== RENDER TABEL =====
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

// ===== FETCH DATA =====
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

// ===== SUBMIT FORM =====
$('#kForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#submitBtn');
  btn.disabled = true;

  try{
    const timeHHMM = $('#timeHHMM').value.trim();
    const activity = $('#activity').value.trim();
    const photo    = $('#photo').value.trim();

    if (!/^\d{2}:\d{2}$/.test(timeHHMM)) throw new Error('Format waktu harus HH:MM');
    if (!activity)                       throw new Error('Kegiatan wajib diisi');
    if (!photo)                          throw new Error('Link/ID foto wajib diisi');

    const res = await fetch(`${SCRIPT_URL}?token=${encodeURIComponent(SHARED_TOKEN)}`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ timeHHMM, activity, photo })
    });
    const data = await res.json();

    if (!data.ok){
      if (data.code === 'FULL')     throw new Error('Slot A18:C28 sudah penuh (10/10). Hapus baris lama dulu.');
      if (data.code === 'BAD_TOKEN')throw new Error('Token salah. Cek SHARED_TOKEN & TOKEN.');
      throw new Error(data.message || data.code || 'Gagal menyimpan');
    }

    showMsg(true, `Tersimpan di baris ${data.row}.`);

    // Reset form & set default jam lagi
    $('#kForm').reset();
    const now = new Date();
    $('#timeHHMM').value = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    // Refresh tabel
    await refreshTable();

  }catch(err){
    showMsg(false, String(err.message || err));
  }finally{
    btn.disabled = false;
  }
});

// ===== Tombol segarkan + load awal =====
$('#refreshBtn').addEventListener('click', refreshTable);
refreshTable();
