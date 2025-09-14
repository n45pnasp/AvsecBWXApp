// check.js — terhubung ke Cloudflare Worker + code.gs (token diinjeksi di Worker)
import { requireAuth, getFirebase } from "./auth-guard.js";
import { capturePhoto, dataUrlToFile, makePhotoName } from "./camera.js";

// Lindungi halaman: wajib login
requireAuth({ loginPath: "index.html", hideWhileChecking: true });

/* ================== KONFIG API ================== */
const API_BASE = "https://dailycheck.avsecbwx2018.workers.dev/"; // Worker kamu
const CFN_DOWNLOAD_PDF_URL = "https://us-central1-avsecbwx-4229c.cloudfunctions.net/downloadPdf";

let allFaskampen = [];
let currentType = "STP";
let currentLookup = null; // hasil lookup meta (MERK, NO_SERTIFIKAT, LOKASI, layar)
const resultLabel = document.getElementById("resultLabel");

/* ================== UTIL ================== */
function formatNow() {
  const d = new Date();
  const dua = (n) => String(n).padStart(2, "0");
  const bulan = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember"
  ];
  return `${dua(d.getDate())} ${bulan[d.getMonth()]} ${d.getFullYear()} / ${dua(d.getHours())}:${dua(d.getMinutes())} WIB`;
}

function getPetugas() {
  const { auth } = getFirebase();
  const user = auth.currentUser;
  if (user && user.displayName) {
    localStorage.setItem("petugasName", user.displayName);
    return user.displayName;
  }
  const el = document.getElementById("petugas");
  if (el && el.value) return el.value.trim();
  const ls = localStorage.getItem("petugasName");
  if (ls) return ls;
  return "";
}

function showOverlay(state, title, desc) {
  const overlay = document.getElementById("overlay");
  const icon = document.getElementById("ovIcon");
  const tEl = document.getElementById("ovTitle");
  const dEl = document.getElementById("ovDesc");
  const close = document.getElementById("ovClose");
  overlay.classList.remove("hidden");
  icon.className =
    "icon " + (state === "loading" ? "spinner" : state === "ok" ? "ok" : "err");
  tEl.textContent = title;
  dEl.textContent = desc || "";
  close.classList.toggle("hidden", state === "loading");
  close.onclick = () => overlay.classList.add("hidden");
  if (state !== "loading") setTimeout(() => overlay.classList.add("hidden"), 1200);
}

function askConfirm(message = "Yakin?", { okText = "Yes", cancelText = "Batal" } = {}) {
  return new Promise((resolve) => {
    let modal = document.getElementById("jsConfirm");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "jsConfirm";
      modal.className = "hidden";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.innerHTML = `
        <div class="jsc-backdrop"></div>
        <div class="jsc-card">
          <button class="jsc-x" aria-label="Tutup" title="Tutup">×</button>
          <div class="jsc-msg"></div>
          <div class="jsc-actions">
            <button class="jsc-cancel" type="button"></button>
            <button class="jsc-ok" type="button"></button>
          </div>
        </div>`;
      const css = document.createElement("style");
      css.textContent = `
        #jsConfirm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9999}
        #jsConfirm.hidden{display:none}
        #jsConfirm .jsc-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.45);backdrop-filter:saturate(120%) blur(2px)}
        #jsConfirm .jsc-card{position:relative;max-width:360px;width:90%;background:#0f172a;color:#e5e7eb;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.35);padding:18px 16px 14px}
        #jsConfirm .jsc-msg{font-size:14px;line-height:1.5;margin:4px 6px 12px;white-space:pre-wrap}
        #jsConfirm .jsc-actions{display:flex;gap:8px;justify-content:flex-end;padding:0 6px}
        #jsConfirm button{appearance:none;border:0;border-radius:10px;padding:8px 12px;font-weight:600;cursor:pointer}
        #jsConfirm .jsc-cancel{background:#374151;color:#e5e7eb}
        #jsConfirm .jsc-ok{background:#ef4444;color:white}
        #jsConfirm button:active{transform:translateY(1px)}
        #jsConfirm .jsc-x{position:absolute;top:8px;right:8px;width:32px;height:32px;line-height:28px;border-radius:999px;background:#111827;color:#e5e7eb;font-size:20px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
        #jsConfirm .jsc-x:active{transform:scale(.98)}
        #jsConfirm, #jsConfirm *{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
      `;
      document.head.appendChild(css);
      document.body.appendChild(modal);
      modal.addEventListener("contextmenu", (e) => e.preventDefault());
    }
    const msgEl = modal.querySelector(".jsc-msg");
    const okBtn = modal.querySelector(".jsc-ok");
    const noBtn = modal.querySelector(".jsc-cancel");
    const xBtn = modal.querySelector(".jsc-x");

    msgEl.textContent = message;
    okBtn.textContent = okText;
    noBtn.textContent = cancelText;

    function close(val) {
      modal.classList.add("hidden");
      okBtn.removeEventListener("click", onOk);
      noBtn.removeEventListener("click", onNo);
      xBtn.removeEventListener("click", onNo);
      modal.removeEventListener("click", onBackdrop);
      resolve(val);
    }
    function onOk() { close(true); }
    function onNo() { close(false); }
    function onBackdrop(e) { if (e.target === modal) close(false); }

    modal.classList.remove("hidden");
    okBtn.addEventListener("click", onOk);
    noBtn.addEventListener("click", onNo);
    xBtn.addEventListener("click", onNo);
    modal.addEventListener("click", onBackdrop);
    setTimeout(() => okBtn.focus?.(), 0);
  });
}

