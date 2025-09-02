const SHARED_TOKEN = "N45p";
const LOOKUP_URL   = "https://rdcheck.avsecbwx2018.workers.dev/";

const translations = {
  id: {
    title: "PEMERIKSAAN BAGASI TERCATAT",
    headers: ["WAKTU PERIKSA", "NAMA PENUMPANG", "PENERBANGAN", "STATUS"],
    status: "DIPERIKSA HARAP MENGHUBUNGI PETUGAS",
    ticker: "HAVE A NICE FLIGHT - SEE YOU SOON!",
  },
  en: {
    title: "CHECKED BAGGAGE INSPECTION",
    headers: ["INSPECTION TIME", "PASSENGER NAME", "FLIGHT", "STATUS"],
    status: "INSPECTED — PLEASE CONTACT OFFICER",
    ticker: "HAVE A NICE FLIGHT - SEE YOU SOON!",
  },
};

let currentLang = "id";
let currentRows = [];

/* ========= UTIL WAKTU ========= */
function formatHHMMFromDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return null;
  const parts = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const hh = parts.find(p => p.type === "hour")?.value ?? "";
  const mm = parts.find(p => p.type === "minute")?.value ?? "";
  return `${hh}:${mm}`;
}

/* robust parser → "HH:MM" */
function toHHMMFromAny(v) {
  if (v == null || v === "") return null;

  if (v instanceof Date && !isNaN(v)) return formatHHMMFromDate(v);

  if (typeof v === "string") {
    const s = v.replace(/\u00A0/g, " ").trim().replace(/\./g, ":");
    // dd/MM/yyyy HH:mm(:ss)
    let m = s.match(/^\d{1,2}\/\d{1,2}\/\d{4}\s+(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (m) return `${m[1].padStart(2,"0")}:${m[2].padStart(2,"0")}`;
    // token waktu biasa (hindari nyangkut ke MM:SS)
    m = s.match(/(?:^|\s)(\d{1,2}):(\d{2})(?::\d{2})?(?:\s|$)/);
    if (m) return `${m[1].padStart(2,"0")}:${m[2].padStart(2,"0")}`;
    // ada offset/Z
    if (/[zZ]|[+-]\d{2}:\d{2}(?:\s*\(.+\))?$/.test(s)) {
      const d = new Date(s); if (!isNaN(d)) return formatHHMMFromDate(d);
    }
    // ISO tanpa zona → UTC
    m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      const [_, Y,M,D,H,Min,S] = m;
      return formatHHMMFromDate(new Date(Date.UTC(+Y, +M-1, +D, +H, +Min, +(S||0))));
    }
  }

  if (typeof v === "number") {
    if (v > 1000 && v < 60000) return formatHHMMFromDate(new Date((v - 25569) * 86400 * 1000)); // serial Sheets
    if (v > 1e9 && v < 1e12)  return formatHHMMFromDate(new Date(v * 1000));                      // epoch sec
    if (v >= 1e12)            return formatHHMMFromDate(new Date(v));                             // epoch ms
  }
  return null;
}

/* ========= RENDER ========= */
function renderList(rows) {
  const body = document.getElementById("sidsBody");
  if (!body) return;
  body.innerHTML = "";

  rows.forEach(it => {
    const aksi = (String(it.aksi || "")).trim();
    if (aksi) return;

    const passenger = (it.namaPemilik || it.nama || "-").toString().toUpperCase();
    const flight    = (it.flight || "-").toString().toUpperCase();

    const tsCandidate = [
      it.timestamp, it.waktu, it.jam, it.createdAt, it.created,
      it.tanggal, it.tanggalFull, it.A, it.a, it["0"]
    ].find(v => v != null && v !== "");

    const timeRaw = toHHMMFromAny(tsCandidate);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${timeRaw ? `<span class="time">${timeRaw}</span>` : "-"}</td>
      <td>${passenger}</td>
      <td>${flight}</td>
      <td>${translations[currentLang].status}</td>
    `;
    body.appendChild(tr);
  });
}

/* ========= FETCH ========= */
async function loadSuspectList() {
  try {
    const url = `${LOOKUP_URL}?action=list_suspect&token=${encodeURIComponent(SHARED_TOKEN)}&limit=200`;
    const r   = await fetch(url, { method: "GET", mode: "cors" });
    const j   = await r.json().catch(() => ({}));
    if (j?.ok && Array.isArray(j.rows)) {
      currentRows = j.rows;
      renderList(currentRows);
    }
  } catch (err) { console.error(err); }
}

/* ========= UI TEXT ========= */
function applyTranslations() {
  const t = translations[currentLang];
  document.title = t.title;
  document.documentElement.lang = currentLang;

  const pageTitleEl = document.getElementById("pageTitle");
  if (pageTitleEl) pageTitleEl.textContent = t.title;

  const headCells = [
    document.getElementById("thTime"),
    document.getElementById("thPassenger"),
    document.getElementById("thFlight"),
    document.getElementById("thStatus"),
  ];
  headCells.forEach((el, idx) => { if (el) el.textContent = t.headers[idx]; });

  const tick = document.getElementById("tickerText");
  if (tick) tick.textContent = t.ticker;
}

function toggleLanguage() {
  currentLang = currentLang === "id" ? "en" : "id";
  applyTranslations();
  renderList(currentRows);
}

/* ========= CLOCK ========= */
function updateClock() {
  const now  = new Date();
  const optsTime = { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" };
  const optsDate = { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" };
  const time = new Intl.DateTimeFormat("id-ID", optsTime).format(now).replace(".", ":");
  const date = new Intl.DateTimeFormat("id-ID", optsDate).format(now);
  const timeEl = document.getElementById("clockTime");
  const dateEl = document.getElementById("clockDate");
  if (timeEl) timeEl.innerHTML = `${time} <span class="wib">WIB</span>`;
  if (dateEl) dateEl.textContent = date;
}

/* ========= BOOT ========= */
document.addEventListener("DOMContentLoaded", () => {
  applyTranslations();
  loadSuspectList();
  setInterval(loadSuspectList, 30000);
  setInterval(toggleLanguage, 10000);
  updateClock();
  setInterval(updateClock, 1000);
});
