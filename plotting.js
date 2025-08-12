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

// Indikator koneksi (bulatan hijau/merah)
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
const seniorSpecEl = document.getElementById('seniorSpec'); // opsional bila ada di HTML
const addPersonBtn = document.getElementById('addPersonBtn');

// ======== Posisi & durasi (20s semuanya) ========
const positions = [
  { id:'pos1', name:'XRAY',             specLabel:'senior|junior',       allowed:['senior','junior'],           dur:20 },
  { id:'pos2', name:'Pemeriksa Barang', specLabel:'senior|junior|basic', allowed:['senior','junior','basic'],   dur:20 },
  { id:'pos3', name:'Pemeriksa Orang',  specLabel:'junior|basic',        allowed:['junior','basic'],            dur:20 },
  { id:'pos4', name:'Pemeriksa Tiket',  specLabel:'junior|basic',        allowed:['junior','basic'],            dur:20 },
];

// ======== RTDB refs ========
const assignmentsRef = ref(db, 'assignments');
const peopleRef      = ref(db, 'people');

// ======== State countdown & rotasi ========
let timer = null;
let countdowns = positions.map(p=>p.dur);

// simpan indeks rotasi per posisi supaya adil (prioritas kandidat bergilir)
const rotIdx = { pos1:0, pos2:0, pos3:0, pos4:0 };

// ======== Render ========
function renderAssignments(assignments){
  assignRows.innerHTML = '';
  positions.forEach((p, idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.name}</td><td>${p.specLabel}</td><td>${assignments?.[p.id] ?? '-'}</td><td>${countdowns[idx]}s</td>`;
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
const isEligible = (person, allowed) =>
  Array.isArray(person.spec) && person.spec.some(s => allowed.includes(String(s).toLowerCase()));

// ======== Rotasi 20s, kombinasi UNIK antar posisi ====
async function stepRotation(){
  const snap = await get(peopleRef);
  const raw  = snap.val() || {};
  const folks = Object.values(raw).map(p => ({
    ...p,
    spec: Array.isArray(p.spec) ? p.spec.map(s=>String(s).toLowerCase()) : []
  }));

  // Buat pool kandidat per posisi (sudah di-rotate berdasar rotIdx agar adil)
  const pools = positions.map((pos, idx) => {
    const candidates = folks.filter(f => isEligible(f, pos.allowed));
    const rot        = rotate(candidates, rotIdx[pos.id] % Math.max(candidates.length, 1));
    return { pos, idx, list: rot };
  });

  // Urutkan: posisi dengan kandidat paling sedikit diproses dulu
  pools.sort((a,b) => (a.list.length - b.list.length) || (a.idx - b.idx));

  // Backtracking untuk mencari kombinasi unik (tanpa nama ganda)
  const used = new Set();
  const result = {};

  function assign(i){
    if(i === pools.length) return true;
    const { pos, list } = pools[i];

    if(list.length === 0){
      // tidak ada kandidat yang sesuai spesifikasi untuk posisi ini
      result[pos.id] = '-';
      return assign(i+1);
    }

    for(const cand of list){
      const name = cand?.name;
      if(!name || used.has(name)) continue; // jaga keunikan di waktu yang sama
      used.add(name);
      result[pos.id] = name;
      if(assign(i+1)) return true;
      used.delete(name);
    }

    // tidak ketemu kombinasi unik untuk cabang ini
    return false;
  }

  // coba cari kombinasi unik penuh
  const fullUnique = assign(0);

  // kalau tidak bisa penuh unik, isi yang bisa saja (unik), sisanya '-'
  if(!fullUnique){
    used.clear();
    for(const { pos, list } of pools){
      const pick = list.find(p => p?.name && !used.has(p.name));
      if(pick){ result[pos.id] = pick.name; used.add(pick.name); }
      else if(list.length > 0){ result[pos.id] = '-'; }
      else { result[pos.id] = '-'; }
    }
  }

  // majukan indeks rotasi per posisi (agar prioritas kandidat bergilir adil)
  for(const { pos, list } of pools){
    const len = list.length;
    if(len > 0) rotIdx[pos.id] = (rotIdx[pos.id] + 1) % len;
  }

  await set(assignmentsRef, result);
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

// Tambah personil
addPersonBtn.onclick = async ()=>{
  const name = nameInput.value.trim(); if(!name) return;
  const specs = [];
  if(juniorSpec?.checked) specs.push('junior');
  if(basicSpec?.checked)  specs.push('basic');
  if(seniorSpecEl?.checked) specs.push('senior'); // bila ada di HTML
  await update(ref(db, 'people/'+name.toLowerCase()), { name, spec: specs });
  nameInput.value='';
  if(juniorSpec) juniorSpec.checked=false;
  if(basicSpec)  basicSpec.checked=false;
  if(seniorSpecEl) seniorSpecEl.checked=false;
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
