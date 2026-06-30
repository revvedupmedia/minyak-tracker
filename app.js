// ===========================================
// Minyak Tracker - App Logic
// ===========================================

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MONTH_NAMES = [
  "Januari","Februari","Mac","April","Mei","Jun",
  "Julai","Ogos","September","Oktober","November","Disember"
];

let state = {
  viewDate: new Date(), // first of month being viewed
  entries: [],
  selectedFuel: "diesel",
  pendingFile: null,
  editingId: null,
};

// ---------- Helpers ----------
function fmtRM(n) {
  const v = Number(n || 0);
  return "RM" + v.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtKm(n) {
  const v = Number(n || 0);
  return v.toLocaleString("en-MY", { maximumFractionDigits: 1 });
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
  const toISO = (d) => d.toISOString().slice(0, 10);
  return { start: toISO(start), end: toISO(end) };
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.hidden = true; }, 2200);
}

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

  if (error) {
    console.error(error);
    showToast("Gagal load data. Cuba refresh.");
    return;
  }
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
  const el = document.getElementById("monthText");
  el.textContent = `${MONTH_NAMES[state.viewDate.getMonth()]} ${state.viewDate.getFullYear()}`;
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
  return entries
    .filter(e => e.fuel_type === fuelType)
    .reduce((acc, e) => acc + Number(e[field] || 0), 0);
}

// Semi-circle gauge from 180deg to 0deg (left to right), split by proportion
function drawGaugeArc(dieselVal, ronVal) {
  const cx = 120, cy = 130, r = 90;
  const total = dieselVal + ronVal;

  const track = document.getElementById("gaugeTrack");
  const dieselPath = document.getElementById("gaugeDiesel");
  const ronPath = document.getElementById("gaugeRon");

  track.setAttribute("d", arcPath(cx, cy, r, 180, 0));

  if (total <= 0) {
    dieselPath.setAttribute("d", "");
    ronPath.setAttribute("d", "");
    return;
  }

  const dieselFrac = dieselVal / total;
  const dieselEndAngle = 180 - (dieselFrac * 180); // sweeping from 180 to 0

  dieselPath.setAttribute("d", arcPath(cx, cy, r, 180, dieselEndAngle));
  ronPath.setAttribute("d", arcPath(cx, cy, r, dieselEndAngle, 0));
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy - r * Math.sin(angleRad),
  };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  if (Math.abs(startAngle - endAngle) < 0.01) return "";
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = Math.abs(startAngle - endAngle) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function renderStats() {
  // Mileage only counted for entries that have both odometer readings (driving, not boat)
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

  for (const e of state.entries) {
    const li = document.createElement("li");
    li.className = "history-item";
    li.dataset.id = e.id;

    const isDiesel = e.fuel_type === "diesel";
    const badgeClass = isDiesel ? "diesel" : "ron";
    const badgeIcon = isDiesel ? "🚗" : "🚤";
    const fuelName = isDiesel ? "Diesel" : "RON95 (Boat)";

    let kmHtml = "";
    if (e.distance_km) {
      kmHtml = `<span class="h-km">${fmtKm(e.distance_km)} km</span>`;
    }

    let claimHtml = "";
    if (e.needs_claim) {
      const isClaimed = e.claim_status === "claimed";
      claimHtml = `<span class="h-claim-pill ${isClaimed ? "claimed" : "pending"}">${isClaimed ? "Dah Claim" : "Pending"}</span>`;
    }

    const receiptDot = e.receipt_url ? `<span class="h-receipt-dot">📎</span>` : "";

    li.innerHTML = `
      <div class="h-fuel-badge ${badgeClass}">${badgeIcon}</div>
      <div class="h-main">
        <div class="h-top">
          <span class="h-fuel-name">${fuelName}</span>
          <span class="h-amount">${fmtRM(e.amount)}</span>
        </div>
        <div class="h-bottom">
          <span class="h-date">${fmtDateShort(e.entry_date)}</span>
          <div class="h-meta">
            ${kmHtml}
            ${receiptDot}
            ${claimHtml}
          </div>
        </div>
      </div>
    `;

    li.addEventListener("click", () => openDetail(e));
    list.appendChild(li);
  }
}

// ---------- Month navigation ----------
document.querySelectorAll(".chev").forEach(chev => {
  chev.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const dir = parseInt(chev.dataset.dir, 10);
    state.viewDate = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth() + dir, 1);
    loadEntries();
  });
});

