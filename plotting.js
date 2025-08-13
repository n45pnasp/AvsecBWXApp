// ==== Firebase SDK v9 (modular) ====
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase, ref, onValue, set, update, remove, get,
  runTransaction
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

// ======== Konfigurasi project (punyamu) ========
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

// ======== UI refs ========
const assignRows   = document.getElementById('assignRows');
const peopleRows   = document.getElementById('peopleRows');
const startBtn     = document.getElementById('startBtn');
const stopBtn      = document.getElementById('stopBtn');
const nextBtn      = document.getElementById('nextBtn');
const mode2040     = document.getElementById('mode2040'); // default OFF
const modeBadge    = document.querySelector('.mode-option');

const nameInput    = document.getElementById('nameInput');
const juniorSpec   = document.getElementById('juniorSpec');
const basicSpec    = document.getElementById('basicSpec');
const seniorSpecEl = document.getElementById('seniorSpec');
const addPersonBtn = document.getElementById('addPersonBtn');
const clockEl      = document.getElementById('clock');
const nextEl       = document.getElementById('nextRotation');

// Bottom sheet
const sheetBackdrop = document.getElementById('sheetBackdrop');
const bottomSheet   = document.getElementById('bottomSheet');
const sheetMsg      = document.getElementById('sheetMsg');
const sheetClose    = document.getElementById('sheetClose');

// Indikator koneksi (dot di dalam card)
const connDot = document.getElementById('connDot');
const setConn = ok => { if (connDot) connDot.classList.toggle('ok', !!ok); };
onValue(ref(db, ".info/connected"), snap => setConn(!!snap.val()));

// ======== Posisi & aturan (20s) ========
const positions = [
  { id:'pos1', name:'Operator Xray',    allowed:['senior','junior'] },
  { id:'pos2', name:'Pemeriksa Barang', allowed:['senior','junior','basic'] },
  { id:'pos3', name:'Pemeriksa Orang',  allowed:['junior','basic'] },
  { id:'pos4', name:'Flow Control',     allowed:['junior','basic'] },
];

// ======== RTDB refs ========
const assignmentsRef = ref(db, 'assignments');
const peopleRef      = ref(db, 'people');
const cooldownRef    = ref(db, 'control/xrayCooldown'); // untuk mode 20–40
const stateRef       = ref(db, 'control/state');        // { running, nextAt, mode2040 }

// ======== State & timing ========
const rotIdx = { pos1:0, pos2:0, pos3:0, pos4:0 };
let running = false;
let nextAtLocal = null;         // cermin RTDB untuk UI
let mode2040State = false;      // cermin state.mode2040
const CYCLE_MS = 20_000;

// Gating mode 20–40
let allow2040 = false;
let lastJSCount = 0;

// ======== UI helpers ========
function setRunningUI(isRunning){
  running = isRunning;
  startBtn.disabled = isRunning;
  stopBtn.disabled  = !isRunning;
  if(modeBadge){ modeBadge.classList.toggle('hidden', isRunning); }
}
function setModeBadgeAvailability(allowed){
  if(!modeBadge) return;
  modeBadge.classList.toggle('disabled', !allowed);
}
function showSheet(msg){
  if(sheetMsg) sheetMsg.textContent = msg;
  sheetBackdrop?.classList.remove('hidden');
  bottomSheet?.classList.remove('hidden');
  // auto-dismiss 3s
  clearTimeout(showSheet._timer);
  showSheet._timer = setTimeout(hideSheet, 3000);
}
function hideSheet(){
  sheetBackdrop?.classList.add('hidden');
  bottomSheet?.classList.add('hidden');
}
sheetBackdrop?.addEventListener('click', hideSheet);
sheetClose?.addEventListener('click', hideSheet);

