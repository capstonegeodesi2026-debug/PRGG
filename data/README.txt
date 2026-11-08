STRUKTUR DATA SINDUADI HOUSING EXPLORER

Jalankan index.html melalui VS Code Live Server, bukan double-click, karena dashboard membaca file dengan fetch().

1. grid.geojson
- Polygon grid hasil ekspor QGIS, CRS EPSG:4326.
- Setiap fitur wajib memiliki properti grid_id (contoh G001, G002).
- Opsional: grid_name atau nama_grid.

2. akomodasi.geojson
- Point kos/penginapan hasil ekspor QGIS, CRS EPSG:4326.
- Properti wajib: grid_id dan price (atau harga/harga_bulan).
- Opsional: name/nama dan type/jenis.
- Geometri Point GeoJSON berurutan [longitude, latitude].

3. akses_grid.csv
- CSV UTF-8, pemisah koma, desimal menggunakan titik.
- Satu baris untuk setiap kombinasi grid_id + faculty_id.
- Header disarankan:
grid_id,faculty_id,faculty_name,distance_faculty_m,distance_minimarket_m,distance_worship_m,median_price,accommodation_count
- Contoh:
G001,FT,Gerbang Fakultas Teknik,1250.5,230.4,410.2,1200000,8
G002,FT,Gerbang Fakultas Teknik,980.2,310.0,275.8,1100000,5
G001,FEB,Gerbang Fakultas Ekonomika dan Bisnis,1450.0,230.4,410.2,1200000,8

faculty_id dan distance_faculty_m mengikuti fakultas tujuan. Jarak minimarket/rumah ibadah merupakan jarak fasilitas terdekat untuk grid dan dapat diulang pada setiap baris fakultas. median_price dan accommodation_count boleh disediakan dari tabel agregasi. Jika median_price kosong, script mencoba menghitung median dari harga akomodasi. Jika accommodation_count kosong, jumlah dihitung dari titik akomodasi.

Nama file/folder harus persis seperti di atas atau ubah konstanta DATA_FILES di awal js/app.js. Pastikan grid_id konsisten di semua sumber (G001, bukan G01).

Script ini mengikuti empat kriteria yang tersedia pada index.html: akses fakultas, minimarket, rumah ibadah, dan median harga. Fasilitas kesehatan belum masuk skor karena index.html belum menyediakan slider bobot faskes. Jarak diasumsikan dalam meter. Skor memakai normalisasi min-max terbalik; bobot awal 50:20:10:20 masih nilai template, bukan bobot final penelitian. Filter anggaran diterapkan pada harga masing-masing titik akomodasi.
