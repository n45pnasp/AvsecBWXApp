// ==== Firebase SDK v9 (modular) ====
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase, ref, child, onValue, set, update, remove, get, runTransaction
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

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ========= Konfigurasi per site =========
const SITE_CONFIG = {
  PSCP: {
    enable2040: true,
    cycleMs: 20_000,
    positions: [
      { id:'pos1', name:'Operator Xray',    allowed:['senior','junior'] },
      { id:'pos2', name:'Pemeriksa Barang', allowed:['senior','junior','basic'] },
      { id:'pos3', name:'Pemeriksa Orang',  allowed:['junior','basic'] },
      { id:'pos4', name:'Flow Control',     allowed:['junior','basic'] },
    ],
  },
  HBSCP: {
    enable2040: false,
    cycleMs: 20_000,
    positions: [
      { id:'pos1',  name:'Operator Xray',       allowed:['senior','junior'] },
      { id:'pos2a', name:'Pemeriksa Barang 1',  allowed:['junior','basic'] },
      { id:'pos2b', name:'Pemeriksa Barang 2',  allowed:['junior','basic'] },
    ],
  }
};

// ========= DOM refs =========
const $id = (id)=>document.getElementById(id);
const connDot      = $id('connDot');
const clockEl      = $id('clock');
const nextEl       = $id('nextRotation');
const startBtn     = $id('startBtn');
const stopBtn      = $id('stopBtn');
const nextBtn      = $id('nextBtn');
const assignTable  = document.querySelector('table.assign');
const assignRows   = $id('assignRows');
const manageBox    = document.querySelector('.manage');
const nameInput    = $id('nameInput');
const seniorSpecEl = $id('seniorSpec');
const juniorSpec   = $id('juniorSpec');
const basicSpec    = $id('basicSpec');
const addPersonBtn = $id('addPersonBtn');
const peopleRows   = $id('peopleRows');

// ========= Sisipkan 2 tombol lokasi (PSCP/HBSCP) =========
let btnPSCP = null, btnHBSCP = null;
(function injectSiteButtons(){
  const controls = document.querySelector('.controls');
  if(!controls) return;
  const bar = document.createElement('div');
  bar.className = 'site-bar';           // CSS kecil ada di bawah (tambahkan ke plotting.css)
  bar.setAttribute('aria-label','Lokasi');

  btnPSCP = document.createElement('button');
  btnHBSCP = document.createElement('button');
  btnPSCP.className = 'site-btn stop';  // default merah (non-aktif)
  btnHBSCP.className = 'site-btn stop';
  btnPSCP.textContent = 'PSCP';
  btnHBSCP.textContent = 'HBSCP';

  bar.appendChild(btnPSCP);
  bar.appendChild(btnHBSCP);
  controls.prepend(bar);
})();

// ========= Koneksi indikator =========
onValue(ref(db, ".info/connected"), snap => {
  const ok = !!snap.val();
  if (connDot) connDot.classList.toggle('ok', ok);
});

// ========= Util =========
const pad = n => String(n).padStart(2,'0');
const fmt = d => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// ========= Mesin per-site =========
class SiteMachine {
  constructor(siteKey){
    this.siteKey = siteKey;
    this.cfg = SITE_CONFIG[siteKey];
    this.CYCLE_MS = this.cfg.cycleMs;

    // RTDB paths
    this.baseRef        = ref(db, `sites/${siteKey}`);
    this.peopleRef      = child(this.baseRef, 'people');
    this.assignmentsRef = child(this.baseRef, 'assignments');
    this.cooldownRef    = child(this.baseRef, 'control/xrayCooldown');
    this.stateRef       = child(this.baseRef, 'control/state'); // {running,nextAt,mode2040}

    // state lokal
    this.rotIdx = {};
    this.cfg.positions.forEach(p => this.rotIdx[p.id] = 0);
    this.running = false;
    this.nextAtLocal = null;
    this.mode2040State = false;

    // timers & unsub
    this.clockTimer = null;
    this.dueTimer   = null;
    this._unsubFns  = [];
  }

  mount(){
    this.clockTimer = setInterval(()=> {
      if (clockEl) clockEl.textContent = fmt(new Date());
      if (nextEl)  nextEl.textContent  = this.nextAtLocal ? fmt(new Date(this.nextAtLocal)) : '-';
    }, 250);

    this._listen(this.assignmentsRef, (snap)=> this.renderAssignments(snap.val()||{}));
    this._listen(this.peopleRef, (snap)=> this.renderPeople(snap.val()||{}));
    this._listen(this.stateRef, async (snap)=>{
      const st  = snap.val() || {};
      this.running = !!st.running;
      const na  = Number(st.nextAt) || 0;
      this.mode2040State = !!st.mode2040;
      this.nextAtLocal = (na > 0) ? na : null;
      this.setRunningUI(this.running);
    });

    this.dueTimer = setInterval(()=>{
      if (this.running && this.nextAtLocal && Date.now() >= this.nextAtLocal) {
        this.tryAdvanceCycle(false);
      }
    }, 500);

    if (startBtn) startBtn.onclick = ()=> this.onStart();
    if (stopBtn)  stopBtn.onclick  = ()=> this.onStop();
    if (nextBtn)  nextBtn.onclick  = ()=> this.onNext();
    if (addPersonBtn) addPersonBtn.onclick = ()=> this.onAddPerson();

    this.setRunningUI(false);
    if (clockEl) clockEl.textContent = fmt(new Date());
    if (nextEl)  nextEl.textContent  = '-';
  }

