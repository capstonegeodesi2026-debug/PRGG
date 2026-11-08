/* Sinduadi Housing Explorer: membaca GeoJSON QGIS + CSV aksesibilitas.
   Input: data/grid.geojson, data/akomodasi.geojson, data/akses_grid.csv */
const DATA_FILES = { grids: "data/grid.geojson", accommodations: "data/akomodasi.geojson", access: "data/akses_grid.csv" };
const $ = id => document.getElementById(id);
const map = L.map("map").setView([-7.759, 110.374], 14);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
const gridLayer = L.geoJSON(null, { style: feature => gridStyle(feature.properties || {}), onEachFeature: (feature, layer) => layer.on("click", () => selectGrid(feature.properties.id)) }).addTo(map);
const accommodationLayer = L.layerGroup().addTo(map);
let grids = [], accommodations = [], accessRows = [], selectedGridId = null, activeFacultyId = "", dataReady = false;

function firstValue(obj, keys) { for (const key of keys) if (obj?.[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== "") return obj[key]; return null; }
function num(value) { if (value === null || value === undefined || value === "") return null; const n = Number(String(value).trim().replace(/\s/g, "")); return Number.isFinite(n) ? n : null; }
function gridId(p) { const v = firstValue(p, ["grid_id", "GRID_ID", "id", "ID", "grid"]); return v === null ? null : String(v).trim(); }
function parseCSV(text) {
  const rows = []; let row = [], field = "", quoted = false; const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) { const c = src[i], next = src[i + 1];
    if (c === '"' && quoted && next === '"') { field += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(field); field = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) { if (c === "\r" && next === "\n") i++; row.push(field); if (row.some(x => x.trim())) rows.push(row); row = []; field = ""; }
    else field += c;
  }
  row.push(field); if (row.some(x => x.trim())) rows.push(row); if (!rows.length) return [];
  const headers = rows.shift().map(x => x.trim()); return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? "").trim()])));
}
function normalizeAccess(r) { return {
  gridId: String(firstValue(r, ["grid_id", "origin_id", "GRID_ID", "origin"]) || "").trim(),
  facultyId: String(firstValue(r, ["faculty_id", "destination_faculty_id", "faculty", "fakultas_id"]) || "umum").trim(),
  facultyName: String(firstValue(r, ["faculty_name", "nama_fakultas", "faculty_label"]) || firstValue(r, ["faculty_id", "destination_faculty_id", "faculty"]) || "Kawasan tujuan").trim(),
  distFaculty: num(firstValue(r, ["distance_faculty_m", "dist_faculty_m", "jarak_fakultas_m", "faculty_distance_m"])),
  distMarket: num(firstValue(r, ["distance_minimarket_m", "dist_market_m", "jarak_minimarket_m", "minimarket_distance_m"])),
  distWorship: num(firstValue(r, ["distance_worship_m", "dist_worship_m", "jarak_rumah_ibadah_m", "worship_distance_m"])),
  medianPrice: num(firstValue(r, ["median_price", "median_price_rp", "harga_median"])),
  count: num(firstValue(r, ["accommodation_count", "jumlah_akomodasi", "count_akomodasi"]))
}; }
function getPrice(p) { return num(firstValue(p, ["price", "harga", "harga_bulan", "monthly_price"])); }
function median(values) { const a = values.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
async function loadData() {
  try {
    // Grid dimuat terlebih dahulu agar peta tetap tampil meskipun CSV/akomodasi belum tersedia.
    const gridResponse = await fetch(DATA_FILES.grids);
    if (!gridResponse.ok) throw new Error(`Gagal membaca ${DATA_FILES.grids} (HTTP ${gridResponse.status}).`);
    const gridJSON = await gridResponse.json();
    grids = (gridJSON.features || []).map((feature, i) => {
      const p = feature.properties || {}, id = gridId(p);
      return id ? { id, name: String(firstValue(p, ["grid_name", "nama_grid", "name"]) || id), feature, properties: p } : null;
    }).filter(Boolean);
    if (!grids.length) throw new Error("grid.geojson tidak memiliki fitur poligon dengan properti grid_id. Pastikan layer berisi Polygon/MultiPolygon dan kolom grid_id.");

    // Dua sumber lain bersifat opsional saat tahap awal pengujian.
    const [accommodationResult, accessResult] = await Promise.allSettled([
      fetch(DATA_FILES.accommodations), fetch(DATA_FILES.access)
    ]);
    const warnings = [];

    if (accommodationResult.status === "fulfilled" && accommodationResult.value.ok) {
      const accommodationJSON = await accommodationResult.value.json();
      accommodations = (accommodationJSON.features || []).map((feature, i) => {
        const p = feature.properties || {}, c = feature.geometry?.coordinates;
        if (feature.geometry?.type !== "Point" || !c) return null;
        return { name: String(firstValue(p, ["name", "nama", "nama_kos", "nama_penginapan"]) || `Akomodasi ${i + 1}`), gridId: String(firstValue(p, ["grid_id", "GRID_ID", "grid", "id_grid"]) || "").trim(), price: getPrice(p), type: String(firstValue(p, ["type", "jenis", "jenis_hunian"]) || "Akomodasi"), lat: c[1], lng: c[0] };
      }).filter(Boolean);
    } else {
      warnings.push("akomodasi.geojson belum tersedia; titik kos/penginapan belum ditampilkan.");
    }

    if (accessResult.status === "fulfilled" && accessResult.value.ok) {
      accessRows = parseCSV(await accessResult.value.text()).map(normalizeAccess).filter(r => r.gridId);
      if (!accessRows.length) warnings.push("akses_grid.csv terbaca, tetapi belum berisi baris dengan kolom grid_id/origin_id.");
    } else {
      warnings.push("akses_grid.csv belum tersedia; skor aksesibilitas belum dapat dihitung.");
    }

    populateFacultySelect(); dataReady = true; renderAll();
    const bounds = gridLayer.getBounds(); if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });
    if (warnings.length) showDataWarning(warnings);
    console.info(`Data dimuat: ${grids.length} grid, ${accommodations.length} akomodasi, ${accessRows.length} baris akses.`);
  } catch (e) { console.error(e); showDataError(e.message); }
}

