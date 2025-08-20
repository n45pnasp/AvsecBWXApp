// =============================
// schedule.js (FINAL via Cloudflare Worker proxy)
// =============================

// Wajib: type="module" di HTML
import { requireAuth } from "./auth-guard.js";

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
