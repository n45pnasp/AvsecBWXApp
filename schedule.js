// ===== KONFIGURASI =====
// Ganti URL_WEB_APP sesuai deployment Google Apps Script kamu (Deploy > New Deployment)
const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbw6AVNm62yMKfV3JSDsn6rkxM5NlQv3fK9pny7Z5TBOI3PCULVuwAumaos-VwtnJVXq/exec"; // contoh: https://script.google.com/macros/s/XXX/exec
const SHARED_TOKEN = "N45p"; // sama dengan di code.gs

const ALLOWED_SECTIONS = ["HBSCP", "PSCP", "POS1", "PATROLI", "MALAM"];

// Utility dom
function $(sel){ return document.querySelector(sel); }
function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  for (const c of children) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return n;
}

// Overlay control (sesuai CSS kamu)
const Overlay = {
  show(title = "Memproses…", desc = "Sedang berjalan") {
    document.body.classList.add("blur-bg");
    const o = $("#loadingOverlay");
    o.style.display = "flex";
    o.querySelector(".title").textContent = title;
    o.querySelector(".desc").textContent = desc;
    const icon = o.querySelector(".icon");
    icon.className = "icon spinner";
  },
  success(title = "Berhasil", desc = "Data berhasil dimuat"){
    const o = $("#loadingOverlay");
    o.querySelector(".title").textContent = title;
    o.querySelector(".desc").textContent = desc;
    const icon = o.querySelector(".icon");
    icon.className = "icon success";
    setTimeout(Overlay.hide, 700);
  },
  error(title = "Gagal", desc = "Terjadi kesalahan"){
    const o = $("#loadingOverlay");
    o.querySelector(".title").textContent = title;
    o.querySelector(".desc").textContent = desc;
    const icon = o.querySelector(".icon");
    icon.className = "icon error";
  },
  hide(){
    document.body.classList.remove("blur-bg");
    $("#loadingOverlay").style.display = "none";
  }
};

window.App = { hideOverlay: Overlay.hide };

function fillText(id, value){
  const el = document.getElementById(id);
  if (el) el.textContent = value || "-";
}

function renderTable(tableId, rows){
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = "";
  rows.forEach((r, idx) => {
    const tr = el("tr", {}, [
      el("td", { textContent: r.no || String(idx+1) }),
      el("td", { textContent: r.nama || "-" }),
      el("td", { textContent: r.posisi || "-" })
    ]);
    tbody.appendChild(tr);
  });
}

async function fetchData(){
  const url = new URL(GAS_ENDPOINT);
  url.searchParams.set("action", "getRoster");
  url.searchParams.set("token", SHARED_TOKEN);

  const res = await fetch(url.toString(), {
    method: "GET",
    // mode: "cors", // default
    // credentials: "omit",
    headers: { "Accept": "application/json" }
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function bySection(data, section){
  return (data.rosters || []).filter(r => (r.section || "").toUpperCase() === section);
}

async function init(){
  try{
    Overlay.show("Mengambil data…", "Memuat daftar tugas dari Google Sheet");
    const data = await fetchData();

    // Header
    fillText("tgl", data.config?.tanggal);
    fillText("chief", data.config?.chief);
    fillText("assistantChief", data.config?.assistant_chief);
    fillText("spvCctv", data.config?.supervisor_cctv);

    // Supervisors per section
    fillText("spvHbscp", data.config?.supervisor_hbscp);
    fillText("spvPscp", data.config?.supervisor_pscp);
    fillText("spvPos1", data.config?.supervisor_pos1);
    fillText("spvPatroli", data.config?.supervisor_patroli);

    // Tables
    renderTable("tbl-hbscp",  bySection(data, "HBSCP"));
    renderTable("tbl-pscp",   bySection(data, "PSCP"));
    renderTable("tbl-pos1",   bySection(data, "POS1"));
    renderTable("tbl-patroli",bySection(data, "PATROLI"));
    renderTable("tbl-malam",  bySection(data, "MALAM"));

    // Notes
    fillText("noteFyi", data.config?.fyi);
    fillText("noteCuti", data.config?.cuti);
    fillText("noteSakit", data.config?.sakit);

    Overlay.success("Selesai", "Data berhasil dimuat");
  } catch(err){
    console.error(err);
    Overlay.error("Gagal Memuat", String(err?.message || err));
  }
}

document.addEventListener("DOMContentLoaded", init);
