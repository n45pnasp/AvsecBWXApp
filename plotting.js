// ==== Firebase SDK v9 (modular) ====
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase, ref, onValue, set, update, remove, get
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ======== Konfigurasi dari project kamu ========
const firebaseConfig = {
  apiKey: "AIzaSyCtJxtgVbMxZdVUMmFGDnqzt2LttxW9KOQ",
  authDomain: "plotting-e9cb7.firebaseapp.com",
  databaseURL: "https://plotting-e9cb7-default-rtdb.firebaseio.com",
  projectId: "plotting-e9cb7",
  storageBucket: "plotting-e9cb7.firebasestorage.app",
  messagingSenderId: "518993555934",
  appId: "1:518993555934:web:41e90375a565ab00776d4f",
  measurementId: "G-GWBBDS8YZZ"
};

// ======== Init & Diagnostik ========
const diagEl = document.getElementById('diag');
const log = (...a)=>{ diagEl.textContent += '\n' + a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '); };

let app, db;
try {
  app = initializeApp(firebaseConfig);
  db  = getDatabase(app);
  log('✅ Firebase init OK');
} catch(e){ log('❌ Firebase init ERROR:', e.message||e); }

try {
  const pingRef = ref(db, '__ping');
  await set(pingRef, { at: Date.now() });
  log('✅ Tulis __ping OK');
  const snap = await get(pingRef); log('✅ Baca __ping OK:', snap.val());
} catch(e){ log('❌ Ping ERROR:', e.message||e); }

// ======== UI refs ========
const assignRows = document.getElementById('assignRows');
const peopleRows = document.getElementById('peopleRows');
const startBtn   = document.getElementById('startBtn');
const stopBtn    = document.getElementById('stopBtn');
const nextBtn    = document.getElementById('nextBtn');
const nameInput  = document.getElementById('nameInput');
const juniorSpec = document.getElementById('juniorSpec');
const basicSpec  = document.getElementById('basicSpec');
const addPersonBtn = document.getElementById('addPersonBtn');

// ======== Data statis posisi & durasi ========
const positions = [
  { id: 'pos1', name: 'XRAY',             spec: ['junior'], dur: 40 },
  { id: 'pos2', name: 'Pemeriksa Barang', spec: ['junior'], dur: 20 },
  { id: 'pos3', name: 'Pemeriksa Orang',  spec: ['basic'],  dur: 20 },
  { id: 'pos4', name: 'Pemeriksa Tiket',  spec: ['basic'],  dur: 20 }
];

// ======== RTDB refs ========
const assignmentsRef = ref(db, 'assignments');
const peopleRef      = ref(db, 'people');

// ======== State countdown & rotasi ========
let timer = null;
let countdowns = positions.map(p=>p.dur);

// 👉 Indeks rotasi per ring (tanpa ubah UX pemilihan)
let rotationIndexJunior = 0;
let rotationIndexBasic  = 0;

// ======== Render ========
function renderAssignments(assignments){
  assignRows.innerHTML = '';
  positions.forEach((pos, idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${pos.name}</td><td>${pos.spec.join(',')}</td><td>${assignments?.[pos.id]||'-'}</td><td>${countdowns[idx]}s</td>`;
    assignRows.appendChild(tr);
  });
}

function renderPeople(people){
  peopleRows.innerHTML = '';
  Object.entries(people||{}).forEach(([id, p])=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.name}</td>
      <td><input type="checkbox" ${p.spec?.includes('junior')?'checked':''} data-id="${id}" data-spec="junior" /></td>
      <td><input type="checkbox" ${p.spec?.includes('basic')?'checked':''} data-id="${id}" data-spec="basic" /></td>
      <td><button data-del="${id}">Hapus</button></td>`;
    peopleRows.appendChild(tr);
  });
}

// ======== Rotasi (perbaikan: benar-benar berputar) ========
async function stepRotation(){
  const snap = await get(peopleRef);
  const all  = snap.val() || {};

  const junior = Object.values(all).filter(p=>p.spec?.includes('junior'));
  const basic  = Object.values(all).filter(p=>p.spec?.includes('basic'));

  // putar urutan berdasar indeks rotasi, lalu tetap ambil dua teratas
  const jr = junior.length ? junior.slice(rotationIndexJunior).concat(junior.slice(0, rotationIndexJunior)) : [];
  const bs = basic.length  ? basic.slice(rotationIndexBasic).concat(basic.slice(0, rotationIndexBasic))     : [];

  const assignments = {
    pos1: jr[0]?.name || '-',
    pos2: jr[1]?.name || '-',
    pos3: bs[0]?.name || '-',
    pos4: bs[1]?.name || '-'
  };

  await set(assignmentsRef, assignments);
  countdowns = positions.map(p=>p.dur);

  // naikkan indeks agar giliran berikutnya bergeser
  rotationIndexJunior = (rotationIndexJunior + 1) % Math.max(junior.length, 1);
  rotationIndexBasic  = (rotationIndexBasic  + 1) % Math.max(basic.length,  1);
}

// ======== Events ========
startBtn.onclick = ()=>{
  if(timer) clearInterval(timer);
  timer = setInterval(()=>{
    countdowns = countdowns.map((c,i)=>{
      if(c>1) return c-1; else { stepRotation(); return positions[i].dur; }
    });
    get(assignmentsRef).then(snap=>renderAssignments(snap.val()||{}));
  }, 1000);
  stepRotation();
};

stopBtn.onclick = ()=>{ if(timer) clearInterval(timer); timer = null; };
nextBtn.onclick = stepRotation;

addPersonBtn.onclick = async ()=>{
  const name = nameInput.value.trim(); if(!name) return;
  const specs = [];
  if(juniorSpec.checked) specs.push('junior');
  if(basicSpec.checked)  specs.push('basic');
  await update(ref(db, 'people/'+name.toLowerCase()), { name, spec: specs });
  nameInput.value=''; juniorSpec.checked=false; basicSpec.checked=false;
};

peopleRows.addEventListener('change', async (e)=>{
  if(e.target.type !== 'checkbox') return;
  const id = e.target.dataset.id, spec = e.target.dataset.spec;
  const snap = await get(ref(db, 'people/'+id)); let person = snap.val(); if(!person) return;
  if(!Array.isArray(person.spec)) person.spec = [];
  if(e.target.checked){
    if(!person.spec.includes(spec)) person.spec.push(spec);
  } else {
    person.spec = person.spec.filter(s=>s!==spec);
  }
  await update(ref(db, 'people/'+id), person);
});

peopleRows.addEventListener('click', async (e)=>{
  if(!e.target.dataset.del) return;
  await remove(ref(db, 'people/'+e.target.dataset.del));
});

// ======== Listeners ========
onValue(assignmentsRef, (snap)=> renderAssignments(snap.val()||{}));
onValue(peopleRef,      (snap)=> renderPeople(snap.val()||{}));