// ---------- Add Entry sheet ----------
const sheetOverlay = document.getElementById("sheetOverlay");
const fabAdd = document.getElementById("fabAdd");
const sheetClose = document.getElementById("sheetClose");
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

fabAdd.addEventListener("click", () => openAddSheet());
sheetClose.addEventListener("click", () => closeSheet());
sheetOverlay.addEventListener("click", (e) => {
  if (e.target === sheetOverlay) closeSheet();
});

function openAddSheet() {
  detailOverlay.hidden = true; // ensure the other sheet is never open at the same time
  state.editingId = null;
  state.pendingFile = null;
  state.selectedFuel = "diesel";
  entryForm.reset();
  document.getElementById("sheetTitle").textContent = "Tambah Entry";
  document.getElementById("entryDate").value = new Date().toISOString().slice(0, 10);
  setFuelToggle("diesel");
  resetDropZone();
  formError.hidden = true;
  submitBtn.textContent = "Simpan Entry";
  sheetOverlay.hidden = false;
  document.body.classList.add("sheet-open");
}

function closeSheet() {
  sheetOverlay.hidden = true;
  document.body.classList.remove("sheet-open");
}

function setFuelToggle(fuel) {
  state.selectedFuel = fuel;
  document.querySelectorAll(".fuel-opt").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.fuel === fuel);
  });
}

fuelToggle.addEventListener("click", (e) => {
  const btn = e.target.closest(".fuel-opt");
  if (!btn) return;
  setFuelToggle(btn.dataset.fuel);
});

function updateDistancePreview() {
  const start = parseFloat(odoStart.value);
  const end = parseFloat(odoEnd.value);
  if (!isNaN(start) && !isNaN(end) && end >= start) {
    distanceValue.textContent = fmtKm(end - start);
    distancePreview.hidden = false;
  } else {
    distancePreview.hidden = true;
  }
}
odoStart.addEventListener("input", updateDistancePreview);
odoEnd.addEventListener("input", updateDistancePreview);

// ---------- File upload preview ----------
dropZone.addEventListener("click", (e) => {
  if (e.target.id === "removeFile") return;
  receiptFile.click();
});

receiptFile.addEventListener("change", () => {
  const file = receiptFile.files[0];
  if (!file) return;
  state.pendingFile = file;
  showFilePreview(file);
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
    reader.onload = (e) => {
      const img = document.getElementById("previewImg");
      img.src = e.target.result;
      img.hidden = false;
      document.getElementById("previewPdf").hidden = true;
    };
    reader.readAsDataURL(file);
  }
}

// ---------- Form submit ----------
entryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
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
    if (oStart !== null && oEnd !== null && oEnd < oStart) {
      throw new Error("Odometer akhir mesti lebih besar dari odometer mula.");
    }

    let distance = null;
    if (oStart !== null && oEnd !== null) {
      distance = oEnd - oStart;
    }

    let receiptUrl = null;
    let receiptPath = null;

    if (state.pendingFile) {
      const file = state.pendingFile;
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await sb.storage
        .from("receipts")
        .upload(path, file);

      if (uploadError) throw new Error("Gagal upload resit: " + uploadError.message);

      const { data: urlData } = sb.storage.from("receipts").getPublicUrl(path);
      receiptUrl = urlData.publicUrl;
      receiptPath = path;
    }

    const payload = {
      entry_date: date,
      fuel_type: state.selectedFuel,
      odometer_start: oStart,
      odometer_end: oEnd,
      distance_km: distance,
      amount: amount,
      needs_claim: needsClaim,
      claim_status: needsClaim ? "pending" : "not_applicable",
      notes: notes || null,
    };

    if (receiptUrl) {
      payload.receipt_url = receiptUrl;
      payload.receipt_path = receiptPath;
    }

    const { error: insertError } = await sb.from("fuel_entries").insert(payload);
    if (insertError) throw new Error(insertError.message);

    closeSheet();
    showToast("Entry disimpan ✓");
    await loadEntries();

  } catch (err) {
    formError.textContent = err.message || "Ralat tidak diketahui. Cuba lagi.";
    formError.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Simpan Entry";
  }
});

