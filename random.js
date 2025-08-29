import { requireAuth } from "./auth-guard.js";
requireAuth({ loginPath: "index.html", hideWhileChecking: true });

const objekSel = document.getElementById("objek");
const barangCard = document.getElementById("barangCard");
objekSel.addEventListener("change", () => {
  if (objekSel.value === "barang") {
    barangCard.classList.remove("hidden");
  } else {
    barangCard.classList.add("hidden");
  }
});

const scanBtn = document.getElementById("scanBtn");
scanBtn.addEventListener("click", () => {
  // Placeholder scan logic
  const now = new Date();
  document.getElementById("namaPenumpang").textContent = "Penumpang";
  document.getElementById("noFlight").textContent = "XX000";
  document.getElementById("waktuScan").textContent = now.toLocaleString("id-ID");
});

document.getElementById("submitBtn").addEventListener("click", () => {
  // TODO: submission logic will be implemented later
});
