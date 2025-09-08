// check.js — terhubung ke Cloudflare Worker + code.gs (token diinjeksi di Worker)
import { requireAuth } from "./auth-guard.js";

// Lindungi halaman: wajib login
requireAuth({ loginPath: "index.html", hideWhileChecking: true });

/* ================== KONFIG API ================== */
const API_BASE = "https://dailycheck.avsecbwx2018.workers.dev/"; // Worker kamu
let allFaskampen = [];
let currentType = "STP";
let currentLookup = null; // hasil lookup meta (MERK, NO_SERTIFIKAT, LOKASI, layar)
const resultLabel = document.getElementById("resultLabel");

/* ================== UTIL ================== */
function formatNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getPetugas() {
  // Coba ambil dari input#petugas bila ada, kalau tidak ambil dari localStorage, terakhir kosong
  const el = document.getElementById("petugas");
  if (el && el.value) return el.value.trim();
  const ls = localStorage.getItem("petugasName");
  if (ls) return ls;
  return "";
}

function updateResult() {
  const allChecks = document.querySelectorAll(
    '#dynamicContent1 input[type="checkbox"], #dynamicContent2:not(.hidden) input[type="checkbox"]'
  );
  const total = allChecks.length;
  const checked = Array.from(allChecks).filter((cb) => cb.checked).length;
  const pass = total > 0 && checked === total;
  resultLabel.textContent = `HASIL FASKAMPEN : ${pass ? "PASS" : "FAIL"}`;
  resultLabel.dataset.pass = pass;
  return pass;
}

function updateSecondPanelVisibility() {
  const wrap2 = document.getElementById('imageWrap2');
  const content2 = document.getElementById('dynamicContent2');
  const photoBtn1 = document.getElementById('photoBtn1');
  const photoBtn2 = document.getElementById('photoBtn2');
  const uploadInfo2 = document.getElementById('uploadInfo2');
  const layarVal =
    currentLookup && currentLookup.layar
      ? currentLookup.layar.trim().toUpperCase()
      : '';
  const show = currentType === 'STP' && layarVal === 'DUAL VIEW';
  if (show) {
    wrap2.classList.remove('hidden');
    content2.classList.remove('hidden');
    photoBtn2.classList.remove('hidden');
    photoBtn1.textContent = 'Layar Kiri';
  } else {
    wrap2.classList.add('hidden');
    content2.classList.add('hidden');
    photoBtn2.classList.add('hidden');
    uploadInfo2.classList.add('hidden');
    if (currentType === 'STP') {
      if (currentLookup) {
        photoBtn1.textContent = layarVal ? 'Layar Kiri' : 'Foto Layar';
      } else {
        photoBtn1.textContent = 'Layar Kiri';
      }
    }
  }
  updateResult();
}

function bindChecks(container) {
  container
    .querySelectorAll('input[type="checkbox"]')
    .forEach((cb) => cb.addEventListener("change", updateResult));
}

function readChecks(container, prefix, count) {
  // return objek {prefix1:bool, prefix2:bool, ...}
  const cbs = Array.from(container.querySelectorAll('input[type="checkbox"]'));
  const out = {};
  for (let i = 0; i < Math.min(count, cbs.length); i++) {
    out[`${prefix}${i + 1}`] = cbs[i].checked;
  }
  return out;
}

function populateChecks(wrap) {
  // 36 checkbox (9x4) untuk STP
  const rows = 9;
  const cols = 4;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const num = r + c * rows + 1;
      const label = document.createElement("label");
      const span = document.createElement("span");
      span.textContent = num;
      const cb = document.createElement("input");
      cb.type = "checkbox";
      label.appendChild(span);
      label.appendChild(cb);
      wrap.appendChild(label);
    }
  }
}

function setupPhoto(btnId, inputId, previewId, infoId, statusId, nameId) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const info = document.getElementById(infoId);
  const status = document.getElementById(statusId);
  const name = document.getElementById(nameId);

  btn.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    preview.src = URL.createObjectURL(file);
    status.textContent = "Foto siap diunggah";
    name.textContent = file.name;
    info.classList.remove("hidden");
  });
}

function fileToDataURL(inputId) {
  const input = document.getElementById(inputId);
  const file = input && input.files ? input.files[0] : null;
  if (!file) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result); // dataURL
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