// ---------- Detail sheet ----------
const detailOverlay = document.getElementById("detailOverlay");
const detailClose = document.getElementById("detailClose");
const detailBody = document.getElementById("detailBody");
const detailDelete = document.getElementById("detailDelete");
let currentDetailEntry = null;

detailClose.addEventListener("click", () => { detailOverlay.hidden = true; document.body.classList.remove("sheet-open"); });
detailOverlay.addEventListener("click", (e) => {
  if (e.target === detailOverlay) { detailOverlay.hidden = true; document.body.classList.remove("sheet-open"); }
});

function openDetail(entry) {
  sheetOverlay.hidden = true; // ensure the other sheet is never open at the same time
  currentDetailEntry = entry;
  const isDiesel = entry.fuel_type === "diesel";

  let rows = [];
  rows.push(row("Tarikh", fmtDateLong(entry.entry_date)));
  rows.push(row("Jenis Minyak", isDiesel ? "Diesel" : "RON95 (Boat)"));
  rows.push(row("Amount", fmtRM(entry.amount), true));

  if (entry.odometer_start !== null && entry.odometer_end !== null) {
    rows.push(row("Odometer Mula", fmtKm(entry.odometer_start) + " km", true));
    rows.push(row("Odometer Akhir", fmtKm(entry.odometer_end) + " km", true));
    rows.push(row("Jarak", fmtKm(entry.distance_km) + " km", true));
  }

  if (entry.needs_claim) {
    const isClaimed = entry.claim_status === "claimed";
    rows.push(row("Status Claim", isClaimed ? "Dah Claim ✓" : "Pending"));
  }

  if (entry.notes) {
    rows.push(row("Nota", entry.notes));
  }

  let receiptHtml = "";
  if (entry.receipt_url) {
    const isPdf = entry.receipt_url.toLowerCase().includes(".pdf");
    if (isPdf) {
      receiptHtml = `<a href="${entry.receipt_url}" target="_blank" rel="noopener" class="detail-receipt-link">📄 Buka Resit (PDF)</a>`;
    } else {
      receiptHtml = `
        <img src="${entry.receipt_url}" class="detail-receipt" alt="Resit" />
        <a href="${entry.receipt_url}" target="_blank" rel="noopener" class="detail-receipt-link" style="margin-top:8px;">⬇ Download Resit</a>
      `;
    }
  }

  detailBody.innerHTML = rows.join("") + receiptHtml;

  // Add claim toggle action if applicable
  if (entry.needs_claim) {
    const isClaimed = entry.claim_status === "claimed";
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "detail-receipt-link";
    toggleBtn.style.cssText = "margin-top:8px; width:100%; border:none; background:var(--success-soft); color:var(--success); cursor:pointer;";
    toggleBtn.textContent = isClaimed ? "Tandakan sebagai Pending" : "Tandakan sebagai Dah Claim";
    toggleBtn.addEventListener("click", async () => {
      const newStatus = isClaimed ? "pending" : "claimed";
      const { error } = await sb.from("fuel_entries").update({ claim_status: newStatus }).eq("id", entry.id);
      if (!error) {
        detailOverlay.hidden = true;
        document.body.classList.remove("sheet-open");
        showToast("Status dikemaskini ✓");
        loadEntries();
      }
    });
    detailBody.appendChild(toggleBtn);
  }

  detailOverlay.hidden = false;
  document.body.classList.add("sheet-open");
}

function row(label, value, mono = false) {
  return `<div class="detail-row">
    <span class="detail-label">${label}</span>
    <span class="detail-value ${mono ? "mono" : ""}">${value}</span>
  </div>`;
}

detailDelete.addEventListener("click", async () => {
  if (!currentDetailEntry) return;
  if (!confirm("Padam entry ni? Tindakan ini tak boleh undo.")) return;

  const entry = currentDetailEntry;

  // Delete receipt from storage if exists
  if (entry.receipt_path) {
    await sb.storage.from("receipts").remove([entry.receipt_path]);
  }

  const { error } = await sb.from("fuel_entries").delete().eq("id", entry.id);
  if (error) {
    showToast("Gagal padam entry.");
    return;
  }

  detailOverlay.hidden = true;
  document.body.classList.remove("sheet-open");
  showToast("Entry dipadam");
  loadEntries();
});

// ---------- Init ----------
loadEntries();

// ---------- Register service worker for PWA ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
