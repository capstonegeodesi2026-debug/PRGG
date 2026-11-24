/* Peta Leaflet: basemap, ikon, layer, grid tematik, rute, legenda. */
const MapView = (() => {
  const ICONS = {
    cap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
    house: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/>',
    bus: '<rect x="4" y="4" width="16" height="13" rx="2"/><path d="M4 11h16M8 20v-3M16 20v-3"/>',
    shirt: '<path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
    cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h3l3 12h10l2-8H6"/>',
    landmark: '<path d="M3 21h18M5 21V10M10 21V10M14 21V10M19 21V10M2 10l10-6 10 6z"/>',
    cross: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V5a1 1 0 0 1 1-1h11"/>'
  };
  const svg = (k, size, color) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let map, gridLayer, boundary, routeGroup, basemap, layers = {}, gridById = {}, scoreBy = {}, lastStyle = {}, selId = null;
  const UI = CONFIG.ui;
  // Lembar bawah (bottom sheet) dipakai di layar sempit. Desktop tetap memakai pop-up Leaflet.
  const sheetMode = () => matchMedia(`(max-width: ${UI.mobileMax}px)`).matches;
  const canHover = () => matchMedia('(hover: hover)').matches;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Kotak ketuk ikon minimal 24 px (WCAG 2.5.8). Lingkaran di dalamnya mengecil pada zoom rendah agar warna grid tetap terbaca. */
  function icon(key, size) {
    const c = CONFIG.layers[key]; size = size || UI.pinSize;
    return L.divIcon({ className: 'pin', iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2],
      html: `<div class="pin-in" style="background:${c.color}">${svg(c.icon, Math.round(size * 0.58), '#fff')}</div>` });
  }
  function init() {
    map = L.map('map', { zoomControl: true, preferCanvas: true, zoomSnap: 0.25 }).setView(CONFIG.center, CONFIG.zoom);
    const b = CONFIG.basemap;
    basemap = L.tileLayer(b.url, { maxZoom: b.maxZoom, attribution: b.attribution });
    routeGroup = L.layerGroup().addTo(map);
    const zcls = () => map.getContainer().classList.toggle('z-low', map.getZoom() < UI.pinFullZoom);
    map.on('zoomend', zcls); zcls();
    initSheet();
  }
  /* Tile OSM baru diminta saat dashboard pertama kali dibuka, tidak saat halaman awal (hemat tile sesuai kebijakan OSM). */
  function showBasemap() { if (basemap && !map.hasLayer(basemap)) basemap.addTo(map); }

  /* ---------- Lembar bawah ---------- */
  let sheet, sheetBody;
  function initSheet() {
    sheet = document.getElementById('sheet'); sheetBody = document.getElementById('sheetBody'); if (!sheet) return;
    sheet.querySelector('.sheet-close').onclick = () => closeSheet();
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
  }
  function openSheet(html, label, latlng) {
    if (!sheet) return;
    map.closePopup();
    sheetBody.innerHTML = html; sheet.setAttribute('aria-label', label || 'Detail'); sheet.hidden = false; sheetBody.scrollTop = 0;
    if (latlng) {   // titik digeser ke bagian peta yang tidak tertutup lembar
      const size = map.getSize(), free = size.y - sheet.offsetHeight, p = map.latLngToContainerPoint(latlng);
      if (p.y > free - 24 || p.y < 24 || p.x < 24 || p.x > size.x - 24) map.panBy([p.x - size.x / 2, p.y - free / 2], { animate: !reduced() });
    }
  }
  function closeSheet() { if (!sheet || sheet.hidden) return; sheet.hidden = true; sheetBody.innerHTML = ''; }
  const isSheetOpen = () => !!sheet && !sheet.hidden;
  const classColor = k => (CONFIG.classes.find(c => c.k === k) || {}).color || '#9ca3af';
  const tip = id => { const r = scoreBy[id], c = r && CONFIG.classes.find(x => x.k === r.kelas);
    return `<b>${esc(id)}</b>${r && r.rank ? `<br>Kelas ${r.kelas} · ${esc(c.label)}<br>Skor ${r.score.toLocaleString('id-ID', { maximumFractionDigits: 1 })} · peringkat ${r.rank}` : '<br>skor tidak lengkap'}`; };
  function fit() { try { map.invalidateSize(); map.fitBounds((boundary || gridLayer).getBounds(), { padding: [12, 12] }); } catch (e) { /* belum ada data */ } }
  function setBoundary(fc) {
    boundary = L.geoJSON(fc, { interactive: false, style: { color: '#0f3d24', weight: 2.5, dashArray: '6 4', fill: false } }).addTo(map);
  }
  function setGrid(fc, onClick) {
    gridById = {}; lastStyle = {};
    gridLayer = L.geoJSON(fc, { style: { color: '#475569', weight: 1, fillOpacity: .5, fillColor: '#9ca3af' },
      onEachFeature: (f, l) => { const id = f.properties[CONFIG.fields.grid]; gridById[id] = l;
        // Tooltip hanya di perangkat yang bisa hover. Padanan ketuknya adalah lembar ringkasan grid (app.js).
        if (canHover()) l.bindTooltip(() => tip(id), { sticky: true, direction: 'top', offset: [0, -8] });
        l.on('click', () => onClick(id)); } }).addTo(map);
    layers.grid = gridLayer; gridLayer.bringToBack();
    fit();
  }
  /* Gaya hanya diterapkan bila berubah; tooltip dipasang sekali (isi dibaca dari scoreBy). */
  function styleFor(id) { const r = scoreBy[id], sel = id === selId;
    return { fillColor: classColor(r && r.kelas), fillOpacity: !r || r.score == null ? .2 : .62, color: sel ? '#111827' : '#ffffff', weight: sel ? 3 : .3, opacity: sel ? 1 : .55 }; }
  function restyle(id) { const l = gridById[id]; if (!l) return; const s = styleFor(id), k = s.fillColor + s.color + s.weight + s.fillOpacity + s.opacity;
    if (lastStyle[id] !== k) { lastStyle[id] = k; l.setStyle(s); } }
  function paintGrid(results, selected) { scoreBy = {}; results.forEach(r => { scoreBy[r.grid_id] = r; }); selId = selected; for (const id in gridById) restyle(id); }
  function selectGrid(id) { const p = selId; selId = id; if (p) restyle(p); restyle(id); if (gridById[id]) gridById[id].bringToFront(); }
  /* titleFn memberi nama aksesibel ikon (atribut title). contentFn berisi HTML untuk pop-up (desktop) atau lembar bawah (ponsel). */
  function setPoints(key, fc, contentFn, onClick, titleFn) {
    const prev = layers[key], was = prev && map.hasLayer(prev); if (prev) map.removeLayer(prev);
    const lyr = L.geoJSON(fc, { pointToLayer: (f, ll) => L.marker(ll, { icon: icon(key, key === 'fakultas' ? UI.pinSizeTujuan : UI.pinSize), title: titleFn ? titleFn(f.properties) : '', riseOnHover: true }),
      onEachFeature: (f, l) => { l._show = () => showFeature(l, contentFn, titleFn); l.on('click', () => { l._show(); if (onClick) onClick(f.properties); }); } });
    layers[key] = lyr; if (was) lyr.addTo(map); return lyr;
  }
  function showFeature(l, contentFn, titleFn) {
    const p = l.feature.properties, html = contentFn(p);
    if (sheetMode()) { openSheet(html, titleFn ? titleFn(p) : 'Detail', l.getLatLng()); return; }
    closeSheet(); l.unbindPopup(); l.bindPopup(html, popupOpts()).openPopup();
  }
  /* Pop-up tidak boleh lebih tinggi dari ruang peta: isi yang panjang digulir di dalam pop-up. */
  function popupOpts() {
    const el = map.getContainer(), h = el.clientHeight || 500, w = el.clientWidth || 360;
    return { maxWidth: Math.min(300, w - 60), maxHeight: Math.max(220, Math.min(380, Math.round(h * 0.62))),
             autoPanPaddingTopLeft: [12, 16], autoPanPaddingBottomRight: [12, 16] };
  }
  function toggle(key, on) { const l = layers[key]; if (!l) return; on ? l.addTo(map) : map.removeLayer(l); if (key !== 'grid' && gridLayer && on) gridLayer.bringToBack(); if (boundary) boundary.bringToFront(); }
  function focusGrid(id) { if (gridById[id]) map.fitBounds(gridById[id].getBounds(), { maxZoom: 17, padding: [30, 30] }); }
  function openPoint(key, idField, id) { const l = layers[key]; if (!l) return;
    l.eachLayer(mk => { if (mk.feature.properties[idField] === id) { map.setView(mk.getLatLng(), Math.max(map.getZoom(), 17), { animate: false }); mk._show(); } }); }
  function clearRoute() { routeGroup.clearLayers(); }
  function drawRoute(feat, startLL, endLL, startName, endName) {
    clearRoute();
    const coords = feat.geometry.coordinates.map(c => [c[1], c[0]]);
    L.polyline(coords, { color: '#fff', weight: 9, opacity: .95 }).addTo(routeGroup);
    const line = L.polyline(coords, { color: '#e11d48', weight: 5, opacity: 1 }).addTo(routeGroup);
    L.circleMarker(startLL, { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).bindTooltip('Awal: ' + esc(startName), { permanent: false }).addTo(routeGroup);
    L.circleMarker(endLL, { radius: 8, color: '#fff', weight: 3, fillColor: '#0F2A44', fillOpacity: 1 }).bindTooltip('Tujuan: ' + esc(endName)).addTo(routeGroup);
    map.fitBounds(line.getBounds(), { padding: [50, 50] });
  }
  function legend(el, items, range) {
    el.innerHTML = `<button class="lg-toggle" type="button" aria-expanded="true">Legenda</button><div class="lg-body">
      <div class="lg-h">Kelas aksesibilitas</div>${CONFIG.classes.slice().reverse().map(c => `<div class="lg-row"><span class="lg-sq" style="background:${c.color}"></span>${c.k} · ${esc(c.label)}</div>`).join('')}
      ${range ? `<div class="lg-note">Skor ${range[0].toLocaleString('id-ID', { maximumFractionDigits: 1 })} sampai ${range[1].toLocaleString('id-ID', { maximumFractionDigits: 1 })}, dibagi 5 interval sama</div>` : ''}
      <div class="lg-h">Titik</div>${items.map(k => `<div class="lg-row"><span class="lg-ic" style="background:${CONFIG.layers[k].color}">${svg(CONFIG.layers[k].icon, 11, '#fff')}</span>${esc(CONFIG.layers[k].label)}</div>`).join('')}
      <div class="lg-row"><span class="lg-bd"></span>Batas Kalurahan Sinduadi</div><div class="lg-row"><span class="lg-rt"></span>Rute tercepat</div></div>`;
    const t = el.querySelector('.lg-toggle'); t.onclick = () => { const o = el.classList.toggle('closed'); t.setAttribute('aria-expanded', String(!o)); };
    if (innerWidth <= UI.mobileMax && !el.dataset.init) { el.classList.add('closed'); t.setAttribute('aria-expanded', 'false'); }
    el.dataset.init = '1';
  }
  const invalidate = () => { if (map) map.invalidateSize(); };
  return { init, showBasemap, invalidate, openSheet, closeSheet, isSheetOpen, sheetMode, fit, setBoundary, setGrid, paintGrid, selectGrid, setPoints, toggle, focusGrid, openPoint, drawRoute, clearRoute, legend, icon, svg, esc, classColor, ICONS };
})();