function updateResult() {
  let pass = false;
  if (currentType === "STP") pass = checkSTPPass();
  else if (currentType === "OTP") pass = checkOTPPass();
  else if (currentType === "HHMD") pass = checkHHMDPass();
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
  const cbs = Array.from(container.querySelectorAll('input[type="checkbox"]'));
  const out = {};
  for (let i = 0; i < Math.min(count, cbs.length); i++) {
    out[`${prefix}${i + 1}`] = cbs[i].checked;
  }
  return out;
}

function getCheckedNumbers(container) {
  return Array.from(container.querySelectorAll('label')).filter((lab) => {
    const cb = lab.querySelector('input');
    return cb && cb.checked;
  }).map((lab) => parseInt(lab.querySelector('span').textContent, 10));
}

function checkSet(required, checked) {
  return required.every((n) => checked.includes(n));
}

function checkSTPPass() {
  const select = document.getElementById('faskampen');
  const val = (select.value || '').toUpperCase();
  const layarVal =
    currentLookup && currentLookup.layar
      ? currentLookup.layar.trim().toUpperCase()
      : '';
  const setPSCP = [1,2,3,4,5,6,7,9,17,19,20,21,22,23,24,30,31,32,33,35];
  const setHBSCPsingle = [1,2,3,4,5,6,17,19,20,21,22,23,30,31,32,35];
  const setHBSCPdual = [1,2,3,4,5,6,17,19,20,21,22,23,30,31,35];
  let required;
  if (val.includes('PSCP')) required = setPSCP;
  else if (val.includes('HBSCP') || val.includes('CARGO')) {
    required = layarVal === 'DUAL VIEW' ? setHBSCPdual : setHBSCPsingle;
  } else return false;
  const nums1 = getCheckedNumbers(document.getElementById('dynamicContent1'));
  if (layarVal === 'DUAL VIEW') {
    const nums2 = getCheckedNumbers(document.getElementById('dynamicContent2'));
    return checkSet(required, nums1) && checkSet(required, nums2);
  }
  return checkSet(required, nums1);
}

function checkOTPPass() {
  const c1 = document.getElementById('dynamicContent1');
  const cbs = c1.querySelectorAll('input[type="checkbox"]');
  return Array.from(cbs).slice(0,8).every((cb) => cb.checked);
}

function checkHHMDPass() {
  const select = document.getElementById('faskampen');
  const val = (select.value || '').toUpperCase();
  const c1 = document.getElementById('dynamicContent1');
  const cbs = c1.querySelectorAll('input[type="checkbox"]');
  if (val.includes('ETD')) {
    return cbs.length >= 2 && cbs[0].checked && cbs[1].checked;
  }
  return cbs.length >= 3 && cbs[0].checked && cbs[1].checked && cbs[2].checked;
}

