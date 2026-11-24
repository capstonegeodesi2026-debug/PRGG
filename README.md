# Sinduadi Spatial

Dashboard WebGIS persebaran dan aksesibilitas kos dan penginapan di Kalurahan Sinduadi, Kapanewon Mlati, Kabupaten Sleman.
Proyek Rekayasa Geodesi-Geoinformatika, Kelompok 7, Teknik Geodesi UGM.

Situs ini statis (HTML, CSS, JavaScript, GeoJSON, CSV). Tidak perlu server atau database. Bisa langsung dipasang di GitHub Pages.

## Isi folder

| Path | Isi |
|---|---|
| `index.html` | Halaman utama |
| `css/style.css` | Tampilan |
| `js/config.js` | Semua pengaturan: nama file, nama kolom, bobot AHP, warna kelas |
| `js/scoring.js` | Perhitungan persentil, skor, dan kelas (sama dengan Tahap 9) |
| `js/app.js`, `js/map.js`, `js/pages.js`, `js/crs.js` | Logika dashboard, peta, halaman, konversi koordinat |
| `lib/leaflet/` | Leaflet 1.9.4 (disimpan lokal) |
| `data/grid.geojson` | 4.285 grid segi enam (`grid_id`, `simpang`, `simpang_800`, `jumlah_kost`) |
| `data/batas.geojson` | Batas Kalurahan Sinduadi |
| `data/akomodasi.geojson` | 137 kos dan penginapan: jenis, harga, satuan harga, rating, foto, serta waktu dan jarak ke 20 tujuan |
| `data/foto/` | Foto kost (belum ada, lihat bagian Foto kost) |
| `data/fakultas.geojson` | 20 tujuan kampus TP-001 sampai TP-020 |
| `data/fasum/*.geojson` | Halte (48), minimarket (56), faskes (13) untuk skor. Laundry (74), rumah ibadah (47), fotokopi (26) hanya tampilan |
| `data/od_matrix/*.csv` | Ringkasan OD Matrix QNEAT3 per grid |
| `data/routes/TP-xxx.geojson` | Rute tercepat 137 kos ke tiap tujuan (dimuat saat dibutuhkan) |
| `tools/` | Skrip pembuat data, uji skor, dan file validasi |

Semua GeoJSON memakai EPSG:4326.

## Metode yang dipakai dashboard

Sama dengan laporan (Tahap 9).

1. Kriteria: waktu tempuh ke tujuan (menit), jarak jaringan ke halte, minimarket, dan faskes terdekat (m), serta kerapatan simpang radius 500 m.
2. Setiap kriteria diubah ke persentil `percent_rank = (rank - 1) / (n - 1)`. Waktu dan jarak diurutkan menurun, simpang diurutkan menaik.
3. Skor = 100 × Σ (bobot × persentil). Bobot awal = AHP: 57,60 / 15,25 / 15,25 / 5,95 / 5,95 (CR 0,021).
4. Kelas = `min(5, floor((skor - min) / ((max - min) / 5)) + 1)`.

Pengguna bisa menggeser bobot. Label di panel menunjukkan apakah peta memakai bobot AHP atau bobot ubahan. Panel Detail grid menampilkan poin tiap kriteria (persentil × bobot), dan jumlah poin sama dengan skor.

## Fitur sesuai laporan (III.3.6)

* Pilihan tujuan kampus mengubah skor, kelas, dan waktu tempuh.
* Filter jenis akomodasi dan rentang harga. Harga kost per bulan, penginapan per malam. Rentang diatur di `CONFIG.priceBands`.
* Pop-up kost menampilkan harga, foto, rating, waktu dan jarak ke tujuan, skor grid, dan tautan Google Maps.
* Filter fasilitas kost belum ada karena data fasilitas di dalam kost (misalnya AC atau kamar mandi dalam) belum dikumpulkan. Bila kolomnya ditambahkan, filter dapat dibuat dengan pola yang sama seperti filter harga.

