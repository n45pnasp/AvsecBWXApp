import { requireAuth } from "./auth-guard.js";

requireAuth({ loginPath: "index.html", hideWhileChecking: true });

const scanBtn  = document.getElementById("scanBtn");
const inputBtn = document.getElementById("inputBtn");

if (scanBtn) {
  scanBtn.addEventListener("click", () => {
    // TODO: logika scan QR
    console.log("Scan QR Code diklik");
  });
}

if (inputBtn) {
  inputBtn.addEventListener("click", () => {
    // TODO: logika input manual
    console.log("Input Data diklik");
  });
}

