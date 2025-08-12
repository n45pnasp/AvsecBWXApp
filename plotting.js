// ==== Firebase SDK v9 (modular) ====
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, onValue, set, update, remove, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

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
const mode2040     = document.getElementById('mode2040'); // default OFF
const nameInput    = document.getElementById('nameInput');
const juniorSpec   = document.getElementById('juniorSpec');
const basicSpec    = document.getElementById('basicSpec');
const seniorSpecEl = document.getElementById('seniorSpec');
const addPersonBtn = document.getElementById('addPersonBtn');
const clockEl      = document.getElementById('clock');
const nextEl       = document.getElementById('nextRotation');

// ======== Posisi & aturan (semua 20s) ========
const positions = [
  { id:'pos1', name:'XRAY',             specLabel:'senior|junior',       allowed:['senior','junior'] },
  { id:'pos2', name:'Pemeriksa Barang', specLabel:'senior|junior|basic', allowed:['senior','junior','basic'] },
  { id:'pos3', name:'Pemeriksa Orang',  specLabel:'junior|basic',        allowed:['junior','basic'] },
  { id:'pos4', name:'Pemeriksa Tiket',  specLabel:'junior|basic',        allowed:['junior','basic'] },
];

// ======== RTDB refs ========
const assignmentsRef   = ref(db, 'assignments');
const peopleRef        = ref(db, 'people');
const xrayCooldownRef  = ref(db, 'control/xrayCooldown'); // dipakai jika mode 20–40 aktif

// ======== State ========
let rotationTimer = null;     // timer siklus rotasi
let running = false;          // status berjalan
let remaining = 20;           // detik menuju rotasi berikutnya (global)
const rotIdx = { pos1:0, pos2:0, pos3:0, pos4:0 }; // rotasi adil per posisi

