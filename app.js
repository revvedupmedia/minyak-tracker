// ===========================================
// Minyak Tracker v4 — Auth + Admin Mode
// ===========================================

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MONTH_NAMES = [
  "Januari","Februari","Mac","April","Mei","Jun",
  "Julai","Ogos","September","Oktober","November","Disember"
];

const ADMIN_SECRET = "GMRBAH7";

let state = {
  viewDate: new Date(),
  entries: [],
  selectedFuel: "diesel",
  pendingFile: null,
  currentUser: null,
  isAdmin: false,
};

// ---------- Helpers ----------
function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtRM(n) {
  const v = Number(n || 0);
  return "RM" + v.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtKm(n) {
  return Number(n || 0).toLocaleString("en-MY", { maximumFractionDigits: 1 });
}

function fmtDateShort(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ms-MY", { day: "numeric", month: "short" });
}

function fmtDateLong(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ms-MY", { day: "numeric", month: "long", year: "numeric" });
}

function monthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 2200);
}

// ---------- Auth ----------
async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) { onLoggedIn(session.user); } else { showLoginScreen(); }
  sb.auth.onAuthStateChange((_event, session) => {
    if (session) { onLoggedIn(session.user); } else { onLoggedOut(); }
  });
}

function showLoginScreen() {
  document.getElementById("loginScreen").hidden = false;
  document.getElementById("app").hidden = true;
}

function onLoggedIn(user) {
  state.currentUser = user;

  // Show turtle success animation, then reveal app
  const loginScreen = document.getElementById("loginScreen");
  const successScreen = document.getElementById("loginSuccess");
  const appEl = document.getElementById("app");

  loginScreen.hidden = true;

  // Only show animation if coming from a fresh login (not a page refresh)
  if (!appEl.dataset.wasShown) {
    successScreen.hidden = false;
    appEl.hidden = true;
    // After animation finishes (1.6s + 0.4s fade = 2s total), hide overlay and show app
    setTimeout(() => {
      successScreen.hidden = true;
      appEl.hidden = false;
      appEl.dataset.wasShown = "1";
      document.getElementById("userEmailDisplay").textContent = user.email;
      loadEntries();
    }, 2000);
  } else {
    successScreen.hidden = true;
    appEl.hidden = false;
    document.getElementById("userEmailDisplay").textContent = user.email;
    loadEntries();
  }
}

function onLoggedOut() {
  state.currentUser = null;
  state.isAdmin = false;
  // Clear admin badge
  document.getElementById("adminBadge").hidden = true;
  // Clear the "was shown" flag so animation plays again on next login
  const appEl = document.getElementById("app");
  delete appEl.dataset.wasShown;
  appEl.hidden = true;
  showLoginScreen();
}

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");
  const btn = document.getElementById("loginBtn");
  errEl.hidden = true;
  btn.disabled = true;
  btn.textContent = "Log masuk...";
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { errEl.textContent = "Email atau password salah. Cuba lagi."; errEl.hidden = false; }
  btn.disabled = false;
  btn.textContent = "Log Masuk";
});

document.getElementById("loginPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("loginBtn").click();
});
document.getElementById("loginEmail").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("loginPassword").focus();
});

document.getElementById("logoutBtn").addEventListener("click", () => sb.auth.signOut());

// ---------- Admin cheat code — tap logo 7x ----------
let logoTapCount = 0;
let logoTapTimer = null;

["loginLogo", "appLogo"].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", () => {
    logoTapCount++;
    clearTimeout(logoTapTimer);
    logoTapTimer = setTimeout(() => { logoTapCount = 0; }, 2000);
    if (logoTapCount >= 7) {
      logoTapCount = 0;
      if (state.isAdmin) {
        state.isAdmin = false;
        document.getElementById("adminBadge").hidden = true;
        showToast("Admin mode dimatikan");
        renderHistory();
      } else {
        openAdminDialog();
      }
    }
  });
});