function renderHHMD(target, isETD = false) {
  const cols = isETD ? 2 : 3;
  const headers = [];
  const body = [];
  for (let i = 1; i <= cols; i++) {
    headers.push(`<td>TEST ${i}</td>`);
    body.push('<td><input type="checkbox" /></td>');
  }
  target.innerHTML = `
      <table class="check-table hhmd-table">
        <tbody>
          <tr>${headers.join("")}</tr>
          <tr>${body.join("")}</tr>
        </tbody>
      </table>`;
  bindChecks(target);
}

function updateHHMDView() {
  if (currentType !== "HHMD") return;
  const select = document.getElementById("faskampen");
  const val = (select.value || "").toUpperCase();
  const isETD = val.includes("ETD");
  const img1 = document.getElementById("typeImage1");
  const img2 = document.getElementById("typeImage2");
  const src = isETD ? "icons/etd.png" : "icons/hhmd.png";
  img1.src = src;
  img2.src = src;
  const c1 = document.getElementById("dynamicContent1");
  const c2 = document.getElementById("dynamicContent2");
  renderHHMD(c1, isETD);
  renderHHMD(c2, isETD);
  updateResult();
}

/* ================== RENDER DINAMIS ================== */
function initTypeButtons() {
  const buttons = document.querySelectorAll(".type-btn");
  const img1 = document.getElementById("typeImage1");
  const img2 = document.getElementById("typeImage2");
  const content1 = document.getElementById("dynamicContent1");
  const content2 = document.getElementById("dynamicContent2");
  const photoBtn1 = document.getElementById("photoBtn1");
  const photoBtn2 = document.getElementById("photoBtn2");

  function renderSTP(target) {
    target.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "card subcard grid-checks";
    populateChecks(grid);
    target.appendChild(grid);
    bindChecks(target);
  }

  function renderOTP(target) {
    // OTP di sini = WTMD (8 checkbox)
    const pos = [
      "Lengan Kanan<br/>Bagian Dalam",
      "Pinggang Kanan",
      "Pinggang Belakang<br/>Bagian Tengah",
      "Pergelangan Kaki<br/>Bagian Kanan"
    ];
    let idx = 1;
    const body = pos
      .map(
        (p) => `
          <tr><td rowspan="2">${p}</td><td>IN</td><td><label><span>${idx++}</span><input type="checkbox" /></label></td></tr>
          <tr><td>OUT</td><td><label><span>${idx++}</span><input type="checkbox" /></label></td></tr>
        `
      )
      .join("");
    const html = `
      <table class="check-table">
        <thead>
          <tr>
            <th>POSISI TEST</th>
            <th>TIPE<br/>KNIFE 304</th>
            <th>HASIL TEST<br/>centang=Alarm<br/>Kosong=No Alarm</th>
          </tr>
        </thead>
        <tbody>
          ${body}
        </tbody>
      </table>`;
    target.innerHTML = html;
    bindChecks(target);
  }

  function handle(btn) {
    buttons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    if (btn.id === "btnSTP") {
      currentType = "STP";
      img1.src = "icons/stp.png";
      img2.src = "icons/stp.png";
      photoBtn1.textContent = "Layar Kiri";
      photoBtn2.textContent = "Layar Kanan";
      renderSTP(content1);
      renderSTP(content2);
    } else if (btn.id === "btnOTP") {
      currentType = "OTP"; // WTMD
      img1.src = "icons/otp.png";
      img2.src = "icons/otp.png";
      photoBtn1.textContent = "Foto Dokumentasi";
      photoBtn2.textContent = "Foto Dokumentasi";
      renderOTP(content1);
      renderOTP(content2);
    } else if (btn.id === "btnHHMD") {
      currentType = "HHMD";
      img1.src = "icons/hhmd.png";
      img2.src = "icons/hhmd.png";
      photoBtn1.textContent = "Foto Dokumentasi";
      photoBtn2.textContent = "Foto Dokumentasi";
      renderHHMD(content1);
      renderHHMD(content2);
    }

    currentLookup = null;
    updateDropdown();
    updateSecondPanelVisibility();
    updateHHMDView();
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => handle(btn));
  });

  handle(document.getElementById("btnSTP"));
}

/* ================== API ================== */
async function apiOptions() {
  const res = await fetch(`${API_BASE}?action=options`, { method: "GET" });
  const data = await res.json();
  // code.gs mengembalikan {ok, options:[...]}
  if (Array.isArray(data)) return data;
  if (data && data.ok && Array.isArray(data.options)) return data.options;
  throw new Error("Format options tidak valid");
}