## Foto kost

Salin semua foto ke folder `data/foto/` dengan nama persis seperti kolom foto (misalnya `KPI-KT-01.png`). Foto yang tidak ditemukan otomatis disembunyikan. Perkecil foto ke lebar sekitar 800 piksel agar situs tetap ringan di ponsel.

## Hasil pengecekan

* Skor dashboard dibandingkan dengan `hasil_tahap9.gpkg` untuk 4.285 grid × 20 tujuan: selisih maksimum 0,005 (pembulatan 2 desimal), kelas sama di 85.700 dari 85.700 pasangan. Contoh G0001 ke TP-001: skor 13,72, kelas 1. Jalankan ulang dengan `node tools/test_scoring.js . tools/acuan_tahap9.csv`.
* Waktu rute yang digambar dibandingkan dengan `od_kos_waktu` QNEAT3: selisih maksimum 0,34 detik untuk 2.740 pasangan (`tools/validasi_rute_vs_qneat3.csv`).
* ID halte di OD tim (H001 sampai H048) dipetakan ke ID layer (HL-001 sampai HL-048). Urutannya sama. Pemetaan dicek ulang dengan jarak jaringan pada 25 grid acak (`tools/cek_id_halte.csv`).
* Tiga grid yang NULL ke faskes (G3126, G3169, G3214) memakai nilai perbaikan Tahap 7 ke FK-001.

## Catatan rute

Waktu tempuh dan jarak terpendek yang tampil berasal dari OD Matrix QNEAT3. Geometri garis rute dibuat ulang dengan `tools/routes.py` (Dijkstra pada `jalan_split_bersih`, titik diikat ke ruas terdekat, biaya masuk dan keluar 10 km/jam). Alasannya, OD Matrix QNEAT3 hanya menghasilkan tabel tanpa garis. Bila tim ingin garis yang dibuat langsung di QGIS, gunakan alat rute terpendek berbasis kecepatan (strategi tercepat, kolom `kecepatan`, kecepatan bawaan 10) lalu ekspor dengan kolom `id_kos`, `faculty_id`, `waktu_menit`, `panjang_rute_m`, `jarak_terpendek_m`.

## Menjalankan di komputer sendiri

Jangan buka `index.html` dengan klik ganda (browser memblokir `fetch` dari `file://`). Pakai salah satu:

* VS Code, ekstensi Live Server, klik kanan `index.html` lalu Open with Live Server.
* Terminal: `python -m http.server 8000` di folder ini, lalu buka `http://localhost:8000`.

## Deploy ke GitHub Pages

1. Buat repositori publik baru di GitHub, misalnya `sinduadi-spatial`.
2. Unggah seluruh isi folder ini ke root repositori (bukan foldernya). `index.html` harus berada di root.
3. Buka Settings, pilih Pages. Pada Source pilih Deploy from a branch, branch `main`, folder `/ (root)`, lalu Save.
4. Tunggu 1 sampai 3 menit. Alamatnya `https://<username>.github.io/sinduadi-spatial/`.

Ukuran data sekitar 9 MB. GitHub Pages mengompres GeoJSON dan CSV saat dikirim, jadi unduhan sebenarnya jauh lebih kecil.

## Memperbarui data

1. Ubah data di QGIS (misalnya menambah kos atau memperbaiki fasilitas), lalu jalankan ulang OD Matrix sesuai panduan.
2. Simpan hasil ke struktur folder kerja: `od/hasil_tahap7_8.gpkg`, `odz/od_*.gpkg`, `fas/fasilitas_bersih.gpkg`, `js/jalan_split_bersih.gpkg`, `netchk/batas.geojson`.
3. Jalankan `python tools/export_data.py data <folder_kerja>` dan `python tools/routes.py data/routes <folder_kerja>`.
4. Commit dan push. GitHub Pages memperbarui situs otomatis.

Bila nama kolom berbeda, cukup ubah `js/config.js`.
