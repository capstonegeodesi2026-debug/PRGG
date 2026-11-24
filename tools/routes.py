"""Rute tercepat kos -> 20 tujuan, direkonstruksi dengan aturan QNEAT3 (titik diikat ke ruas terdekat,
biaya masuk/keluar pada kecepatan bawaan 10 km/jam, biaya ruas = panjang / kecepatan). Divalidasi terhadap od_kos_waktu."""
import json, sys, math
import geopandas as gpd, pandas as pd, networkx as nx
from shapely.geometry import Point, LineString
from shapely.ops import substring
from shapely import STRtree

OUT = sys.argv[1]
H = sys.argv[2] if len(sys.argv) > 2 else '.'   # folder kerja berisi od/, odz/, fas/, js/, netchk/
DEF = 10 / 3.6
net = gpd.read_file(f'{H}/js/jalan_split_bersih.gpkg')
ks = gpd.read_file(f'{H}/od/hasil_tahap7_8.gpkg', layer='kost_final')
tj = gpd.read_file(f'{H}/od/hasil_tahap7_8.gpkg', layer='tujuan')
qw = gpd.read_file(f'{H}/odz/od_kos_waktu.gpkg', ignore_geometry=True).set_index(['origin_id', 'destination_id']).total_cost
key = lambda p: (round(p[0], 2), round(p[1], 2))

# Graf per segmen (setiap vertex adalah simpul), sama seperti graph builder QGIS/QNEAT3:
# ruas yang bersentuhan di vertex tengah tetap terhubung.
G = nx.Graph()
segs, sspeed = [], []
for g, v in zip(net.geometry, net.kecepatan / 3.6):
    c = list(g.coords)
    for a, b in zip(c[:-1], c[1:]):
        if math.dist(a, b) == 0: continue
        segs.append(LineString([a, b])); sspeed.append(v)
for i, (g, v) in enumerate(zip(segs, sspeed)):
    a, b = key(g.coords[0]), key(g.coords[-1])
    t = g.length / v
    if a == b or (G.has_edge(a, b) and G[a][b]['t'] <= t): continue
    G.add_edge(a, b, t=t, d=g.length, i=i)
geoms, speeds = segs, sspeed
tree = STRtree(geoms)

# Ikat titik ke ruas terdekat: node virtual di titik proyeksi, terhubung ke kedua ujung ruas.
ties = {}
def tie(pid, pt):
    i = int(tree.nearest(pt)); g = geoms[i]; v = speeds[i]
    s = g.project(pt); proj = g.interpolate(s)
    n = ('P', pid)
    G.add_node(n)
    a, b = key(g.coords[0]), key(g.coords[-1])
    pa = substring(g, 0, s); pb = substring(g, s, g.length)
    G.add_edge(n, a, t=pa.length / v, d=pa.length, geom=LineString(list(pa.coords)[::-1]) if pa.length > 0 else None)
    G.add_edge(n, b, t=pb.length / v, d=pb.length, geom=pb if pb.length > 0 else None)
    ties[pid] = (n, proj, pt.distance(proj))
for _, r in ks.iterrows(): tie(r.ID, r.geometry)
for _, r in tj.iterrows(): tie(r.kode, r.geometry)

def edge_coords(u, v):
    e = G[u][v]
    if 'geom' in e:
        g = e['geom']
        if g is None: return []
        c = list(g.coords)
        # geom tersimpan berarah node virtual -> ujung ruas
        return c if (u[0] == 'P') else c[::-1]
    c = list(geoms[e['i']].coords)
    return c if key(c[0]) == u else c[::-1]

feats, cmp = [], []
from pyproj import Transformer
tr = Transformer.from_crs(32749, 4326, always_xy=True)
for _, k in ks.iterrows():
    src = ties[k.ID]
    dist, paths = nx.single_source_dijkstra(G, src[0], weight='t')
    for _, t in tj.iterrows():
        dst = ties[t.kode]; p = paths[dst[0]]
        coords = [tuple(k.geometry.coords[0]), (src[1].x, src[1].y)]
        for u, v in zip(p[:-1], p[1:]): coords += edge_coords(u, v)
        coords += [(dst[1].x, dst[1].y), tuple(t.geometry.coords[0])]
        clean = [coords[0]] + [c for a, c in zip(coords[:-1], coords[1:]) if math.dist(a, c) > 0.01]
        line = LineString(clean)
        total = dist[dst[0]] + src[2] / DEF + dst[2] / DEF
        q = qw.get((k.ID, t.kode))
        cmp.append((k.ID, t.kode, total, q))
        tcol = 'TP' + t.kode[3:]
        feats.append({'type': 'Feature', 'properties': {
            'id_kos': k.ID, 'faculty_id': t.kode, 'waktu_menit': round(float(k[f'waktu_{tcol}']), 2),
            'panjang_rute_m': round(line.length, 1), 'jarak_terpendek_m': round(float(k[f'jarak_{tcol}']), 1)},
            'geometry': {'type': 'LineString', 'coordinates': [[round(x, 6), round(y, 6)] for x, y in (tr.transform(*c) for c in line.simplify(0.3).coords)]}})

c = pd.DataFrame(cmp, columns=['kos', 'tp', 'rekon_s', 'qneat3_s'])
c['selisih_s'] = c.rekon_s - c.qneat3_s; c['selisih_pct'] = c.selisih_s / c.qneat3_s * 100
print(c.selisih_s.abs().describe()); print('>1%:', (c.selisih_pct.abs() > 1).sum(), ' >5 s:', (c.selisih_s.abs() > 5).sum())
print(c.reindex(c.selisih_s.abs().sort_values(ascending=False).index).head(8))
c.to_csv('validasi_rute_vs_qneat3.csv', index=False)
import os
os.makedirs(OUT, exist_ok=True)
for tp in sorted({f['properties']['faculty_id'] for f in feats}):
    fs = [f for f in feats if f['properties']['faculty_id'] == tp]
    fp = os.path.join(OUT, f'{tp}.geojson')
    with open(fp, 'w') as f:
        json.dump({'type': 'FeatureCollection', 'name': f'rute_kos_{tp}', 'features': fs}, f, separators=(',', ':'))
print('rute per tujuan', len(feats), sum(os.path.getsize(os.path.join(OUT, x)) for x in os.listdir(OUT)) // 1024, 'KB total')
