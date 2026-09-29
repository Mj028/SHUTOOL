const STORAGE_KEY = "shuttler_mvp_v1";

const defaultState = {
  fare: 200,
  studentBalance: 2000,
  creditBalance: 300,
  driverBalance: 4850,
  pendingClaims: [
    { id: "CLM-1001", student: "Joseph", driver: "Adewale", cashGiven: 500, fare: 200, amount: 300, status: "Pending", time: "Today, 12:42 PM" }
  ],
  drivers: [
    { name: "Adewale", id: "SH-DRV-001", status: "Approved" },
    { name: "Chinedu", id: "SH-DRV-002", status: "Approved" },
    { name: "Fatima", id: "SH-DRV-003", status: "Approved" },
    { name: "Emeka", id: "SH-DRV-004", status: "Pending" }
  ],
  transactions: [
    { type: "Digital fare", detail: "Adewale · SH-DRV-001", amount: -200, time: "Today, 11:30 AM" },
    { type: "Change credit", detail: "Driver confirmation pending", amount: 300, time: "Today, 12:42 PM", status: "Pending" }
  ]
};

let state = loadState();
let scannerStream = null;
let scannerRunning = false;
let toastTimer = null;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? saved : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function naira(value) {
  return "₦" + Number(value || 0).toLocaleString("en-NG");
}

function showToast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

function switchRole(role) {
  document.querySelectorAll(".role-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.role === role));
  document.querySelectorAll(".role-view").forEach(view => view.classList.remove("active"));
  document.getElementById(role + "View").classList.add("active");
  if (role === "driver") renderDriver();
  if (role === "admin") renderAdmin();
  if (role === "student") renderStudent();
}

function openModal(id) {
  document.getElementById(id).classList.add("open");
  if (id === "useCreditModal") updateCreditCalculation();
  if (id === "cashModal") calculateChange();
}

function closeModal(id) {
  document.getElementById(id).classList.remove("open");
  if (id === "scanModal") stopScanner();
}

function renderStudent() {
  document.getElementById("studentBalance").textContent = naira(state.studentBalance);
  document.getElementById("creditBalance").textContent = naira(state.creditBalance);
  document.getElementById("creditActionText").textContent = naira(state.creditBalance) + " confirmed";
  document.getElementById("fareDisplay").textContent = naira(state.fare);
  document.getElementById("cashFare").textContent = naira(state.fare);
  document.getElementById("creditFare").textContent = naira(state.fare);
  renderStudentTransactions();
  updateCreditCalculation();
}

function renderStudentTransactions() {
  const list = document.getElementById("studentTransactions");
  const rows = [...state.transactions].slice(-6).reverse();
  list.innerHTML = rows.map(t => `
    <div class="transaction">
      <div class="transaction-left">
        <div class="transaction-icon">${t.type === "Change credit" ? "₦" : "→"}</div>
        <div><strong>${t.type}</strong><small>${t.detail} · ${t.time}</small></div>
      </div>
      <span class="amount ${t.amount >= 0 ? "plus" : "minus"}">${t.amount >= 0 ? "+" : ""}${naira(t.amount)}</span>
    </div>
  `).join("");
}

function renderDriver() {
  document.getElementById("driverBalance").textContent = naira(state.driverBalance);
  const pending = state.pendingClaims.filter(c => c.status === "Pending");
  document.getElementById("claimCountBadge").textContent = `${pending.length} pending`;

  const claimBox = document.getElementById("driverClaims");
  if (!pending.length) {
    claimBox.innerHTML = `<div class="empty">No pending change claims. You're all caught up.</div>`;
  } else {
    claimBox.innerHTML = pending.map(c => `
      <div class="claim">
        <div class="claim-top">
          <strong>${naira(c.amount)} change claimed</strong>
          <span class="badge pending">Pending</span>
        </div>
        <p><b>${c.student}</b> says they gave ${naira(c.cashGiven)} for a ${naira(c.fare)} fare on your shuttle. This claim needs your confirmation.</p>
        <div class="claim-actions">
          <button class="confirm-btn" onclick="confirmClaim('${c.id}')">Confirm</button>
          <button class="reject-btn" onclick="rejectClaim('${c.id}')">Reject</button>
        </div>
      </div>
    `).join("");
  }

  const list = document.getElementById("driverTransactions");
  list.innerHTML = state.transactions.slice(-6).reverse().map(t => `
    <div class="transaction">
      <div class="transaction-left">
        <div class="transaction-icon">₦</div>
        <div><strong>${t.type}</strong><small>${t.detail} · ${t.time}</small></div>
      </div>
      <span class="amount ${t.amount >= 0 ? "plus" : "minus"}">${t.amount >= 0 ? "+" : ""}${naira(t.amount)}</span>
    </div>
  `).join("");
}

function renderAdmin() {
  const approved = state.drivers.filter(d => d.status === "Approved").length;
  const pending = state.drivers.filter(d => d.status === "Pending").length;
  const openClaims = state.pendingClaims.filter(c => c.status === "Pending").length;
  document.getElementById("approvedDrivers").textContent = approved;
  document.getElementById("pendingDrivers").textContent = pending;
  document.getElementById("transactionCount").textContent = state.transactions.length;
  document.getElementById("openClaims").textContent = openClaims;
  document.getElementById("openClaims").textContent = openClaims;
  document.getElementById("fareDisplay").textContent = naira(state.fare);

  document.getElementById("driverQueue").innerHTML = state.drivers.map(d => `
    <div class="queue-item">
      <div class="queue-info">
        <strong>${d.name}</strong>
        <small>${d.id} · ${d.status}</small>
      </div>
      ${d.status === "Pending"
        ? `<button class="approve-btn" onclick="approveDriver('${d.id}')">Approve</button>`
        : `<span class="badge confirmed">Approved</span>`}
    </div>
  `).join("");

  document.getElementById("adminLedger").innerHTML = state.transactions.slice(-8).reverse().map(t => `
    <div class="transaction">
      <div class="transaction-left">
        <div class="transaction-icon">↔</div>
        <div><strong>${t.type}</strong><small>${t.detail} · ${t.time}</small></div>
      </div>
      <span class="amount ${t.amount >= 0 ? "plus" : "minus"}">${t.amount >= 0 ? "+" : ""}${naira(t.amount)}</span>
    </div>
  `).join("");
}

function calculateChange() {
  const cash = Number(document.getElementById("cashGiven").value || 0);
  const change = Math.max(0, cash - state.fare);
  document.getElementById("cashFare").textContent = naira(state.fare);
  document.getElementById("changeOwed").textContent = naira(change);
}

function submitChangeClaim() {
  const cash = Number(document.getElementById("cashGiven").value || 0);
  const driver = document.getElementById("cashDriver").value;
  const change = cash - state.fare;

  if (cash <= state.fare) {
    showToast("Cash given must be greater than the official fare.");
    return;
  }

  const claim = {
    id: "CLM-" + Math.floor(1000 + Math.random() * 9000),
    student: "Joseph",
    driver,
    cashGiven: cash,
    fare: state.fare,
    amount: change,
    status: "Pending",
    time: new Date().toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })
  };

  state.pendingClaims.push(claim);
  state.transactions.push({
    type: "Change credit",
    detail: `${driver} · Driver confirmation pending`,
    amount: change,
    time: claim.time,
    status: "Pending"
  });
  saveState();
  closeModal("cashModal");
  renderAll();
  showToast(`₦${change.toLocaleString()} change claim sent to ${driver}.`);
}

