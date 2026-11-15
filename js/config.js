/* KONFIGURASI — ubah di sini (bukan di kode lain) bila nama file/kolom berbeda. */
const CONFIG = {
  center: [-7.7585, 110.3735], zoom: 16,
  // CRS file GeoJSON. Jika file memuat anggota "crs" (ekspor QGIS), nilai itu dipakai lebih dulu.
  // Didukung: 'EPSG:4326' atau UTM WGS84 ('EPSG:32749' = UTM 49S). Konversi ke lon/lat dilakukan sekali saat data dimuat.
  sourceCRS: 'EPSG:32749',
  files: {
    grid: 'data/grid.geojson',
    akomodasi: 'data/akomodasi.geojson',
    fakultas: 'data/fakultas.geojson',
    routes: 'data/routes/rute_kos_fakultas.geojson'
  },
  // Kolom CSV OD Matrix (hasil QNEAT3)
  csv: { origin: 'origin_id', dest: 'destination_id', cost: 'total_cost' },
  // Atribut kunci
  fields: { grid: 'grid_id', kosId: 'id_kos', kosName: 'nama_kos', kosGrid: 'grid_id', kosType: 'jenis',
            facId: 'faculty_id', facName: 'nama_fakultas', routeKos: 'id_kos', routeFac: 'faculty_id',
            routeDist: 'distance_m', routeTime: 'time_min' },
  // Informasi penelitian untuk halaman Tentang. Isi placeholder [..] dengan data sebenarnya.
  research: {
    judul: 'Pembuatan Dashboard Spasial Persebaran dan Aksesibilitas Kost dan Penginapan di Kalurahan Sinduadi, Kapanewon Mlati, Kabupaten Sleman',
    peneliti: '[Nama peneliti: isi di js/config.js]',
    prodi: 'Teknik Geodesi',
    fakultas: 'Fakultas Teknik, Universitas Gadjah Mada',
    tahun: '[Tahun penelitian: isi di js/config.js]'
  },
  // Layer fasilitas: file GeoJSON, gaya, dan kolom atribut
  layers: {
    fakultas:     { label: 'Fakultas',          color: '#14532d', icon: 'cap' },
    akomodasi:    { label: 'Kos / Penginapan',  color: '#2563eb', icon: 'house' },
    halte:        { label: 'Halte',             color: '#f97316', icon: 'bus',      file: 'data/fasum/halte.geojson',        id: 'id_halte',    name: 'nama_halte' },
    laundry:      { label: 'Laundry',           color: '#7e22ce', icon: 'shirt',    file: 'data/fasum/laundry.geojson',      id: 'id_laundry',  name: 'nama_laundry' },
    minimarket:   { label: 'Minimarket',        color: '#0891b2', icon: 'cart',     file: 'data/fasum/minimarket.geojson',   id: 'id_mart',     name: 'nama_mart' },
    rumah_ibadah: { label: 'Rumah ibadah',      color: '#b7791f', icon: 'landmark', file: 'data/fasum/rumah_ibadah.geojson', id: 'id_religion', name: 'nama' },
    kesehatan:    { label: 'Fasilitas kesehatan', color: '#dc2626', icon: 'cross',  file: 'data/fasum/kesehatan.geojson',    id: 'id_health',   name: 'nama' }
  },
  // Kriteria WSM (6). weight = bobot awal CONTOH (bukan bobot final penelitian).
  criteria: [
    { key: 'fakultas',     label: 'Jarak ke fakultas tujuan', csv: 'data/od_matrix/centroid_to_faculty.csv',  byFaculty: true, dest: 'fakultas',     weight: 30 },
    { key: 'kesehatan',    label: 'Faskes terdekat',          csv: 'data/od_matrix/centroid_to_health.csv',   dest: 'kesehatan',    weight: 14 },
    { key: 'laundry',      label: 'Laundry terdekat',         csv: 'data/od_matrix/centroid_to_laundry.csv',  dest: 'laundry',      weight: 14 },
    { key: 'minimarket',   label: 'Minimarket terdekat',      csv: 'data/od_matrix/centroid_to_mart.csv',     dest: 'minimarket',   weight: 14 },
    { key: 'rumah_ibadah', label: 'Rumah ibadah terdekat',    csv: 'data/od_matrix/centroid_to_religion.csv', dest: 'rumah_ibadah', weight: 14 },
    { key: 'halte',        label: 'Halte terdekat',           csv: 'data/od_matrix/centroid_to_stop.csv',     dest: 'halte',        weight: 14 }
  ]
};
if (typeof module !== 'undefined') module.exports = CONFIG;
