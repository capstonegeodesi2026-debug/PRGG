DASHBOARD SPASIAL AKSESIBILITAS KOS & PENGINAPAN - KALURAHAN SINDUADI
Capstone PRGG, Teknik Geodesi UGM
=====================================================================
PENTING: SEMUA DATA DI FOLDER data/ SAAT INI ADALAH SIMULASI (nama berawalan "SIMULASI").
Koordinat, ID, jarak OD, dan garis rute dibuat sintetis untuk menguji fitur. BUKAN hasil
QGIS/QNEAT3 dan tidak boleh dipakai sebagai hasil penelitian. Ganti semuanya dengan data aktual.

1. MENJALANKAN
   - Buka folder di VS Code, klik kanan index.html > "Open with Live Server".
   - Jangan buka lewat file:// (browser memblokir fetch). Perlu internet untuk Leaflet, font, dan basemap.

2. STRUKTUR
   index.html (welcome, tentang, FAQ, onboarding, dashboard) | css/style.css | js/config.js (nama file, kolom, bobot awal) | js/scoring.js (CSV + WSM)
   js/map.js (peta, ikon, rute) | js/app.js (alur data, validasi, UI dashboard) | js/pages.js (navigasi, onboarding, Tentang, FAQ)
   data/grid.geojson, akomodasi.geojson, fakultas.geojson
   data/fasum/{halte,laundry,minimarket,rumah_ibadah,kesehatan}.geojson
   data/od_matrix/{centroid_to_faculty,centroid_to_stop,centroid_to_laundry,centroid_to_mart,centroid_to_religion,centroid_to_health}.csv
   data/routes/rute_kos_fakultas.geojson

3. FORMAT DATA (GeoJSON: EPSG:32749 = UTM 49S, urutan [easting, northing] dalam meter; lihat bagian 9)
   File                      Geometri           Atribut wajib
   grid.geojson              Polygon/MultiPolygon  grid_id
   akomodasi.geojson         Point              id_kos, nama_kos, grid_id, jenis
   fakultas.geojson          Point              faculty_id, nama_fakultas
   fasum/halte.geojson       Point              id_halte, nama_halte
   fasum/laundry.geojson     Point              id_laundry, nama_laundry
   fasum/minimarket.geojson  Point              id_mart, nama_mart, jenis
   fasum/rumah_ibadah.geojson Point             id_religion, nama, jenis
   fasum/kesehatan.geojson   Point              id_health, nama, jenis
   routes/rute_kos_fakultas.geojson  LineString  id_kos, faculty_id, distance_m, time_min
   (distance_m dan time_min opsional; bila kosong, dashboard menulis "tidak tersedia".)
   Kolom jenis (akomodasi) dipakai untuk filter. Nilai contoh: Kos Putra, Kos Putri, Kos Campur, Penginapan.
   Pilihan filter dibuat otomatis dari nilai yang ada di data. Nilai yang mengandung kata penginapan/hotel/
   homestay/guest dihitung sebagai "Penginapan", sisanya sebagai "Kos". Atribut tambahan di akomodasi.geojson
   otomatis tampil di popup dan panel detail (kolom bernama harga/price/tarif/biaya sengaja disembunyikan).
   Tidak ada atribut harga; dashboard tidak memakai harga sama sekali.

4. FORMAT CSV OD MATRIX (header persis)
   origin_id,destination_id,entry_cost,network_cost,exit_cost,total_cost
   - origin_id = grid_id (grid.geojson). destination_id = faculty_id (fakultas) atau ID fasilitas
     (id_halte/id_laundry/id_mart/id_religion/id_health).
   - Lima tabel fasilitas: dashboard mengambil total_cost TERKECIL per grid (fasilitas terdekat).
   - Tabel fakultas: simpan SEMUA pasangan grid-fakultas; tidak diminimumkan, karena nilainya
     mengikuti dropdown fakultas.
   - NULL/kosong dan 0 tidak dianggap nilai valid: baris dilewati, dicatat di panel "Status data",
     dan grid yang kehilangan kriteria berbobot > 0 diberi skor "belum lengkap" (bukan 0).
   - Satuan total_cost harus konsisten (mis. meter untuk shortest path).
   Nama kolom/file lain dapat diatur di js/config.js.

