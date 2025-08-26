// ==== Firebase SDK v9 (modular) ====
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getDatabase, ref, child, onValue, set, update, get, runTransaction,
  query, orderByChild, equalTo
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// ======== Konfigurasi (samakan dgn auth-guard.js) ========
const firebaseConfig = {
  apiKey: "AIzaSyBc-kE-_q1yoENYECPTLC3EZf_GxBEwrWY",
  authDomain: "avsecbwx-4229c.firebaseapp.com",
  databaseURL: "https://avsecbwx-4229c-default-rtdb.firebaseio.com",
  projectId: "avsecbwx-4229c",
  storageBucket: "avsecbwx-4229c.appspot.com",
  messagingSenderId: "1029406629258",
  appId: "1:1029406629258:web:53e8f09585cd77823efc73",
  measurementId: "G-P37F88HGFE"
};

// Singleton
const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db   = getDatabase(app);
const auth = getAuth(app);

// Log data auth (name dan spec) jika user login
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const snap = await get(child(ref(db, "users"), user.uid));
      const data = snap.val() || {};
      console.log("[auth] name:", data.name, "spec:", data.spec);
    } catch (err) {
      console.error("Gagal ambil data auth user:", err);
    }
  } else {
    console.log("[auth] belum login");
  }
});

// ========= Cloud Functions download PDF (endpoint) =========
const FN = "https://us-central1-avsecbwx-4229c.cloudfunctions.net/downloadPdf";

// ====== Utility: penamaan file ======
function makePdfFilename(siteKey){
  const d = new Date();
  const pad = (n)=> String(n).padStart(2, "0");
  const dateStr = `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()}`;
  return `Plotting_${siteKey}_${dateStr}.pdf`;
}

