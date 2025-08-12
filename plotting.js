// ==== Firebase SDK v9 (modular) ====
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, onValue, set, update, remove, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

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

// Indikator koneksi (bulatan)
const connDot = document.getElementById('connDot');
const setConn = ok => { if (connDot) connDot.classList.toggle('ok', !!ok); };

// Pantau status koneksi realtime
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
const addPersonBtn = document.getElementById('addPersonBtn');

// ======== Data posisi & durasi (UI tetap) ========
const positions = [
  { id: 'pos1', name: 'XRAY',             specLabel: 'junior',       dur: 40 },
  { id: 'pos2', name: 'Pemeriksa Barang', specLabel: 'junior|basic', dur: 20 },
  { id: 'pos3', name: 'Pemeriksa Orang',  specLabel: 'basic',        dur: 20 },
  { id: 'pos4', name: 'Pemeriksa Tiket',  specLabel: 'basic',        dur: 20 }
];

// ======== RTDB refs ========
const assignmentsRef = ref(db, 'assignments');
const peopleRef      = ref(db, 'people');

// ======== State countdown & rotasi ========
let timer = null;
let countdowns = positions.map(p=>p.dur);

// Indeks rotasi terpisah
let rotationIndexJunior = 0;  // untuk XRAY (dan pos2 bila ≥2 junior)
let rotationIndexBasic  = 0;  // untuk pos2 (jika pakai basic), pos3, pos4

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
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.name}</td>
      <td><input type="checkbox" ${p.spec?.includes('junior')?'checked':''} data-id="${id}" data-spec="junior" /></td>
      <td><input type="checkbox" ${p.spec?.includes('basic')?'checked':''} data-id="${id}" data-spec="basic" /></td>
      <td><button data-del="${id}">Hapus</button></td>`;
    peopleRows.appendChild(tr);
  });
}

// ======== Helper ========
const rotate = (arr, idx) => arr.length ? arr.slice(idx).concat(arr.slice(0, idx)) : [];
const pickNext = (list, used) => {
  for(const p of list){
    if(p?.name && !used.has(p.name)) return p.name;
  }
  return '-';
};

// ======== Rotasi dengan aturan terbaru ========
async function stepRotation(){
  const snap = await get(peopleRef);
  const all  = snap.val() || {};

  const juniors = Object.values(all).filter(p=>Array.isArray(p.spec) && p.spec.includes('junior'));
  const basics  = Object.values(all).filter(p=>Array.isArray(p.spec) && p.spec.includes('basic'));

  // urutan berputar sesuai indeks
  const jrRot = rotate(juniors, rotationIndexJunior);
  const bsRot = rotate(basics,  rotationIndexBasic);

  const used = new Set();
  const assignments = {};

  // pos1: XRAY -> wajib junior
  const pos1 = jrRot[0]?.name || '-';
  assignments.pos1 = pos1;
  if(pos1 !== '-') used.add(pos1);

  // pos2: Pemeriksa Barang -> jika ada >=2 junior => pakai junior ke-2; else pakai basic
  if (juniors.length >= 2) {
    const jr2 = pickNext(jrRot.slice(1), used); // mulai dari kandidat kedua
    assignments.pos2 = jr2;
    if(jr2 !== '-') used.add(jr2);
  } else {
    const bs1 = pickNext(bsRot, used);
    assignments.pos2 = bs1;
    if(bs1 !== '-') used.add(bs1);
  }

  // pos3: Pemeriksa Orang -> basic
  const pos3 = pickNext(bsRot, used);
  assignments.pos3 = pos3;
  if(pos3 !== '-') used.add(pos3);

  // pos4: Pemeriksa Tiket -> basic
  const pos4 = pickNext(bsRot, used);
  assignments.pos4 = pos4;
  if(pos4 !== '-') used.add(pos4);

  await set(assignmentsRef, assignments);

  // reset countdown & majukan indeks
  countdowns = positions.map(p=>p.dur);
  rotationIndexJunior = (rotationIndexJunior + 1) % Math.max(juniors.length, 1);
  rotationIndexBasic  = (rotationIndexBasic  + 1) % Math.max(basics.length,  1);
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
