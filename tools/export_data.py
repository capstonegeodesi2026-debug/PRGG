"""Tahap 10: ekspor data aktual ke format dashboard (EPSG:4326, GeoJSON + CSV ringkas)."""
import json, os, sys
import geopandas as gpd, pandas as pd

OUT = sys.argv[1]
H = sys.argv[2] if len(sys.argv) > 2 else '.'   # folder kerja berisi od/, odz/, fas/, js/, netchk/
os.makedirs(f'{OUT}/fasum', exist_ok=True); os.makedirs(f'{OUT}/od_matrix', exist_ok=True); os.makedirs(f'{OUT}/routes', exist_ok=True)

def rnd(c, d=6):
    return [rnd(x, d) for x in c] if isinstance(c[0], (list, tuple)) else [round(c[0], d), round(c[1], d)]

def write_fc(gdf, path, props, name):
    g = gdf.to_crs(4326)
    feats = []
    for _, r in g.iterrows():
        geo = r.geometry.__geo_interface__
        p = {}
        for k in props:
            v = r[k]
            if isinstance(v, float) and pd.isna(v): v = None
            elif hasattr(v, 'item'): v = v.item()
            p[k] = v
        feats.append({'type': 'Feature', 'properties': p, 'geometry': {'type': geo['type'], 'coordinates': rnd(geo['coordinates'])}})
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({'type': 'FeatureCollection', 'name': name, 'features': feats}, f, ensure_ascii=False, separators=(',', ':'))
    print(path, len(feats), os.path.getsize(path) // 1024, 'KB')

TP = [f'TP{i:03d}' for i in range(1, 21)]
kaw = gpd.read_file(f'{H}/od/hasil_tahap7_8.gpkg', layer='kawasan_final')
kaw = kaw.rename(columns={'id_grid': 'grid_id'})
kaw['simpang'] = kaw['simpang'].round(2); kaw['simpang_800'] = kaw['simpang_800'].round(2)
write_fc(kaw, f'{OUT}/grid.geojson', ['grid_id', 'simpang', 'simpang_800', 'jumlah_kost'], 'grid_sinduadi')

# Batas kalurahan (hanya tampilan)
b = gpd.read_file(f'{H}/netchk/batas.geojson')
b['nama'] = 'Kalurahan Sinduadi'
write_fc(b[['nama', 'geometry']], f'{OUT}/batas.geojson', ['nama'], 'batas_sinduadi')

# Tujuan (gerbang fakultas / titik jemput)
tj = gpd.read_file(f'{H}/od/hasil_tahap7_8.gpkg', layer='tujuan')
tj = tj.rename(columns={'kode': 'faculty_id', 'nama': 'nama_fakultas'})
write_fc(tj, f'{OUT}/fakultas.geojson', ['faculty_id', 'nama_fakultas', 'singkatan', 'jenis'], 'tujuan_kampus')

# Akomodasi
ks = gpd.read_file(f'{H}/od/hasil_tahap7_8.gpkg', layer='kost_final')
ks = ks.rename(columns={'ID': 'id_kos', 'Nama': 'nama_kos', 'Jenis': 'jenis', 'id_grid': 'grid_id', 'Alamat': 'alamat',
                        'Padukuhan': 'padukuhan', 'Rating': 'rating', 'Harga': 'harga', 'Satuan Harga': 'satuan_harga', 'Foto': 'foto', 'Link Gmaps': 'link_gmaps'})
write_fc(ks, f'{OUT}/akomodasi.geojson', ['id_kos', 'nama_kos', 'jenis', 'grid_id', 'padukuhan', 'alamat', 'harga', 'satuan_harga', 'rating', 'link_gmaps', 'foto']
         + [f'waktu_{t}' for t in TP] + [f'jarak_{t}' for t in TP], 'akomodasi_sinduadi')

# Fasilitas: indeks + tampilan
fas = gpd.read_file(f'{H}/fas/fasilitas_bersih.gpkg', layer='fasilitas')
cats = {'Halte Trans Jogja': 'halte', 'Minimarket': 'minimarket', 'Fasilitas Kesehatan': 'kesehatan',
        'Laundry': 'laundry', 'Rumah Ibadah': 'rumah_ibadah', 'Fotokopi': 'fotokopi'}
for cat, key in cats.items():
    sub = fas[fas.kategori == cat].copy()
    write_fc(sub, f'{OUT}/fasum/{key}.geojson', ['id_fas', 'nama', 'kategori', 'kelompok', 'keterangan'], key)

# OD waktu + jarak grid -> 20 tujuan (menit, meter). Nilai sama persis dengan kawasan_final (dipakai Tahap 9).
rows = []
for t in TP:
    tid = 'TP-' + t[2:]
    rows.append(pd.DataFrame({'origin_id': kaw.grid_id, 'destination_id': tid, 'total_cost': kaw[f'waktu_{t}'], 'jarak_m': kaw[f'jarak_{t}']}))
od = pd.concat(rows).sort_values(['origin_id', 'destination_id'])
od.to_csv(f'{OUT}/od_matrix/centroid_to_faculty.csv', index=False, float_format='%.2f')
print('faculty csv', len(od), os.path.getsize(f'{OUT}/od_matrix/centroid_to_faculty.csv') // 1024, 'KB')

# Fasilitas terdekat: ID dari OD QNEAT3, nilai dari kawasan_final (sudah termasuk perbaikan 3 NULL faskes)
for f, col, name in [('od_halte', 'd_halte', 'stop'), ('od_minimarket', 'd_minimarket', 'mart'), ('od_faskes', 'd_faskes', 'health')]:
    if f'{col}_id' in kaw.columns:   # data v2: ID fasilitas terdekat sudah dihitung bersama nilainya
        out = pd.DataFrame({'origin_id': kaw.grid_id, 'destination_id': kaw[f'{col}_id'], 'total_cost': kaw[col]})
        out.to_csv(f'{OUT}/od_matrix/centroid_to_{name}.csv', index=False, float_format='%.1f'); print(name, len(out), '(v2)'); continue
    o = gpd.read_file(f'{H}/odz/{f}.gpkg', ignore_geometry=True).dropna(subset=['total_cost'])
    n = o.loc[o.groupby('origin_id').total_cost.idxmin(), ['origin_id', 'destination_id', 'total_cost']].set_index('origin_id')
    m = kaw.set_index('grid_id')[[col]].join(n)
    diff = (m[col] - m.total_cost).abs() > 0.06
    if diff.any():
        print(f, 'override', list(m.index[diff]))
        m.loc[diff, 'destination_id'] = 'FK-001'   # 3 grid hasil perbaikan NULL (lihat Tahap 7)
    if name == 'stop':   # OD tim memakai ID H001..H048, layer halte memakai HL-001..HL-048 (urutan sama, dicek ulang lewat jarak jaringan)
        m['destination_id'] = m.destination_id.str.replace(r'^H(\d{3})$', r'HL-\1', regex=True)
    out = pd.DataFrame({'origin_id': m.index, 'destination_id': m.destination_id.values, 'total_cost': m[col].values})
    out.to_csv(f'{OUT}/od_matrix/centroid_to_{name}.csv', index=False, float_format='%.1f')
    print(name, len(out))