const adminDialog = document.getElementById("adminDialog");
document.getElementById("adminDialogClose").addEventListener("click", () => adminDialog.close());
adminDialog.addEventListener("click", (e) => { if (e.target === adminDialog) adminDialog.close(); });

function openAdminDialog() {
  if (addDialog && addDialog.open) addDialog.close();
  if (detailDialog && detailDialog.open) detailDialog.close();
  document.getElementById("adminPassword").value = "";
  document.getElementById("adminError").hidden = true;
  adminDialog.showModal();
  setTimeout(() => document.getElementById("adminPassword").focus(), 100);
}

document.getElementById("adminUnlockBtn").addEventListener("click", () => {
  const pw = document.getElementById("adminPassword").value;
  if (pw === ADMIN_SECRET) {
    state.isAdmin = true;
    document.getElementById("adminBadge").hidden = false;
    adminDialog.close();
    showToast("Admin mode aktif");
    renderHistory();
  } else {
    document.getElementById("adminError").hidden = false;
    document.getElementById("adminPassword").value = "";
    document.getElementById("adminPassword").focus();
  }
});

document.getElementById("adminPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("adminUnlockBtn").click();
});

// ---------- Data loading ----------
async function loadEntries() {
  const { start, end } = monthRange(state.viewDate);
  const { data, error } = await sb
    .from("fuel_entries")
    .select("*")
    .gte("entry_date", start)
    .lte("entry_date", end)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) { console.error(error); showToast("Gagal load data."); return; }
  state.entries = data || [];
  render();
}

// ---------- Rendering ----------
function render() {
  renderMonthLabel();
  renderGauge();
  renderStats();
  renderHistory();
}

function renderMonthLabel() {
  document.getElementById("monthText").textContent =
    `${MONTH_NAMES[state.viewDate.getMonth()]} ${state.viewDate.getFullYear()}`;
}

function renderGauge() {
  const dieselTotal = sumBy(state.entries, "diesel", "amount");
  const ronTotal = sumBy(state.entries, "ron95", "amount");
  const total = dieselTotal + ronTotal;
  document.getElementById("gaugeTotal").textContent = fmtRM(total);
  document.getElementById("dieselTotal").textContent = fmtRM(dieselTotal);
  document.getElementById("ronTotal").textContent = fmtRM(ronTotal);
  drawGaugeArc(dieselTotal, ronTotal);
}

function sumBy(entries, fuelType, field) {
  return entries.filter(e => e.fuel_type === fuelType)
    .reduce((acc, e) => acc + Number(e[field] || 0), 0);
}

