// =============================
// schedule.js (FINAL - Dropzone dari POS1: 'DROPZONE', Arrival & Pos1 by label, PSCP max 4, HBSCP/PSCP, Mobile malam fallback PIC)
// =============================

import { requireAuth, getFirebase } from "./auth-guard.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";

const { app, auth } = getFirebase();
const db = getDatabase(app);

// ===== KONFIG =====
const PROXY_ENDPOINT = "https://roster-proxy.avsecbwx2018.workers.dev";
const SHARED_TOKEN   = "N45p";

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
    if (!o) return;
    o.style.display = "flex";
    o.querySelector(".title").textContent = title;
    o.querySelector(".desc").textContent  = desc;
    o.querySelector(".icon").className    = "icon spinner";
  },
  success(title = "Berhasil", desc = "Data berhasil dimuat"){
    const o = $("#loadingOverlay");
    if (!o) return;
    o.querySelector(".title").textContent = title;
    o.querySelector(".desc").textContent  = desc;
    o.querySelector(".icon").className    = "icon success";
    setTimeout(Overlay.hide, 700);
  },
  error(title = "Gagal", desc = "Terjadi kesalahan"){
    const o = $("#loadingOverlay");
    if (!o) return;
    o.querySelector(".title").textContent = title;
    o.querySelector(".desc").textContent  = desc;
    o.querySelector(".icon").className    = "icon error";
  },
  hide(){
    document.body.classList.remove("blur-bg");
    const o = $("#loadingOverlay");
    if (!o) return;
    o.style.display = "none";
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

// ===== Helpers tampilan tabel yang sudah ada =====
function fillText(id, value){
  const elx = document.getElementById(id);
  if (elx) elx.textContent = (value ?? "").toString().trim() || "-";
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
  const hbs   = bySection(data, "HBSCP");
  const pscp  = bySection(data, "PSCP");
  const pos1  = bySection(data, "POS1");      // berisi POS 1 / DROPZONE / (kadang ARRIVAL)
  const patroli = bySection(data, "PATROLI");  // personel PATROLI (bukan Dropzone)
  const malam = bySection(data, "MALAM");
  return {
    chief: data.config?.chief || "-",
    asstChief: data.config?.assistant_chief || "-",
    chief2: data.config?.chief2 || "-",
    asstChief2: data.config?.assistant_chief2 || "-",
    spvPscp: data.config?.supervisor_pscp || "-",
    spvHbs:  data.config?.supervisor_hbscp || "-",
    spvCctv: data.config?.supervisor_cctv || "-",
    spvPatroli: data.config?.supervisor_patroli || "-",
    pos1Arr: pos1,
    angHbs:  hbs,
    angPscp: pscp,
    angPatroli: patroli,
    angMalam: malam
  };
}

// ====== FETCH via Cloudflare Worker ======
async function fetchData(){
  const url = new URL(PROXY_ENDPOINT);
  url.searchParams.set("action", "getRoster");
  url.searchParams.set("token", SHARED_TOKEN);
  url.searchParams.set("_", Date.now());

  const res = await fetch(url.toString(), { method: "GET", cache: "no-store" });
  const ctype = (res.headers.get("content-type") || "").toLowerCase();
  if (!ctype.includes("application/json")) {
    const text = await res.text().catch(()=> "");
    throw new Error(`non-json response${text ? `: ${text.slice(0,120)}…` : ""}`);
  }
  const data = await res.json();
  if (!data || !data.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

// ========== UTIL GENERATOR TEKS ==========
function normalizeStringList(strOrArr){
  if (Array.isArray(strOrArr)) return strOrArr.map(s => `${s}`.trim()).filter(Boolean);
  const s = (strOrArr || "").toString();
  if (!s.trim()) return [];
  return s.split(/\r?\n|,/g).map(x => x.trim()).filter(Boolean);
}
function listNumberedFromNames(arrNames, minOneDash = true){
  const names = (arrNames || []).map(n => (n || "-").toString().trim()).filter(Boolean);
  if (names.length === 0 && minOneDash) return "1. -";
  return names.map((nm, i) => `${i+1}. ${nm}`).join("\n");
}
function listNumberedFromRoster(rosterArr, minOneDash = true){
  const names = (rosterArr || []).map(x => (x?.nama || "-").toString().trim()).filter(Boolean);
  return listNumberedFromNames(names, minOneDash);
}
function ensureDateText(dateStr){
  return (dateStr || "").trim();
}
const toUpperTrim = s => (s || "").toString().trim().toUpperCase();
const findByPos = (arr, kw) =>
  (arr || []).find(x => (x?.posisi || "").toString().toLowerCase().includes(kw)) || null;

// ========== GENERATOR TEKS WA (PAGI) ==========
function composeWhatsAppText_Morning(data){
  const cfg = data?.config || {};
  const tglTeks = ensureDateText(cfg.tanggal || "-");

  const c1 = (cfg.chief || "-").trim();
  const c2 = (cfg.chief2 || "-").trim();
  const a1 = (cfg.assistant_chief || "-").trim();
  const a2 = (cfg.assistant_chief2 || "-").trim();

  const spvHbs  = (cfg.supervisor_hbscp || "-").trim();
  const spvCctv = (cfg.supervisor_cctv || "-").trim();
  const spvPscp = (cfg.supervisor_pscp || "-").trim();
  const spvPat  = (cfg.supervisor_patroli || "-").trim();

  const hbs   = bySection(data, "HBSCP");
  const pscp  = bySection(data, "PSCP");
  const pos1Arr  = bySection(data, "POS1");

  // PSCP blok: maksimal 4
  const pscpTop4 = pscp.slice(0, 4);
  const pscp5th  = (pscp[4]?.nama || "").trim();

  // Cari label di POS1
  const pos1Row     = findByPos(pos1Arr, "pos 1") || findByPos(pos1Arr, "pos1");
  const dropzoneRow = findByPos(pos1Arr, "dropzone");
  const arrivalRow  = findByPos(pos1Arr, "arrival");

  // Arrival: PSCP[5] > POS1 label ARRIVAL > default POS1[0]
  const arrivalName = pscp5th ||
                      (arrivalRow?.nama || "").trim() ||
                      (pos1Arr?.[0]?.nama || "-").trim();

  // Pos 1: label POS 1 jika ada; jika tidak, ambil orang pertama POS1 yang bukan Arrival
  let pos1Name = (pos1Row?.nama || "").trim();
  if (!pos1Name) {
    const pos1Names = (pos1Arr || []).map(x => (x?.nama || "").trim()).filter(Boolean);
    pos1Name = (pos1Names.find(nm => toUpperTrim(nm) !== toUpperTrim(arrivalName)) || "-");
  }

  // Dropzone: HANYA dari baris POS1 yang berposisi DROPZONE (tidak dari PATROLI / fallback lain)
  const dropzoneName = (dropzoneRow?.nama || "-").trim();

  const cutiList    = normalizeStringList(cfg.cuti);
  const sakitList   = normalizeStringList(cfg.sakit);
  const attensiList = normalizeStringList(cfg.attensi);
  const attPad = [...attensiList];
  while (attPad.length < 5) attPad.push("-");

  const header = "‎ السَّلاَمُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ\n\nSelamat pagi komandan, \n\n" +
                 `Ijin melaporkan kekuatan personil yg berdinas pada pagi hari ini *${tglTeks}* \n`;

  const pimpinan =
`\n*Chief 1 : ${c1}*
*Chief 2 : ${c2}*
*AsstChief 1 : ${a1}*
*AsstChief 2 : ${a2}*`;

  const spv =
`\n*SPV HBSCP : ${spvHbs}*
*SPV CCTV : ${spvCctv}*
*SPV PSCP : ${spvPscp}*
*SPV Cargo & Patroli : ${spvPat}*`;

  const anggota =
`\n\n*Anggota* 
HBSCP :
${listNumberedFromRoster(hbs)}

PSCP :
${listNumberedFromRoster(pscpTop4)}

Arrival : 
${listNumberedFromNames([arrivalName])}

Pos 1 :
${listNumberedFromNames([pos1Name])}

Dropzone : 
${listNumberedFromNames([dropzoneName])}
`;

  const cutiBlock =
`Cuti :
${listNumberedFromNames(cutiList)}

Sakit :
${listNumberedFromNames(sakitList)}`;

  const apel = `\nApel pagi dipimpin oleh Chief ${c1} \n`;

  const attensi =
`\nAttensi:

1. ${attPad[0]}
2. ${attPad[1]}
3. ${attPad[2]}
4. ${attPad[3]}
5. ${attPad[4]}

Demikian beberapa atensi yang kami buat, atas perhatiannya disampaikan Terimakasih

`;

  const footer =
`#AVSECBWX
#B.E.R.S.I.H
*_Be profesional_*
*_Educated_* 
*_Responsible_*
*_Synergy_*
*_Inovation_*
*_Hospitality_*`;

  return [header, pimpinan, spv, anggota, "\n", cutiBlock, "\n\n", apel, attensi, footer].join("");
}

// ========== GENERATOR TEKS WA (MALAM) ==========
function splitNightByRole(malamRoster){
  const mobile = [];
  const terminal = [];
  const pos1 = [];
  (malamRoster || []).forEach(r => {
    const nm = (r?.nama || "").trim();
    const ps = (r?.posisi || "").toLowerCase();
    if (!nm) return;
    if (ps.includes("mobile")) {
      mobile.push(nm);
    } else if (ps.includes("terminal")) {
      terminal.push(nm);
    } else if (ps.includes("pos 1") || ps === "pos1" || ps.includes("pos")) {
      pos1.push(nm);
    } else {
      terminal.push(nm);
    }
  });
  return { mobile, terminal, pos1 };
}

function composeWhatsAppText_Night(data){
  const cfg = data?.config || {};
  const tglTeks = ensureDateText(cfg.tanggal || "-");

  const malamRoster = bySection(data, "MALAM");
  const picMalam = (cfg.pic_malam || malamRoster?.[0]?.nama || "-").toString().trim();

  let { mobile, terminal, pos1 } = splitNightByRole(malamRoster);

  // Fallback: jika Mobile kosong, isi PIC malam
  if ((!mobile || mobile.length === 0) && picMalam && picMalam !== "-") {
    mobile = [picMalam];
  }

  const cutiList  = normalizeStringList(cfg.cuti_malam || cfg.cuti);
  const sakitList = normalizeStringList(cfg.sakit_malam || cfg.sakit);

  const attensiList = normalizeStringList(cfg.attensi_malam);
  const attPad = [...attensiList];
  while (attPad.length < 6) attPad.push("-");

  const header =
"السَّلاَمُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ\n\n" +
"Selamat Malam komandan,  \n\n" +
`Ijin melaporkan kekuatan personil yg berdinas pada Malam hari ini *${tglTeks}*  \n\n`;

  const pic = `PIC Dinas Malam : ${picMalam}\n`;

  const plot =
`\nPlotingan personil :

Mobile :
${listNumberedFromNames(mobile)}

Terminal :
${listNumberedFromNames(terminal)}

Pos 1 :
${listNumberedFromNames(pos1)}
`;

  const ket =
`\nKeterangan :
Cuti :
${listNumberedFromNames(cutiList)}

Sakit :
${listNumberedFromNames(sakitList)}
`;

  const att =
`\nDilaksanakan apel malam dengan atensi sebagai berikut :

1. ${attPad[0]}
2. ${attPad[1]}
3. ${attPad[2]}
4. ${attPad[3]}
5. ${attPad[4]}
6. ${attPad[5]}

Demikian dilaporkan atensi Apel Dinas malam ini, disampakikan trimakasih 🙏🏻
 
`;

  const footer =
`#AVSECBWX
#B.E.R.S.I.H
*_Be profesional_*
*_Educated_*
*_Responsible_*
*_Synergy_*
*_Inovation_*
*_Hospitality_*`;

  return [header, pic, plot, ket, att, footer].join("");
}

// ===== Clipboard util (2 tombol) =====
async function copyTextFromTextarea(sel){
  const ta = $(sel);
  if (!ta || !ta.value) {
    Modal.show("Teks laporan belum tersedia.", "Info");
    return;
  }
  const text = ta.value;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      ta.hidden = false; ta.select(); document.execCommand("copy"); ta.blur(); ta.hidden = true;
    }
    Modal.show("Teks laporan WhatsApp telah disalin. Tinggal *Paste* di chat.", "Tersalin");
  } catch (err) {
    console.error("copy fail", err);
    Modal.show("Gagal menyalin teks. Silakan pilih & salin manual.", "Gagal");
  }
}
$("#copyWaMorningBtn")?.addEventListener("click", () => copyTextFromTextarea("#waTextMorning"));
$("#copyWaNightBtn")?.addEventListener("click", () => copyTextFromTextarea("#waTextNight"));

// ====== INIT ======
async function init(){
  try{
    Overlay.show("Mengambil data…", "Memuat daftar tugas");
    const data = await fetchData();

    // sinkron ke RTDB (hanya UID yang diizinkan)
    const classified = classifyRoster(data);
    const user = auth.currentUser;
    if (!user) throw new Error("User belum login");
    const uid = user.uid;

    const snap = await get(ref(db, "config/UID-NOVAN"));
    const allowedUid = snap.val();
    if (!allowedUid) throw new Error("UID referensi tidak ditemukan");

    if (uid === allowedUid) {
      try {
        if (Object.keys(classified).length === 0) throw new Error("Data roster kosong");
        await set(ref(db, "roster"), classified);
        Modal.show("Roster sudah terkirim ke RTDB");
      } catch (err) {
        console.error("sync rtdb", err);
        Modal.show(`Gagal mengirim data roster ke RTDB: ${err?.message || err}`, "Gagal");
      }
    }

    // Render UI
    fillText("tgl", data.config?.tanggal);
    fillText("chief", data.config?.chief);
    fillText("assistantChief", data.config?.assistant_chief);
    fillText("spvCctv", data.config?.supervisor_cctv);

    fillText("spvHbscp",  data.config?.supervisor_hbscp);
    fillText("spvPscp",   data.config?.supervisor_pscp);
    fillText("spvPos1",   data.config?.supervisor_pos1);
    fillText("spvPatroli",data.config?.supervisor_patroli);

    renderTable("tbl-hbscp",   bySection(data, "HBSCP"));
    renderTable("tbl-pscp",    bySection(data, "PSCP"));
    renderTable("tbl-pos1",    bySection(data, "POS1"));
    renderTable("tbl-patroli", bySection(data, "PATROLI"));
    renderTable("tbl-malam",   bySection(data, "MALAM"));

    fillText("noteFyi",   data.config?.fyi);
    fillText("noteCuti",  data.config?.cuti);
    fillText("noteSakit", data.config?.sakit);

    // === Susun teks WA: PAGI & MALAM ===
    const morningText = composeWhatsAppText_Morning(data);
    const nightText   = composeWhatsAppText_Night(data);

    const taMorning = $("#waTextMorning");
    const taNight   = $("#waTextNight");
    if (taMorning) taMorning.value = morningText;
    if (taNight)   taNight.value   = nightText;

    Overlay.success("Selesai", "Data berhasil dimuat");
  } catch(err){
    console.error(err);
    Overlay.error("Gagal Memuat", String(err?.message || err));
  }
}

// ====== Auth guard + start ======
requireAuth({
  loginPath: "index.html",
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