function populateChecks(wrap) {
  const rows = 9, cols = 4;
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

function setupPhoto(btnId, inputId, previewId, infoId, statusId, nameId, idx) {
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const info = document.getElementById(infoId);
  const status = document.getElementById(statusId);
  const name = document.getElementById(nameId);

  btn.addEventListener("click", async () => {
    try {
      const dataUrl = await capturePhoto();
      if (!dataUrl) return;
      const fileName = makePhotoName(null, idx);
      const file = dataUrlToFile(dataUrl, fileName);
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dataset.filename = file.name;
      preview.src = dataUrl;
      status.textContent = "Foto siap diunggah";
      name.textContent = file.name;
      info.classList.remove("hidden");
    } catch (e) {
      console.error(e);
    }
  });

  input.addEventListener('change', () => {
    const fname = makePhotoName(null, idx);
    input.dataset.filename = fname;
    const n = document.getElementById(nameId);
    if (n) n.textContent = fname;
  });
}

function fileToDataURL(inputId) {
  const input = document.getElementById(inputId);
  const file = input && input.files ? input.files[0] : null;
  if (!file) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

function getFileName(inputId){
  const input = document.getElementById(inputId);
  return input?.dataset.filename || (input?.files?.[0]?.name || "");
}

function resetForm() {
  const select = document.getElementById("faskampen");
  select.value = "";
  currentLookup = null;

  document.getElementById("resultCard").classList.add("hidden");
  document.getElementById("photoBtn1").classList.add("hidden");
  document.getElementById("photoBtn2").classList.add("hidden");
  document.getElementById("uploadInfo1").classList.add("hidden");
  document.getElementById("uploadInfo2").classList.add("hidden");

  ["fileInput1", "fileInput2"].forEach((id) => {
    const el = document.getElementById(id);
    if (el){ el.value = ""; el.dataset.filename = ""; }
  });
  ["preview1", "preview2"].forEach((id) => {
    const img = document.getElementById(id);
    if (img) img.src = "";
  });

  ["dynamicContent1", "dynamicContent2"].forEach((id) => {
    const cont = document.getElementById(id);
    cont.querySelectorAll('input[type="checkbox"]').forEach((cb) => (cb.checked = false));
  });

  updateSecondPanelVisibility();
  updateHHMDView();
  updateResult();

  const pdfBtn = document.getElementById("downloadPdfBtn");
  if (pdfBtn){
    pdfBtn.disabled = true;
    pdfBtn.classList.add("hidden");
  }
}

function renderHHMD(target, isETD = false) {
  const cols = isETD ? 2 : 3;
  const headers = [], body = [];
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
  const resultCard = document.getElementById("resultCard");
  const select = document.getElementById("faskampen");
  const uploadInfo1 = document.getElementById("uploadInfo1");
  const uploadInfo2 = document.getElementById("uploadInfo2");

  function renderSTP(target) {
    target.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "card subcard grid-checks";
    populateChecks(grid);
    target.appendChild(grid);
    bindChecks(target);
  }

  function renderOTP(target) {
    const pos = [
      "Lengan Kanan<br/>Bagian Dalam",
      "Pinggang Kanan",
      "Pinggang Belakang<br/>Bagian Tengah",
      "Pergelangan Kaki<br/>Bagian Kanan"
    ];
    const body = pos.map((p, i) => {
      const numIn = i * 2 + 1;
      const numOut = i * 2 + 2;
      return `
      <tr><td rowspan="2">${p}</td><td>IN</td><td><label><input type="checkbox" /><span class="row-num">${numIn}</span></label></td></tr>
      <tr><td>OUT</td><td><label><input type="checkbox" /><span class="row-num">${numOut}</span></label></td></tr>
    `;
    }).join("");
    const html = `
      <table class="check-table">
        <thead>
          <tr>
            <th>POSISI TEST</th>
            <th>TIPE<br/>KNIFE 304</th>
            <th>
              <div class="col-test-title">HASIL TES</div>
              <span class="status-sample">☑</span> Alarm<br/>
              <span class="status-sample">☐</span> No Alarm
            </th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
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
    select.value = "";
    resultCard.classList.add("hidden");
    photoBtn1.classList.add("hidden");
    photoBtn2.classList.add("hidden");
    uploadInfo1.classList.add("hidden");
    uploadInfo2.classList.add("hidden");
    updateDropdown();
    updateSecondPanelVisibility();
    updateHHMDView();
    updateResult();

    const pdfBtn = document.getElementById("downloadPdfBtn");
    if (pdfBtn){
      pdfBtn.disabled = true;
      pdfBtn.classList.add("hidden");
    }
  }

  buttons.forEach((btn) => btn.addEventListener("click", () => handle(btn)));
  handle(document.getElementById("btnSTP"));
}

/* ================== API ================== */
async function apiOptions() {
  const res = await fetch(`${API_BASE}?action=options`, { method: "GET" });
  let data;
  try { data = await res.json(); }
  catch { throw new Error("Response bukan JSON"); }
  if (Array.isArray(data)) return data;
  if (data && data.ok && Array.isArray(data.options)) return data.options;
  throw new Error("Format options tidak valid");
}

async function apiLookup(key) {
  const url = `${API_BASE}?action=lookup&key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: "GET" });
  let data;
  try { data = await res.json(); }
  catch { throw new Error("Response bukan JSON"); }
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
  let data;
  try { data = await res.json(); }
  catch { throw new Error("Response bukan JSON"); }
  if (!data.ok) throw new Error(data.error || "Submit gagal");
  return data;
}

/* ================== DROPDOWN ================== */
function updateDropdown() {
  const select = document.getElementById("faskampen");
  select.innerHTML = '<option value="" selected>Pilih Faskampen</option>';
  if (!allFaskampen.length) return;

  let prefixes;
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
  showOverlay("loading", "Mengambil data…", "");
  try {
    const options = await apiOptions();
    allFaskampen = options;
    updateDropdown();
    document.getElementById("overlay").classList.add("hidden");
  } catch (err) {
    showOverlay("err", "Gagal memuat", err.message || "Coba lagi");
  }
}

/* ============ Mapping dropdown → site (Cloud Functions) ============ */
function siteKeyForDropdown(dropdownName) {
  const s = String(dropdownName || "").toUpperCase();

  if (s === "PSCP DOM RAPISCAN 620DV")   return "STP_DV_PSCP_DOM";
  if (s === "PSCP INTER RAPISCAN 620XR") return "STP_OV_PSCP_INTER";
  if (s === "HBSCP DOM RAPISCAN 628DV")  return "STP_DV_HBSCP_DOM";
  if (s === "HBSCP INTER NUCTECH")       return "STP_DV_HBSCP_INTER";
  if (s === "CARGO SMITH HISCAN")        return "STP_DV_CARGO";

  if (s.startsWith("WTMD"))              return "WTMD_PSCP";
  if (s.startsWith("ETD"))               return "ETD";

  if (s === "HHMD GARRETT PSCP" || s === "HHMD CEIA PSCP")   return "OTP_HHMD_PSCP";
  if (s === "HHMD GARRETT HBSCP"|| s === "HHMD CEIA HBSCP")  return "OTP_HHMD_HBSCP";
  if (s === "HHMD GARRETT ARRIVAL")                          return "OTP_HHMD_ARRIVAL";
  if (s === "HHMD GARRETT POS 1")                            return "OTP_HHMD_POS1";

  return "";
}

/* ================== SUBMIT ================== */
function initSubmit() {
  const select = document.getElementById("faskampen");
  const pdfBtn = document.getElementById("downloadPdfBtn");

  select.addEventListener("change", async () => {
    const key = select.value;
    if (pdfBtn){
      const hasKey = !!key;
      pdfBtn.disabled = !hasKey;
      pdfBtn.classList.toggle("hidden", !hasKey);
    }
    if (key) {
      try {
        showOverlay("loading", "Mengambil data…", "");
        currentLookup = await apiLookup(key);
        showOverlay("ok", "Data ditemukan", "");
      } catch (err) {
        currentLookup = null;
        showOverlay("err", "Lookup gagal", err.message || "Coba lagi");
      }
    } else {
      currentLookup = null;
    }
    const show = !!key && !!currentLookup;
    const card = document.getElementById("resultCard");
    const btn1 = document.getElementById("photoBtn1");
    const btn2 = document.getElementById("photoBtn2");
    card.classList.toggle("hidden", !show);
    btn1.classList.toggle("hidden", !show);
    btn2.classList.toggle("hidden", !show);
    if (!show) {
      document.getElementById("uploadInfo1").classList.add("hidden");
      document.getElementById("uploadInfo2").classList.add("hidden");
    }
    updateSecondPanelVisibility();
    updateHHMDView();
    updateResult();
  });

  document.getElementById("submitBtn").addEventListener("click", async () => {
    try {
      const key = select.value;
      if (!key) return alert("Pilih Faskampen terlebih dahulu!");

      const passBool = resultLabel.dataset.pass === "true";
      const failBool = !passBool;

      if (!passBool) {
        const proceed = await askConfirm("HASIL FAIL, ANDA TETAP MENGIRIM DATA?", { okText: "Yes", cancelText: "Batal" });
        if (!proceed) return;
      }

      const petugas = getPetugas();
      const date = formatNow();

      const gbr1 = await fileToDataURL("fileInput1");
      const gbr2 = await fileToDataURL("fileInput2");
      const gbr = gbr1 || gbr2;
      const gbr1Name = getFileName("fileInput1");
      const gbr2Name = getFileName("fileInput2");

      const payload = {
        dropdown: key, petugas, date,
        pass: passBool, fail: failBool,
        gbr1, gbr2, gbr,
        ...(gbr1 ? { gbr1Name } : {}),
        ...(gbr2 ? { gbr2Name } : {})
      };

      if (currentLookup) {
        if (currentLookup.MERK) payload.merk = currentLookup.MERK;
        if (currentLookup.LOKASI) payload.lokasi = currentLookup.LOKASI;
        if (currentLookup.NO_SERTIFIKAT) payload.noSertifikat = currentLookup.NO_SERTIFIKAT;
      }

      const c1 = document.getElementById("dynamicContent1");
      const c2 = document.getElementById("dynamicContent2");

      if (currentType === "STP") {
        Object.assign(payload, readChecks(c1, "k", 36));
        if (!c2.classList.contains('hidden')) {
          Object.assign(payload, readChecks(c2, "x", 36));
        } else {
          const kVals = readChecks(c1, "k", 36);
          for (let i = 1; i <= 36; i++) payload["x" + i] = !!kVals["k" + i];
        }
      } else if (currentType === "OTP") {
        Object.assign(payload, readChecks(c1, "k", 8));
        payload.gbr = gbr;
      } else if (currentType === "HHMD") {
        Object.assign(payload, readChecks(c1, "k", 3));
        payload.gbr = gbr;
      }

      showOverlay("loading", "Mengirim data…", "");
      await apiSubmit(payload);
      showOverlay("ok", "Data Berhasil di kirim", "");
      resetForm();
    } catch (err) {
      showOverlay("err", "Gagal mengirim", err.message || "Coba lagi");
      console.error(err);
    }
  });
}

/* ================== DOWNLOAD PDF (Cloud Functions) ================== */
function initPdfDownload() {
  const pdfBtn = document.getElementById("downloadPdfBtn");
  if (!pdfBtn) return;

  pdfBtn.addEventListener("click", async () => {
    try {
      const select = document.getElementById("faskampen");
      const key = select.value;
      if (!key) return alert("Pilih Faskampen dahulu.");

      const site = siteKeyForDropdown(key);
      if (!site) return alert("Sheet untuk PDF belum dipetakan.");

      const { auth } = getFirebase();
      const user = auth.currentUser;
      if (!user) return alert("Silakan login ulang.");
      const idToken = await user.getIdToken(true);
      showOverlay("loading", "Mengunduh PDF…", "");

      const url = `${CFN_DOWNLOAD_PDF_URL}?site=${encodeURIComponent(site)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Gagal export (${res.status}). ${txt}`);
      }

      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);

      const text = select.options[select.selectedIndex]?.text || "";
      const words = text.trim().split(/\s+/);
      const base = words.slice(0, 2).join("_").toUpperCase();
      const d = new Date();
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const fname = `${base}_${dd}${mm}${yyyy}.pdf`;
      a.download = fname;

      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      showOverlay("ok", "Download dimulai", "");
    } catch (err) {
      console.error(err);
      showOverlay("err", "Download gagal", err.message || "Coba lagi");
    }
  });
}

/* ================== STARTUP ================== */
document.addEventListener("DOMContentLoaded", () => {
  setupPhoto("photoBtn1", "fileInput1", "preview1", "uploadInfo1", "uploadStatus1", "uploadName1", 1);
  setupPhoto("photoBtn2", "fileInput2", "preview2", "uploadInfo2", "uploadStatus2", "uploadName2", 2);
  initTypeButtons();
  initSubmit();
  initPdfDownload();
  loadFaskampen();
});