5. HUBUNGAN ANTAR-ID
   grid.grid_id = akomodasi.grid_id = OD.origin_id
   fakultas.faculty_id = OD fakultas.destination_id = rute.faculty_id
   akomodasi.id_kos = rute.id_kos
   id fasilitas di fasum/*.geojson = OD.destination_id yang bersangkutan
   Ketidakcocokan ditampilkan sebagai peringatan di panel Status data dan konsol (F12).

6. MENGGANTI DATA DARI QGIS
   a. Ekspor layer ke GeoJSON dengan CRS EPSG:32749 (Layer > Save As > GeoJSON, CRS EPSG:32749). Samakan CRS untuk SEMUA file GeoJSON.
   b. Pastikan nama kolom sesuai tabel di atas, lalu simpan ke path yang sama di folder data/.
   c. OD Matrix QNEAT3: ekspor tabel hasil (Layer > Export > Save Features As > CSV) dengan kolom
      origin_id, destination_id, entry_cost, network_cost, exit_cost, total_cost. Gunakan ID grid sebagai Origin ID field.
   d. Rute kos-fakultas: jalankan QNEAT3 Shortest Path (Point to Point / Layer to Point) per kos, gabungkan hasilnya
      menjadi satu GeoJSON LineString dengan atribut id_kos, faculty_id, distance_m, time_min.
      Gunakan jaringan jalan, CRS, strategi (shortest/fastest), field arah, field kecepatan, dan topology
      tolerance yang SAMA dengan OD Matrix. Dashboard hanya menampilkan geometri; tidak ada routing di browser.
      Bila rute suatu kombinasi tidak ada, dashboard menulis "Rute belum tersedia" (tanpa garis lurus pengganti).
   e. Refresh browser. Tidak perlu mengubah kode JavaScript.
   File fasilitas yang belum ada: layer dinonaktifkan dan skor grid ditandai belum lengkap; dashboard tetap berjalan.

7. METODE SKOR (WSM) DAN KETERBATASAN
   Nilai kriteria (jarak, makin kecil makin baik): s = (d_max - d) / (d_max - d_min) x 100, dihitung antar-grid
   (jika semua grid sama, s = 100). Skor = jumlah (s x bobot ternormalisasi). Bobot slider dinormalisasi otomatis ke 100%.
   Keterbatasan: min-max sensitif terhadap pencilan dan relatif terhadap sebaran grid yang ada; skor
   hanya bermakna untuk membandingkan grid, bukan nilai absolut; kriteria dianggap independen dan linear;
   jarak dihitung dari centroid grid, sehingga kos di tepi grid bisa berbeda dari nilai grid.
   Bobot awal (fakultas 30, lainnya 14) hanya contoh simulasi, bukan bobot final penelitian.
   Rute kos-fakultas adalah analisis terpisah dari OD centroid-fakultas (titik awalnya lokasi kos).

8. ALUR HALAMAN, RUTE, DAN INFO PENELITIAN
   - Welcome > Panduan (4 langkah, status selesai disimpan di localStorage 'sinduadi.onboarded') > Dashboard.
     Menu Panduan membuka kembali panduan; menu Tentang dan FAQ tersedia di navbar. Logo membuka Welcome.
   - Rute diakses dari titik kos: klik titik kos > tombol "Lihat Rute ke Fakultas" (popup atau panel Detail akomodasi).
     Pasangan id_kos + faculty_id menentukan rute. Mengganti fakultas, kos, atau memfilter menghapus rute lama.
     Bila tidak ada: "Data rute untuk akomodasi dan fakultas ini belum tersedia." (tanpa garis pengganti).
     Rute pada paket ini SIMULASI dan diberi label itu. Jika nama FeatureCollection di file rute tidak
     mengandung kata "simulasi", label tersebut tidak ditampilkan; pastikan data aktual memang hasil QNEAT3.
   - Isi js/config.js > research (peneliti dan tahun masih placeholder) agar halaman Tentang lengkap.

9. CRS DAN KINERJA
   - Semua GeoJSON memakai EPSG:32749 (CONFIG.sourceCRS di js/config.js). js/crs.js mengonversi ke lon/lat sekali saat
     data dimuat karena peta Leaflet dan tile basemap memerlukan lon/lat/Web Mercator. Jarak di CSV (total_cost) tidak terpengaruh.
   - Jika file memuat anggota "crs" (ekspor QGIS), nilai itu dipakai dan dibandingkan dengan CONFIG.sourceCRS (beda = peringatan).
     Yang didukung: EPSG:4326 dan UTM WGS84 (326xx/327xx). CRS lain (mis. EPSG:23833) harus diekspor ulang.
     Posisi yang tampak sudah lon/lat pada file UTM diberi peringatan di panel Status data.
   - Bobot: slider hanya mengubah label; tekan "Terapkan bobot" untuk menghitung ulang (ringan untuk ribuan grid).
   - Peta memakai render kanvas; daftar ranking menampilkan 100 teratas (tombol "Tampilkan ... lagi").
