// ==== Firebase SDK v9 (modular) ====
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase, ref, child, onValue, set, update, remove, get, runTransaction
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// ======== Konfigurasi project (RTDB baru) ========
const firebaseConfig = {
  apiKey: "AIzaSyBc-kE-_q1yoENYECPTLC3EZf_GxBEwrWY",
  authDomain: "avsecbwx-4229c.firebaseapp.com",
  databaseURL: "https://avsecbwx-4229c-default-rtdb.firebaseio.com",
  projectId: "avsecbwx-4229c",
  storageBucket: "avsecbwx-4229c.firebasestorage.app",
  messagingSenderId: "1029406629258",
  appId: "1:1029406629258:web:53e8f09585cd77823efc73",
  measurementId: "G-P37F88HGFE"
};

const app  = initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

/* ========= Link PDF per site ========= */
const SHEETS = {
  PSCP: { id: "1qOd-uWNGIguR4wTj85R5lQQF3GhTFnHru78scoTkux8", gid: "" },
  HBSCP:{ id: "1NwPi_H6W7SrCiXevy8y3uxovO2xKwlQKUryXM3q4iiU", gid: "" },
};

/* ====== Export PDF tanpa login Google ======
   - Jika Sheet di "Publish to the web" → set USE_PUB = true (pakai /pub?output=pdf)
   - Jika hanya "Anyone with the link – Viewer" → biarkan false (pakai /export?format=pdf)
*/
const USE_PUB = false;

const PDF_DEFAULT_OPTS = {
  format: "pdf",
  size: "A4",
  portrait: "true",
  scale: "2",
  top_margin: "0.50",
  bottom_margin: "0.50",
  left_margin: "0.50",
  right_margin: "0.50",
  sheetnames: "false",
  printtitle: "false",
  pagenumbers: "true",
  gridlines: "false",
  fzr: "true",
};