function confirmClaim(id) {
  const claim = state.pendingClaims.find(c => c.id === id);
  if (!claim) return;
  claim.status = "Confirmed";
  state.creditBalance += claim.amount;

  const tx = state.transactions.find(t => t.type === "Change credit" && t.detail.includes("pending"));
  if (tx) {
    tx.detail = `${claim.driver} · Confirmed by driver`;
    tx.status = "Confirmed";
  }

  saveState();
  renderAll();
  showSuccess(
    "Change credit confirmed",
    `${naira(claim.amount)} is now confirmed and can be used with any approved driver.`,
    [
      ["Claim ID", claim.id],
      ["Driver", claim.driver],
      ["Amount", naira(claim.amount)],
      ["Status", "CONFIRMED"]
    ]
  );
}

function rejectClaim(id) {
  const claim = state.pendingClaims.find(c => c.id === id);
  if (!claim) return;
  claim.status = "Rejected";
  const tx = state.transactions.find(t => t.type === "Change credit" && t.detail.includes("pending"));
  if (tx) {
    tx.detail = `${claim.driver} · Rejected by driver`;
    tx.status = "Rejected";
  }
  saveState();
  renderAll();
  showToast("Claim rejected. No credit was created.");
}

function updateCreditCalculation() {
  const after = Math.max(0, state.creditBalance - state.fare);
  document.getElementById("creditBefore").textContent = naira(state.creditBalance);
  document.getElementById("creditFare").textContent = naira(state.fare);
  document.getElementById("creditAfter").textContent = naira(after);
}

function useCredit() {
  if (state.creditBalance < state.fare) {
    showToast("Not enough confirmed credit for this fare.");
    return;
  }

  const driver = document.getElementById("creditDriver").value.split(" — ")[0];
  state.creditBalance -= state.fare;
  state.transactions.push({
    type: "Fare paid with credit",
    detail: `${driver} · Confirmed credit applied`,
    amount: -state.fare,
    time: new Date().toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })
  });

  saveState();
  closeModal("useCreditModal");
  renderAll();

  showSuccess(
    "Fare paid with credit",
    `The ${naira(state.fare)} fare was covered by your confirmed change credit.`,
    [
      ["Driver", driver],
      ["Fare", naira(state.fare)],
      ["Credit remaining", naira(state.creditBalance)],
      ["Status", "SETTLED"]
    ]
  );
}