async function apiLookup(key) {
  const url = `${API_BASE}?action=lookup&key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: "GET" });
  const data = await res.json();
  if (data && data.ok) return data;
  throw new Error(data && data.error ? data.error : "Lookup gagal");
}

async function apiSubmit(payload) {
  const body = { action: "submit", payload };
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Submit gagal");
  return data;
}

/* ================== DROPDOWN ================== */
function updateDropdown() {
  const select = document.getElementById("faskampen");
  select.innerHTML = '<option value="" selected>Pilih Faskampen</option>';
  if (!allFaskampen.length) return;

  // Filter nama berdasar type
  let prefixes;
  // Sesuai pilihan Novan sebelumnya:
  // STP -> PSCP/HBSCP/CARGO
  // OTP (WTMD) -> WTMD
  // HHMD -> HHMD dan ETD (kalau ingin menampilkan ETD di tab HHMD)
  if (currentType === "OTP") prefixes = ["WTMD"];
  else if (currentType === "HHMD") prefixes = ["HHMD", "ETD"];
  else prefixes = ["PSCP", "HBSCP", "CARGO"];

  const opts = allFaskampen.filter((name) =>
    prefixes.some((p) => name.toUpperCase().startsWith(p))
  );

  for (const name of opts) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  }
}

async function loadFaskampen() {
  try {
    const options = await apiOptions();
    allFaskampen = options;
    updateDropdown();
  } catch (err) {
    console.error("Gagal memuat faskampen", err);
  }
}

/* ================== SUBMIT ================== */
function initSubmit() {
  const overlay = document.getElementById("overlay");
  const select = document.getElementById("faskampen");

  // simpan lookup ketika user memilih dropdown
  select.addEventListener("change", async () => {
    const key = select.value;
    currentLookup = key ? await apiLookup(key) : null;
    updateSecondPanelVisibility();
    updateHHMDView();
  });

  document.getElementById("submitBtn").addEventListener("click", async () => {
    try {
      const key = select.value;
      if (!key) return alert("Pilih Faskampen terlebih dahulu!");

      // pass/fail dari label
      const passBool = resultLabel.dataset.pass === "true";
      const failBool = !passBool;

      // ambil tanggal & petugas
      const petugas = getPetugas();
      const date = formatNow();

      // gambar (dataURL)
      const gbr1 = await fileToDataURL("fileInput1");
      const payload = {
        dropdown: key,
        petugas,
        date,
        pass: passBool,
        fail: failBool,
        gbr1
      };
      if (currentType === "STP") {
        payload.gbr2 = await fileToDataURL("fileInput2");
      }

      // tambahkan MERK dari lookup bila ada (dibutuhkan OTP/ETD)
      if (currentLookup && currentLookup.MERK) {
        payload.merk = currentLookup.MERK;
      }

      // kumpulkan checkbox sesuai type
      const c1 = document.getElementById("dynamicContent1");
      const c2 = document.getElementById("dynamicContent2");

      if (currentType === "STP") {
        Object.assign(payload, readChecks(c1, "k", 36)); // k1..k36
        if (!c2.classList.contains('hidden')) {
          Object.assign(payload, readChecks(c2, "x", 36)); // x1..x36
        }
      } else if (currentType === "OTP") {
        // WTMD: 8 checkbox k1..k8 (ambil dari panel 1 saja)
        Object.assign(payload, readChecks(c1, "k", 8));
      } else if (currentType === "HHMD") {
        // HHMD: 3 checkbox k1..k3
        Object.assign(payload, readChecks(c1, "k", 3));
      }

      // kirim ke backend via Worker
      overlay.classList.remove("hidden");
      const resp = await apiSubmit(payload);
      overlay.classList.add("hidden");

      alert(`Data terkirim ke sheet: ${resp.routedTo}`);

      // reset foto (opsional)
      // document.getElementById('uploadInfo1').classList.add('hidden');
      // document.getElementById('uploadInfo2').classList.add('hidden');
    } catch (err) {
      overlay.classList.add("hidden");
      console.error(err);
      alert("Gagal mengirim data: " + err.message);
    }
  });
}

/* ================== STARTUP ================== */
document.addEventListener("DOMContentLoaded", () => {
  setupPhoto("photoBtn1", "fileInput1", "preview1", "uploadInfo1", "uploadStatus1", "uploadName1");
  setupPhoto("photoBtn2", "fileInput2", "preview2", "uploadInfo2", "uploadStatus2", "uploadName2");
  initTypeButtons();
  initSubmit();
  loadFaskampen();
});