  unmount(){
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.dueTimer)   clearInterval(this.dueTimer);
    this.clockTimer = this.dueTimer = null;

    if (startBtn) startBtn.onclick = null;
    if (stopBtn)  stopBtn.onclick  = null;
    if (nextBtn)  nextBtn.onclick  = null;
    if (addPersonBtn) addPersonBtn.onclick = null;

    this._unsubFns.forEach(fn => { try{ fn && fn(); }catch(_){} });
    this._unsubFns = [];
  }

  _listen(r, cb){
    const unsub = onValue(r, cb); // v9 returns unsubscribe
    this._unsubFns.push(unsub);
  }

  setRunningUI(isRunning){
    if (startBtn) startBtn.disabled = isRunning;
    if (stopBtn)  stopBtn.disabled  = !isRunning;
    if (nextBtn)  nextBtn.disabled  = !isRunning;
    if (assignTable) assignTable.classList.toggle('hidden', !isRunning);
    if (manageBox)   manageBox.classList.toggle('hidden',  isRunning);
  }

  renderAssignments(assignments){
    if (!assignRows) return;
    assignRows.innerHTML = '';
    this.cfg.positions.forEach((p)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${p.name}</td><td>${assignments?.[p.id] ?? '-'}</td>`;
      assignRows.appendChild(tr);
    });
  }

  renderPeople(people){
    if (!peopleRows) return;
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

    peopleRows.onchange = async (e)=>{
      if(e.target.type !== 'checkbox') return;
      const id = e.target.dataset.id, spec = e.target.dataset.spec;
      const snap = await get(child(this.peopleRef, id)); let person = snap.val(); if(!person) return;
      if(!Array.isArray(person.spec)) person.spec = [];
      if(e.target.checked){
        if(!person.spec.includes(spec)) person.spec.push(spec);
      } else {
        person.spec = person.spec.filter(s=>s!==spec);
      }
      await update(child(this.peopleRef, id), person);
    };
    peopleRows.onclick = async (e)=>{
      if(!e.target.dataset.del) return;
      await remove(child(this.peopleRef, e.target.dataset.del));
    };
  }

  rotate(arr, idx){ return arr.length ? arr.slice(idx).concat(arr.slice(0, idx)) : []; }
  isEligible(person, allowed){
    return Array.isArray(person.spec) && person.spec.some(s => allowed.includes(String(s).toLowerCase()));
  }

  async buildPools(useCooldown){
    const [pSnap, cdSnap] = await Promise.all([
      get(this.peopleRef),
      useCooldown ? get(this.cooldownRef) : Promise.resolve({ val: () => ({}) })
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

    const pools = this.cfg.positions.map((pos) => {
      let candidates = folks.filter(f => this.isEligible(f, pos.allowed));
      if(useCooldown && pos.id === 'pos1'){ // cooldown khusus Operator Xray
        candidates = candidates.filter(f => (cooldown[f.name] || 0) <= 0);
      }
      const rot = this.rotate(candidates, this.rotIdx[pos.id] % Math.max(candidates.length, 1));
      return { pos, list: rot };
    });

    pools.sort((a,b)=> (a.list.length - b.list.length));
    return { pools, cooldown };
  }

  assignUnique(pools){
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

  assignUniqueGreedy(pools){
    const used = new Set(); const result = {};
    for(const { pos, list } of pools){
      const pick = list.find(p => p?.name && !used.has(p.name));
      result[pos.id] = pick ? (used.add(pick.name), pick.name) : '-';
    }
    return result;
  }

  advanceRotIdx(pools){
    for(const { pos, list } of pools){
      const len = list.length;
      if(len > 0) this.rotIdx[pos.id] = (this.rotIdx[pos.id] + 1) % len;
    }
  }

  async computeAndWriteAssignments(useCooldown){
    const { pools, cooldown } = await this.buildPools(useCooldown);

    let finalAssign;
    const { ok, result } = this.assignUnique(pools);
    finalAssign = ok ? result : this.assignUniqueGreedy(pools);

    if(useCooldown){
      const cd = { ...(cooldown||{}) };
      for(const k of Object.keys(cd)){ cd[k] = Math.max(0, (cd[k]|0) - 1); }
      const xrayName = finalAssign.pos1;
      if(xrayName && xrayName !== '-') cd[xrayName] = 2;
      await Promise.all([ set(this.assignmentsRef, finalAssign), set(this.cooldownRef, cd) ]);
    } else {
      await set(this.assignmentsRef, finalAssign);
    }

    this.advanceRotIdx(pools);
  }

  async tryAdvanceCycle(force = false){
    const res = await runTransaction(this.stateRef, (cur) => {
      const now = Date.now();
      if(!cur || typeof cur !== 'object') return cur;
      const isRun = !!cur.running;
      const nextAt  = cur.nextAt|0;
      if(!isRun) return cur;

      if(force || (nextAt && now >= nextAt)){
        return { ...cur, nextAt: now + this.CYCLE_MS };
      }
      return cur;
    });

    if(res.committed){
      const st = res.snapshot.val()||{};
      this.nextAtLocal   = st.nextAt || null;
      this.mode2040State = !!st.mode2040;
      await this.computeAndWriteAssignments(this.cfg.enable2040 && this.mode2040State);
    }
  }

  async onStart(){
    let enable2040Now = false;
    if (this.cfg.enable2040){
      const pSnap = await get(this.peopleRef);
      const people = pSnap.val() || {};
      const jsCount = Object.values(people).filter(p =>
        Array.isArray(p?.spec) && p.spec.some(s => ['junior','senior'].includes(String(s).toLowerCase()))
      ).length;
      enable2040Now = (jsCount >= 3);
    }
    this.mode2040State = this.cfg.enable2040 && enable2040Now;

    const next = Date.now() + this.CYCLE_MS;
    await set(this.stateRef, { running:true, nextAt: next, mode2040: this.mode2040State });
    this.nextAtLocal = next;

    await this.computeAndWriteAssignments(this.cfg.enable2040 && this.mode2040State);
    this.setRunningUI(true);
  }

  async onStop(){
    const tasks = [ update(this.stateRef, { running:false, nextAt: 0, mode2040: false }) ];
    if (this.cfg.enable2040) tasks.push(set(this.cooldownRef, {}));
    await Promise.all(tasks);
    this.setRunningUI(false);
    this.nextAtLocal = null;
    if (nextEl) nextEl.textContent = '-';
  }

  async onNext(){
    const snap = await get(this.stateRef);
    const cur  = snap.val()||{};
    if(cur.running){
      this.mode2040State = !!cur.mode2040;
      await this.tryAdvanceCycle(true);
    }
  }

  async onAddPerson(){
    const name = nameInput?.value?.trim(); if(!name) return;
    const specs = [];
    if(seniorSpecEl?.checked) specs.push('senior');
    if(juniorSpec?.checked)   specs.push('junior');
    if(basicSpec?.checked)    specs.push('basic');
    await update(child(this.peopleRef, name.toLowerCase()), { name, spec: specs });
    if (nameInput) nameInput.value='';
    if(seniorSpecEl) seniorSpecEl.checked=false;
    if(juniorSpec)   juniorSpec.checked=false;
    if(basicSpec)    basicSpec.checked=false;
  }
}

// ====== Boot & switch site dengan tombol ======
let machine = null;

function resetSurface(){
  if (assignRows) assignRows.innerHTML = '';
  if (peopleRows) peopleRows.innerHTML = '';
  if (nextEl) nextEl.textContent = '-';
  if (clockEl) clockEl.textContent = fmt(new Date());
  if (assignTable) assignTable.classList.add('hidden');
  if (manageBox)   manageBox.classList.remove('hidden');
}

// update UI tombol (aktif = hijau/start; non-aktif = merah/stop)
function updateSiteButtonsUI(selected){
  const setState = (btn, active)=>{
    btn.classList.toggle('start', active);
    btn.classList.toggle('stop', !active);
  };
  if (btnPSCP && btnHBSCP){
    setState(btnPSCP, selected === 'PSCP');
    setState(btnHBSCP, selected === 'HBSCP');
  }
}

function bootSite(siteKey){
  try{ localStorage.setItem('siteSelected', siteKey); }catch(_){}
  if (machine){ machine.unmount(); }
  resetSurface();
  machine = new SiteMachine(siteKey);
  machine.mount();
  updateSiteButtonsUI(siteKey);
}

// default site dari ?site= atau localStorage
(function initSite(){
  const url = new URL(location.href);
  const qsSite = url.searchParams.get('site');
  let initial = 'PSCP';
  try{
    initial = qsSite || localStorage.getItem('siteSelected') || 'PSCP';
  }catch(_){}
  bootSite(initial);
  // bind click tombol
  if (btnPSCP) btnPSCP.onclick = ()=> bootSite('PSCP');
  if (btnHBSCP) btnHBSCP.onclick = ()=> bootSite('HBSCP');
})();

// tampilkan halaman setelah siap
document.documentElement.style.visibility = 'visible';