function approveDriver(id) {
  const driver = state.drivers.find(d => d.id === id);
  if (!driver) return;
  driver.status = "Approved";
  saveState();
  renderAll();
  showToast(`${driver.name} is now an approved Shuttler driver.`);
}

function changeFare() {
  const next = prompt("Enter the new official shuttle fare (₦):", state.fare);
  if (next === null) return;
  const value = Number(next);
  if (!Number.isFinite(value) || value <= 0) {
    showToast("Please enter a valid positive fare.");
    return;
  }
  state.fare = Math.round(value);
  saveState();
  renderAll();
  showToast(`Official fare changed to ${naira(state.fare)}.`);
}

function showSuccess(title, text, rows) {
  document.getElementById("successTitle").textContent = title;
  document.getElementById("successText").textContent = text;
  document.getElementById("receipt").innerHTML = rows.map(([a,b]) => `<div><span>${a}</span><strong>${b}</strong></div>`).join("");
  openModal("successModal");
}

function simulateScan() {
  stopScanner();
  document.getElementById("scanResult").textContent = "✓ Demo driver detected: Adewale · SH-DRV-001";
  setTimeout(() => {
    closeModal("scanModal");
    showToast("Driver identified: Adewale · SH-DRV-001");
    openDigitalPayment();
  }, 700);
}

function openDigitalPayment() {
  const driver = "Adewale";
  const ok = confirm(`Driver identified: ${driver} · SH-DRV-001\n\nOfficial fare: ${naira(state.fare)}\n\nPay digitally from your simulated wallet?`);
  if (!ok) return;
  if (state.studentBalance < state.fare) {
    showToast("Insufficient simulated wallet balance.");
    return;
  }

  state.studentBalance -= state.fare;
  state.driverBalance += state.fare;
  const id = "TX-" + Math.floor(100000 + Math.random() * 900000);
  state.transactions.push({
    type: "Digital fare",
    detail: `${driver} · ${id}`,
    amount: -state.fare,
    time: new Date().toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })
  });
  saveState();
  renderAll();

  showSuccess(
    "Payment successful",
    `The official ${naira(state.fare)} fare was transferred from the student's simulated wallet.`,
    [
      ["Transaction ID", id],
      ["Driver", driver],
      ["Fare", naira(state.fare)],
      ["Status", "SUCCESS"]
    ]
  );
}

async function startScanner() {
  const video = document.getElementById("scannerVideo");
  const result = document.getElementById("scanResult");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    result.textContent = "Camera access is unavailable here. Use localhost/HTTPS or the demo driver button.";
    return;
  }

  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    video.srcObject = scannerStream;
    await video.play();
    scannerRunning = true;
    result.textContent = "Camera running — point it at a Shuttler driver QR.";
    scanLoop();
  } catch (err) {
    result.textContent = "Camera permission was blocked. Use the demo driver button instead.";
  }
}

function stopScanner() {
  scannerRunning = false;
  if (scannerStream) {
    scannerStream.getTracks().forEach(track => track.stop());
    scannerStream = null;
  }
  const video = document.getElementById("scannerVideo");
  if (video) video.srcObject = null;
}

function scanLoop() {
  if (!scannerRunning) return;
  const video = document.getElementById("scannerVideo");
  const canvas = document.getElementById("scannerCanvas");
  if (video.readyState >= 2 && typeof jsQR === "function") {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(image.data, image.width, image.height);
    if (code && code.data) {
      document.getElementById("scanResult").textContent = "✓ QR detected: " + code.data;
      stopScanner();
      setTimeout(() => {
        closeModal("scanModal");
        openDigitalPayment();
      }, 600);
      return;
    }
  }
  requestAnimationFrame(scanLoop);
}

function generateDriverQR() {
  const el = document.getElementById("driverQr");
  if (!el || typeof QRCode === "undefined") return;
  el.innerHTML = "";
  new QRCode(el, {
    text: "SHUTTLER-DRIVER-SH-DRV-001",
    width: 180,
    height: 180,
    colorDark: "#0b1f3a",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

function resetDemo() {
  if (!confirm("Reset all demo data to the original pitch scenario?")) return;
  state = structuredClone(defaultState);
  saveState();
  renderAll();
  showToast("Demo reset.");
}

function renderAll() {
  renderStudent();
  renderDriver();
  renderAdmin();
  generateDriverQR();
}

window.addEventListener("click", (event) => {
  if (event.target.classList.contains("modal")) {
    event.target.classList.remove("open");
    stopScanner();
  }
});

window.addEventListener("DOMContentLoaded", () => {
  renderAll();
});
