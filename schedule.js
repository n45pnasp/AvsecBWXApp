// =============================
// schedule.js (FINAL - UID diambil dari path config/UID-NOVAN)
// =============================

// Wajib: type="module" di HTML
import { requireAuth, getFirebase } from "./auth-guard.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const { app, auth } = getFirebase();
const db = getDatabase(app);

// ===== KONFIG =====
// Ganti dengan URL Cloudflare Worker kamu (bkn URL Apps Script langsung)
const PROXY_ENDPOINT = "https://roster-proxy.avsecbwx2018.workers.dev"; // <-- ganti ini
const SHARED_TOKEN   = "N45p"; // samakan dgn code.gs

// UID akun yang boleh menulis ke "roster" disimpan di RTDB pada path config/UID-NOVAN


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

// ===== Modal Notifikasi =====
const Modal = {
  show(msg, title = "Notifikasi") {
    const back = $("#alertBack");
    if (!back) return;
    back.querySelector("#alertTitle").textContent = title;
    back.querySelector("#alertMsg").textContent = msg;
    back.classList.add("show");
    back.setAttribute("aria-hidden", "false");
  },
  hide() {
    const back = $("#alertBack");
    if (!back) return;
    back.classList.remove("show");
    back.setAttribute("aria-hidden", "true");
  }
};
document.getElementById("alertOk")?.addEventListener("click", Modal.hide);

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

      const classified = classifyRoster(data);
      const user = auth.currentUser;
      if (!user) throw new Error("User belum login");

      const uid = user.uid;
      console.log("🔑 UID login saat ini:", uid);

      // Ambil UID yang diizinkan dari RTDB
      const snap = await get(ref(db, "config/UID-NOVAN"));
      const allowedUid = snap.val();
      if (!allowedUid) throw new Error("UID referensi tidak ditemukan");
      console.log("✅ UID yang diizinkan:", allowedUid);

      if (uid === allowedUid) {
        // ✅ sesuai rules: hanya UID ini yang bisa menulis
        try {
          if (Object.keys(classified).length === 0) throw new Error("Data roster kosong");
          await set(ref(db, "roster"), classified);
          Modal.show("Roster sudah terkirim ke RTDB");
        } catch (err) {
          console.error("sync rtdb", err);
          Modal.show(`Gagal mengirim data roster ke RTDB: ${err?.message || err}`, "Gagal");
        }
      } else {
        console.warn("Akun tidak diizinkan kirim roster", { uid });
        // Tidak menampilkan modal apa pun untuk user yang tidak diizinkan
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

document.addEventListener("DOMContentLoaded", () => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      unsubscribe();
      init();
    }
  });
});
