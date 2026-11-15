/* Orkestrasi dashboard: memuat data, validasi, interaksi, ranking, rute. */
(async function () {
  const $ = id => document.getElementById(id), F = CONFIG.fields, esc = MapView.esc;
  const issues = [];
  const S = { grid: null, kos: null, fac: null, routes: null, tables: {}, weights: {}, results: [], selected: null,
              kosById: {}, gridIds: [], present: {}, destIds: {} };
  const log = (level, msg) => { issues.push({ level, msg }); (level === 'error' ? console.error : console.warn)('[Sinduadi] ' + msg); };

  /* ---------- Validasi & pemuatan ---------- */
  const coordsOK = c => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
  const walk = (c, fn) => Array.isArray(c) && typeof c[0] === 'number' ? fn(c) : Array.isArray(c) && c.every(x => Array.isArray(x)) ? c.every(x => walk(x, fn)) : false;
  function cleanFC(fc, label, types) {
    if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) { log('error', `${label}: bukan FeatureCollection GeoJSON yang valid.`); return null; }
    const declared = CRS.codeNum(fc.crs && fc.crs.properties && fc.crs.properties.name), cfgCode = CRS.codeNum(CONFIG.sourceCRS), code = declared || cfgCode;
    if (declared && declared !== cfgCode) log('warn', `${label}: CRS dalam file (EPSG:${declared}) berbeda dari CONFIG.sourceCRS (${CONFIG.sourceCRS}); CRS file dipakai.`);
    const conv = CRS.converter(code);
    if (conv === undefined) { log('error', `${label}: EPSG:${code} tidak didukung. Gunakan EPSG:4326 atau UTM WGS84 (EPSG:326xx/327xx).`); return null; }
    let geo = 0;   // posisi yang tampak sudah lon/lat padahal CRS sumber UTM
    const xf = c => Array.isArray(c) && typeof c[0] === 'number' ? (!conv ? c : (Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90 ? (geo++, c) : conv(c[0], c[1]))) : Array.isArray(c) ? c.map(xf) : c;
    const src = fc.features.map(f => f && f.geometry && f.geometry.coordinates ? { ...f, geometry: { ...f.geometry, coordinates: xf(f.geometry.coordinates) } } : f);
    if (geo) log('warn', `${label}: ${geo} posisi tampak sudah berupa lon/lat padahal CRS sumber EPSG:${code}; diperlakukan apa adanya. Periksa CRS file.`);
    let bad = 0, outside = 0;
    const feats = src.filter(f => {
      const g = f && f.geometry;
      if (!g || !g.coordinates || !types.includes(g.type) || (Array.isArray(g.coordinates) && !g.coordinates.length)) { bad++; return false; }
      if (!walk(g.coordinates, coordsOK)) { bad++; return false; }
      let out = false; walk(g.coordinates, c => { if (c[0] < 94 || c[0] > 142 || c[1] < -12 || c[1] > 7) out = true; return true; });
      if (out) outside++;
      return true;
    });
    if (bad) log('warn', `${label}: ${bad} fitur dibuang (geometri kosong/tidak valid/koordinat di luar rentang atau tipe bukan ${types.join('/')}).`);
    if (outside) log('warn', `${label}: ${outside} fitur berada di luar wilayah Indonesia; periksa CRS file dan CONFIG.sourceCRS.`);
    return { ...fc, features: feats };
  }
  const hint = () => location.protocol === 'file:' ? ' Jalankan lewat Live Server, bukan file://.' : '';
  async function loadJSON(path, label, types) {
    try { const r = await fetch(path); if (!r.ok) throw new Error('HTTP ' + r.status); return cleanFC(await r.json(), label, types); }
    catch (e) { log('error', `${label}: file ${path} tidak dapat dimuat (${e.message}).${hint()}`); return null; }
  }
  async function loadCSV(path, label) {
    try { const r = await fetch(path); if (!r.ok) throw new Error('HTTP ' + r.status); return Scoring.parseCSV(await r.text()); }
    catch (e) { log('error', `${label}: file ${path} tidak dapat dimuat (${e.message}).${hint()}`); return null; }
  }
  function renderStatus() {
    const e = issues.filter(i => i.level === 'error').length, w = issues.filter(i => i.level === 'warn').length;
    $('statusBadge').textContent = e ? `${e} galat, ${w} peringatan` : w ? `${w} peringatan` : 'Data OK';
    $('statusBadge').className = 'badge ' + (e ? 'err' : w ? 'warn' : 'ok');
    $('statusList').innerHTML = issues.length ? issues.map(i => `<li class="${i.level}">${esc(i.msg)}</li>`).join('') : '<li class="ok">Semua file terbaca dan ID konsisten.</li>';
  }

  MapView.init();
  const fasumKeys = Object.keys(CONFIG.layers).filter(k => CONFIG.layers[k].file);
  const [grid, kos, fac, routes] = await Promise.all([
    loadJSON(CONFIG.files.grid, 'Grid', ['Polygon', 'MultiPolygon']),
    loadJSON(CONFIG.files.akomodasi, 'Akomodasi', ['Point']),
    loadJSON(CONFIG.files.fakultas, 'Fakultas', ['Point']),
    loadJSON(CONFIG.files.routes, 'Rute', ['LineString'])]);
  S.grid = grid; S.kos = kos; S.fac = fac; S.routes = routes;
  const fasum = {};
  await Promise.all(fasumKeys.map(async k => { fasum[k] = await loadJSON(CONFIG.layers[k].file, CONFIG.layers[k].label, ['Point']); }));

  S.gridIds = grid ? grid.features.map(f => f.properties[F.grid]) : [];
  if (new Set(S.gridIds).size !== S.gridIds.length) log('warn', 'Grid: ada grid_id duplikat.');
  if (S.gridIds.some(i => i === undefined || i === '')) log('warn', 'Grid: ada fitur tanpa grid_id.');
  if (kos) {
    kos.features.forEach(f => { const id = f.properties[F.kosId]; if (S.kosById[id]) log('warn', `Akomodasi: id_kos duplikat ${id}.`); S.kosById[id] = f; });
    const orphan = kos.features.filter(f => grid && !S.gridIds.includes(f.properties[F.kosGrid])).map(f => f.properties[F.kosId]);
    if (orphan.length) log('warn', `Akomodasi: ${orphan.length} kos punya grid_id yang tidak ada di grid.geojson (${orphan.slice(0, 5).join(', ')}${orphan.length > 5 ? '…' : ''}).`);
  }
  for (const c of CONFIG.criteria) {                      // ID tujuan per kriteria
    const src = c.dest === 'fakultas' ? fac : fasum[c.dest], idf = c.dest === 'fakultas' ? F.facId : CONFIG.layers[c.dest]?.id;
    S.destIds[c.key] = src ? new Set(src.features.map(f => f.properties[idf])) : null;
  }
  for (const c of CONFIG.criteria) {                      // OD Matrix
    const parsed = await loadCSV(c.csv, 'OD ' + c.label);
    S.tables[c.key] = parsed ? Scoring.buildTable(parsed, CONFIG.csv, 'OD ' + c.label, issues) : null;
    const t = S.tables[c.key]; if (!t) continue;
    const unk = [...t.pair.keys()].filter(o => !S.gridIds.includes(o));
    if (unk.length) log('warn', `OD ${c.label}: ${unk.length} origin_id tidak ada di grid.geojson (${unk.slice(0, 5).join(', ')}).`);
    const none = S.gridIds.filter(g => !t.pair.has(g));
    if (none.length) log('warn', `OD ${c.label}: ${none.length} grid tidak punya baris valid (${none.slice(0, 5).join(', ')}); skor grid tsb ditandai belum lengkap.`);
    const dset = S.destIds[c.key];
    if (dset) { const ud = new Set(); t.pair.forEach(m => m.forEach((_, d) => { if (!dset.has(d)) ud.add(d); }));
      if (ud.size) log('warn', `OD ${c.label}: destination_id tidak cocok dengan GeoJSON: ${[...ud].slice(0, 5).join(', ')}.`); }
    if (c.byFaculty && fac) { const used = new Set(); t.pair.forEach(m => m.forEach((_, d) => used.add(d)));
      fac.features.forEach(f => { if (!used.has(f.properties[F.facId])) log('warn', `OD fakultas: tidak ada data jarak untuk ${f.properties[F.facId]}.`); }); }
  }
  if (routes) {
    const fids = new Set(fac ? fac.features.map(f => f.properties[F.facId]) : []);
    const bad = routes.features.filter(f => !S.kosById[f.properties[F.routeKos]] || (fac && !fids.has(f.properties[F.routeFac])));
    if (bad.length) log('warn', `Rute: ${bad.length} rute memakai id_kos/faculty_id yang tidak cocok.`);
    const short = routes.features.filter(f => f.geometry.coordinates.length < 2).length;
    if (short) log('warn', `Rute: ${short} rute punya <2 titik.`);
  }

  /* ---------- Peta ---------- */
  if (grid) MapView.setGrid(grid, id => select(id, true));
  const popBase = (title, rows) => `<div class="pop"><b>${esc(title)}</b><table>${rows.filter(r => r[1] !== undefined && r[1] !== '').map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table></div>`;
  /* Akomodasi: filter jenis (tidak memengaruhi skor), popup, panel detail */
  const isInap = p => /penginapan|hotel|homestay|guest/i.test(p[F.kosType] || '');
  const HIDE = /harga|price|tarif|biaya/i;
  S.type = ''; S.kosSel = null; S.route = null;
  const visKos = () => kos ? kos.features.filter(f => !S.type || f.properties[F.kosType] === S.type) : [];
  const kosRows = p => { const rows = [['ID', p[F.kosId]], ['Jenis', p[F.kosType]], ['Grid', p[F.kosGrid]]], known = [F.kosId, F.kosName, F.kosType, F.kosGrid];
    Object.entries(p).forEach(([k, v]) => { if (!known.includes(k) && !HIDE.test(k) && v !== null && v !== '') rows.push([k, v]); }); return rows; };
  function buildKos() { S.kosIdx = new Map(); visKos().forEach(f => { const g = f.properties[F.kosGrid]; if (!S.kosIdx.has(g)) S.kosIdx.set(g, []); S.kosIdx.get(g).push(f); });
    if (kos) MapView.setPoints('akomodasi', { ...kos, features: visKos() },
    p => popBase(p[F.kosName] || p[F.kosId], kosRows(p)) + `<button class="mini" data-route="${esc(p[F.kosId])}">Lihat Rute ke Fakultas</button>`, p => selectKos(p[F.kosId])); }
  buildKos();
  if (fac) MapView.setPoints('fakultas', fac, p => popBase(p[F.facName] || p[F.facId], [['ID', p[F.facId]]]));
  fasumKeys.forEach(k => { const c = CONFIG.layers[k]; if (fasum[k]) MapView.setPoints(k, fasum[k], p => popBase(p[c.name] || p[c.id], [['Kategori', c.label], ['ID', p[c.id]], ['Jenis', p.jenis]])); });

  const layerKeys = ['grid', ...Object.keys(CONFIG.layers)];
  S.present = { grid: !!grid, akomodasi: !!kos, fakultas: !!fac, ...Object.fromEntries(fasumKeys.map(k => [k, !!fasum[k]])) };
  $('layerList').innerHTML = layerKeys.map(k => { const lab = k === 'grid' ? 'Grid (skor WSM)' : CONFIG.layers[k].label, ok = S.present[k];
    return `<label class="chk${ok ? '' : ' off'}"><input type="checkbox" data-layer="${k}" ${ok ? 'checked' : 'disabled'}>${k === 'grid' ? '<span class="gdot"></span>' : `<span class="ldot" style="background:${CONFIG.layers[k].color}">${MapView.svg(CONFIG.layers[k].icon, 11, '#fff')}</span>`}${esc(lab)}${ok ? '' : ' <em>(file tidak ada)</em>'}</label>`; }).join('');
  layerKeys.forEach(k => { if (S.present[k]) MapView.toggle(k, true); });
  $('layerList').addEventListener('change', e => { const k = e.target.dataset.layer; if (k) { MapView.toggle(k, e.target.checked); refreshLegend(); } });

  /* ---------- Kontrol ---------- */
  const facList = fac ? fac.features.map(f => ({ id: f.properties[F.facId], name: f.properties[F.facName] || f.properties[F.facId] })) : [];
  if (!facList.length && S.tables.fakultas) { const s = new Set(); S.tables.fakultas.pair.forEach(m => m.forEach((_, d) => s.add(d))); s.forEach(d => facList.push({ id: d, name: d })); log('warn', 'Dropdown fakultas dibuat dari OD Matrix karena fakultas.geojson tidak tersedia.'); }
  $('facultySelect').innerHTML = facList.length ? facList.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('') : '<option value="">(fakultas tidak tersedia)</option>';
  const types = kos ? [...new Set(kos.features.map(f => f.properties[F.kosType]).filter(Boolean))].sort() : [];
  $('typeSelect').innerHTML = '<option value="">Semua akomodasi</option>' + types.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
  $('typeSelect').disabled = !kos;
  CONFIG.criteria.forEach(c => S.weights[c.key] = c.weight);
  S.draft = { ...S.weights };                       // bobot yang sedang digeser; baru dipakai setelah "Terapkan"
  const dirty = () => CONFIG.criteria.some(c => S.draft[c.key] !== S.weights[c.key]);
  function runBusy(fn) { const b = $('busy'); b.hidden = false; setTimeout(() => { try { fn(); } finally { b.hidden = true; } }, 30); }
  function renderWeights() {
    const n = Scoring.normWeights(S.draft);
    $('weights').innerHTML = CONFIG.criteria.map(c => `<div class="wrow"><div><span>${esc(c.label)}</span><b id="wv-${c.key}">${n[c.key].toFixed(0)}%</b></div><input type="range" min="0" max="100" step="1" value="${S.draft[c.key]}" data-w="${c.key}"></div>`).join('');
  }
  function updateWeightLabels() { const n = Scoring.normWeights(S.draft); CONFIG.criteria.forEach(c => $('wv-' + c.key).textContent = n[c.key].toFixed(0) + '%');
    const tot = Object.values(n).reduce((x, y) => x + y, 0); $('weightTotal').textContent = tot ? tot.toFixed(0) + '%' : '0% (semua bobot nol)';
    const b = $('applyWeights'); b.disabled = !dirty(); b.textContent = dirty() ? 'Terapkan bobot (belum diterapkan)' : 'Bobot sudah diterapkan'; }
  renderWeights(); updateWeightLabels();
  $('weights').addEventListener('input', e => { const k = e.target.dataset.w; if (k) { S.draft[k] = +e.target.value; updateWeightLabels(); } });   // hanya label; peta tidak dihitung ulang
  $('applyWeights').onclick = () => runBusy(() => { S.weights = { ...S.draft }; updateWeightLabels(); recalc(); });
  $('resetWeights').onclick = () => { CONFIG.criteria.forEach(c => S.draft[c.key] = c.weight); renderWeights(); updateWeightLabels(); runBusy(() => { S.weights = { ...S.draft }; updateWeightLabels(); recalc(); }); };
  const facName = () => (facList.find(f => f.id === $('facultySelect').value) || {}).name || '(belum dipilih)';
  function resetRoute() { S.route = null; MapView.clearRoute(); renderRouteBar(); }
  $('facultySelect').onchange = () => { resetRoute(); runBusy(recalc); };           // ganti fakultas: rute lama dihapus
  $('typeSelect').onchange = () => { S.type = $('typeSelect').value; buildKos();
    if (S.kosSel && !visKos().includes(S.kosById[S.kosSel])) { S.kosSel = null; resetRoute(); }
    runBusy(recalc); };

  /* ---------- Ranking & detail ---------- */
  const fmt = v => v === null || v === undefined ? '—' : Math.round(v).toLocaleString('id-ID') + ' m';
  const kosIn = g => S.kosIdx.get(g) || [];
  const RANK_STEP = 100; S.rankLimit = RANK_STEP;
  function recalc() {
    const fid = $('facultySelect').value;
    S.results = Scoring.compute(S.gridIds, S.tables, CONFIG.criteria, fid, S.weights);
    S.byGrid = new Map(S.results.map(r => [r.grid_id, r])); S.rankLimit = RANK_STEP;
    const ok = S.results.filter(r => r.score !== null);
    MapView.paintGrid(S.results, S.selected);
    const vk = visKos(); $('gridCount').textContent = S.gridIds.length;
    $('accCount').textContent = kos ? vk.length : '—'; $('kosCount').textContent = kos ? vk.filter(f => !isInap(f.properties)).length : '—';
    $('inapCount').textContent = kos ? vk.filter(f => isInap(f.properties)).length : '—'; $('facInfo').textContent = facName();
    renderRanking();
    refreshLegend(ok.length ? [Math.min(...ok.map(r => r.score)), Math.max(...ok.map(r => r.score))] : null);
    renderDetail(); renderKos();
  }
  const rkItem = r => `<button class="rk${r.grid_id === S.selected ? ' sel' : ''}" data-grid="${esc(r.grid_id)}"><span class="rn">${r.rank ?? '–'}</span><span class="rt"><b>${esc(r.grid_id)}</b><small>${kosIn(r.grid_id).length} kos${r.score === null ? ' · skor belum lengkap' : ''}</small></span><span class="rs"><i style="width:${r.score ?? 0}%;background:${MapView.scoreColor(r.score)}"></i><b>${r.score === null ? 'n/a' : r.score.toFixed(1)}</b></span></button>`;
  function renderRanking() {   // hanya sebagian daftar yang digambar (ringan untuk ribuan grid)
    const rs = S.results, shown = rs.slice(0, S.rankLimit), sel = S.byGrid && S.byGrid.get(S.selected);
    const pinned = sel && !shown.includes(sel) ? rkItem(sel) + '<div class="rkgap">· · ·</div>' : '';
    $('rankingList').innerHTML = rs.length ? pinned + shown.map(rkItem).join('') + (rs.length > shown.length ? `<button class="more" data-more="1">Tampilkan ${Math.min(RANK_STEP, rs.length - shown.length)} lagi (${shown.length} dari ${rs.length})</button>` : '') : '<p class="hint">Tidak ada grid.</p>';
  }
  function refreshLegend(range) {
    S.range = range === undefined ? S.range : range;
    MapView.legend($('legend'), Object.keys(CONFIG.layers).filter(k => S.present[k] && document.querySelector(`[data-layer="${k}"]`)?.checked), S.range);
  }
  function select(g, zoom) { S.selected = g; if (zoom) MapView.focusGrid(g); MapView.selectGrid(g); renderRanking(); renderDetail(); if (innerWidth < 960) $('gridDetail').scrollIntoView({ behavior: 'smooth' }); }
  $('rankingList').addEventListener('click', e => { if (e.target.closest('[data-more]')) { S.rankLimit += RANK_STEP; renderRanking(); return; } const b = e.target.closest('[data-grid]'); if (b) select(b.dataset.grid, true); });
  function renderDetail() {
    const el = $('gridDetail'), r = S.byGrid && S.byGrid.get(S.selected);
    if (!r) { el.innerHTML = '<p class="hint">Pilih grid pada peta atau daftar ranking.</p>'; return; }
    const w = Scoring.normWeights(S.weights), ks = kosIn(r.grid_id);
    el.innerHTML = `<h3>${esc(r.grid_id)} <span class="pill" style="background:${MapView.scoreColor(r.score)}">${r.score === null ? 'skor belum lengkap' : 'skor ' + r.score.toFixed(1) + ' · peringkat ' + r.rank}</span></h3>
      <table class="crit"><tr><th>Kriteria</th><th>Jarak</th><th>Nilai</th><th>Bobot</th></tr>${CONFIG.criteria.map(c => `<tr><td>${esc(c.label)}</td><td>${r.dist[c.key] === null ? '<em>tidak tersedia</em>' : fmt(r.dist[c.key])}</td><td>${r.norm[c.key] === null ? '—' : r.norm[c.key].toFixed(0)}</td><td>${w[c.key].toFixed(0)}%</td></tr>`).join('')}</table>
      ${r.missing.length ? `<p class="warnbox">Data jarak tidak tersedia untuk: ${r.missing.map(k => esc(CONFIG.criteria.find(c => c.key === k).label)).join(', ')}. Skor tidak dihitung (tidak diganti 0).</p>` : ''}
      <h4>Akomodasi di grid ini (${ks.length}${S.type ? ', filter: ' + esc(S.type) : ''})</h4>
      ${ks.length ? `<ul class="koslist">${ks.map(f => `<li><div><b>${esc(f.properties[F.kosName] || f.properties[F.kosId])}</b><small>${esc(f.properties[F.kosId])}${f.properties[F.kosType] ? ' · ' + esc(f.properties[F.kosType]) : ''}</small></div><button class="mini" data-kos="${esc(f.properties[F.kosId])}">Lihat di peta</button></li>`).join('')}</ul>` : '<p class="hint">Tidak ada akomodasi di grid ini.</p>'}`;
  }

  /* ---------- Detail akomodasi & rute (hanya menampilkan geometri QNEAT3 dari GeoJSON) ---------- */
  function selectKos(id, fly) { S.kosSel = id; resetRoute(); renderKos(); if (fly) MapView.openPoint('akomodasi', F.kosId, id); }
  function renderKos() {
    const el = $('kosDetail'), f = S.kosById[S.kosSel];
    if (!f || !visKos().includes(f)) { el.innerHTML = '<p class="hint">Klik titik kos pada peta untuk melihat detail dan rute ke fakultas tujuan.</p>'; return; }
    const p = f.properties;
    el.innerHTML = `<h3>${esc(p[F.kosName] || p[F.kosId])}</h3><table class="crit">${kosRows(p).map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>
      <button class="route-btn" data-route="${esc(p[F.kosId])}">Lihat Rute ke Fakultas</button><p class="hint">Fakultas tujuan aktif: ${esc(facName())}</p>`;
  }
  function renderRouteBar() {
    const b = $('routeBar'); b.hidden = !S.route;
    b.className = 'routebar ' + (S.route ? S.route.kind : '');
    b.innerHTML = S.route ? S.route.html + '<button class="mini" data-closeroute="1">Tutup Rute</button>' : '';
  }
  function showRoute(kosId) {
    const fid = $('facultySelect').value, kf = S.kosById[kosId], ff = fac && fac.features.find(f => f.properties[F.facId] === fid);
    if (!kf) return;
    if (S.kosSel !== kosId) { S.kosSel = kosId; renderKos(); }
    MapView.clearRoute();
    if (!ff) { S.route = { kind: 'warn', html: '<div>Pilih fakultas tujuan yang tersedia dalam data.</div>' }; renderRouteBar(); return; }
    const kn = kf.properties[F.kosName] || kosId, fn = ff.properties[F.facName] || fid;
    const rf = routes && routes.features.find(f => f.properties[F.routeKos] === kosId && f.properties[F.routeFac] === fid);
    if (!rf) { S.route = { kind: 'warn', html: `<div><b>Data rute untuk akomodasi dan fakultas ini belum tersedia.</b></div><small>${esc(kn)} → ${esc(fn)}</small>` }; renderRouteBar(); return; }
    const kl = kf.geometry.coordinates, fl = ff.geometry.coordinates;
    MapView.drawRoute(rf, [kl[1], kl[0]], [fl[1], fl[0]], kn, fn);
    const d = rf.properties[F.routeDist], t = rf.properties[F.routeTime], sim = /simulasi/i.test(routes.name || ''), ok = v => v !== null && v !== undefined && v !== '' && Number.isFinite(+v);
    S.route = { kind: 'ok', html: `<div><b>${esc(kn)} → ${esc(fn)}</b></div><div>Jarak: <b>${ok(d) ? (+d >= 1000 ? (d / 1000).toFixed(2) + ' km' : Math.round(d) + ' m') : 'tidak tersedia'}</b> · Waktu: <b>${ok(t) ? (+t).toFixed(1) + ' menit' : 'tidak tersedia'}</b></div>${sim ? '<div class="sim">Rute SIMULASI, bukan hasil QNEAT3.</div>' : ''}` };
    renderRouteBar();
  }
  document.addEventListener('click', e => {
    const r = e.target.closest('[data-route]'); if (r) return showRoute(r.dataset.route);
    if (e.target.closest('[data-closeroute]')) return resetRoute();
    const k = e.target.closest('[data-kos]'); if (k) selectKos(k.dataset.kos, true);
  });

  recalc(); renderStatus();
})();