// ======== Render ========
function renderAssignments(assignments){
  assignRows.innerHTML = '';
  positions.forEach((p)=>{
    const tr = document.createElement('tr');
    // hanya tampilkan Posisi & Nama (tanpa kolom spesifikasi)
    tr.innerHTML = `<td>${p.name}</td><td>${assignments?.[p.id] ?? '-'}</td>`;
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
      <td><input type="checkbox" ${has('senior')?'checked':''} data-id="${id}" data-spec="senior" /></td>
      <td><input type="checkbox" ${has('junior')?'checked':''} data-id="${id}" data-spec="junior" /></td>
      <td><input type="checkbox" ${has('basic')?'checked':''}  data-id="${id}" data-spec="basic"  /></td>
      <td><button data-del="${id}">Hapus</button></td>`;
    peopleRows.appendChild(tr);
  });
}

// Jam selalu jalan; “perputaran selanjutnya” selalu pakai nextAtLocal (jika ada)
const pad = n => String(n).padStart(2,'0');
const fmt = d => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
function renderClock(){
  clockEl.textContent = fmt(new Date());
  nextEl.textContent  = nextAtLocal ? fmt(new Date(nextAtLocal)) : '-';
}
setInterval(renderClock, 250); // ticker UI jam

// ======== Helpers rotasi ========
const rotate = (arr, idx) => arr.length ? arr.slice(idx).concat(arr.slice(0, idx)) : [];
const isEligible = (person, allowed) =>
  Array.isArray(person.spec) && person.spec.some(s => allowed.includes(String(s).toLowerCase()));

async function buildPools(useCooldown){
  const [pSnap, cdSnap] = await Promise.all([
    get(peopleRef),
    useCooldown ? get(cooldownRef) : Promise.resolve({ val: () => ({}) })
  ]);
  const raw  = pSnap.val() || {};
  const folks = Object.values(raw).map(p => ({
    ...p,
    spec: Array.isArray(p.spec) ? p.spec.map(s=>String(s).toLowerCase()) : []
  }));
  const cooldown = useCooldown ? (cdSnap.val() || {}) : {};

  // bersihkan cooldown yatim
  if(useCooldown){
    const names = new Set(folks.map(f=>f.name));
    for(const k of Object.keys(cooldown)){ if(!names.has(k)) delete cooldown[k]; }
  }

  const pools = positions.map((pos) => {
    let candidates = folks.filter(f => isEligible(f, pos.allowed));
    if(useCooldown && pos.id === 'pos1'){ // Operator Xray cooldown (pos1)
      candidates = candidates.filter(f => (cooldown[f.name] || 0) <= 0);
    }
    const rot = rotate(candidates, rotIdx[pos.id] % Math.max(candidates.length, 1));
    return { pos, list: rot };
  });

  // posisi paling ketat dulu
  pools.sort((a,b)=> (a.list.length - b.list.length));
  return { pools, cooldown };
}

// Backtracking anti-duplikasi
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

// ======== Step rotasi + tulis ke RTDB ========
async function computeAndWriteAssignments(useCooldown){
  const { pools, cooldown } = await buildPools(useCooldown);

  let finalAssign;
  const { ok, result } = assignUnique(pools);
  finalAssign = ok ? result : assignUniqueGreedy(pools);

  if(useCooldown){
    const cd = { ...(cooldown||{}) };
    // kurangi semua cooldown 1
    for(const k of Object.keys(cd)){ cd[k] = Math.max(0, (cd[k]|0) - 1); }
    const xrayName = finalAssign.pos1;
    if(xrayName && xrayName !== '-') cd[xrayName] = 2; // 2 siklus tidak boleh pos1 (Operator Xray)
    await Promise.all([ set(assignmentsRef, finalAssign), set(cooldownRef, cd) ]);
  } else {
    await set(assignmentsRef, finalAssign);
  }

  advanceRotIdx(pools);
}

// ======== Mesin rotasi bersama (race-safe) ========
async function tryAdvanceCycle(force = false){
  // Transaction di /control/state: hanya SATU klien yang menang ketika due/force
  const res = await runTransaction(stateRef, (cur) => {
    const now = Date.now();
    if(!cur || typeof cur !== 'object') return cur;
    const running = !!cur.running;
    const nextAt  = cur.nextAt|0;
    if(!running) return cur;

    if(force || (nextAt && now >= nextAt)){
      // majukan nextAt tepat 20 detik dari sekarang
      return { ...cur, nextAt: now + CYCLE_MS };
    }
    return cur; // tidak berubah
  });

  if(res.committed){
    // Kita (atau klien lain) telah memajukan nextAt; hitung assignments dan simpan.
    const st = res.snapshot.val()||{};
    nextAtLocal   = st.nextAt || null;  // mirror ke UI
    mode2040State = !!st.mode2040;
    await computeAndWriteAssignments(!!mode2040State);
  }
}

// ======== EVENTS ========

// Pastikan default TIDAK 20–40 saat load
if (mode2040) mode2040.checked = false;

startBtn.onclick = async ()=>{
  // Validasi mode 20–40 (hanya jika dicentang)
  const want2040 = !!(mode2040 && mode2040.checked);
  if(want2040 && !allow2040){
    mode2040.checked = false;
    showSheet(`Metode 20–40 hanya untuk komposisi junior/senior berjumlah tepat 3 orang (contoh: 1 senior + 2 junior, atau 3 junior). Saat ini: ${lastJSCount}.`);
    return;
  }

  // Set running & nextAt di RTDB + set lokal nextAtLocal segera supaya tampil
  const next = Date.now() + CYCLE_MS;
  await set(stateRef, { running:true, nextAt: next, mode2040: want2040 });
  mode2040State = want2040;
  nextAtLocal   = next;   // tampil langsung tanpa nunggu listener
  renderClock();

  // Tulis assignments awal
  await computeAndWriteAssignments(mode2040State);

  // UI lokal
  setRunningUI(true);
};

stopBtn.onclick = async ()=>{
  // Reset total: berhenti + nextAt ke 0 + matikan 20–40 + kosongkan cooldown XRAY
  await Promise.all([
    update(stateRef, { running:false, nextAt: 0, mode2040: false }),
    set(cooldownRef, {})
  ]);
  setRunningUI(false);
  nextAtLocal = null;              // tampil "-" di semua klien
  if (mode2040) mode2040.checked = false; // UI checkbox balik OFF
  renderClock();
};

nextBtn.onclick = async ()=>{
  // Majukan paksa 1x dari sekarang (jika sedang running)
  const snap = await get(stateRef);
  const cur  = snap.val()||{};
  if(cur.running){
    mode2040State = !!cur.mode2040;
    await tryAdvanceCycle(true);
  }
};

// Toggle checkbox 20–40 saat idle
mode2040?.addEventListener('change', ()=>{
  if(mode2040.checked && !allow2040){
    mode2040.checked = false;
    showSheet(`Metode 20–40 Menit hanya untuk komposisi jumlah junior dan senior minimal 3 orang. Saat ini: ${lastJSCount}.`);
  }
});

// Tambah/hapus/ubah personil
addPersonBtn.onclick = async ()=>{
  const name = nameInput.value.trim(); if(!name) return;
  const specs = [];
  if(seniorSpecEl?.checked) specs.push('senior');
  if(juniorSpec?.checked) specs.push('junior');
  if(basicSpec?.checked)  specs.push('basic');
  await update(ref(db, 'people/'+name.toLowerCase()), { name, spec: specs });
  nameInput.value='';
  if(seniorSpecEl) seniorSpecEl.checked=false;
  if(juniorSpec)   juniorSpec.checked=false;
  if(basicSpec)    basicSpec.checked=false;
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

// ======== Live listeners ========
// Assignments display
onValue(assignmentsRef, (snap)=> renderAssignments(snap.val()||{}));

// People + validasi komposisi 20–40
onValue(peopleRef, (snap)=>{
  const people = snap.val()||{};
  renderPeople(people);
  const countJS = Object.values(people).filter(p =>
    Array.isArray(p?.spec) && p.spec.some(s => ['junior','senior'].includes(String(s).toLowerCase()))
  ).length;
  lastJSCount = countJS;
  allow2040 = (countJS === 3);
  setModeBadgeAvailability(allow2040);
});

// State global (semua klien sinkron)
onValue(stateRef, async (snap)=>{
  const st  = snap.val() || {};
  const run = !!st.running;
  const na  = Number(st.nextAt) || 0;
  mode2040State = !!st.mode2040;

  nextAtLocal = (na > 0) ? na : null;  // 0 → tampil "-"
  setRunningUI(run);

  // Jika klien lain menekan Hentikan, pastikan checkbox lokal ikut OFF
  if (!run && mode2040 && mode2040.checked !== false) {
    mode2040.checked = false;
  }
});

// ======== Heartbeat shared-control: cek due setiap 500ms ========
setInterval(()=>{
  if (running && nextAtLocal && Date.now() >= nextAtLocal) {
    // Aman dari race-condition karena tryAdvanceCycle pakai runTransaction
    tryAdvanceCycle(false);
  }
}, 500);

// Paint awal
renderClock();
