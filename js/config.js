/* KONFIGURASI: ubah di sini (bukan di kode lain) bila nama file/kolom berbeda. */
const CONFIG = {
  center: [-7.7585, 110.3735], zoom: 15,
  // Peta dasar OpenStreetMap standar. Patuhi kebijakan tile OSM: tanpa unduhan massal dan tanpa prefetch berlebihan.
  basemap: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  },
  // Tampilan: batas lebar ponsel (px) untuk lembar bawah dan tata letak bertumpuk, ukuran kotak ketuk ikon (px),
  // dan zoom minimum ikon tampil penuh (di bawahnya lingkaran ikon diperkecil agar warna grid terbaca).
  // dataDelayMax: batas tunggu (ms) sebelum data diunduh, agar halaman awal dan font tampil lebih dulu.
  ui: { mobileMax: 960, pinSize: 24, pinSizeTujuan: 28, pinFullZoom: 16, dataDelayMax: 1500 },
  // Label tampilan untuk nilai kolom jenis. Isi data tidak diubah, hanya teks yang tampil di antarmuka.
  typeLabels: { 'Kos Putri': 'Kost Putri', 'Kos Putra': 'Kost Putra' },
  // Semua file di folder data/ diekspor dalam EPSG:4326 (lon/lat). Bila Anda mengekspor ulang dari QGIS dalam
  // UTM 49S, ubah menjadi 'EPSG:32749'; konversi dilakukan sekali saat data dimuat (js/crs.js).
  sourceCRS: 'EPSG:4326',
  files: {
    grid: 'data/grid.geojson',
    batas: 'data/batas.geojson',
    akomodasi: 'data/akomodasi.geojson',
    fakultas: 'data/fakultas.geojson',
    routes: 'data/routes/{id}.geojson'   // satu file rute per tujuan, dimuat saat dibutuhkan
  },
  // Kolom CSV OD Matrix (hasil QNEAT3). extra = kolom tambahan opsional (jarak jaringan untuk tujuan kampus).
  csv: { origin: 'origin_id', dest: 'destination_id', cost: 'total_cost', extra: 'jarak_m' },
  // Atribut kunci
  fields: { grid: 'grid_id', kosId: 'id_kos', kosName: 'nama_kos', kosGrid: 'grid_id', kosType: 'jenis',
            kosPrice: 'harga', kosPriceUnit: 'satuan_harga', kosPhoto: 'foto',
            facId: 'faculty_id', facName: 'nama_fakultas', routeKos: 'id_kos', routeFac: 'faculty_id',
            routeDist: 'panjang_rute_m', routeTime: 'waktu_menit', routeShort: 'jarak_terpendek_m' },
  // Foto kost hasil tools/optimasi_foto.py. Kolom foto berisi nama asli (misalnya KPI-KT-01.png). Dashboard memakai
  // nama yang sama tanpa ekstensi + photoExt, jadi KPI-KT-01.png dibaca dari data/foto/KPI-KT-01.webp. Foto yang gagal dimuat disembunyikan.
  photoDir: 'data/foto/',
  photoExt: '.webp',
  // Rentang harga untuk filter. unit harus sama dengan isi kolom satuan_harga.
  priceBands: [
    { id: 'b1', unit: 'bulan', label: 'Kurang dari Rp750.000 per bulan', min: 0, max: 750000 },
    { id: 'b2', unit: 'bulan', label: 'Rp750.000 sampai Rp1.000.000 per bulan', min: 750000, max: 1000000 },
    { id: 'b3', unit: 'bulan', label: 'Rp1.000.001 sampai Rp1.500.000 per bulan', min: 1000001, max: 1500000 },
    { id: 'b4', unit: 'bulan', label: 'Lebih dari Rp1.500.000 per bulan', min: 1500001, max: Infinity },
    { id: 'm1', unit: 'malam', label: 'Kurang dari Rp200.000 per malam', min: 0, max: 199999 },
    { id: 'm2', unit: 'malam', label: 'Rp200.000 sampai Rp500.000 per malam', min: 200000, max: 500000 },
    { id: 'm3', unit: 'malam', label: 'Lebih dari Rp500.000 per malam', min: 500001, max: Infinity }
  ],
  // Informasi penelitian untuk halaman Tentang.
  research: {
    judul: 'Pembuatan Dashboard Spasial Persebaran dan Aksesibilitas Kost dan Penginapan di Kalurahan Sinduadi, Kapanewon Mlati, Kabupaten Sleman',
    peneliti: 'Kelompok 7: Arimbi, Ariel, Agung, Diandra, Nova',
    prodi: 'Teknik Geodesi',
    fakultas: 'Fakultas Teknik, Universitas Gadjah Mada',
    tahun: '2026'
  },
  // Kelas aksesibilitas (Tahap 9, interval sama). Warna berurutan dari rendah ke tinggi.
  classes: [
    { k: 1, label: 'Sangat rendah', color: '#b5452f' },
    { k: 2, label: 'Rendah',        color: '#e3924a' },
    { k: 3, label: 'Sedang',        color: '#ecd37a' },
    { k: 4, label: 'Tinggi',        color: '#86b46a' },
    { k: 5, label: 'Sangat tinggi', color: '#2f6b47' }
  ],
  // Layer titik. index: true = dipakai dalam skor. Fasilitas lain hanya ditampilkan.
  layers: {
    fakultas:     { label: 'Tujuan kampus (gerbang/titik jemput)', color: '#0F2A44', icon: 'cap' },
    akomodasi:    { label: 'Kost dan penginapan',  color: '#2563eb', icon: 'house' },
    halte:        { label: 'Halte Trans Jogja', color: '#f97316', icon: 'bus',      file: 'data/fasum/halte.geojson',        id: 'id_fas', name: 'nama', index: true },
    minimarket:   { label: 'Minimarket',        color: '#0891b2', icon: 'cart',     file: 'data/fasum/minimarket.geojson',   id: 'id_fas', name: 'nama', index: true },
    kesehatan:    { label: 'Fasilitas kesehatan', color: '#dc2626', icon: 'cross',  file: 'data/fasum/kesehatan.geojson',    id: 'id_fas', name: 'nama', index: true },
    laundry:      { label: 'Laundry',           color: '#7e22ce', icon: 'shirt',    file: 'data/fasum/laundry.geojson',      id: 'id_fas', name: 'nama', off: true },
    rumah_ibadah: { label: 'Rumah ibadah',      color: '#b7791f', icon: 'landmark', file: 'data/fasum/rumah_ibadah.geojson', id: 'id_fas', name: 'nama', off: true },
    fotokopi:     { label: 'Fotokopi',          color: '#475569', icon: 'copy',     file: 'data/fasum/fotokopi.geojson',     id: 'id_fas', name: 'nama', off: true }
  },
  /* Kriteria indeks aksesibilitas (Tahap 9). weight = bobot AHP laporan (CR 0,021). Pengguna boleh mengubahnya di panel.
     type: cost (nilai kecil lebih baik) atau benefit (nilai besar lebih baik). gridField = nilai dibaca dari atribut grid. */
  criteria: [
    { key: 'waktu',      label: 'Waktu tempuh ke tujuan',  csv: 'data/od_matrix/centroid_to_faculty.csv', byFaculty: true, dest: 'fakultas', type: 'cost', unit: 'menit', weight: 57.60 },
    { key: 'halte',      label: 'Jarak ke halte',    csv: 'data/od_matrix/centroid_to_stop.csv',   dest: 'halte',      type: 'cost', unit: 'm', weight: 15.25 },
    { key: 'minimarket', label: 'Jarak ke minimarket', csv: 'data/od_matrix/centroid_to_mart.csv', dest: 'minimarket', type: 'cost', unit: 'm', weight: 15.25 },
    { key: 'kesehatan',  label: 'Jarak ke fasilitas kesehatan',   csv: 'data/od_matrix/centroid_to_health.csv', dest: 'kesehatan',  type: 'cost', unit: 'm', weight: 5.95 },
    { key: 'simpang',    label: 'Kerapatan simpang', gridField: 'simpang', type: 'benefit', unit: 'simpang/km²', weight: 5.95 }
  ]
};
if (typeof module !== 'undefined') module.exports = CONFIG;