function buildSheetPdfUrl(sheetId, gid, opts = {}) {
  const cacheBuster = { t: Date.now() };
  if (USE_PUB) {
    const params = new URLSearchParams({ gid, single: "true", output: "pdf", ...cacheBuster });
    return `https://docs.google.com/spreadsheets/d/${sheetId}/pub?${params}`;
  } else {
    const params = new URLSearchParams({ ...PDF_DEFAULT_OPTS, ...opts, gid, ...cacheBuster });
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?${params}`;
  }
}

// ========= Konfigurasi per site =========
const SITE_CONFIG = {
  PSCP: {
    enable2040: true,
    cycleMs: 20_000,
    positions: [
      { id:"pos1", name:"Operator Xray",    allowed:["senior","junior"] },
      { id:"pos2", name:"Pemeriksa Barang", allowed:["senior","junior","basic"] },
      { id:"pos3", name:"Pemeriksa Orang",  allowed:["junior","basic"] },
      { id:"pos4", name:"Flow Control",     allowed:["junior","basic"] },
    ],
  },
  HBSCP: {
    enable2040: true, // ON bila jr/sr >= 3
    cycleMs: 20_000,
    positions: [
      { id:"pos1",  name:"Operator Xray",       allowed:["senior","junior"] },
      { id:"pos2a", name:"Pemeriksa Barang 1",  allowed:["senior","junior","basic"] },
      { id:"pos2b", name:"Pemeriksa Barang 2",  allowed:["senior","junior","basic"] },
    ],
  },
};

// ========= DOM refs =========
const $ = (id)=>document.getElementById(id);
const connDot      = $("connDot");
const clockEl      = $("clock");
const nextEl       = $("nextRotation");
const startBtn     = $("startBtn");
const stopBtn      = $("stopBtn");
const nextBtn      = $("nextBtn");
const downloadBtn  = $("downloadPdfBtn");
const assignTable  = document.querySelector("table.assign");
const assignRows   = $("assignRows");
const manageBox    = document.querySelector(".manage");
const nameInput    = $("nameInput");
const seniorSpecEl = $("seniorSpec");
const juniorSpec   = $("juniorSpec");
const basicSpec    = $("basicSpec");
const addPersonBtn = $("addPersonBtn");
const peopleRows   = $("peopleRows");
const btnPSCP      = $("pscpBtn");
const btnHBSCP     = $("hbscpBtn");

// ========= Indikator koneksi =========
onValue(ref(db, ".info/connected"), (snap) => {
  connDot?.classList.toggle("ok", !!snap.val());
});

// ========= Util =========
const pad = (n) => String(n).padStart(2,"0");
const fmt = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// ========= Pewarnaan tombol berdasar status RTDB =========
function paintSiteButton(btn, isRunning){
  if(!btn) return;
  btn.classList.toggle("start", !!isRunning); // hijau
  btn.classList.toggle("stop",  !isRunning);  // merah
}
onValue(ref(db, "sites/PSCP/control/state"), (snap)=>{
  paintSiteButton(btnPSCP, !!(snap.val()?.running));
});
onValue(ref(db, "sites/HBSCP/control/state"), (snap)=>{
  paintSiteButton(btnHBSCP, !!(snap.val()?.running));
});

// ========= Mesin per-site =========
class SiteMachine {
  constructor(siteKey){
    this.siteKey = siteKey;
    this.cfg = SITE_CONFIG[siteKey];
    this.CYCLE_MS = this.cfg.cycleMs;

    this.baseRef        = ref(db, `sites/${siteKey}`);
    this.peopleRef      = child(this.baseRef, "people");
    this.assignmentsRef = child(this.baseRef, "assignments");
    this.cooldownRef    = child(this.baseRef, "control/xrayCooldown");
    this.stateRef       = child(this.baseRef, "control/state"); // {running,nextAt,mode2040,lastCycleAt}

    this.rotIdx = {}; this.cfg.positions.forEach(p => this.rotIdx[p.id] = 0);
    this.running = false;
    this.nextAtLocal = null;
    this.lastCycleAtLocal = null;
    this.mode2040State = false;

    this.clockTimer = null;
    this.dueTimer   = null;
    this._unsubs    = [];
  }

  mount(){
    this.clockTimer = setInterval(()=>{
      clockEl && (clockEl.textContent = fmt(new Date()));
      nextEl  && (nextEl.textContent  = this.nextAtLocal ? fmt(new Date(this.nextAtLocal)) : "-");
    }, 250);

    this._listen(this.assignmentsRef, s => this.renderAssignments(s.val()||{}));
    this._listen(this.peopleRef,      s => this.renderPeople(s.val()||{}));
    this._listen(this.stateRef, s=>{
      const st = s.val() || {};
      this.running         = !!st.running;
      this.nextAtLocal     = (Number(st.nextAt)||0) > 0 ? Number(st.nextAt) : null;
      this.mode2040State   = !!st.mode2040;
      this.lastCycleAtLocal= (Number(st.lastCycleAt)||0) > 0 ? Number(st.lastCycleAt) : null;
      this.setRunningUI(this.running);
    });

    this.dueTimer = setInterval(()=>{
      if (this.running && this.nextAtLocal && Date.now() >= this.nextAtLocal) {
        this.tryAdvanceCycle(false);
      }
    }, 500);

    startBtn.onclick = ()=> this.onStart();
    stopBtn.onclick  = ()=> this.onStop();
    nextBtn.onclick  = ()=> this.onNext();
    addPersonBtn.onclick = ()=> this.onAddPerson();

    this.setRunningUI(false);
    clockEl && (clockEl.textContent = fmt(new Date()));
    nextEl  && (nextEl.textContent  = "-");
  }

  unmount(){
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.dueTimer)   clearInterval(this.dueTimer);
    startBtn.onclick = stopBtn.onclick = nextBtn.onclick = addPersonBtn.onclick = null;
    this._unsubs.forEach(u=>{ try{u&&u();}catch(e){} });
    this._unsubs = [];
  }

  _listen(r, cb){
    const unsubscribe = onValue(r, cb);
    this._unsubs.push(unsubscribe);
  }

  setRunningUI(isRunning){
    startBtn.disabled = isRunning;
    stopBtn.disabled  = !isRunning;
    nextBtn.disabled  = !isRunning;
    assignTable.classList.toggle("hidden", !isRunning);
    manageBox.classList.toggle("hidden",  isRunning);
    document.body.classList.toggle("running", isRunning);
  }

  renderAssignments(assignments){
    assignRows.innerHTML = "";
    this.cfg.positions.forEach(p=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${p.name}</td><td>${assignments?.[p.id] ?? "-"}</td>`;
      assignRows.appendChild(tr);
    });
  }

  renderPeople(people){
    peopleRows.innerHTML = "";
    Object.entries(people||{}).forEach(([id,p])=>{
      const has = (s) => Array.isArray(p.spec) && p.spec.includes(s);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.name}</td>
        <td><input type="checkbox" ${has("senior")?'checked':''} data-id="${id}" data-spec="senior"/></td>
        <td><input type="checkbox" ${has("junior")?'checked':''} data-id="${id}" data-spec="junior"/></td>
        <td><input type="checkbox" ${has("basic")?'checked':''}  data-id="${id}" data-spec="basic"/></td>
        <td><button data-del="${id}">Hapus</button></td>`;
      peopleRows.appendChild(tr);
    });

    peopleRows.onchange = async (e)=>{
      if(e.target.type!=="checkbox") return;
      const id=e.target.dataset.id, spec=e.target.dataset.spec;
      try{
        const snap = await get(child(this.peopleRef,id));
        let person=snap.val(); if(!person) return;
        if(!Array.isArray(person.spec)) person.spec=[];
        if(e.target.checked){ if(!person.spec.includes(spec)) person.spec.push(spec); }
        else { person.spec = person.spec.filter(s=>s!==spec); }
        await update(child(this.peopleRef,id), person);
      }catch(err){
        console.error("Update spec gagal:", err);
        alert("Update spesifikasi gagal: " + (err?.message || err));
        e.target.checked = !e.target.checked; // revert UI
      }
    };

    peopleRows.onclick = async (e)=>{
      if(!e.target.dataset.del) return;
      const id = e.target.dataset.del;
      if(!confirm("Hapus personil ini?")) return;
      try{
        await remove(child(this.peopleRef, id));
      }catch(err){
        console.error("Hapus gagal:", err);
        alert("Hapus gagal: " + (err?.message || err));
      }
    };
  }

  rotate(arr, idx){ return arr.length ? arr.slice(idx).concat(arr.slice(0,idx)) : []; }
  isEligible(person, allowed){
    return Array.isArray(person.spec) && person.spec.some(s=>allowed.includes(String(s).toLowerCase()));
  }

  async buildPools(useCooldown){
    const [pSnap, cdSnap] = await Promise.all([
      get(this.peopleRef),
      useCooldown ? get(this.cooldownRef) : Promise.resolve({ val:()=>({}) })
    ]);
    const folks = Object.values(pSnap.val()||{}).map(p=>({
      ...p, spec: Array.isArray(p.spec) ? p.spec.map(s=>String(s).toLowerCase()) : []
    }));
    const cooldown = useCooldown ? (cdSnap.val()||{}) : {};

    if(useCooldown){
      const names = new Set(folks.map(f=>f.name));
      for(const k of Object.keys(cooldown)){ if(!names.has(k)) delete cooldown[k]; }
    }

    const pools = this.cfg.positions.map(pos=>{
      let candidates = folks.filter(f=>this.isEligible(f,pos.allowed));
      if(useCooldown && pos.id==="pos1"){ // cooldown khusus Operator Xray
        candidates = candidates.filter(f=>(cooldown[f.name]||0)<=0);
      }
      const rot = this.rotate(candidates, this.rotIdx[pos.id] % Math.max(candidates.length,1));
      return { pos, list: rot };
    });

    pools.sort((a,b)=> (a.list.length - b.list.length));
    return { pools, cooldown };
  }

  assignUnique(pools){
    const used=new Set(); const result={};
    function bt(i){
      if(i===pools.length) return true;
      const {pos,list}=pools[i];
      if(list.length===0){ result[pos.id]="-"; return bt(i+1); }
      for(const cand of list){
        const name=cand?.name; if(!name||used.has(name)) continue;
        used.add(name); result[pos.id]=name;
        if(bt(i+1)) return true;
        used.delete(name);
      }
      return false;
    }
    const ok=bt(0);
    return { ok, result };
  }
  assignUniqueGreedy(pools){
    const used=new Set(); const result={};
    for(const {pos,list} of pools){
      const pick=list.find(p=>p?.name && !used.has(p.name));
      result[pos.id]=pick ? (used.add(pick.name), pick.name) : "-";
    }
    return result;
  }
  advanceRotIdx(pools){
    for(const {pos,list} of pools){
      const len=list.length;
      if(len>0) this.rotIdx[pos.id]=(this.rotIdx[pos.id]+1)%len;
    }
  }

  async computeAndWriteAssignments(useCooldown){
    const { pools, cooldown } = await this.buildPools(useCooldown);
    const { ok, result } = this.assignUnique(pools);
    const finalAssign = ok ? result : this.assignUniqueGreedy(pools);

    try{
      if(useCooldown){
        const cd = { ...(cooldown||{}) };
        for(const k of Object.keys(cd)){ cd[k]=Math.max(0,(cd[k]|0)-1); }
        const xrayName = finalAssign.pos1;
        if(xrayName && xrayName!=="-") cd[xrayName]=2;
        await Promise.all([
          set(this.assignmentsRef, finalAssign),
          set(this.cooldownRef, cd),
        ]);
      } else {
        await set(this.assignmentsRef, finalAssign);
      }
    }catch(err){
      console.error("Tulis assignments gagal:", err);
      alert("Tulis assignments gagal: " + (err?.message || err));
    }

    this.advanceRotIdx(pools);
  }

  async tryAdvanceCycle(force=false){
    const res = await runTransaction(this.stateRef, (cur)=>{
      const now=Date.now();
      if(!cur||typeof cur!=="object") return cur;
      if(!cur.running) return cur;
      const nextAt=cur.nextAt|0;
      if(force || (nextAt && now>=nextAt)){
        return { ...cur, nextAt: now + this.CYCLE_MS, lastCycleAt: now };
      }
      return cur;
    });
    if(res.committed){
      const st=res.snapshot.val()||{};
      this.nextAtLocal      = st.nextAt||null;
      this.mode2040State    = !!st.mode2040;
      this.lastCycleAtLocal = st.lastCycleAt||null;
      await this.computeAndWriteAssignments(this.cfg.enable2040 && this.mode2040State);
    }
  }

  async onStart(){
    let enable2040Now=false;
    if(this.cfg.enable2040){
      const pSnap=await get(this.peopleRef);
      const people=pSnap.val()||{};
      const jsCount=Object.values(people).filter(p =>
        Array.isArray(p?.spec) && p.spec.some(s=>["junior","senior"].includes(String(s).toLowerCase()))
      ).length;
      enable2040Now = (jsCount>=3);
    }
    this.mode2040State = this.cfg.enable2040 && enable2040Now;

    const now  = Date.now();
    const next = now + this.CYCLE_MS;
    try{
      await set(this.stateRef, { running:true, nextAt: next, mode2040: this.mode2040State, lastCycleAt: now });
      this.nextAtLocal      = next;
      this.lastCycleAtLocal = now;
      await this.computeAndWriteAssignments(this.cfg.enable2040 && this.mode2040State);
      this.setRunningUI(true);
    }catch(err){
      console.error("Start gagal:", err);
      alert("Memulai rotasi gagal: " + (err?.message || err));
    }
  }

  async onStop(){
    const tasks=[ update(this.stateRef,{ running:false, nextAt:0, mode2040:false, lastCycleAt:0 }) ];
    if(this.cfg.enable2040) tasks.push(set(this.cooldownRef, {}));
    try{
      await Promise.all(tasks);
      this.setRunningUI(false);
      this.nextAtLocal=null;
      this.lastCycleAtLocal=null;
      nextEl && (nextEl.textContent="-");
    }catch(err){
      console.error("Stop gagal:", err);
      alert("Menghentikan rotasi gagal: " + (err?.message || err));
    }
  }

  async onNext(){
    const snap=await get(this.stateRef);
    const cur=snap.val()||{};
    if(cur.running){
      this.mode2040State=!!cur.mode2040;
      await this.tryAdvanceCycle(true);
    }
  }

  async onAddPerson(){
    const name=nameInput?.value?.trim(); if(!name) return;
    const specs=[];
    if(seniorSpecEl?.checked) specs.push("senior");
    if(juniorSpec?.checked)   specs.push("junior");
    if(basicSpec?.checked)    specs.push("basic");

    const key = name.toLowerCase();
    try{
      await update(child(this.peopleRef, key), { name, spec: specs });
      nameInput.value=""; seniorSpecEl.checked=false; juniorSpec.checked=false; basicSpec.checked=false;
    }catch(err){
      console.error("Tambah personil gagal:", err);
      alert("Tambah personil gagal: " + (err?.message || err));
    }
  }
}

// ====== Boot & switch viewer site ======
let machine=null;
let currentSite = null; // untuk download PDF

function resetSurface(){
  assignRows.innerHTML=""; peopleRows.innerHTML="";
  nextEl && (nextEl.textContent="-");
  clockEl && (clockEl.textContent=fmt(new Date()));
  assignTable.classList.add("hidden");
  manageBox.classList.remove("hidden");
}
function selectSiteButtonUI(site){
  btnPSCP?.classList.toggle("selected", site==="PSCP");
  btnHBSCP?.classList.toggle("selected", site==="HBSCP");
}
function bootSite(siteKey){
  try{ localStorage.setItem("siteSelected", siteKey); }catch(_){}
  if(machine) machine.unmount();
  resetSurface();
  machine = new SiteMachine(siteKey);
  machine.mount();
  selectSiteButtonUI(siteKey);
  currentSite = siteKey;
  if (downloadBtn) downloadBtn.disabled = false;
}

// ====== Download PDF (tanpa login Google) ======
function openActiveSitePdf(){
  if(!currentSite || !SHEETS[currentSite]){
    alert("Pilih lokasi dulu (PSCP / HBSCP).");
    return;
  }
  const { id, gid } = SHEETS[currentSite];
  window.open(buildSheetPdfUrl(id, gid), "_blank");
}

// ====== Init + Lock UI sampai login terdeteksi ======
(function init(){
  if (downloadBtn) downloadBtn.disabled = true;

  // Kunci semua aksi write sampai user ter-auth
  const lockUI = (locked) => {
    startBtn.disabled = locked;
    stopBtn.disabled  = true;
    nextBtn.disabled  = true;
    addPersonBtn.disabled = locked;
  };
  lockUI(true);

  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("✅ Login Firebase sebagai:", user.uid);
      lockUI(false);
    } else {
      console.warn("❌ Belum login Firebase. Pastikan auth-guard.js mengarahkan ke login.");
      lockUI(true);
    }
  });

  const url = new URL(location.href);
  const qsSite = url.searchParams.get("site");
  let initial="PSCP";
  try{ initial = qsSite || localStorage.getItem("siteSelected") || "PSCP"; }catch(_){}
  bootSite(initial);

  btnPSCP?.addEventListener("click", ()=> bootSite("PSCP"));
  btnHBSCP?.addEventListener("click", ()=> bootSite("HBSCP"));
  downloadBtn?.addEventListener("click", openActiveSitePdf);

  document.documentElement.style.visibility="visible";
})();
