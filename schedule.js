// =============================
// schedule.js (final + auth guard)
// =============================

// 👉 Wajib pakai type="module" di HTML: <script type="module" src="./schedule.js"></script>
import { requireAuth } from "./auth-guard.js";

// ===== KONFIGURASI =====
const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbwvaVAt6ebqSnrSM1PNy14dA2FAhbBrovyjh70KPTKpNly51ui2srwtazsGPAnE758J/exec";
const SHARED_TOKEN = "N45p";
const PREFER_JSONP = location.hostname.endsWith("github.io");

// ===== JSONP helper =====
function fetchJsonpOnce(timeoutMs = 15000){
  return new Promise((resolve, reject) => {
    const cbName = "roster_cb_" + Math.random().toString(36).slice(2);
    const s = document.createElement("script");
    const url = new URL(GAS_ENDPOINT);
    url.searchParams.set("action", "getRoster");
    url.searchParams.set("token", SHARED_TOKEN);
    url.searchParams.set("callback", cbName);
    url.searchParams.set("_", Date.now());

    let done = false;
    const cleanup = () => {
      if (window[cbName]) delete window[cbName];
      if (s && s.parentNode) s.parentNode.removeChild(s);
    };

    window[cbName] = (payload) => {
      if (done) return;
      done = true; cleanup();
      if (!payload || !payload.ok) return reject(new Error(payload?.error || "JSONP payload error"));
      resolve(payload);
    };

    s.onerror = () => {
      if (done) return;
      done = true; cleanup();
      reject(new Error("JSONP load error"));
    };

    s.src = url.toString();
    (document.head || document.documentElement).appendChild(s);

    setTimeout(() => {
      if (done) return;
      done = true; cleanup();
      reject(new Error("JSONP timeout"));
    }, timeoutMs);
  });
}

async function fetchJsonpWithRetry(){
  try {
    return await fetchJsonpOnce(15000);
  } catch {
    await new Promise(r => setTimeout(r, 800));
    return fetchJsonpOnce(20000);
  }
}

// ===== fetch standar =====
async function fetchHttp(){
  const url = new URL(GAS_ENDPOINT);
  url.searchParams.set("action", "getRoster");
  url.searchParams.set("token", SHARED_TOKEN);
  url.searchParams.set("_", Date.now());

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const ctype = (res.headers.get("content-type") || "").toLowerCase();
  if (!ctype.includes("application/json")) throw new Error("non-json response");
  const data = await res.json();
  if (!data || !data.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

// ===== Strategi =====
async function fetchData(){
  if (PREFER_JSONP) {
    try { return await fetchJsonpWithRetry(); }
    catch { /* fallback */ }
  }
  try { return await fetchHttp(); }
  catch { return fetchJsonpWithRetry(); }
}

// ===== Utility DOM & Overlay (tetap sama) =====
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
    o.querySelector(".desc").textContent = desc;
    o.querySelector(".icon").className = "icon spinner";
  },
  success(title = "Berhasil", desc = "Data berhasil dimuat"){
    const o = $("#loadingOverlay");
    o.querySelector(".title").textContent = title;
    o.querySelector(".desc").textContent = desc;
    o.querySelector(".icon").className = "icon success";
    setTimeout(Overlay.hide, 700);
  },
  error(title = "Gagal", desc = "Terjadi kesalahan"){
    const o = $("#loadingOverlay");
    o.querySelector(".title").textContent = title;
    o.querySelector(".desc").textContent = desc;
    o.querySelector(".icon").className = "icon error";
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

// ===== init =====
async function init(){
  try {
    Overlay.show("Mengambil data…", "Memuat daftar tugas");
    const data = await fetchData();

    fillText("tgl", data.config?.tanggal);              // format tanggal = getDisplayValues() (server)
    fillText("chief", data.config?.chief);
    fillText("assistantChief", data.config?.assistant_chief);
    fillText("spvCctv", data.config?.supervisor_cctv);

    fillText("spvHbscp", data.config?.supervisor_hbscp);
    fillText("spvPscp", data.config?.supervisor_pscp);
    fillText("spvPos1", data.config?.supervisor_pos1);
    fillText("spvPatroli", data.config?.supervisor_patroli);

    renderTable("tbl-hbscp",   bySection(data, "HBSCP"));
    renderTable("tbl-pscp",    bySection(data, "PSCP"));
    renderTable("tbl-pos1",    bySection(data, "POS1"));
    renderTable("tbl-patroli", bySection(data, "PATROLI"));
    renderTable("tbl-malam",   bySection(data, "MALAM"));

    fillText("noteFyi",   data.config?.fyi);
    fillText("noteCuti",  data.config?.cuti);
    fillText("noteSakit", data.config?.sakit);

    Overlay.success("Selesai", "Data berhasil dimuat");
  } catch(err){
    console.error(err);
    Overlay.error("Gagal Memuat", String(err?.message || err));
  }
}

// ===== Jalankan guard + init =====
// - Jika belum login → redirect ke login (mis. index.html) oleh auth-guard.
// - Jika sudah login → halaman dibiarkan tampil; kita tetap panggil init().
// Note: requireAuth menyembunyikan dokumen sementara (opsional) agar tidak nampak flicker.
requireAuth({
  loginPath: "index.html",      // sesuaikan jika login page beda
  hideWhileChecking: true,      // sembunyikan konten saat cek auth
  requireEmailVerified: false   // set true jika mau wajib verifikasi email
});

// Tetap pasang init; jika user belum login, halaman akan di-redirect dulu oleh guard.
document.addEventListener("DOMContentLoaded", init);