// ======== Render ========
function renderAssignments(assignments){
  assignRows.innerHTML = '';
  positions.forEach((p)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${p.name}</td><td>${p.specLabel}</td><td>${assignments?.[p.id] ?? '-'}</td>`;
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

// ======== Clock (selalu update) ========
function pad(n){ return String(n).padStart(2,'0'); }
function fmt(t){ return `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`; }
function updateClock(){
  const now = new Date();
  clockEl.textContent = fmt(now);
  if(running){
    const next = new Date(now.getTime() + remaining * 1000);
    nextEl.textContent = fmt(next);
  } else {
    nextEl.textContent = '-';
  }
}
setInterval(updateClock, 250); // smooth-enough; ringan

// ======== Helpers ========
const rotate = (arr, idx) => arr.length ? arr.slice(idx).concat(arr.slice(0, idx)) : [];
const isEligible = (person, allowed) =>
  Array.isArray(person.spec) && person.spec.some(s => allowed.includes(String(s).toLowerCase()));

// susun pools kandidat per posisi (dengan/ tanpa cooldown XRAY)
async function buildPools(useCooldown){
  const [pSnap, cdSnap] = await Promise.all([
    get(peopleRef),
    useCooldown ? get(xrayCooldownRef) : Promise.resolve({ val:()=>({}) })
  ]);
  const raw  = pSnap.val() || {};
  const folks = Object.values(raw).map(p => ({
    ...p,
    spec: Array.isArray(p.spec) ? p.spec.map(s=>String(s).toLowerCase()) : []
  }));
  const cooldown = useCooldown ? (cdSnap.val() || {}) : {};

  if(useCooldown){
    const names = new Set(folks.map(f=>f.name));
    for(const k of Object.keys(cooldown)){ if(!names.has(k)) delete cooldown[k]; }
  }

  const pools = positions.map((pos, idx) => {
    let candidates = folks.filter(f => isEligible(f, pos.allowed));
    if(useCooldown && pos.id === 'pos1'){ // XRAY cooldown
      candidates = candidates.filter(f => (cooldown[f.name] || 0) <= 0);
    }
    const rot = rotate(candidates, rotIdx[pos.id] % Math.max(candidates.length, 1));
    return { pos, idx, list: rot };
  });

  // posisi "paling sempit" dulu
  pools.sort((a,b)=> (a.list.length - b.list.length) || (a.idx - b.idx));
  return { pools, cooldown };
}

// Backtracking: cari kombinasi unik penuh (tanpa duplikasi)
function assignUnique(pools){
  const used = new Set();
  const result = {};
  function bt(i){
    if(i === pools.length) return true;
    const { pos, list } = pools[i];
    if(list.length === 0){ result[pos.id] = '-'; return bt(i+1); }
    for(const cand of list){
      const name = cand?.name; if(!name || used.has(name)) continue;
      used.add(name); result[pos.id] = name;
      if(bt(i+1)) return true;
      used.delete(name);
    }
    return false;
  }
  const ok = bt(0);
  return { ok, result };
}
// Unik semampunya; sisanya '-'
function assignUniqueGreedy(pools){
  const used = new Set(); const result = {};
  for(const { pos, list } of pools){
    const pick = list.find(p => p?.name && !used.has(p.name));
    result[pos.id] = pick ? (used.add(pick.name), pick.name) : '-';
  }
  return result;
}
function advanceRotIdx(pools){
  for(const { pos, list } of pools){
    const len = list.length;
    if(len > 0) rotIdx[pos.id] = (rotIdx[pos.id] + 1) % len;
  }
}

// ======== STEP ROTATION ========
async function stepRotation(){
  const useCooldown = !!(mode2040 && mode2040.checked);

  const { pools, cooldown } = await buildPools(useCooldown);

  // Anti-duplikasi di kedua mode
  let finalAssign;
  const { ok, result } = assignUnique(pools);
  finalAssign = ok ? result : assignUniqueGreedy(pools);

  // Kelola cooldown XRAY hanya untuk mode 20–40
  if(useCooldown){
    const cd = { ...cooldown };
    for(const k of Object.keys(cd)){ cd[k] = Math.max(0, (cd[k]|0) - 1); }
    const xrayName = finalAssign.pos1;
    if(xrayName && xrayName !== '-') cd[xrayName] = 2; // 2 siklus tidak boleh XRAY
    await Promise.all([ set(assignmentsRef, finalAssign), set(xrayCooldownRef, cd) ]);
  } else {
    await set(assignmentsRef, finalAssign);
  }

  advanceRotIdx(pools);
  remaining = 20; // reset hitung menuju perputaran berikutnya
}

// ======== Events ========
startBtn.onclick = ()=>{
  if(rotationTimer) clearInterval(rotationTimer);
  running = true;
  remaining = 20; // mulai siklus baru
  rotationTimer = setInterval(()=>{
    if(remaining > 1){
      remaining -= 1;
    } else {
      // 0 -> rotasi
      stepRotation();
      remaining = 20;
    }
    // assignments table dirender via listener; clock via setInterval terpisah
  }, 1000);
  // jalankan rotasi awal
  stepRotation();
};

stopBtn.onclick = ()=>{
  if(rotationTimer) clearInterval(rotationTimer);
  running = false;
  rotationTimer = null;
  // nextRotation jadi '-' via updateClock()
};

nextBtn.onclick = ()=>{
  stepRotation();
  remaining = 20;
};

// Tambah personil
addPersonBtn.onclick = async ()=>{
  const name = nameInput.value.trim(); if(!name) return;
  const specs = [];
  if(juniorSpec?.checked) specs.push('junior');
  if(basicSpec?.checked)  specs.push('basic');
  if(seniorSpecEl?.checked) specs.push('senior');
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

// ======== Live listeners ========
onValue(assignmentsRef, (snap)=> renderAssignments(snap.val()||{}));
onValue(peopleRef,      (snap)=> renderPeople(snap.val()||{}));

// initial clock paint
updateClock();
