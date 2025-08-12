// ==== Firebase SDK v9 (modular) ====
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase, ref, onValue, set, update, remove, get
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ======== Konfigurasi project ========
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

// Init
const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// Indikator koneksi bulat hijau/merah
const connDot = document.getElementById('connDot');
const setConn = ok => { if (connDot) connDot.classList.toggle('ok', !!ok); };
onValue(ref(db, ".info/connected"), snap => setConn(!!snap.val()));

// ======== UI refs ========
const assignRows   = document.getElementById('assignRows');
const peopleRows   = document.getElementById('peopleRows');
const startBtn     = document.getElementById('startBtn');
const stopBtn      = document.getElementById('stopBtn');
const nextBtn      = document.getElementById('nextBtn');
const nameInput    = document.getElementById('nameInput');
const juniorSpec   = document.getElementById('juniorSpec');
const basicSpec    = document.getElementById('basicSpec');
// (opsional) kalau kamu tambahkan checkbox senior di HTML, ambil juga elemennya:
const seniorSpecEl = document.getElementById('seniorSpec');
const addPersonBtn = document.getElementById('addPersonBtn');

// ======== Posisi & durasi (20s semuanya) ========
const positions = [
  { id:'pos1', name:'XRAY',             specLabel:'senior|junior',       allowed:['senior','junior'], dur:20 },
  { id:'pos2', name:'Pemeriksa Barang', specLabel:'senior|junior|basic', allowed:['senior','junior','basic'], dur:20 },
  { id:'pos3', name:'Pemeriksa Orang',  specLabel:'junior|basic',        allowed:['junior','basic'], dur:20 },
  { id:'pos4', name:'Pemeriksa Tiket',  specLabel:'junior|basic',        allowed:['junior','basic'], dur:20 },
];

// ======== RTDB refs ========
const assignmentsRef = ref(db, 'assignments');
const peopleRef      = ref(db, 'people');

// ======== State countdown & rotasi ========
let timer = null;
let countdowns = positions.map(p=>p.dur);

// simpan indeks rotasi per posisi agar adil (tiap posisi punya antrian sendiri)
const rotIdx = { pos1:0, pos2:0, pos3:0, pos4:0 };

// ======== Render ========
function renderAssignments(assignments){
  assignRows.innerHTML = '';
  positions.forEach((p, idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.name}</td><td>${p.specLabel}</td><td>${assignments?.[p.id]||'-'}</td><td>${countdowns[idx]}s</td>`;
    assignRows.appendChild(tr);
  });
}

function renderPeople(people){
  peopleRows.innerHTML = '';
  Object.entries(people||{}).forEach(([id, p])=>{
    const has = s => Array.isArray(p.spec) && p.spec.includes(s);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.name}</td>
      <td><input type="checkbox" ${has('junior')?'checked':''} data-id="${id}" data-spec="junior" /></td>
      <td><input type="checkbox" ${has('basic')?'checked':''}  data-id="${id}" data-spec="basic"  /></td>
      <td><input type="checkbox" ${has('senior')?'checked':''} data-id="${id}" data-spec="senior" /></td>
      <td><button data-del="${id}">Hapus</button></td>`;
    peopleRows.appendChild(tr);
  });
}

// ======== Helpers ========
const rotate = (arr, idx) => arr.length ? arr.slice(idx).concat(arr.slice(0, idx)) : [];
const eligible = (person, allowed) =>
  Array.isArray(person.spec) && person.spec.some(s => allowed.includes(String(s).toLowerCase()));
const nextFrom = (list, used) => {
  for(const p of list){ if(p?.name && !used.has(p.name)) return p.name; }
  return '-';
};

// ======== Rotasi (20s, aturan allowed per posisi) ========
async function stepRotation(){
  const snap = await get(peopleRef);
  const all  = snap.val() || {};
  const folks = Object.values(all);

  const used = new Set();
  const assignments = {};

  for(const p of positions){
    // daftar kandidat untuk posisi p, dirotasi berdasarkan rotIdx posisi tsb
    const pool = folks.filter(f => eligible(f, p.allowed));
    const rot  = rotate(pool, rotIdx[p.id] % Math.max(pool.length,1));
    const pick = nextFrom(rot, used);
    assignments[p.id] = pick;
    if(pick !== '-') used.add(pick);

    // majukan indeks rotasi untuk posisi ini agar next cycle berganti orang
    rotIdx[p.id] = (rotIdx[p.id] + 1) % Math.max(pool.length, 1);
  }

  await set(assignmentsRef, assignments);
  countdowns = positions.map(p=>p.dur);
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

// Tambah/orbit personil
addPersonBtn.onclick = async ()=>{
  const name = nameInput.value.trim(); if(!name) return;
  const specs = [];
  if(juniorSpec?.checked) specs.push('junior');
  if(basicSpec?.checked)  specs.push('basic');
  if(seniorSpecEl?.checked) specs.push('senior'); // bila ditambahkan di HTML
  await update(ref(db, 'people/'+name.toLowerCase()), { name, spec: specs });
  nameInput.value=''; if(juniorSpec) juniorSpec.checked=false; if(basicSpec) basicSpec.checked=false; if(seniorSpecEl) seniorSpecEl.checked=false;
};

// Toggle spec / hapus
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