function drawGaugeArc(dieselVal, ronVal) {
  const cx = 120, cy = 130, r = 90;
  const total = dieselVal + ronVal;
  document.getElementById("gaugeTrack").setAttribute("d", arcPath(cx, cy, r, 180, 0));
  if (total <= 0) {
    document.getElementById("gaugeDiesel").setAttribute("d", "");
    document.getElementById("gaugeRon").setAttribute("d", "");
    return;
  }
  const dieselEndAngle = 180 - (dieselVal / total * 180);
  document.getElementById("gaugeDiesel").setAttribute("d", arcPath(cx, cy, r, 180, dieselEndAngle));
  document.getElementById("gaugeRon").setAttribute("d", arcPath(cx, cy, r, dieselEndAngle, 0));
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(cx, cy, r, sa, ea) {
  if (Math.abs(sa - ea) < 0.01) return "";
  const s = polarToCartesian(cx, cy, r, sa);
  const e = polarToCartesian(cx, cy, r, ea);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${Math.abs(sa - ea) > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
}

function renderStats() {
  const totalKm = state.entries.reduce((acc, e) => acc + Number(e.distance_km || 0), 0);
  document.getElementById("statMileage").innerHTML = `${fmtKm(totalKm)} <span class="unit">km</span>`;
  const pendingTotal = state.entries
    .filter(e => e.needs_claim && e.claim_status === "pending")
    .reduce((acc, e) => acc + Number(e.amount || 0), 0);
  document.getElementById("statPending").textContent = fmtRM(pendingTotal);
}

function renderHistory() {
  const list = document.getElementById("historyList");
  const empty = document.getElementById("emptyState");
  const count = document.getElementById("historyCount");
  list.innerHTML = "";

  if (state.entries.length === 0) {
    empty.hidden = false;
    count.textContent = "";
    return;
  }
  empty.hidden = true;
  count.textContent = `${state.entries.length} entry`;

  for (const entry of state.entries) {
    const li = document.createElement("li");
    const isDiesel = entry.fuel_type === "diesel";
    const isOwner = state.currentUser && entry.user_id === state.currentUser.id;
    const kmHtml = entry.distance_km ? `<span class="h-km">${fmtKm(entry.distance_km)} km</span>` : "";
    const claimHtml = entry.needs_claim
      ? `<span class="h-claim-pill ${entry.claim_status === "claimed" ? "claimed" : "pending"}">${entry.claim_status === "claimed" ? "Dah Claim" : "Pending"}</span>` : "";
    const receiptDot = entry.receipt_url ? `<span class="h-receipt-dot">📎</span>` : "";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "history-item";
    btn.innerHTML = `
      <div class="h-fuel-badge ${isDiesel ? "diesel" : "ron"}">${isDiesel ? "🚗" : "🚤"}</div>
      <div class="h-main">
        <div class="h-top">
          <span class="h-fuel-name">${isDiesel ? "Diesel" : "RON95 (Boat)"}</span>
          <span class="h-amount">${fmtRM(entry.amount)}</span>
        </div>
        <div class="h-bottom">
          <div style="display:flex;flex-direction:column;gap:1px;">
            <span class="h-date">${fmtDateShort(entry.entry_date)}</span>
            <span class="h-owner">${entry.user_email || ""}</span>
          </div>
          <div class="h-meta">${kmHtml}${receiptDot}${claimHtml}</div>
        </div>
      </div>
    `;
    btn.addEventListener("click", () => openDetailDialog(entry, isOwner));
    li.appendChild(btn);
    list.appendChild(li);
  }
}

// ---------- Month nav ----------
document.querySelectorAll(".chev").forEach(chev => {
  chev.addEventListener("click", () => {
    const dir = parseInt(chev.dataset.dir, 10);
    state.viewDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + dir, 1);
    loadEntries();
  });
});

// ---------- Add Entry dialog ----------
const addDialog = document.getElementById("addDialog");
const detailDialog = document.getElementById("detailDialog");
const entryForm = document.getElementById("entryForm");
const fuelToggle = document.getElementById("fuelToggle");
const odoStart = document.getElementById("odoStart");
const odoEnd = document.getElementById("odoEnd");
const distancePreview = document.getElementById("distancePreview");
const distanceValue = document.getElementById("distanceValue");
const dropZone = document.getElementById("dropZone");
const receiptFile = document.getElementById("receiptFile");
const formError = document.getElementById("formError");
const submitBtn = document.getElementById("submitBtn");

document.getElementById("fabAdd").addEventListener("click", openAddDialog);
document.getElementById("addDialogClose").addEventListener("click", () => addDialog.close());
document.getElementById("detailDialogClose").addEventListener("click", () => detailDialog.close());
addDialog.addEventListener("click", (e) => { if (e.target === addDialog) addDialog.close(); });
detailDialog.addEventListener("click", (e) => { if (e.target === detailDialog) detailDialog.close(); });

function openAddDialog() {
  if (detailDialog.open) detailDialog.close();
  state.pendingFile = null;
  state.selectedFuel = "diesel";
  entryForm.reset();
  document.getElementById("entryDate").value = toLocalDateStr(new Date());
  setFuelToggle("diesel");
  resetDropZone();
  formError.hidden = true;
  submitBtn.disabled = false;
  submitBtn.textContent = "Simpan Entry";
  addDialog.showModal();
}

function setFuelToggle(fuel) {
  state.selectedFuel = fuel;
  document.querySelectorAll(".fuel-opt").forEach(b => b.classList.toggle("active", b.dataset.fuel === fuel));
}

fuelToggle.addEventListener("click", (e) => {
  const btn = e.target.closest(".fuel-opt");
  if (btn) setFuelToggle(btn.dataset.fuel);
});

odoStart.addEventListener("input", updateDistancePreview);
odoEnd.addEventListener("input", updateDistancePreview);

function updateDistancePreview() {
  const s = parseFloat(odoStart.value), e = parseFloat(odoEnd.value);
  if (!isNaN(s) && !isNaN(e) && e >= s) {
    distanceValue.textContent = fmtKm(e - s);
    distancePreview.hidden = false;
  } else { distancePreview.hidden = true; }
}

dropZone.addEventListener("click", (e) => { if (e.target.id !== "removeFile") receiptFile.click(); });
receiptFile.addEventListener("change", () => {
  const file = receiptFile.files[0];
  if (file) { state.pendingFile = file; showFilePreview(file); }
});
document.getElementById("removeFile").addEventListener("click", (e) => {
  e.stopPropagation();
  state.pendingFile = null;
  receiptFile.value = "";
  resetDropZone();
});

function resetDropZone() {
  document.getElementById("dropZoneEmpty").hidden = false;
  document.getElementById("dropZonePreview").hidden = true;
  document.getElementById("previewImg").hidden = true;
  document.getElementById("previewPdf").hidden = true;
}

function showFilePreview(file) {
  document.getElementById("dropZoneEmpty").hidden = true;
  document.getElementById("dropZonePreview").hidden = false;
  if (file.type === "application/pdf") {
    document.getElementById("previewImg").hidden = true;
    document.getElementById("previewPdf").hidden = false;
    document.getElementById("previewPdfName").textContent = file.name;
  } else {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = document.getElementById("previewImg");
      img.src = ev.target.result;
      img.hidden = false;
      document.getElementById("previewPdf").hidden = true;
    };
    reader.readAsDataURL(file);
  }
}

