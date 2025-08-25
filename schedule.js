// =============================
// schedule.js (FINAL via Cloudflare Worker proxy)
// =============================

// Wajib: type="module" di HTML
import { requireAuth } from "./auth-guard.js";
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBc-kE-_q1yoENYECPTLC3EZf_GxBEwrWY",
  authDomain: "avsecbwx-4229c.firebaseapp.com",
  projectId: "avsecbwx-4229c",
  appId: "1:1029406629258:web:53e8f09585cd77823efc73",
  storageBucket: "avsecbwx-4229c.appspot.com",
  messagingSenderId: "1029406629258",
  measurementId: "G-P37F88HGFE",
  databaseURL: "https://avsecbwx-4229c-default-rtdb.firebaseio.com"
};

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db   = getDatabase(app);

// ===== KONFIG =====
// Ganti dengan URL Cloudflare Worker kamu (bkn URL Apps Script langsung)
const PROXY_ENDPOINT = "https://roster-proxy.avsecbwx2018.workers.dev"; // <-- ganti ini
const SHARED_TOKEN   = "N45p"; // samakan dgn code.gs

// ====== DOM utils & overlay ======
function $(sel){ return document.querySelector(sel); }
function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  for (const c of children) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return n;
}
const Overlay = {
  show(title = "Memproses…", desc = "Sedang berjalan") {
    document.body.classList.add("blur-bg");
    const o = $("#loadingOverlay");
    o.style.display = "flex";
    o.querySelector(".title").textContent = title;
    o.querySelector(".desc").textContent  = desc;
    o.querySelector(".icon").className    = "icon spinner";
  },
  success(title = "Berhasil", desc = "Data berhasil dimuat"){
    const o = $("#loadingOverlay");
    o.querySelector(".title").textContent = title;
    o.querySelector(".desc").textContent  = desc;
    o.querySelector(".icon").className    = "icon success";
    setTimeout(Overlay.hide, 700);
  },
  error(title = "Gagal", desc = "Terjadi kesalahan"){
    const o = $("#loadingOverlay");
    o.querySelector(".title").textContent = title;
    o.querySelector(".desc").textContent  = desc;
    o.querySelector(".icon").className    = "icon error";
  },
  hide(){
    document.body.classList.remove("blur-bg");
    $("#loadingOverlay").style.display = "none";
  }
};
window.App = { hideOverlay: Overlay.hide };

function fillText(id, value){
  const el = document.getElementById(id);
  if (el) el.textContent = (value ?? "").toString().trim() || "-";
}
function renderTable(tableId, rows){
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) return;
  tbody.innerHTML = "";
  (rows || []).forEach((r, idx) => {
    const tr = el("tr", {}, [
      el("td", { textContent: (r.no || String(idx+1)) }),
      el("td", { textContent: (r.nama || "-") }),
      el("td", { textContent: (r.posisi || "-") })
    ]);
    tbody.appendChild(tr);
  });
}
function bySection(data, section){
  return (data.rosters || []).filter(r => (r.section || "").toUpperCase() === section);
}

function classifyRoster(data){
  const getName = (arr, idx) => (arr?.[idx]?.nama) || "-";
  const hbs   = bySection(data, "HBSCP");
  const cabin = bySection(data, "PSCP");
  const pos1  = bySection(data, "POS1");
  const patroli = bySection(data, "PATROLI");
  const cargo = bySection(data, "MALAM");
  return {
    chief: data.config?.chief || "-",
    asstChief: data.config?.assistant_chief || "-",
    spvCabin: data.config?.supervisor_pscp || "-",
    spvHbs: data.config?.supervisor_hbscp || "-",
    spvLandside: data.config?.supervisor_pos1 || "-",
    spvCargo: data.config?.supervisor_patroli || "-",
    spvCctv: data.config?.supervisor_cctv || "-",
    angHbs1: getName(hbs,0),
    angHbs2: getName(hbs,1),
    angHbs3: getName(hbs,2),
    angCabin1: getName(cabin,0),
    angCabin2: getName(cabin,1),
    angCabin3: getName(cabin,2),
    angCabin4: getName(cabin,3),
    angArrival: getName(pos1,0),
    angPos1: getName(pos1,1),
    angDropzone1: getName(patroli,0),
    angDropzone2: getName(patroli,1),
    angCargo: getName(cargo,0)
  };
}

// ====== FETCH via Cloudflare Worker (no JSONP) ======
async function fetchData(){
  const url = new URL(PROXY_ENDPOINT);
  url.searchParams.set("action", "getRoster");
  url.searchParams.set("token", SHARED_TOKEN);
  url.searchParams.set("_", Date.now()); // bust cache

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });

  // Worker sudah balas JSON + CORS; tapi tetap cek untuk jaga-jaga
  const ctype = (res.headers.get("content-type") || "").toLowerCase();
  if (!ctype.includes("application/json")) {
    const text = await res.text().catch(()=> "");
    throw new Error(`non-json response${text ? `: ${text.slice(0,120)}…` : ""}`);
  }

  const data = await res.json();
  if (!data || !data.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

// ====== INIT ======
async function init(){
  try{
    Overlay.show("Mengambil data…", "Memuat daftar tugas");
    const data = await fetchData();

    try {
      const classified = classifyRoster(data);
      await set(ref(db, "roster"), classified);
    } catch (err) {
      console.error("sync rtdb", err);
    }

    // Header (tanggal sudah sesuai format Sheet karena server pakai getDisplayValues)
    fillText("tgl", data.config?.tanggal);
    fillText("chief", data.config?.chief);
    fillText("assistantChief", data.config?.assistant_chief);
    fillText("spvCctv", data.config?.supervisor_cctv);

    // Supervisors per section
    fillText("spvHbscp",  data.config?.supervisor_hbscp);
    fillText("spvPscp",   data.config?.supervisor_pscp);
    fillText("spvPos1",   data.config?.supervisor_pos1);
    fillText("spvPatroli",data.config?.supervisor_patroli);

    // Tables
    renderTable("tbl-hbscp",   bySection(data, "HBSCP"));
    renderTable("tbl-pscp",    bySection(data, "PSCP"));
    renderTable("tbl-pos1",    bySection(data, "POS1"));
    renderTable("tbl-patroli", bySection(data, "PATROLI"));
    renderTable("tbl-malam",   bySection(data, "MALAM"));

    // Notes
    fillText("noteFyi",   data.config?.fyi);
    fillText("noteCuti",  data.config?.cuti);
    fillText("noteSakit", data.config?.sakit);

    Overlay.success("Selesai", "Data berhasil dimuat");
  } catch(err){
    console.error(err);
    Overlay.error("Gagal Memuat", String(err?.message || err));
  }
}

// ====== Auth guard + start ======
requireAuth({
  loginPath: "index.html",     // halaman login kamu
  hideWhileChecking: true,
  requireEmailVerified: false
});

document.addEventListener("DOMContentLoaded", init);
