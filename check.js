// Interaksi untuk halaman check

function setupPhoto(btnId, inputId, previewId, infoId, statusId, nameId){
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const info = document.getElementById(infoId);
  const status = document.getElementById(statusId);
  const name = document.getElementById(nameId);

  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files[0];
    if(!file) return;
    preview.src = URL.createObjectURL(file);
    status.textContent = 'Foto siap diunggah';
    name.textContent = file.name;
    info.classList.remove('hidden');
  });
}

function initDropdown(){
  const opts = ['Baik','Rusak','Perlu Perbaikan'];
  const sel = document.getElementById('selectNilai');
  sel.innerHTML = '<option value="">Pilih nilai…</option>';
  opts.forEach(v => {
    const o = document.createElement('option');
    o.value = v; o.textContent = v; sel.appendChild(o);
  });
}

function initTypeButtons(){
  const buttons = document.querySelectorAll('.type-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('primary'));
      btn.classList.add('primary');
    });
  });
}

function initSubmit(){
  const overlay = document.getElementById('overlay');
  document.getElementById('submitBtn').addEventListener('click', () => {
    overlay.classList.remove('hidden');
    setTimeout(() => {
      overlay.classList.add('hidden');
      alert('Data terkirim');
    }, 1000);
  });
}

function populateChecks(id){
  const wrap = document.getElementById(id);
  for(let i=1;i<=36;i++){
    const label = document.createElement('label');
    const span = document.createElement('span');
    span.textContent = i;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    label.appendChild(span);
    label.appendChild(cb);
    wrap.appendChild(label);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupPhoto('photoBtn1','fileInput1','preview1','uploadInfo1','uploadStatus1','uploadName1');
  setupPhoto('photoBtn2','fileInput2','preview2','uploadInfo2','uploadStatus2','uploadName2');
  initDropdown();
  initTypeButtons();
  initSubmit();
  populateChecks('checks1');
  populateChecks('checks2');
});