submitBtn.addEventListener("click", async () => {
  formError.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = "Menyimpan...";
  try {
    const date = document.getElementById("entryDate").value;
    const amount = parseFloat(document.getElementById("entryAmount").value);
    const needsClaim = document.getElementById("needsClaim").checked;
    const notes = document.getElementById("entryNotes").value.trim();
    const oStart = odoStart.value ? parseFloat(odoStart.value) : null;
    const oEnd = odoEnd.value ? parseFloat(odoEnd.value) : null;

    if (!date) throw new Error("Sila pilih tarikh.");
    if (isNaN(amount) || amount <= 0) throw new Error("Sila masukkan amount yang sah.");
    if (oStart !== null && oEnd !== null && oEnd < oStart)
      throw new Error("Odometer akhir mesti lebih besar dari odometer mula.");

    let receiptUrl = null, receiptPath = null;
    if (state.pendingFile) {
      const file = state.pendingFile;
      const ext = file.name.split(".").pop();
      const path = `${state.currentUser.id}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const { error: upErr } = await sb.storage.from("receipts").upload(path, file);
      if (upErr) throw new Error("Gagal upload resit: " + upErr.message);
      const { data: urlData } = sb.storage.from("receipts").getPublicUrl(path);
      receiptUrl = urlData.publicUrl;
      receiptPath = path;
    }

    const payload = {
      entry_date: date,
      fuel_type: state.selectedFuel,
      odometer_start: oStart,
      odometer_end: oEnd,
      distance_km: (oStart !== null && oEnd !== null) ? oEnd - oStart : null,
      amount,
      needs_claim: needsClaim,
      claim_status: needsClaim ? "pending" : "not_applicable",
      notes: notes || null,
      user_id: state.currentUser.id,
      user_email: state.currentUser.email,
    };
    if (receiptUrl) { payload.receipt_url = receiptUrl; payload.receipt_path = receiptPath; }

    const { error: insErr } = await sb.from("fuel_entries").insert(payload);
    if (insErr) throw new Error(insErr.message);

    addDialog.close();
    showToast("Entry disimpan ✓");
    await loadEntries();
  } catch (err) {
    formError.textContent = err.message || "Ralat tidak diketahui.";
    formError.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Simpan Entry";
  }
});

// ---------- Detail dialog ----------
const detailBody = document.getElementById("detailBody");
const detailActions = document.getElementById("detailActions");
let currentDetailEntry = null;

function openDetailDialog(entry, isOwner) {
  if (addDialog.open) addDialog.close();
  currentDetailEntry = entry;
  const isDiesel = entry.fuel_type === "diesel";

  let rows = [];
  rows.push(row("Tarikh", fmtDateLong(entry.entry_date)));
  rows.push(row("Dimasukkan oleh", entry.user_email || "—"));
  rows.push(row("Jenis Minyak", isDiesel ? "Diesel" : "RON95 (Boat)"));
  rows.push(row("Amount", fmtRM(entry.amount), true));
  if (entry.odometer_start !== null && entry.odometer_end !== null) {
    rows.push(row("Odometer Mula", fmtKm(entry.odometer_start) + " km", true));
    rows.push(row("Odometer Akhir", fmtKm(entry.odometer_end) + " km", true));
    rows.push(row("Jarak", fmtKm(entry.distance_km) + " km", true));
  }
  if (entry.needs_claim) rows.push(row("Status Claim", entry.claim_status === "claimed" ? "Dah Claim ✓" : "Pending"));
  if (entry.notes) rows.push(row("Nota", entry.notes));

  let receiptHtml = "";
  if (entry.receipt_url) {
    const isPdf = entry.receipt_url.toLowerCase().includes(".pdf");
    receiptHtml = isPdf
      ? `<a href="${entry.receipt_url}" target="_blank" rel="noopener" class="detail-receipt-link">📄 Buka Resit (PDF)</a>`
      : `<img src="${entry.receipt_url}" class="detail-receipt" alt="Resit" />
         <a href="${entry.receipt_url}" target="_blank" rel="noopener" class="detail-receipt-link" style="margin-top:8px;">⬇ Download Resit</a>`;
  }

  detailBody.innerHTML = rows.join("") + receiptHtml;

  if (entry.needs_claim && isOwner) {
    const isClaimed = entry.claim_status === "claimed";
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "detail-receipt-link";
    toggleBtn.style.cssText = "margin-top:8px;width:100%;border:none;background:var(--success-soft);color:var(--success);cursor:pointer;";
    toggleBtn.textContent = isClaimed ? "Tandakan sebagai Pending" : "Tandakan sebagai Dah Claim";
    toggleBtn.addEventListener("click", async () => {
      const { error } = await sb.from("fuel_entries")
        .update({ claim_status: isClaimed ? "pending" : "claimed" }).eq("id", entry.id);
      if (!error) { detailDialog.close(); showToast("Status dikemaskini ✓"); loadEntries(); }
    });
    detailBody.appendChild(toggleBtn);
  }

  detailActions.innerHTML = "";
  if (isOwner || state.isAdmin) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger-btn";
    deleteBtn.textContent = (state.isAdmin && !isOwner) ? "🔐 Padam Entry (Admin)" : "Padam Entry";
    deleteBtn.addEventListener("click", () => deleteEntry(entry));
    detailActions.appendChild(deleteBtn);
  }

  detailDialog.showModal();
}

function row(label, value, mono = false) {
  return `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-value ${mono ? "mono" : ""}">${value}</span></div>`;
}

async function deleteEntry(entry) {
  if (!confirm("Padam entry ni? Tindakan ini tak boleh undo.")) return;
  if (entry.receipt_path) await sb.storage.from("receipts").remove([entry.receipt_path]);
  const { error } = await sb.from("fuel_entries").delete().eq("id", entry.id);
  if (error) { showToast("Gagal padam entry."); return; }
  detailDialog.close();
  showToast("Entry dipadam");
  loadEntries();
}

// ---------- Init ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
initAuth();
