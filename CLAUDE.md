# CLAUDE.md · Dashboard Sinduadi Spatial

Berkas ini adalah konteks proyek untuk Claude Code. Baca seluruhnya sebelum mengubah kode.

## Proyek

- Capstone Teknik Geodesi UGM, Kelompok 7 (Arimbi, Ariel, Agung, Diandra, Nova).
- Judul: Pembuatan Dashboard Spasial Persebaran dan Aksesibilitas Kost dan Penginapan di Kalurahan Sinduadi, Kapanewon Mlati, Kabupaten Sleman.
- Output: WebGIS statis (HTML, CSS, JavaScript, Leaflet, GeoJSON, CSV) yang di-deploy ke GitHub Pages. Tidak ada server, tidak ada build step, tidak ada database.
- Acuan metode adalah laporan antara revisi 3. Dashboard harus selalu sama dengan laporan. Bila ada perbedaan, laporan yang benar, kecuali pemilik repo berkata lain.

## Struktur berkas

| Path | Isi |
|---|---|
| `index.html` | Halaman tunggal: Dashboard, Tentang, Panduan, FAQ |
| `css/style.css` | Seluruh gaya |
| `js/config.js` | Semua pengaturan: nama file, nama kolom, bobot AHP, warna kelas, rentang harga |
| `js/scoring.js` | Persentil, skor, kelas. Tanpa DOM, bisa diuji di Node |
| `js/map.js` | Leaflet: grid, titik, legenda, rute |
| `js/app.js` | Pemuatan data, validasi, filter, ranking, detail, rute |
| `js/pages.js` | Onboarding, Tentang, FAQ |
| `js/crs.js` | Konversi UTM ke lon/lat bila data diekspor ulang dalam EPSG:32749 |
| `lib/leaflet/` | Leaflet 1.9.4 lokal |
| `data/` | Data aktual, EPSG:4326 |
| `tools/` | Skrip ekspor data, uji skor, file validasi |

## Kontrak data (jangan ubah nama kolom tanpa mengubah `config.js`)

- `data/grid.geojson`: 4.285 poligon heksagon. Kolom `grid_id` (G0001 sampai G4285), `simpang` (simpang/km², radius 500 m), `simpang_800`, `jumlah_kost`.
- `data/batas.geojson`: batas Kalurahan Sinduadi.
- `data/akomodasi.geojson`: 137 titik. Kolom `id_kos`, `nama_kos`, `jenis` (Kos Putri, Kos Putra, Penginapan), `grid_id`, `padukuhan`, `alamat`, `harga`, `satuan_harga` (bulan atau malam), `rating`, `link_gmaps`, `foto`, serta `waktu_TP001` sampai `waktu_TP020` (menit) dan `jarak_TP001` sampai `jarak_TP020` (meter).
- `data/fakultas.geojson`: 20 titik tujuan. Kolom `faculty_id` (TP-001 sampai TP-020), `nama_fakultas`, `singkatan`, `jenis`. Isinya 18 gerbang fakultas serta titik jemput Sekolah Pascasarjana dan Sekolah Vokasi.
- `data/fasum/*.geojson`: halte (48), minimarket (56), kesehatan (13) dipakai dalam skor. Laundry (74), rumah_ibadah (47), fotokopi (26) hanya tampilan. Kolom `id_fas`, `nama`, `kategori`, `keterangan`.
- `data/od_matrix/centroid_to_faculty.csv`: `origin_id,destination_id,total_cost,jarak_m`. total_cost dalam menit, 85.700 baris.
- `data/od_matrix/centroid_to_{stop,mart,health}.csv`: fasilitas terdekat per grid, total_cost dalam meter.
- `data/routes/TP-0xx.geojson`: rute tercepat 137 kost ke satu tujuan. Kolom `id_kos`, `faculty_id`, `waktu_menit`, `panjang_rute_m`, `jarak_terpendek_m`. Dimuat saat dibutuhkan.
- `data/foto/`: foto kost, nama berkas sama dengan kolom `foto`. Bisa kosong. Foto yang tidak ada disembunyikan.

## Metode skor (JANGAN diubah tanpa persetujuan pemilik repo)