function populateFacultySelect() {
  const select = $("facultySelect"), choices = new Map(); accessRows.forEach(r => choices.set(r.facultyId, r.facultyName)); select.innerHTML = "";
  choices.forEach((name, id) => { const option = document.createElement("option"); option.value = id; option.textContent = name; select.appendChild(option); }); activeFacultyId = select.value || choices.keys().next().value || "";
}
function accessFor(id) { return accessRows.find(r => r.gridId === id && r.facultyId === activeFacultyId) || accessRows.find(r => r.gridId === id && r.facultyId === "umum") || {}; }
function metrics(g) { const a = accommodations.filter(x => x.gridId === g.id), r = accessFor(g.id); return { ...g, distFaculty: r.distFaculty, distMarket: r.distMarket, distWorship: r.distWorship, medianPrice: r.medianPrice ?? median(a.map(x => x.price)), count: r.count ?? a.length, accommodationItems: a }; }
function getWeights() { const raw = { faculty: +$("facultyWeight").value, market: +$("marketWeight").value, worship: +$("worshipWeight").value, price: +$("priceWeight").value }, sum = Object.values(raw).reduce((a, b) => a + b, 0); return sum ? Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v / sum])) : { faculty: .5, market: .2, worship: .1, price: .2 }; }
function reverseScore(value, values) { const valid = values.filter(Number.isFinite); if (!Number.isFinite(value) || !valid.length) return null; const min = Math.min(...valid), max = Math.max(...valid); return max === min ? 1 : (max - value) / (max - min); }
function scoreGrids() {
  const w = getWeights(), data = grids.map(metrics), criteria = [{ key: "faculty", field: "distFaculty" }, { key: "market", field: "distMarket" }, { key: "worship", field: "distWorship" }, { key: "price", field: "medianPrice" }];
  return data.map(g => { let total = 0, used = 0; criteria.forEach(c => { const s = reverseScore(g[c.field], data.map(x => x[c.field])); if (s !== null && w[c.key] > 0) { total += s * w[c.key]; used += w[c.key]; } }); return { ...g, score: used ? total / used * 100 : null }; });
}
function color(score) { return !Number.isFinite(score) ? "#9ca3af" : score >= 65 ? "#23966b" : score >= 35 ? "#e9b949" : "#d96b5f"; }
function gridStyle(p) { return { color: p.id === selectedGridId ? "#17324d" : "#fff", weight: p.id === selectedGridId ? 3 : 1.5, fillColor: color(Number(p.score)), fillOpacity: .58 }; }
function rupiah(v) { return Number.isFinite(v) ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v) : "Belum tersedia"; }
function distance(v) { return Number.isFinite(v) ? `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(v)} m` : "Belum tersedia"; }
function esc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function renderMap() {
  gridLayer.clearLayers(); accommodationLayer.clearLayers(); const scored = scoreGrids();
  gridLayer.addData({ type: "FeatureCollection", features: scored.map(g => ({ ...g.feature, properties: { ...g.properties, id: g.id, name: g.name, score: g.score, count: g.count, medianPrice: g.medianPrice } })) });
  gridLayer.setStyle(f => gridStyle(f.properties || {}));
  gridLayer.eachLayer(layer => { const g = scored.find(x => x.id === layer.feature.properties.id); layer.bindPopup(`<strong>${esc(g.name)}</strong><br>Skor WSM: ${Number.isFinite(g.score) ? g.score.toFixed(1) : "Belum dihitung"} / 100<br>Jumlah akomodasi: ${g.count}<br>Jarak fakultas: ${distance(g.distFaculty)}<br>Jarak minimarket: ${distance(g.distMarket)}<br>Jarak rumah ibadah: ${distance(g.distWorship)}`); });
  const budget = +$("budgetSelect").value;
  scored.forEach(g => g.accommodationItems.filter(a => Number.isFinite(a.price) && a.price <= budget).forEach(a => L.circleMarker([a.lat, a.lng], { radius: 6, color: "#17324d", weight: 1.5, fillColor: "#fff", fillOpacity: 1 }).bindPopup(`<strong>${esc(a.name)}</strong><br>Jenis: ${esc(a.type)}<br>Harga: ${rupiah(a.price)}/bulan<br>Grid: ${esc(g.id)}`).addTo(accommodationLayer)));
}
function renderRanking() {
  const budget = +$("budgetSelect").value;
  const ranked = scoreGrids().map(g => ({ ...g, eligible: g.accommodationItems.filter(a => Number.isFinite(a.price) && a.price <= budget) })).filter(g => g.eligible.length && Number.isFinite(g.score)).sort((a, b) => b.score - a.score);
  $("gridCount").textContent = ranked.length; $("accommodationCount").textContent = ranked.reduce((n, g) => n + g.eligible.length, 0); $("topScore").textContent = ranked.length ? ranked[0].score.toFixed(1) : "—";
  $("rankingList").innerHTML = ranked.map((g, i) => `<button class="rank-item ${selectedGridId === g.id ? "active" : ""}" data-grid="${esc(g.id)}" type="button"><span class="rank-number">${i + 1}</span><span class="rank-copy"><strong>${esc(g.name)}</strong><small>${g.eligible.length} akomodasi sesuai anggaran • median ${rupiah(g.medianPrice)}</small></span><span class="score-pill">${g.score.toFixed(0)}</span></button>`).join("") || '<p class="hint">Tidak ada grid dengan akomodasi sesuai anggaran atau data skor belum lengkap.</p>';
  document.querySelectorAll("[data-grid]").forEach(b => b.addEventListener("click", () => { selectGrid(b.dataset.grid); const layer = findLayer(b.dataset.grid); if (layer) map.fitBounds(layer.getBounds(), { maxZoom: 17 }); }));
}
function findLayer(id) { let found = null; gridLayer.eachLayer(l => { if (l.feature?.properties?.id === id) found = l; }); return found; }
function selectGrid(id) {
  selectedGridId = id; const g = scoreGrids().find(x => x.id === id); if (!g) return;
  $("gridDetails").classList.remove("empty"); $("gridDetails").innerHTML = `<h3>Detail ${esc(g.name)}</h3><p><strong>Skor WSM:</strong> ${Number.isFinite(g.score) ? g.score.toFixed(1) + " / 100" : "Belum dapat dihitung"}</p><p><strong>Jumlah akomodasi:</strong> ${g.count ?? "Belum tersedia"}</p><p><strong>Median harga:</strong> ${rupiah(g.medianPrice)}/bulan</p><p><strong>Jarak fakultas tujuan:</strong> ${distance(g.distFaculty)}</p><p><strong>Jarak minimarket terdekat:</strong> ${distance(g.distMarket)}</p><p><strong>Jarak rumah ibadah terdekat:</strong> ${distance(g.distWorship)}</p><p class="footnote">Jarak berasal dari akses_grid.csv. Skor memakai normalisasi min-max terbalik dan bobot pada panel preferensi.</p>`;
  renderMap(); renderRanking();
}
function updateWeights() {
  ["faculty", "market", "worship", "price"].forEach(k => { $(`${k}WeightValue`).textContent = `${$(`${k}Weight`).value}%`; });
  const w = getWeights(); $("weightTotal").textContent = `${Math.round(Object.values(w).reduce((a, b) => a + b, 0) * 100)}%`;
  if (dataReady) { renderMap(); renderRanking(); if (selectedGridId) selectGrid(selectedGridId); }
}
function renderAll() { renderMap(); renderRanking(); updateWeights(); }
function showDataWarning(messages) {
  const d = $("gridDetails");
  d.classList.remove("empty");
  d.innerHTML = `<h3>Grid berhasil dimuat</h3><p>${grids.length} grid berhasil ditampilkan pada peta.</p><ul>${messages.map(m => `<li>${esc(m)}</li>`).join("")}</ul><p>Tambahkan file yang belum tersedia ke folder data untuk mengaktifkan seluruh fitur dashboard.</p>`;
}
function showDataError(message) { const d = $("gridDetails"); d.classList.remove("empty"); d.innerHTML = `<h3>Data belum berhasil dimuat</h3><p>${esc(message)}</p><p>Periksa nama file/folder dan jalankan melalui Live Server.</p>`; $("rankingList").innerHTML = '<p class="hint">Menunggu data grid, akomodasi, dan aksesibilitas.</p>'; }

["facultyWeight", "marketWeight", "worshipWeight", "priceWeight"].forEach(id => $(id).addEventListener("input", updateWeights));
$("facultySelect").addEventListener("change", e => { activeFacultyId = e.target.value; selectedGridId = null; $("gridDetails").classList.add("empty"); $("gridDetails").textContent = "Klik salah satu grid atau rekomendasi untuk melihat detail."; renderAll(); });
$("budgetSelect").addEventListener("change", () => { if (dataReady) { renderMap(); renderRanking(); } });
$("resetButton").addEventListener("click", () => { $("facultyWeight").value = 50; $("marketWeight").value = 20; $("worshipWeight").value = 10; $("priceWeight").value = 20; $("budgetSelect").value = 1500000; selectedGridId = null; $("gridDetails").classList.add("empty"); $("gridDetails").textContent = "Klik salah satu grid atau rekomendasi untuk melihat detail."; updateWeights(); });
loadData();
