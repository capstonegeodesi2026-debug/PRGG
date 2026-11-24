/* Parsing OD Matrix + skoring metode laporan (Tahap 9): persentil (percent_rank) x bobot AHP, lalu 5 kelas interval sama.
   Tidak bergantung pada DOM, sehingga bisa diuji di Node. */
const Scoring = (() => {
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
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

  /* Tabel OD -> {nearest: Map(origin->{cost,dest,extra}), pair: Map(origin->Map(dest->{cost,extra}))}.
     NULL/negatif dilewati dan dicatat. Nilai 0 sah (titik tepat di jalan/tujuan) tetapi dicatat sebagai info. */
  function buildTable(parsed, csvCfg, label, issues) {
    const { origin, dest, cost, extra } = csvCfg;
    const miss = [origin, dest, cost].filter(c => !parsed.header.includes(c));
    if (miss.length) { issues.push({ level: 'error', msg: `${label}: kolom tidak ditemukan: ${miss.join(', ')}` }); return null; }
    const hasExtra = extra && parsed.header.includes(extra);
    const nearest = new Map(), pair = new Map(); let nNull = 0, nZero = 0, nNeg = 0;
    for (const r of parsed.rows) {
      const o = r[origin], d = r[dest], c = toCost(r[cost]), x = hasExtra ? toCost(r[extra]) : null;
      if (c === null) { nNull++; continue; }
      if (c < 0) { nNeg++; continue; }
      if (c === 0) nZero++;
      if (!pair.has(o)) pair.set(o, new Map());
      const m = pair.get(o); if (!m.has(d) || c < m.get(d).cost) m.set(d, { cost: c, extra: x });
      if (!nearest.has(o) || c < nearest.get(o).cost) nearest.set(o, { cost: c, dest: d, extra: x });
    }
    if (nNull) issues.push({ level: 'warn', msg: `${label}: ${nNull} baris total_cost NULL/kosong diabaikan (tidak dianggap 0).` });
    if (nZero) issues.push({ level: 'info', msg: `${label}: ${nZero} baris bernilai 0 (titik tepat di lokasi tujuan).` });
    if (nNeg) issues.push({ level: 'warn', msg: `${label}: ${nNeg} baris total_cost negatif diabaikan.` });
    return { nearest, pair };
  }

  /* Normalisasi bobot ke total 100. */
  function normWeights(raw) {
    const sum = Object.values(raw).reduce((a, b) => a + b, 0), out = {};
    for (const k in raw) out[k] = sum > 0 ? raw[k] / sum * 100 : 0;
    return out;
  }

  /* percent_rank SQLite/SQL standar: (rank - 1) / (n - 1), rank = 1 + jumlah nilai yang mendahului (ties memakai rank terkecil).
     cost   -> ORDER BY nilai DESC: nilai paling besar = 0, paling kecil = 1 (waktu/jarak pendek lebih baik).
     benefit-> ORDER BY nilai ASC : nilai paling kecil = 0, paling besar = 1 (kerapatan simpang tinggi lebih baik). */
  function percentRank(values, type) {
    const v = values.filter(x => x !== null).sort((a, b) => a - b), n = v.length;
    const lower = x => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (v[m] < x) lo = m + 1; else hi = m; } return lo; };
    const upper = x => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (v[m] <= x) lo = m + 1; else hi = m; } return lo; };
    return x => {
      if (x === null || n === 0) return null;
      if (n === 1) return 0;
      const before = type === 'benefit' ? lower(x) : n - upper(x);
      return before / (n - 1);
    };
  }

  /* Kelas interval sama (Tahap 9): kelas = min(5, floor((s - min) / ((max - min) / 5)) + 1). */
  function classify(s, min, max, k = 5) {
    if (s === null) return null;
    if (max === min) return 1;
    return Math.min(k, Math.floor((s - min) / ((max - min) / k)) + 1);
  }

  /* Ambil nilai mentah tiap kriteria untuk satu grid. */
  function rawValue(c, g, tables, gridProps, facultyId) {
    if (c.gridField) { const v = gridProps.get(g)?.[c.gridField]; return v === null || v === undefined || v === '' || !Number.isFinite(+v) ? null : +v; }
    const t = tables[c.key]; if (!t) return null;
    return c.byFaculty ? (t.pair.get(g)?.get(facultyId)?.cost ?? null) : (t.nearest.get(g)?.cost ?? null);
  }

  /* skor = 100 * sum(w_i * p_i), w_i ternormalisasi (jumlah 1), p_i = percent_rank kriteria i.
     Grid tanpa nilai pada kriteria berbobot > 0 => skor null (tidak lengkap), bukan 0. */
  function compute(gridIds, tables, criteria, facultyId, weights, gridProps) {
    const w = normWeights(weights), val = {}, pr = {};
    for (const c of criteria) {
      val[c.key] = gridIds.map(g => rawValue(c, g, tables, gridProps, facultyId));
      pr[c.key] = percentRank(val[c.key], c.type || 'cost');
    }
    const res = gridIds.map((g, i) => {
      const norm = {}, dist = {}, missing = []; let score = 0;
      for (const c of criteria) {
        const d = val[c.key][i]; dist[c.key] = d;
        const p = pr[c.key](d);
        if (p === null) { norm[c.key] = null; if (w[c.key] > 0) missing.push(c.key); continue; }
        norm[c.key] = p * 100;
        score += p * w[c.key];               // w dalam persen, sehingga skor 0-100
      }
      return { grid_id: g, score: missing.length ? null : score, dist, norm, missing };
    });
    const ok = res.filter(r => r.score !== null).map(r => r.score);
    const min = ok.length ? Math.min(...ok) : null, max = ok.length ? Math.max(...ok) : null;
    res.forEach(r => { r.kelas = classify(r.score, min, max); });
    res.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    let rank = 0; res.forEach(r => { r.rank = r.score === null ? null : ++rank; });
    res.range = ok.length ? [min, max] : null;
    return res;
  }
  return { parseCSV, buildTable, normWeights, percentRank, classify, compute };
})();
if (typeof module !== 'undefined') module.exports = Scoring;
