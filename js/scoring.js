/* Parsing OD Matrix + Weighted Sum Model. Tidak bergantung pada DOM. */
const Scoring = (() => {
  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (!lines.length) return { header: [], rows: [] };
    const split = l => { const o = []; let cur = '', q = false;
      for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(cur); cur = ''; } else cur += ch; }
      o.push(cur); return o.map(s => s.trim()); };
    const header = split(lines[0]).map(h => h.toLowerCase());
    const rows = lines.slice(1).map(l => { const c = split(l), o = {}; header.forEach((h, i) => o[h] = c[i] ?? ''); return o; });
    return { header, rows };
  }
  const toCost = v => { const s = String(v ?? '').trim();
    if (s === '' || /^(null|nan|none|na|n\/a)$/i.test(s)) return null;
    const n = Number(s); return Number.isFinite(n) ? n : null; };

  /* Bangun tabel jarak. Mengembalikan {nearest: Map(origin->{cost,dest}), pair: Map(origin->Map(dest->cost))}.
     NULL dan 0 TIDAK diubah menjadi angka: dilewati dan dicatat sebagai isu. */
  function buildTable(parsed, csvCfg, label, issues) {
    const { origin, dest, cost } = csvCfg;
    const miss = [origin, dest, cost].filter(c => !parsed.header.includes(c));
    if (miss.length) { issues.push({ level: 'error', msg: `${label}: kolom tidak ditemukan: ${miss.join(', ')}` }); return null; }
    const nearest = new Map(), pair = new Map(); let nNull = 0, nZero = 0, nNeg = 0;
    for (const r of parsed.rows) {
      const o = r[origin], d = r[dest], c = toCost(r[cost]);
      if (c === null) { nNull++; continue; }
      if (c === 0) { nZero++; continue; }
      if (c < 0) { nNeg++; continue; }
      if (!pair.has(o)) pair.set(o, new Map());
      const m = pair.get(o); if (!m.has(d) || c < m.get(d)) m.set(d, c);
      if (!nearest.has(o) || c < nearest.get(o).cost) nearest.set(o, { cost: c, dest: d });
    }
    if (nNull) issues.push({ level: 'warn', msg: `${label}: ${nNull} baris total_cost NULL/kosong diabaikan (tidak dianggap 0).` });
    if (nZero) issues.push({ level: 'warn', msg: `${label}: ${nZero} baris total_cost = 0 diabaikan; periksa snapping/jaringan di QGIS.` });
    if (nNeg) issues.push({ level: 'warn', msg: `${label}: ${nNeg} baris total_cost negatif diabaikan.` });
    return { nearest, pair };
  }

  /* Normalisasi bobot ke total 100. */
  function normWeights(raw) {
    const sum = Object.values(raw).reduce((a, b) => a + b, 0), out = {};
    for (const k in raw) out[k] = sum > 0 ? raw[k] / sum * 100 : 0;
    return out;
  }

  /* WSM. Skor jarak (cost criterion, min-max terbalik): s = (max - d) / (max - min) * 100.
     Bila max == min, semua grid bernilai 100 (tidak ada pembeda).
     Grid yang tidak punya nilai valid pada kriteria berbobot > 0 => skor null (tidak lengkap), bukan 0. */
  function compute(gridIds, tables, criteria, facultyId, weights) {
    const w = normWeights(weights), dist = {}, range = {};
    for (const c of criteria) {
      const t = tables[c.key]; dist[c.key] = {};
      for (const g of gridIds) {
        let v = null;
        if (t) v = c.byFaculty ? (t.pair.get(g)?.get(facultyId) ?? null) : (t.nearest.get(g)?.cost ?? null);
        dist[c.key][g] = v;
      }
      const vals = Object.values(dist[c.key]).filter(v => v !== null);
      range[c.key] = vals.length ? { min: Math.min(...vals), max: Math.max(...vals) } : null;
    }
    const res = gridIds.map(g => {
      const norm = {}, missing = []; let score = 0;
      for (const c of criteria) {
        const d = dist[c.key][g], r = range[c.key];
        if (d === null || !r) { norm[c.key] = null; if (w[c.key] > 0) missing.push(c.key); continue; }
        norm[c.key] = r.max === r.min ? 100 : (r.max - d) / (r.max - r.min) * 100;
        score += norm[c.key] * w[c.key] / 100;
      }
      return { grid_id: g, score: missing.length ? null : score, dist: Object.fromEntries(criteria.map(c => [c.key, dist[c.key][g]])), norm, missing };
    });
    res.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    let rank = 0; res.forEach(r => { r.rank = r.score === null ? null : ++rank; });
    return res;
  }
  return { parseCSV, buildTable, normWeights, compute };
})();
if (typeof module !== 'undefined') module.exports = Scoring;
