import { requireAuth } from "./auth-guard.js";

// Lindungi halaman: wajib login
requireAuth({ loginPath: "index.html", hideWhileChecking: true });

const DROPDOWN_URL = "https://avsecbwxapp.online/api/dropdown"; // Cloudflare JSON lookup
let allFaskampen = [];
let currentType = "STP";
const resultLabel = document.getElementById('resultLabel');

function updateResult(){
  const allChecks = document.querySelectorAll('#dynamicContent1 input[type="checkbox"], #dynamicContent2 input[type="checkbox"]');
  const total = allChecks.length;
  const checked = document.querySelectorAll('#dynamicContent1 input[type="checkbox"]:checked, #dynamicContent2 input[type="checkbox"]:checked').length;
  const pass = total > 0 && checked === total;
  resultLabel.textContent = `HASIL FASKAMPEN : ${pass ? 'PASS' : 'FAIL'}`;
  resultLabel.dataset.pass = pass;
  return pass;
}

function bindChecks(container){
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.addEventListener('change', updateResult));
}

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
    const img1 = document.getElementById('typeImage1');
    const img2 = document.getElementById('typeImage2');
    const content1 = document.getElementById('dynamicContent1');
    const content2 = document.getElementById('dynamicContent2');

  function renderSTP(target){
    target.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'card subcard grid-checks';
    populateChecks(grid);
    target.appendChild(grid);
    bindChecks(target);
  }

  function renderOTP(target){
    const html = `\n      <table class="check-table">\n        <thead>\n          <tr>\n            <th>POSISI TEST</th>\n            <th>TIPE<br/>KNIFE 304</th>\n            <th>HASIL TEST<br/>centang=Alarm<br/>Kosong=No Alarm</th>\n          </tr>\n        </thead>\n        <tbody>\n          <tr>\n            <td rowspan="2">Lengan Kanan<br/>Bagian Dalam</td>\n            <td>IN</td>\n            <td><input type="checkbox" /></td>\n          </tr>\n          <tr>\n            <td>OUT</td>\n            <td><input type="checkbox" /></td>\n          </tr>\n          <tr>\n            <td rowspan="2">Pinggang Kanan</td>\n            <td>IN</td>\n            <td><input type="checkbox" /></td>\n          </tr>\n          <tr>\n            <td>OUT</td>\n            <td><input type="checkbox" /></td>\n          </tr>\n          <tr>\n            <td rowspan="2">Pinggang Belakang<br/>Bagian Tengah</td>\n            <td>IN</td>\n            <td><input type="checkbox" /></td>\n          </tr>\n          <tr>\n            <td>OUT</td>\n            <td><input type="checkbox" /></td>\n          </tr>\n          <tr>\n            <td rowspan="2">Pergelangan Kaki<br/>Bagian Kanan</td>\n            <td>IN</td>\n            <td><input type="checkbox" /></td>\n          </tr>\n          <tr>\n            <td>OUT</td>\n            <td><input type="checkbox" /></td>\n          </tr>\n        </tbody>\n      </table>`;
    target.innerHTML = html;
    bindChecks(target);
  }

  function renderHHMD(target){
    const html = `\n      <table class="check-table hhmd-table">\n        <tbody>\n          <tr>\n            <td>TEST 1</td>\n            <td>TEST 2</td>\n            <td>TEST 3</td>\n          </tr>\n          <tr>\n            <td><input type="checkbox" /></td>\n            <td><input type="checkbox" /></td>\n            <td><input type="checkbox" /></td>\n          </tr>\n        </tbody>\n      </table>`;
    target.innerHTML = html;
    bindChecks(target);
  }

  function handle(btn){
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if(btn.id === 'btnSTP'){
        currentType = 'STP';
        img1.src = 'icons/stp.png';
        img2.src = 'icons/stp.png';
        renderSTP(content1);
        renderSTP(content2);
      } else if(btn.id === 'btnOTP'){
        currentType = 'OTP';
        img1.src = 'icons/otp.png';
        img2.src = 'icons/otp.png';
        renderOTP(content1);
        renderOTP(content2);
      } else if(btn.id === 'btnHHMD'){
        currentType = 'HHMD';
        img1.src = 'icons/hhmd.png';
        img2.src = 'icons/hhmd.png';
        renderHHMD(content1);
        renderHHMD(content2);
      }

    updateResult();
    updateDropdown();
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => handle(btn));
  });

  handle(document.getElementById('btnSTP'));
}

function initSubmit(){
  const overlay = document.getElementById('overlay');
  document.getElementById('submitBtn').addEventListener('click', () => {
    const pass = resultLabel.dataset.pass === 'true';
    const fall = !pass;
    console.log('Kirim ke spreadsheet', { pass, fall });
    overlay.classList.remove('hidden');
    setTimeout(() => {
      overlay.classList.add('hidden');
      alert('Data terkirim');
    }, 1000);
  });
}

function populateChecks(wrap){
  const rows = 9;
  const cols = 4;
  for(let r=0; r<rows; r++){
    for(let c=0; c<cols; c++){
      const num = r + c * rows + 1;
      const label = document.createElement('label');
      const span = document.createElement('span');
      span.textContent = num;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      label.appendChild(span);
      label.appendChild(cb);
      wrap.appendChild(label);
    }
  }
}

function updateDropdown(){
  const select = document.getElementById('faskampen');
  select.innerHTML = '<option value="" selected>Pilih Faskampen</option>';
  if(!allFaskampen.length) return;

  let prefixes;
  if(currentType === 'OTP') prefixes = ['WTMD'];
  else if(currentType === 'HHMD') prefixes = ['HHMD','ETD'];
  else prefixes = ['PSCP','HBSCP','CARGO'];

  const opts = allFaskampen.filter(name =>
    prefixes.some(p => name.toUpperCase().startsWith(p))
  );
  for(const name of opts){
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  }
}

async function loadFaskampen(){
  try{
    const res = await fetch(DROPDOWN_URL);
    allFaskampen = await res.json();
    updateDropdown();
  }catch(err){
    console.error('Gagal memuat faskampen', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupPhoto('photoBtn1','fileInput1','preview1','uploadInfo1','uploadStatus1','uploadName1');
  setupPhoto('photoBtn2','fileInput2','preview2','uploadInfo2','uploadStatus2','uploadName2');
  initTypeButtons();
  initSubmit();
  loadFaskampen();
});
