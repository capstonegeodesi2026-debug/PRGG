/* Orkestrasi dashboard: memuat data, validasi, interaksi, ranking, rute. */
(async function () {
  const $ = id => document.getElementById(id), F = CONFIG.fields, esc = MapView.esc;
  const issues = [];
  const S = { grid: null, kos: null, fac: null, tables: {}, weights: {}, results: [], selected: null,
              kosById: {}, gridIds: [], gridSet: new Set(), gridProps: new Map(), present: {}, destIds: {}, routeCache: {} };
  const log = (level, msg) => { issues.push({ level, msg }); (level === 'error' ? console.error : console.warn)('[Sinduadi] ' + msg); };
  const num = (v, d = 0) => Number(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });

  /* ---------- Validasi & pemuatan ---------- */
  const coordsOK = c => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
  const walk = (c, fn) => Array.isArray(c) && typeof c[0] === 'number' ? fn(c) : Array.isArray(c) && c.every(x => Array.isArray(x)) ? c.every(x => walk(x, fn)) : false;
  function cleanFC(fc, label, types) {
    if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) { log('error', `${label}: bukan FeatureCollection GeoJSON yang valid.`); return null; }
    const declared = CRS.codeNum(fc.crs && fc.crs.properties && fc.crs.properties.name), cfgCode = CRS.codeNum(CONFIG.sourceCRS), code = declared || cfgCode;
    if (declared && declared !== cfgCode) log('warn', `${label}: CRS dalam file (EPSG:${declared}) berbeda dari CONFIG.sourceCRS (${CONFIG.sourceCRS}); CRS file dipakai.`);
    const conv = CRS.converter(code);
    if (conv === undefined) { log('error', `${label}: EPSG:${code} tidak didukung. Gunakan EPSG:4326 atau UTM WGS84 (EPSG:326xx/327xx).`); return null; }
    let geo = 0;
    const xf = c => Array.isArray(c) && typeof c[0] === 'number' ? (!conv ? c : (Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90 ? (geo++, c) : conv(c[0], c[1]))) : Array.isArray(c) ? c.map(xf) : c;
    const src = conv ? fc.features.map(f => f && f.geometry && f.geometry.coordinates ? { ...f, geometry: { ...f.geometry, coordinates: xf(f.geometry.coordinates) } } : f) : fc.features;
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
    if (bad) log('warn', `${label}: ${bad} fitur dibuang (geometri kosong/tidak valid atau tipe bukan ${types.join('/')}).`);
    if (outside) log('warn', `${label}: ${outside} fitur berada di luar wilayah Indonesia; periksa CRS file dan CONFIG.sourceCRS.`);
    return { ...fc, features: feats };
  }
  const hint = () => location.protocol === 'file:' ? ' Jalankan lewat Live Server atau GitHub Pages, bukan file://.' : '';
  async function loadJSON(path, label, types, quiet) {
    try { const r = await fetch(path); if (!r.ok) throw new Error('HTTP ' + r.status); return cleanFC(await r.json(), label, types); }
    catch (e) { if (!quiet) log('error', `${label}: file ${path} tidak dapat dimuat (${e.message}).${hint()}`); return null; }
  }
  async function loadCSV(path, label) {
    try { const r = await fetch(path); if (!r.ok) throw new Error('HTTP ' + r.status); return Scoring.parseCSV(await r.text()); }
    catch (e) { log('error', `${label}: file ${path} tidak dapat dimuat (${e.message}).${hint()}`); return null; }
  }
  function renderStatus() {
    const e = issues.filter(i => i.level === 'error').length, w = issues.filter(i => i.level === 'warn').length;
    $('statusBadge').textContent = e ? `${e} galat, ${w} peringatan` : w ? `${w} peringatan` : 'Data OK';
    $('statusBadge').className = 'badge ' + (e ? 'err' : w ? 'warn' : 'ok');
    $('statusList').innerHTML = (issues.length ? issues.map(i => `<li class="${i.level}">${esc(i.msg)}</li>`).join('') : '') + '<li class="ok">Semua file terbaca dan ID konsisten.</li>'.repeat(e + w ? 0 : 1);
  }

  MapView.init();
  const fasumKeys = Object.keys(CONFIG.layers).filter(k => CONFIG.layers[k].file);
  const [grid, kos, fac, batas] = await Promise.all([
    loadJSON(CONFIG.files.grid, 'Grid', ['Polygon', 'MultiPolygon']),
    loadJSON(CONFIG.files.akomodasi, 'Akomodasi', ['Point']),
    loadJSON(CONFIG.files.fakultas, 'Tujuan kampus', ['Point']),
    loadJSON(CONFIG.files.batas, 'Batas kalurahan', ['Polygon', 'MultiPolygon'], true)]);
  S.grid = grid; S.kos = kos; S.fac = fac;
  const fasum = {};
  await Promise.all(fasumKeys.map(async k => { fasum[k] = await loadJSON(CONFIG.layers[k].file, CONFIG.layers[k].label, ['Point']); }));

  S.gridIds = grid ? grid.features.map(f => f.properties[F.grid]) : [];
  S.gridSet = new Set(S.gridIds);
  if (grid) grid.features.forEach(f => S.gridProps.set(f.properties[F.grid], f.properties));
  if (S.gridSet.size !== S.gridIds.length) log('warn', 'Grid: ada grid_id duplikat.');
  if (S.gridIds.some(i => i === undefined || i === '')) log('warn', 'Grid: ada fitur tanpa grid_id.');
  if (kos) {
    kos.features.forEach(f => { const id = f.properties[F.kosId]; if (S.kosById[id]) log('warn', `Akomodasi: id_kos duplikat ${id}.`); S.kosById[id] = f; });
    const orphan = kos.features.filter(f => grid && !S.gridSet.has(f.properties[F.kosGrid])).map(f => f.properties[F.kosId]);
    if (orphan.length) log('warn', `Akomodasi: ${orphan.length} kos punya grid_id yang tidak ada di grid.geojson (${orphan.slice(0, 5).join(', ')}${orphan.length > 5 ? '…' : ''}).`);
  }
  for (const c of CONFIG.criteria) {
    if (c.gridField) {
      const none = grid ? grid.features.filter(f => !Number.isFinite(+f.properties[c.gridField]) || f.properties[c.gridField] === null).length : 0;
      if (grid && none) log('warn', `Grid: ${none} grid tanpa nilai ${c.gridField}; skor grid tsb ditandai belum lengkap.`);
      continue;
    }
    const src = c.dest === 'fakultas' ? fac : fasum[c.dest], idf = c.dest === 'fakultas' ? F.facId : CONFIG.layers[c.dest]?.id;
    S.destIds[c.key] = src ? new Set(src.features.map(f => f.properties[idf])) : null;
    const parsed = await loadCSV(c.csv, 'OD ' + c.label);
    S.tables[c.key] = parsed ? Scoring.buildTable(parsed, CONFIG.csv, 'OD ' + c.label, issues) : null;
    const t = S.tables[c.key]; if (!t) continue;
    const unk = [...t.pair.keys()].filter(o => !S.gridSet.has(o));
    if (unk.length) log('warn', `OD ${c.label}: ${unk.length} origin_id tidak ada di grid.geojson (${unk.slice(0, 5).join(', ')}).`);
    const none = S.gridIds.filter(g => !t.pair.has(g));
    if (none.length) log('warn', `OD ${c.label}: ${none.length} grid tidak punya baris valid (${none.slice(0, 5).join(', ')}); skor grid tsb ditandai belum lengkap.`);
    const dset = S.destIds[c.key];
    if (dset) { const ud = new Set(); t.pair.forEach(m => m.forEach((_, d) => { if (!dset.has(d)) ud.add(d); }));
      if (ud.size) log('warn', `OD ${c.label}: destination_id tidak cocok dengan GeoJSON: ${[...ud].slice(0, 5).join(', ')}.`); }
    if (c.byFaculty && fac) { const used = new Set(); t.pair.forEach(m => m.forEach((_, d) => used.add(d)));
      fac.features.forEach(f => { if (!used.has(f.properties[F.facId])) log('warn', `OD tujuan: tidak ada data waktu tempuh untuk ${f.properties[F.facId]}.`); }); }
  }

  /* ---------- Peta ---------- */
  if (batas) MapView.setBoundary(batas);
  if (grid) MapView.setGrid(grid, id => select(id, true));
  const popBase = (title, rows) => `<div class="pop"><b>${esc(title)}</b><table>${rows.filter(r => r[1] !== undefined && r[1] !== null && r[1] !== '').map(r => `<tr><td>${esc(r[0])}</td><td>${r[2] ? r[1] : esc(r[1])}</td></tr>`).join('')}</table></div>`;
  const isInap = p => /penginapan|hotel|homestay|guest/i.test(p[F.kosType] || '');
  const facCol = fid => String(fid || '').replace('-', '');          // TP-001 -> TP001
  const kosTrip = (p, fid) => { const w = p['waktu_' + facCol(fid)], d = p['jarak_' + facCol(fid)];
    return Number.isFinite(w) ? `${num(w, 1)} menit · ${d >= 1000 ? num(d / 1000, 2) + ' km' : num(d) + ' m'}` : null; };
  const safeUrl = u => /^https:\/\//i.test(u || '') ? u : null;
  S.type = ''; S.kosSel = null; S.route = null;
  S.price = '';
  const band = () => CONFIG.priceBands.find(b => b.id === S.price);
  const inBand = p => { const b = band(); if (!b) return true; const h = +p[F.kosPrice];
    return String(p[F.kosPriceUnit] || '').toLowerCase() === b.unit && Number.isFinite(h) && h >= b.min && h <= b.max; };
  const visKos = () => kos ? kos.features.filter(f => (!S.type || f.properties[F.kosType] === S.type) && inBand(f.properties)) : [];
  const rupiah = v => 'Rp' + Number(v).toLocaleString('id-ID', { maximumFractionDigits: 0 });
  const photo = p => p[F.kosPhoto] ? `<img class="kphoto" src="${esc(CONFIG.photoDir + p[F.kosPhoto])}" alt="Foto ${esc(p[F.kosName] || '')}" loading="lazy" onerror="this.remove()">` : '';
  const kosRows = p => { const fid = $('facultySelect').value, link = safeUrl(p.link_gmaps), g = S.byGrid && S.byGrid.get(p[F.kosGrid]);
    return [['ID', p[F.kosId]], ['Jenis', p[F.kosType]], ['Harga', Number.isFinite(+p[F.kosPrice]) && p[F.kosPrice] !== null ? `${rupiah(p[F.kosPrice])} per ${p[F.kosPriceUnit] || '-'}` : null], ['Padukuhan', p.padukuhan], ['Alamat', p.alamat],
      ['Rating Google', p.rating !== null && p.rating !== undefined ? num(p.rating, 1) : null],
      ['Ke ' + facShort(fid), kosTrip(p, fid)],
      ['Grid', g && g.score !== null ? `${p[F.kosGrid]} · skor ${num(g.score, 1)} (${clsLabel(g.kelas)})` : p[F.kosGrid]],
      ['Lokasi', link ? `<a href="${esc(link)}" target="_blank" rel="noopener">Buka di Google Maps</a>` : null, true]]; };
  function buildKos() { S.kosIdx = new Map(); visKos().forEach(f => { const g = f.properties[F.kosGrid]; if (!S.kosIdx.has(g)) S.kosIdx.set(g, []); S.kosIdx.get(g).push(f); });
    if (kos) MapView.setPoints('akomodasi', { ...kos, features: visKos() },
    p => photo(p) + popBase(p[F.kosName] || p[F.kosId], kosRows(p)) + `<button class="mini" data-route="${esc(p[F.kosId])}">Lihat rute ke tujuan</button>`, p => selectKos(p[F.kosId])); }
  if (fac) MapView.setPoints('fakultas', fac, p => popBase(p[F.facName] || p[F.facId], [['Kode', p[F.facId]], ['Singkatan', p.singkatan], ['Jenis', p.jenis]]));
  fasumKeys.forEach(k => { const c = CONFIG.layers[k]; if (fasum[k]) MapView.setPoints(k, fasum[k], p => popBase(p[c.name] || p[c.id],
    [['Kategori', c.label], ['ID', p[c.id]], ['Keterangan', p.keterangan], ['Peran', c.index ? 'Dipakai dalam skor aksesibilitas' : 'Informasi pendukung (tidak masuk skor)']])); });

  const layerKeys = ['grid', ...Object.keys(CONFIG.layers)];
  S.present = { grid: !!grid, akomodasi: !!kos, fakultas: !!fac, ...Object.fromEntries(fasumKeys.map(k => [k, !!fasum[k]])) };
  const small = innerWidth < 960;   // di ponsel hanya kos dan tujuan yang tampil di awal agar peta tidak penuh ikon
  const onByDefault = k => S.present[k] && !(CONFIG.layers[k] && (CONFIG.layers[k].off || (small && CONFIG.layers[k].file)));
  $('layerList').innerHTML = layerKeys.map(k => { const lab = k === 'grid' ? 'Grid kelas aksesibilitas' : CONFIG.layers[k].label, ok = S.present[k],
      n = k === 'grid' ? '' : k === 'akomodasi' ? (kos ? kos.features.length : '') : k === 'fakultas' ? (fac ? fac.features.length : '') : (fasum[k] ? fasum[k].features.length : '');
    return `<label class="chk${ok ? '' : ' off'}"><input type="checkbox" data-layer="${k}" ${onByDefault(k) ? 'checked' : ''} ${ok ? '' : 'disabled'}>${k === 'grid' ? '<span class="gdot"></span>' : `<span class="ldot" style="background:${CONFIG.layers[k].color}">${MapView.svg(CONFIG.layers[k].icon, 11, '#fff')}</span>`}<span class="lname">${esc(lab)}${CONFIG.layers[k]?.index ? '<i class="tag">skor</i>' : ''}</span>${n !== '' ? `<small>${n}</small>` : ''}${ok ? '' : ' <em>(file tidak ada)</em>'}</label>`; }).join('');
  $('layerList').addEventListener('change', e => { const k = e.target.dataset.layer; if (k) { MapView.toggle(k, e.target.checked); refreshLegend(); } });

  /* ---------- Kontrol ---------- */
  const facList = fac ? fac.features.map(f => ({ id: f.properties[F.facId], name: f.properties[F.facName] || f.properties[F.facId], short: f.properties.singkatan })).sort((a, b) => String(a.id).localeCompare(String(b.id))) : [];
  if (!facList.length && S.tables.waktu) { const s = new Set(); S.tables.waktu.pair.forEach(m => m.forEach((_, d) => s.add(d))); s.forEach(d => facList.push({ id: d, name: d })); log('warn', 'Dropdown tujuan dibuat dari OD Matrix karena fakultas.geojson tidak tersedia.'); }
  $('facultySelect').innerHTML = facList.length ? facList.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('') : '<option value="">(tujuan tidak tersedia)</option>';
  const facShort = fid => { const f = facList.find(x => x.id === fid); return f ? (f.short || f.name) : 'tujuan'; };
  const types = kos ? [...new Set(kos.features.map(f => f.properties[F.kosType]).filter(Boolean))].sort() : [];
  $('typeSelect').innerHTML = '<option value="">Semua akomodasi</option>' + types.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
  $('typeSelect').disabled = !kos;
  const units = new Set(kos ? kos.features.map(f => String(f.properties[F.kosPriceUnit] || '').toLowerCase()) : []);
  const grp = u => CONFIG.priceBands.filter(b => b.unit === u && units.has(u));
  $('priceSelect').innerHTML = '<option value="">Semua harga</option>' + ['bulan', 'malam'].map(u => grp(u).length ? `<optgroup label="${u === 'bulan' ? 'Kost (per bulan)' : 'Penginapan (per malam)'}">${grp(u).map(b => `<option value="${b.id}">${esc(b.label)}</option>`).join('')}</optgroup>` : '').join('');
  $('priceSelect').disabled = !kos || !units.size;
  buildKos();
  layerKeys.forEach(k => { if (onByDefault(k)) MapView.toggle(k, true); });

  CONFIG.criteria.forEach(c => S.weights[c.key] = c.weight);
  S.draft = { ...S.weights };
  const dirty = () => CONFIG.criteria.some(c => S.draft[c.key] !== S.weights[c.key]);
  const pct = v => num(v, 2) + '%';
  function runBusy(fn) { const b = $('busy'); b.hidden = false; setTimeout(() => { try { fn(); } finally { b.hidden = true; } }, 30); }
  function renderWeights() {
    const n = Scoring.normWeights(S.draft);
    $('weights').innerHTML = CONFIG.criteria.map(c => `<div class="wrow"><div><span>${esc(c.label)}</span><b id="wv-${c.key}">${pct(n[c.key])}</b></div><input type="range" min="0" max="100" step="0.05" value="${S.draft[c.key]}" data-w="${c.key}" aria-label="Bobot ${esc(c.label)}"></div>`).join('');
  }
  function updateWeightLabels() { const n = Scoring.normWeights(S.draft); CONFIG.criteria.forEach(c => $('wv-' + c.key).textContent = pct(n[c.key]));
    const tot = Object.values(n).reduce((x, y) => x + y, 0); $('weightTotal').textContent = tot ? num(tot, 0) + '%' : '0% (semua bobot nol)';
    const isDef = CONFIG.criteria.every(c => S.weights[c.key] === c.weight);
    $('weightMode').textContent = isDef ? 'Bobot AHP penelitian' : 'Bobot ubahan pengguna';
    $('weightMode').className = 'wmode' + (isDef ? '' : ' custom');
    const b = $('applyWeights'); b.disabled = !dirty(); b.textContent = dirty() ? 'Terapkan bobot' : 'Bobot sudah diterapkan'; }
  renderWeights(); updateWeightLabels();
  $('weights').addEventListener('input', e => { const k = e.target.dataset.w; if (k) { S.draft[k] = +e.target.value; updateWeightLabels(); } });
  $('applyWeights').onclick = () => runBusy(() => { S.weights = { ...S.draft }; updateWeightLabels(); recalc(); });
  $('resetWeights').onclick = () => { CONFIG.criteria.forEach(c => S.draft[c.key] = c.weight); renderWeights(); updateWeightLabels(); runBusy(() => { S.weights = { ...S.draft }; updateWeightLabels(); recalc(); }); };
  const facName = () => (facList.find(f => f.id === $('facultySelect').value) || {}).name || '(belum dipilih)';
  function resetRoute() { S.route = null; MapView.clearRoute(); renderRouteBar(); }
  $('facultySelect').onchange = () => { resetRoute(); runBusy(recalc); };
  $('priceSelect').onchange = () => { S.price = $('priceSelect').value; buildKos();
    if (S.kosSel && !visKos().includes(S.kosById[S.kosSel])) { S.kosSel = null; resetRoute(); }
    runBusy(recalc); };
  $('typeSelect').onchange = () => { S.type = $('typeSelect').value; buildKos();
    if (S.kosSel && !visKos().includes(S.kosById[S.kosSel])) { S.kosSel = null; resetRoute(); }
    runBusy(recalc); };

  /* ---------- Ranking & detail ---------- */
  const clsOf = k => CONFIG.classes.find(c => c.k === k);
  const clsLabel = k => (clsOf(k) || {}).label || 'tidak lengkap';
  const fmtVal = (c, v) => v === null || v === undefined ? '-' : c.unit === 'menit' ? num(v, 1) + ' menit' : c.unit === 'm' ? (v >= 1000 ? num(v / 1000, 2) + ' km' : num(v) + ' m') : num(v, 1) + ' ' + c.unit;
  const kosIn = g => S.kosIdx.get(g) || [];
  const RANK_STEP = 100; S.rankLimit = RANK_STEP;
  function recalc() {
    const fid = $('facultySelect').value;
    S.results = Scoring.compute(S.gridIds, S.tables, CONFIG.criteria, fid, S.weights, S.gridProps);
    S.byGrid = new Map(S.results.map(r => [r.grid_id, r])); S.rankLimit = RANK_STEP;
    MapView.paintGrid(S.results, S.selected);
    const vk = visKos(); $('gridCount').textContent = num(S.gridIds.length);
    $('accCount').textContent = kos ? vk.length : '-'; $('kosCount').textContent = kos ? vk.filter(f => !isInap(f.properties)).length : '-';
    $('inapCount').textContent = kos ? vk.filter(f => isInap(f.properties)).length : '-'; $('facInfo').textContent = facName();
    renderDist(); renderRanking(); refreshLegend(); renderDetail(); renderKos();
  }
  function renderDist() {   // sebaran grid dan kos per kelas
    const n = {}, nk = {}; CONFIG.classes.forEach(c => { n[c.k] = 0; nk[c.k] = 0; });
    S.results.forEach(r => { if (r.kelas) n[r.kelas]++; });
    visKos().forEach(f => { const r = S.byGrid.get(f.properties[F.kosGrid]); if (r && r.kelas) nk[r.kelas]++; });
    const tot = S.results.filter(r => r.kelas).length || 1;
    $('classDist').innerHTML = `<div class="cbar">${CONFIG.classes.map(c => `<i style="width:${n[c.k] / tot * 100}%;background:${c.color}" title="${esc(c.label)}: ${n[c.k]} grid"></i>`).join('')}</div>
      <table class="ctab"><tr><th>Kelas</th><th>Grid</th><th>Kos</th></tr>${CONFIG.classes.slice().reverse().map(c => `<tr><td><span class="sw" style="background:${c.color}"></span>${c.k} · ${esc(c.label)}</td><td>${num(n[c.k])}</td><td>${nk[c.k]}</td></tr>`).join('')}</table>`;
  }
  const rkItem = r => { const c = clsOf(r.kelas); return `<button class="rk${r.grid_id === S.selected ? ' sel' : ''}" data-grid="${esc(r.grid_id)}"><span class="rn">${r.rank ?? '–'}</span><span class="rt"><b>${esc(r.grid_id)}</b><small>${kosIn(r.grid_id).length} kos · ${esc(clsLabel(r.kelas))}</small></span><span class="rs"><i style="width:${r.score ?? 0}%;background:${c ? c.color : '#9ca3af'}"></i><b>${r.score === null ? 'n/a' : num(r.score, 1)}</b></span></button>`; };
  function renderRanking() {
    const rs = S.onlyKos ? S.results.filter(r => kosIn(r.grid_id).length) : S.results, shown = rs.slice(0, S.rankLimit), sel = S.byGrid && S.byGrid.get(S.selected);
    const pinned = sel && !shown.includes(sel) ? rkItem(sel) + '<div class="rkgap">· · ·</div>' : '';
    $('rankingList').innerHTML = rs.length ? pinned + shown.map(rkItem).join('') + (rs.length > shown.length ? `<button class="more" data-more="1">Tampilkan ${Math.min(RANK_STEP, rs.length - shown.length)} lagi (${shown.length} dari ${num(rs.length)})</button>` : '') : '<p class="hint">Tidak ada grid.</p>';
  }
  S.onlyKos = false;
  $('onlyKos').onchange = e => { S.onlyKos = e.target.checked; S.rankLimit = RANK_STEP; renderRanking(); };
  function refreshLegend() {
    MapView.legend($('legend'), Object.keys(CONFIG.layers).filter(k => S.present[k] && document.querySelector(`[data-layer="${k}"]`)?.checked), S.results.range);
  }
  function select(g, zoom) { S.selected = g; if (zoom) MapView.focusGrid(g); MapView.selectGrid(g); renderRanking(); renderDetail(); if (innerWidth < 960) $('gridDetail').scrollIntoView({ behavior: 'smooth' }); }
  $('rankingList').addEventListener('click', e => { if (e.target.closest('[data-more]')) { S.rankLimit += RANK_STEP; renderRanking(); return; } const b = e.target.closest('[data-grid]'); if (b) select(b.dataset.grid, true); });
  function renderDetail() {
    const el = $('gridDetail'), r = S.byGrid && S.byGrid.get(S.selected);
    if (!r) { el.innerHTML = '<p class="hint">Pilih grid pada peta atau daftar peringkat.</p>'; return; }
    const w = Scoring.normWeights(S.weights), ks = kosIn(r.grid_id), c = clsOf(r.kelas), gp = S.gridProps.get(r.grid_id) || {};
    const near = k => { const t = S.tables[k], n = t && t.nearest.get(r.grid_id); if (!n) return ''; const f = fasum[k] && fasum[k].features.find(x => x.properties[CONFIG.layers[k].id] === n.dest); return f ? `<small class="near">${esc(f.properties[CONFIG.layers[k].name] || n.dest)}</small>` : `<small class="near">${esc(n.dest)}</small>`; };
    el.innerHTML = `<h3>${esc(r.grid_id)} <span class="pill" style="background:${c ? c.color : '#9ca3af'};color:${r.kelas >= 4 || r.kelas === 1 ? '#fff' : '#1f2937'}">${r.score === null ? 'skor belum lengkap' : 'kelas ' + r.kelas + ' · ' + esc(c.label)}</span></h3>
      <p class="scoreline">Skor <b>${r.score === null ? 'n/a' : num(r.score, 2)}</b> dari 100 · peringkat ${r.rank ?? '–'} dari ${num(S.results.filter(x => x.score !== null).length)} grid untuk ${esc(facName())}</p>
      <table class="crit"><tr><th>Kriteria (bobot)</th><th>Nilai</th><th>Persentil</th><th>Poin</th></tr>${CONFIG.criteria.map(k => `<tr><td>${esc(k.label)} <small class="wt">(${num(w[k.key], 2)}%)</small>${k.gridField ? '' : k.byFaculty ? '' : near(k.key)}</td><td>${r.dist[k.key] === null ? '<em>tidak tersedia</em>' : fmtVal(k, r.dist[k.key])}${k.byFaculty && S.tables.waktu ? `<small class="near">${(v => v === null || v === undefined ? '' : 'jarak ' + fmtVal({ unit: 'm' }, v))(S.tables.waktu.pair.get(r.grid_id)?.get($('facultySelect').value)?.extra)}</small>` : ''}</td><td>${r.norm[k.key] === null ? '-' : num(r.norm[k.key], 1)}</td><td>${r.norm[k.key] === null ? '-' : num(r.norm[k.key] * w[k.key] / 100, 1)}</td></tr>`).join('')}<tr class="tot"><td colspan="3">Skor (jumlah poin)</td><td>${r.score === null ? 'n/a' : num(r.score, 1)}</td></tr></table>
      ${r.missing.length ? `<p class="warnbox">Data tidak tersedia untuk: ${r.missing.map(k => esc(CONFIG.criteria.find(c => c.key === k).label)).join(', ')}. Skor tidak dihitung (tidak diganti 0).</p>` : ''}
      <p class="hint">Persentil 100 berarti grid ini paling unggul pada kriteria tersebut dibanding seluruh grid. Poin = persentil × bobot, dan jumlah poin adalah skor. Kerapatan simpang radius 800 m (uji sensitivitas): ${gp.simpang_800 !== undefined ? num(gp.simpang_800, 1) + ' simpang/km²' : '-'}.</p>
      <h4>Akomodasi di grid ini (${ks.length}${S.type || S.price ? ', sesuai filter' : ''})</h4>
      ${ks.length ? `<ul class="koslist">${ks.map(f => `<li><div><b>${esc(f.properties[F.kosName] || f.properties[F.kosId])}</b><small>${esc(f.properties[F.kosId])}${f.properties[F.kosType] ? ' · ' + esc(f.properties[F.kosType]) : ''}</small></div><button class="mini" data-kos="${esc(f.properties[F.kosId])}">Lihat di peta</button></li>`).join('')}</ul>` : '<p class="hint">Tidak ada akomodasi di grid ini.</p>'}`;
  }

  /* ---------- Detail akomodasi & rute ---------- */
  function selectKos(id, fly) { S.kosSel = id; resetRoute(); renderKos(); if (fly) MapView.openPoint('akomodasi', F.kosId, id); }
  function renderKos() {
    const el = $('kosDetail'), f = S.kosById[S.kosSel];
    if (!f || !visKos().includes(f)) { el.innerHTML = '<p class="hint">Klik titik kos pada peta untuk melihat detail dan rute ke tujuan yang dipilih.</p>'; return; }
    const p = f.properties;
    el.innerHTML = photo(p) + `<h3>${esc(p[F.kosName] || p[F.kosId])}</h3><table class="crit kv">${kosRows(p).filter(r => r[1] !== null && r[1] !== undefined && r[1] !== '').map(r => `<tr><td>${esc(r[0])}</td><td>${r[2] ? r[1] : esc(r[1])}</td></tr>`).join('')}</table>
      <button class="route-btn" data-route="${esc(p[F.kosId])}">Lihat rute ke ${esc(facShort($('facultySelect').value))}</button>`;
  }
  function renderRouteBar() {
    const b = $('routeBar'); b.hidden = !S.route;
    b.className = 'routebar ' + (S.route ? S.route.kind : '');
    b.innerHTML = S.route ? S.route.html + '<button class="mini" data-closeroute="1">Tutup rute</button>' : '';
  }
  async function routesFor(fid) {
    if (!(fid in S.routeCache)) {
      S.routeCache[fid] = loadJSON(CONFIG.files.routes.replace('{id}', encodeURIComponent(fid)), 'Rute ' + fid, ['LineString'], true);
    }
    return S.routeCache[fid];
  }
  async function showRoute(kosId) {
    const fid = $('facultySelect').value, kf = S.kosById[kosId], ff = fac && fac.features.find(f => f.properties[F.facId] === fid);
    if (!kf) return;
    if (S.kosSel !== kosId) { S.kosSel = kosId; renderKos(); }
    MapView.clearRoute();
    if (!ff) { S.route = { kind: 'warn', html: '<div>Pilih tujuan kampus yang tersedia dalam data.</div>' }; renderRouteBar(); return; }
    const kn = kf.properties[F.kosName] || kosId, fn = ff.properties[F.facName] || fid;
    S.route = { kind: 'ok', html: '<div>Memuat rute…</div>' }; renderRouteBar();
    const routes = await routesFor(fid);
    if ($('facultySelect').value !== fid) return;      // pengguna sudah mengganti tujuan
    const rf = routes && routes.features.find(f => f.properties[F.routeKos] === kosId && f.properties[F.routeFac] === fid);
    if (!rf) { S.route = { kind: 'warn', html: `<div><b>Data rute untuk akomodasi dan tujuan ini belum tersedia.</b></div><small>${esc(kn)} → ${esc(fn)}</small>` }; renderRouteBar(); return; }
    const kl = kf.geometry.coordinates, fl = ff.geometry.coordinates;
    MapView.drawRoute(rf, [kl[1], kl[0]], [fl[1], fl[0]], kn, fn);
    if (innerWidth < 960) document.querySelector('.mapwrap').scrollIntoView({ behavior: 'smooth' });
    const p = rf.properties, ok = v => v !== null && v !== undefined && v !== '' && Number.isFinite(+v), km = v => +v >= 1000 ? num(v / 1000, 2) + ' km' : num(v) + ' m';
    S.route = { kind: 'ok', html: `<div><b>${esc(kn)} → ${esc(fn)}</b></div><div>Waktu tempuh: <b>${ok(p[F.routeTime]) ? num(p[F.routeTime], 1) + ' menit' : 'tidak tersedia'}</b> · Panjang rute: <b>${ok(p[F.routeDist]) ? km(p[F.routeDist]) : '-'}</b></div>${ok(p[F.routeShort]) && Math.abs(p[F.routeShort] - p[F.routeDist]) > 20 ? `<small>Jalur tercepat. Jalur terpendek ${km(p[F.routeShort])}, tetapi lebih lambat.</small>` : '<small>Jalur tercepat berdasarkan kecepatan kelas jalan.</small>'}` };
    renderRouteBar();
  }
  document.addEventListener('click', e => {
    const r = e.target.closest('[data-route]'); if (r) { showRoute(r.dataset.route); return; }
    if (e.target.closest('[data-closeroute]')) return resetRoute();
    const k = e.target.closest('[data-kos]'); if (k) selectKos(k.dataset.kos, true);
  });

  recalc(); renderStatus();
})();
