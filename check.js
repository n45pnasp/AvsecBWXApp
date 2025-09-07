import { requireAuth } from "./auth-guard.js";

// Lindungi halaman: wajib login
requireAuth({ loginPath: "index.html", hideWhileChecking: true });

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

function initTypeButtons(){
    const buttons = document.querySelectorAll('.type-btn');
    const img = document.getElementById('typeImage');
  const content = document.getElementById('dynamicContent');

  function renderSTP(){
    content.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'card subcard grid-checks';
    populateChecks(grid);
    content.appendChild(grid);
  }

  function renderOTP(){
    content.innerHTML = `\n      <table class="check-table">\n        <thead>\n          <tr>\n            <th>POSISI TEST</th>\n            <th>TIPE<br/>KNIFE 304</th>\n            <th>HASIL TEST<br/>centang=Alarm<br/>Kosong=No Alarm</th>\n          </tr>\n        </thead>\n        <tbody>\n          <tr>\n            <td rowspan="2">Lengan Kanan<br/>Bagian Dalam</td>\n            <td>IN</td>\n            <td><input type="checkbox" /></td>\n          </tr>\n          <tr>\n            <td>OUT</td>\n            <td><input type="checkbox" /></td>\n          </tr>\n          <tr>\n            <td rowspan="2">Pinggang Kanan</td>\n            <td>IN</td>\n            <td><input type="checkbox" /></td>\n          </tr>\n          <tr>\n            <td>OUT</td>\n            <td><input type="checkbox" /></td>\n          </tr>\n          <tr>\n            <td rowspan="2">Pinggang Belakang<br/>Bagian Tengah</td>\n            <td>IN</td>\n            <td><input type="checkbox" /></td>\n          </tr>\n          <tr>\n            <td>OUT</td>\n            <td><input type="checkbox" /></td>\n          </tr>\n          <tr>\n            <td rowspan="2">Pergelangan Kaki<br/>Bagian Kanan</td>\n            <td>IN</td>\n            <td><input type="checkbox" /></td>\n          </tr>\n          <tr>\n            <td>OUT</td>\n            <td><input type="checkbox" /></td>\n          </tr>\n        </tbody>\n      </table>`;
  }

  function renderHHMD(){
    content.innerHTML = `\n      <table class="check-table hhmd-table">\n        <tbody>\n          <tr>\n            <td>TEST 1</td>\n            <td>TEST 2</td>\n            <td>TEST 3</td>\n          </tr>\n          <tr>\n            <td><input type="checkbox" /></td>\n            <td><input type="checkbox" /></td>\n            <td><input type="checkbox" /></td>\n          </tr>\n        </tbody>\n      </table>`;
  }

  function handle(btn){
    buttons.forEach(b => b.classList.remove('primary'));
    btn.classList.add('primary');
    if(btn.id === 'btnSTP'){
        img.src = 'icons/stp.png';
        renderSTP();
      } else if(btn.id === 'btnOTP'){
        img.src = 'icons/otp.png';
        renderOTP();
      } else if(btn.id === 'btnHHMD'){
        img.src = 'icons/hhmd.png';
        renderHHMD();
      }
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => handle(btn));
  });

  handle(document.getElementById('btnSTP'));
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

function populateChecks(wrap){
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
  initTypeButtons();
  initSubmit();
});
