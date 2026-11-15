/* Peta Leaflet: basemap, ikon, layer, grid tematik, rute, legenda. */
const MapView = (() => {
  const ICONS = {
    cap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
    house: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/>',
    bus: '<rect x="4" y="4" width="16" height="13" rx="2"/><path d="M4 11h16M8 20v-3M16 20v-3"/>',
    shirt: '<path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z"/>',
    cart: '<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h3l3 12h10l2-8H6"/>',
    landmark: '<path d="M3 21h18M5 21V10M10 21V10M14 21V10M19 21V10M2 10l10-6 10 6z"/>',
    cross: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>'
  };
  const svg = (k, size, color) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let map, gridLayer, routeGroup, layers = {}, gridById = {}, scoreBy = {}, lastStyle = {}, selId = null;

  function icon(key, size) {
    const c = CONFIG.layers[key]; size = size || 22;
    return L.divIcon({ className: 'pin', iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2],
      html: `<div class="pin-in" style="background:${c.color};width:${size}px;height:${size}px">${svg(c.icon, size * 0.6, '#fff')}</div>` });
  }
  function init() {
    map = L.map('map', { zoomControl: true, preferCanvas: true }).setView(CONFIG.center, CONFIG.zoom);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO' }).addTo(map);
    routeGroup = L.layerGroup().addTo(map);
  }
  const scoreColor = s => s === null || s === undefined ? '#9ca3af' : `hsl(${Math.round(Math.max(0, Math.min(100, s)) * 1.2)},72%,48%)`;

  const tip = id => { const r = scoreBy[id]; return `${id}${r && r.rank ? ' · #' + r.rank + ' · skor ' + r.score.toFixed(1) : ' · skor tidak lengkap'}`; };
  function setGrid(fc, onClick) {
    gridById = {}; lastStyle = {};
    gridLayer = L.geoJSON(fc, { style: { color: '#475569', weight: 1, fillOpacity: .5, fillColor: '#9ca3af' },
      onEachFeature: (f, l) => { const id = f.properties[CONFIG.fields.grid]; gridById[id] = l; l.bindTooltip(() => tip(id), { sticky: true }); l.on('click', () => onClick(id)); } }).addTo(map);
    layers.grid = gridLayer; gridLayer.bringToBack();
    try { map.fitBounds(gridLayer.getBounds(), { padding: [20, 20] }); } catch (e) { /* grid kosong */ }
  }
  /* Gaya hanya diterapkan bila berubah; tooltip dipasang sekali (isi dibaca dari scoreBy). */
  function styleFor(id) { const r = scoreBy[id], sel = id === selId;
    return { fillColor: scoreColor(r && r.score), fillOpacity: !r || r.score == null ? .25 : .55, color: sel ? '#111827' : '#475569', weight: sel ? 3 : 1 }; }
  function restyle(id) { const l = gridById[id]; if (!l) return; const s = styleFor(id), k = s.fillColor + s.color + s.weight + s.fillOpacity;
    if (lastStyle[id] !== k) { lastStyle[id] = k; l.setStyle(s); } }
  function paintGrid(results, selected) { scoreBy = {}; results.forEach(r => { scoreBy[r.grid_id] = r; }); selId = selected; for (const id in gridById) restyle(id); }
  function selectGrid(id) { const p = selId; selId = id; if (p) restyle(p); restyle(id); if (gridById[id]) gridById[id].bringToFront(); }
  function setPoints(key, fc, popupFn, onClick) {
    const cfg = CONFIG.layers[key];
    const prev = layers[key], was = prev && map.hasLayer(prev); if (prev) map.removeLayer(prev);
    const lyr = L.geoJSON(fc, { pointToLayer: (f, ll) => L.marker(ll, { icon: icon(key, key === 'fakultas' ? 26 : 20) }),
      onEachFeature: (f, l) => { l.bindPopup(popupFn(f.properties)); if (onClick) l.on('click', () => onClick(f.properties)); } });
    layers[key] = lyr; if (was) lyr.addTo(map); return lyr;
  }
  function toggle(key, on) { const l = layers[key]; if (!l) return; on ? l.addTo(map) : map.removeLayer(l); if (key !== 'grid' && gridLayer && on) gridLayer.bringToBack(); }
  function focusGrid(id) { if (gridById[id]) map.fitBounds(gridById[id].getBounds(), { maxZoom: 17, padding: [30, 30] }); }
  function openPoint(key, idField, id) { const l = layers[key]; if (!l) return;
    l.eachLayer(mk => { if (mk.feature.properties[idField] === id) { map.setView(mk.getLatLng(), Math.max(map.getZoom(), 17)); mk.openPopup(); } }); }
  function clearRoute() { routeGroup.clearLayers(); }
  function drawRoute(feat, startLL, endLL, startName, endName) {
    clearRoute();
    const coords = feat.geometry.coordinates.map(c => [c[1], c[0]]);
    L.polyline(coords, { color: '#fff', weight: 9, opacity: .95 }).addTo(routeGroup);
    const line = L.polyline(coords, { color: '#e11d48', weight: 5, opacity: 1 }).addTo(routeGroup);
    L.circleMarker(startLL, { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).bindTooltip('Awal: ' + esc(startName), { permanent: false }).addTo(routeGroup);
    L.circleMarker(endLL, { radius: 8, color: '#fff', weight: 3, fillColor: '#14532d', fillOpacity: 1 }).bindTooltip('Tujuan: ' + esc(endName)).addTo(routeGroup);
    map.fitBounds(line.getBounds(), { padding: [50, 50] });
  }
  function legend(el, items, range) {
    el.innerHTML = '<b>Legenda</b>' + items.map(k => `<div class="lg-row"><span class="lg-ic" style="background:${CONFIG.layers[k].color}">${svg(CONFIG.layers[k].icon, 11, '#fff')}</span>${esc(CONFIG.layers[k].label)}</div>`).join('') +
      `<div class="lg-bar"></div><div class="lg-lab"><span>Skor rendah${range ? ' ' + range[0].toFixed(0) : ''}</span><span>tinggi${range ? ' ' + range[1].toFixed(0) : ''}</span></div><div class="lg-row"><span class="lg-sw"></span>Skor belum lengkap</div><div class="lg-row"><span class="lg-rt"></span>Rute jaringan jalan (GeoJSON)</div>`;
  }
  return { init, setGrid, paintGrid, selectGrid, setPoints, toggle, focusGrid, openPoint, drawRoute, clearRoute, legend, icon, svg, esc, scoreColor, ICONS };
})();