1. Lima kriteria: waktu tempuh ke tujuan (cost), jarak ke halte (cost), jarak ke minimarket (cost), jarak ke fasilitas kesehatan (cost), kerapatan simpang radius 500 m (benefit).
2. Normalisasi: `percent_rank = (rank - 1) / (n - 1)`, ties memakai rank terkecil. Cost diurutkan menurun, benefit menaik.
3. Skor = 100 × Σ (w × persentil), bobot dinormalisasi ke jumlah 1.
4. Bobot AHP bawaan: 57,60 / 15,25 / 15,25 / 5,95 / 5,95 (λmaks 5,094, CR 0,021). Pengguna boleh menggeser bobot, tetapi tombol "Kembalikan bobot AHP" harus tetap ada.
5. Kelas interval sama per tujuan: `min(5, floor((s - min) / ((max - min) / 5)) + 1)`. 1 Sangat rendah, 2 Rendah, 3 Sedang, 4 Tinggi, 5 Sangat tinggi.
6. Data kosong tidak boleh dianggap 0. Grid dengan kriteria kosong ditandai "skor belum lengkap".
7. Kecepatan jaringan yang mendasari data: arteri 50, kolektor 40, lokal 25, jalan lingkungan 10, setapak 4,5 km/jam, asumsi sepeda motor. Dasar 10 km/jam: UU 2/2022 Pasal 8 ayat (6), PP 34/2006 Pasal 11 ayat (4) dan Pasal 20 ayat (1), Perbup Sleman 6.1/2019. Data OD sudah jadi, dashboard tidak menghitung ulang jaringan.

## Uji wajib sebelum setiap commit

```bash
node tools/test_scoring.js . tools/acuan_tahap9.csv
```

Hasil wajib: `G0001 TP001 13.72 kelas 1`, `max |diff skor|` paling besar 0,005, `kelas berbeda 0 dari 85700`. Bila gagal, perubahan ditolak.

Uji manual di browser:

```bash
python -m http.server 8000
```

Buka `http://localhost:8000`. Lencana status harus "Data OK" dan Console tanpa error merah. Uji pada lebar 1440 px dan 390 px (DevTools, mode perangkat). Jangan buka `index.html` lewat `file://`.

## Aturan teknis

- Tetap statis dan tanpa build. Jangan menambah framework (React, Vue, Tailwind build) atau bundler. Pustaka tambahan hanya bila benar-benar perlu, disimpan lokal di `lib/`.
- Semua path relatif dan huruf besar kecil harus persis sama, karena GitHub Pages peka huruf besar kecil.
- Semua pengaturan baru masuk `js/config.js`, bukan ditulis langsung di kode lain.
- Teks dari data selalu lewat `esc()` sebelum masuk HTML. Tautan luar hanya `https://`, dengan `rel="noopener"`.
- Peta dasar: OpenStreetMap standar `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, `maxZoom: 19`, atribusi `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors` wajib terlihat. Patuhi kebijakan penggunaan tile OSM: tanpa unduhan massal, tanpa prefetch berlebihan.
- Performa ponsel: jangan memuat ulang CSV saat filter berubah. Rute tetap dimuat per tujuan. Gunakan `preferCanvas` untuk grid.

## Aturan tampilan dan bahasa

- Bahasa Indonesia baku, sederhana, konsisten dengan istilah laporan (kost, penginapan, tujuan kampus, kelas aksesibilitas, skor aksesibilitas).
- Jangan memakai tanda pisah panjang (em dash) dan titik koma dalam teks antarmuka.
- Tampilan tidak boleh terlihat seperti template AI: hindari gradien ungu, emoji sebagai ikon, kartu bertumpuk generik, bayangan berlebihan, dan teks pemasaran. Arah gaya: kartografis dan editorial, tipografi jelas, warna kelas sesuai legenda laporan (`#b5452f`, `#e3924a`, `#ecd37a`, `#86b46a`, `#2f6b47`).
- Warna kelas tidak boleh menjadi satu-satunya pembeda. Sertakan label kelas.
- Kontras teks minimal WCAG AA. Semua kontrol bisa dipakai dengan keyboard dan punya label.

## Kekurangan yang sudah diketahui

1. Filter fasilitas kost belum ada karena data fasilitas di dalam kost belum dikumpulkan. Jangan mengarang data. Siapkan antarmuka hanya bila kolomnya sudah ada.
2. Folder `data/foto/` masih kosong sampai foto disalin.
3. `favicon` belum ada (muncul 404 di Console).
4. Basemap masih CARTO, harus diganti OSM.
5. `centroid_to_faculty.csv` sekitar 2,6 MB. Boleh dioptimalkan, asalkan uji skor tetap lolos.

## Cara kerja yang diharapkan

1. Baca repo dulu, bandingkan dengan kontrak di atas, lalu laporkan perbedaan sebelum mengubah apa pun.
2. Susun rencana singkat dan tunggu persetujuan untuk perubahan besar.
3. Kerjakan di branch baru, commit kecil per tema, pesan commit dalam bahasa Indonesia.
4. Setelah tiap tema: jalankan uji skor, cek browser desktop dan 390 px, lalu ringkas apa yang berubah.
5. Jangan menyentuh `data/` kecuali diminta. Jangan menghapus `tools/`.