/* ========= (Opsional) export publik langsung — tidak dipakai karena via Functions ======== */
const USE_PUB = false;
const PDF_DEFAULT_OPTS = {
  format: "pdf", size: "A4", portrait: "true", scale: "2",
  top_margin: "0.50", bottom_margin: "0.50", left_margin: "0.50", right_margin: "0.50",
  sheetnames: "false", printtitle: "false", pagenumbers: "true", gridlines: "false", fzr: "true"
};
function buildSheetPdfUrl(sheetId, gid, opts = {}) {
  const cacheBuster = { t: Date.now() };
  if (USE_PUB) {
    const params = new URLSearchParams({ gid, single: "true", output: "pdf", ...cacheBuster });
    return `https://docs.google.com/spreadsheets/d/${sheetId}/pub?${params.toString()}`;
  } else {
    const params = new URLSearchParams({ ...PDF_DEFAULT_OPTS, ...opts, gid, ...cacheBuster });
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?${params.toString()}`;
  }
}

/* ========= Info Sheets (referensi; download via Functions) ========= */
const SHEETS = {
  PSCP:  { id: "1qOd-uWNGIguR4wTj85R5lQQF3GhTFnHru78scoTkux8", gid: "" },
  HBSCP: { id: "1NwPi_H6W7SrCiXevy8y3uxovO2xKwlQKUryXM3q4iiU", gid: "" },
};

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
    enable2040: true, // aktif jika jr/sr >= 3
    cycleMs: 20_000,
    positions: [
      { id:"pos1",  name:"Operator Xray",       allowed:["senior","junior"] },
      { id:"pos2a", name:"Pemeriksa Barang 1",  allowed:["senior","junior","basic"] },
      { id:"pos2b", name:"Pemeriksa Barang 2",  allowed:["senior","junior","basic"] },
    ],
  }
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
const peopleRows   = $("peopleRows");
const btnPSCP      = $("pscpBtn");
const btnHBSCP     = $("hbscpBtn");

// ========= Loading Overlay + Card Popup =========
(function setupLoadingUI(){
  // Elemen overlay/card dibuat via JS agar tidak perlu ubah HTML
  const overlay = document.createElement("div");
  overlay.id = "loadingOverlay";
  overlay.innerHTML = `
    <div class="load-card" role="status" aria-live="polite">
      <div class="icon spinner" id="loadIcon" aria-hidden="true"></div>
      <div class="texts">
        <div class="title" id="loadTitle">Menyiapkan PDF…</div>
        <div class="desc" id="loadDesc">Mohon tunggu sebentar</div>
      </div>
      <button class="close" id="loadClose" title="Tutup" aria-label="Tutup">&times;</button>
    </div>
  `;
  document.body.appendChild(overlay);

  // Helper untuk toggle state (spinner / success / error)
  function setState(state){
    const icon = document.getElementById("loadIcon");
    icon.classList.remove("spinner","success","error");
    icon.classList.add(state);
  }

  window.__loadingUI = {
    show(title="Memproses…", desc="Mohon tunggu"){
      document.getElementById("loadTitle").textContent = title;
      document.getElementById("loadDesc").textContent  = desc;
      setState("spinner");
      overlay.style.display = "flex";
      document.body.classList.add("blur-bg");
      try{ downloadBtn && (downloadBtn.disabled = true); }catch(_){}
    },
    update(title, desc){
      if(title) document.getElementById("loadTitle").textContent = title;
      if(desc)  document.getElementById("loadDesc").textContent  = desc;
    },
    success(title="PDF telah tersimpan", desc="Silakan cek folder unduhan Anda"){
      this.update(title, desc);
      setState("success");
    },
    error(title="Gagal", desc="Terjadi kendala saat mengunduh"){
      this.update(title, desc);
      setState("error");
    },
    hide(){
      overlay.style.display = "none";
      document.body.classList.remove("blur-bg");
      try{ downloadBtn && (downloadBtn.disabled = false); }catch(_){}
    }
  };

  // Tombol tutup (optional)
  overlay.querySelector("#loadClose")?.addEventListener("click", ()=> __loadingUI.hide());
})();

// ========= Indikator koneksi =========
onValue(ref(db, ".info/connected"), snap => { connDot?.classList.toggle("ok", !!snap.val()); });

// ========= Util =========
const pad = n => String(n).padStart(2,"0");
const fmt = d => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

// ========= Pewarnaan tombol berdasar status RTDB =========
function paintSiteButton(btn, isRunning){
  if(!btn) return;
  btn.classList.toggle("start", !!isRunning); // hijau
  btn.classList.toggle("stop",  !isRunning);  // merah
}
onValue(ref(db, "sites/PSCP/control/state"), snap=>{
  paintSiteButton(btnPSCP, !!(snap.val()?.running));
});
onValue(ref(db, "sites/HBSCP/control/state"), snap=>{
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

    this.rosterRef = ref(db, "roster");
    this.usersRef  = ref(db, "users"); // referensi data pengguna
    this._rosterData = {};
    this._specCache  = {};

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
    this._listen(this.rosterRef, s=>{
      this._rosterData = s.val()||{};
      console.log("[roster]", this._rosterData);
      this.syncRosterPeople();
    });

    this.dueTimer = setInterval(()=>{
      if (this.running && this.nextAtLocal && Date.now() >= this.nextAtLocal) {
        this.tryAdvanceCycle(false);
      }
    }, 500);

    startBtn.onclick = ()=> this.onStart();
    stopBtn.onclick  = ()=> this.onStop();
    nextBtn.onclick  = ()=> this.onNext();
    this.setRunningUI(false);
    clockEl && (clockEl.textContent = fmt(new Date()));
    nextEl  && (nextEl.textContent  = "-");
  }

  unmount(){
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.dueTimer)   clearInterval(this.dueTimer);
    startBtn.onclick = stopBtn.onclick = nextBtn.onclick = null;
    this._unsubs.forEach(u=>{ try{u&&u();}catch(e){} });
    this._unsubs = [];
  }

  _listen(r, cb){ const u = onValue(r, cb); this._unsubs.push(u); }

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
    Object.values(people||{}).forEach(p=>{
      const specText = Array.isArray(p.spec) ? p.spec.join(", ") : "";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${p.name}</td><td>${specText}</td>`;
      peopleRows.appendChild(tr);
    });
    peopleRows.onchange = null;
    peopleRows.onclick = null;
    const hasMissingSpec = Object.values(people||{}).some(p => !Array.isArray(p.spec) || p.spec.length===0);
    if(!this.running && startBtn){ startBtn.disabled = hasMissingSpec; }
  }

  async _resolveSpec(name){
    const key = String(name||"").trim().toLowerCase();
    if(this._specCache[key]){
      console.log("[spec-cache]", name, this._specCache[key]);
      return this._specCache[key];
    }

    console.log("[lookup]", name, "->", key);
    let spec = [];
    try{
      const q = query(this.usersRef, orderByChild("nameLower"), equalTo(key));
      const snap = await get(q);
      if(!snap.exists()){
        console.log("[lookup] tidak ditemukan", name);
      }
      snap.forEach(childSnap => {
        const s = childSnap.val()?.spec;
        if(Array.isArray(s)) spec = s.map(x=>String(x).toLowerCase());
        else if(typeof s === "string" && s) spec = [String(s).toLowerCase()];
      });
      console.log("[spec]", name, spec);
    }catch(err){
      console.error("Ambil spec gagal", name, err);
    }
    this._specCache[key] = spec;
    return spec;
  }

  async syncRosterPeople(){
    this._specCache = {}; // selalu ambil spec terbaru saat sinkronisasi
    const r = this._rosterData || {};
    let names = [];
    if(this.siteKey === "PSCP"){
      const arr=[r.angCabin1,r.angCabin2,r.angCabin3,r.angCabin4];
      names = arr.filter(n=>n && n!=="-");
      if(arr.some(n=>n==="-") && r.spvCabin && r.spvCabin!=="-") names.push(r.spvCabin);
    } else if(this.siteKey === "HBSCP"){
      const arr=[r.angHbs1,r.angHbs2,r.angHbs3];
      names = arr.filter(n=>n && n!=="-");
      if(arr.some(n=>n==="-") && r.spvHbs && r.spvHbs!=="-") names.push(r.spvHbs);
    }
    const entries = await Promise.all(names.map(async n=>{
      const spec = await this._resolveSpec(n);
      return [n.toLowerCase(), { name:n, spec }];
    }));
    const people = Object.fromEntries(entries);
    try{
      await set(this.peopleRef, people);
    }catch(err){
      console.error("Sync roster gagal:", err);
    }
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
        if(xrayName && xrayName!=="-") cd[xrayName]=2; // 2 siklus tak boleh pos1
        await Promise.all([
          set(this.assignmentsRef, finalAssign),
          set(this.cooldownRef, cd)
        ]);
      } else {
        await set(this.assignmentsRef, finalAssign);
      }
    }catch(err){
      alert("Tulis assignments gagal: " + (err?.message||err));
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
    if(!auth.currentUser){
      alert("Harus login terlebih dulu.");
      return;
    }

    const pSnap = await get(this.peopleRef);
    const people = pSnap.val() || {};
    const missing = Object.values(people).filter(p => !Array.isArray(p?.spec) || p.spec.length===0).map(p=>p.name);
    if(missing.length){
      alert("Spesifikasi belum tersedia untuk: " + missing.join(", "));
      return;
    }

    let enable2040Now=false;
    if(this.cfg.enable2040){
      const jsCount = Object.values(people).filter(p =>
        Array.isArray(p?.spec) && p.spec.some(s=>["junior","senior"].includes(String(s).toLowerCase()))
      ).length;
      enable2040Now = (jsCount>=3);
    }
    this.mode2040State = this.cfg.enable2040 && enable2040Now;

    const now  = Date.now();
    const next = now + this.CYCLE_MS;
    try{
      await set(this.stateRef, { running:true, nextAt: next, mode2040: this.mode2040State, lastCycleAt: now });
    }catch(err){
      alert("Gagal memulai: " + (err?.message||err));
      return;
    }
    this.nextAtLocal      = next;
    this.lastCycleAtLocal = now;

    await this.computeAndWriteAssignments(this.cfg.enable2040 && this.mode2040State);
    this.setRunningUI(true);
  }

  async onStop(){
    const tasks=[ update(this.stateRef,{ running:false, nextAt:0, mode2040:false, lastCycleAt:0 }) ];
    if(this.cfg.enable2040) tasks.push(set(this.cooldownRef, {}));
    try{
      await Promise.all(tasks);
    }catch(err){
      alert("Gagal menghentikan: " + (err?.message||err));
    }
    this.setRunningUI(false);
    this.nextAtLocal=null;
    this.lastCycleAtLocal=null;
    nextEl && (nextEl.textContent="-");
  }

  async onNext(){
    const snap=await get(this.stateRef);
    const cur=snap.val()||{};
    if(cur.running){
      this.mode2040State=!!cur.mode2040;
      await this.tryAdvanceCycle(true);
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

// ====== Download PDF (dengan card popup + status bertahap) ======
async function downloadViaFunctions(siteKey) {
  const user = auth.currentUser;
  if (!user) { alert("Harus login terlebih dulu."); return; }

  const idToken = await user.getIdToken(true); // paksa refresh

  let resp;
  try {
    __loadingUI.show("Menyiapkan PDF…", "Menghubungkan ke server");
    resp = await fetch(`${FN}?site=${encodeURIComponent(siteKey)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Accept": "application/pdf"
      }
    });
  } catch (e) {
    __loadingUI.error("Gagal terhubung", (e?.message || "Periksa koneksi Anda"));
    setTimeout(()=> __loadingUI.hide(), 1400);
    return;
  }

  if (!resp.ok) {
    const txt = await resp.text().catch(() => resp.statusText);
    __loadingUI.error("Gagal mengunduh", `${resp.status} ${resp.statusText}${txt ? " — "+txt : ""}`);
    setTimeout(()=> __loadingUI.hide(), 1600);
    return;
  }

  __loadingUI.update("Mendownload…", "Menyiapkan berkas PDF");
  const blob = await resp.blob();

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = makePdfFilename(siteKey);
  document.body.appendChild(a);
  a.click();

  // Setelah link terpicu, anggap sukses — tampilkan status & auto-hide
  __loadingUI.success("PDF telah tersimpan", "Cek folder unduhan Anda");
  setTimeout(()=>{
    URL.revokeObjectURL(a.href);
    a.remove();
    __loadingUI.hide();
  }, 1200);
}

// ====== Handler klik tombol Download ======
function onClickDownload(){
  if(!currentSite){ alert("Pilih lokasi dulu (PSCP / HBSCP)."); return; }
  downloadViaFunctions(currentSite);
}

// ====== Init ======
(function init(){
  if (downloadBtn) downloadBtn.disabled = true;

  const url = new URL(location.href);
  const qsSite = url.searchParams.get("site");
  let initial="PSCP";
  try{ initial = qsSite || localStorage.getItem("siteSelected") || "PSCP"; }catch(_){}
  bootSite(initial);

  btnPSCP?.addEventListener("click", ()=> bootSite("PSCP"));
  btnHBSCP?.addEventListener("click", ()=> bootSite("HBSCP"));
  downloadBtn?.addEventListener("click", onClickDownload);

  document.documentElement.style.visibility="visible";
})();
