# PRGG.md · Dashboard Sinduadi Spatial

Berkas ini adalah konteks proyek untuk Claude Code. Baca seluruhnya sebelum mengubah kode.

## Proyek

- Capstone Teknik Geodesi UGM, Kelompok 7 (Arimbi, Ariel, Agung, Diandra, Nova).
- Judul: Pembuatan Dashboard Spasial Persebaran dan Aksesibilitas Kost dan Penginapan di Kalurahan Sinduadi, Kapanewon Mlati, Kabupaten Sleman.
- Output: WebGIS statis (HTML, CSS, JavaScript, Leaflet, GeoJSON, CSV). Tidak ada server, tidak ada database, tidak ada build step saat deploy.
- Deploy: Vercel, terhubung ke repo GitHub ini. Push ke branch utama memperbarui produksi. Push ke branch lain menghasilkan preview deployment.
- Versi dasar repo adalah dashboard v6. Acuan metode adalah laporan antara revisi 3. Data memakai jaringan terkoreksi (6.967 ruas, ruas 4078 di sekitar Fakultas Teknik dihapus) dan seluruh OD berasal dari QNEAT3 putaran kedua. Isi folder `data/` sudah final, jangan dibuat ulang. Dashboard harus selalu sama dengan laporan. Bila ada perbedaan, laporan yang benar, kecuali pemilik repo berkata lain.

## Struktur berkas (repo capstonegeodesi2026-debug/PRGG)

| Path | Isi |
|---|---|
| `PRGG.md` | Berkas konteks ini. Namanya sengaja PRGG.md, jangan diganti nama. Claude Code tidak memuatnya otomatis, jadi harus dibaca di awal setiap sesi |
| `README.md` | Panduan repo versi v6 (berlaku) |
| `README.txt` | Sisa versi v3, isinya menyatakan data SIMULASI. Sudah tidak berlaku dan harus dihapus |
| `index.html` | Halaman tunggal: halaman awal, Dashboard, Tentang, Panduan, FAQ |
| `css/style.css` | Seluruh gaya |
| `js/config.js` | Semua pengaturan: nama file, nama kolom, bobot AHP, warna kelas, rentang harga, folder foto |
| `js/scoring.js` | Persentil, skor, kelas. Tanpa DOM, bisa diuji di Node |
| `js/map.js` | Leaflet: basemap, grid, titik, legenda, rute |
| `js/app.js` | Pemuatan data, validasi, filter, ranking, detail, pop-up, rute |
| `js/pages.js` | Halaman awal, onboarding Panduan, Tentang, FAQ |
| `js/crs.js` | Konversi UTM ke lon/lat bila data diekspor ulang dalam EPSG:32749 |
| `lib/leaflet/` | Leaflet 1.9.4 lokal |
| `data/grid.geojson`, `data/batas.geojson`, `data/akomodasi.geojson`, `data/fakultas.geojson` | Data utama, EPSG:4326 |
| `data/fasum/` | `halte`, `minimarket`, `kesehatan`, `laundry`, `rumah_ibadah`, `fotokopi` (.geojson) |
| `data/od_matrix/` | `centroid_to_faculty.csv`, `centroid_to_stop.csv`, `centroid_to_mart.csv`, `centroid_to_health.csv` dipakai skor. `centroid_to_laundry.csv` dan `centroid_to_religion.csv` tidak dipakai oleh `config.js` dan tidak ada di laporan |
| `data/routes/` | `TP-001.geojson` sampai `TP-020.geojson` dipakai. `rute_kos_fakultas.geojson` adalah sisa SIMULASI v3 dan harus dihapus |
| `data/foto/` | Saat ini berisi 105 foto asli (sekitar 78 MB, belum dioptimasi). Lihat bagian Foto kost |
| `tools/` | `export_data.py`, `routes.py`, `test_scoring.js`, `acuan_tahap9.csv`, `validasi_rute_vs_qneat3.csv`, `cek_id_halte.csv` |
| `vercel.json` | Belum ada. Opsional untuk header cache. Tidak boleh berisi build command |

## Kontrak data (jangan ubah nama kolom tanpa mengubah `config.js`)

- `data/grid.geojson`: 4.285 poligon heksagon. Kolom `grid_id` (G0001 sampai G4285), `simpang` (simpang/km², radius 500 m), `simpang_800`, `jumlah_kost`.
- `data/batas.geojson`: batas Kalurahan Sinduadi.
- `data/akomodasi.geojson`: 137 titik. Kolom `id_kos`, `nama_kos`, `jenis` (Kos Putri, Kos Putra, Penginapan), `grid_id`, `padukuhan`, `alamat`, `harga`, `satuan_harga` (bulan atau malam), `rating`, `link_gmaps`, `foto`, serta `waktu_TP001` sampai `waktu_TP020` (menit) dan `jarak_TP001` sampai `jarak_TP020` (meter).
- `data/fakultas.geojson`: 20 titik tujuan. Kolom `faculty_id` (TP-001 sampai TP-020), `nama_fakultas`, `singkatan`, `jenis`. Isinya 18 gerbang fakultas serta titik jemput Sekolah Pascasarjana dan Sekolah Vokasi.
- `data/fasum/*.geojson`: halte (48), minimarket (56), kesehatan (13) dipakai dalam skor. Laundry (74), rumah_ibadah (47), fotokopi (26) hanya tampilan. Kolom `id_fas`, `nama`, `kategori`, `keterangan`.
- `data/od_matrix/centroid_to_faculty.csv`: `origin_id,destination_id,total_cost,jarak_m`. total_cost dalam menit, 85.700 baris.
- `data/od_matrix/centroid_to_{stop,mart,health}.csv`: fasilitas terdekat per grid, total_cost dalam meter.
- `data/routes/TP-0xx.geojson`: rute tercepat 137 kost ke satu tujuan. Kolom `id_kos`, `faculty_id`, `waktu_menit`, `panjang_rute_m`, `jarak_terpendek_m`. Dimuat saat dibutuhkan.

## Metode skor (JANGAN diubah tanpa persetujuan pemilik repo)

1. Lima kriteria: waktu tempuh ke tujuan (cost), jarak ke halte (cost), jarak ke minimarket (cost), jarak ke fasilitas kesehatan (cost), kerapatan simpang radius 500 m (benefit).
2. Normalisasi: `percent_rank = (rank - 1) / (n - 1)`, ties memakai rank terkecil. Cost diurutkan menurun, benefit menaik.
3. Skor = 100 × Σ (w × persentil), bobot dinormalisasi ke jumlah 1. Panel Detail grid menampilkan poin tiap kriteria (persentil × bobot) yang jumlahnya sama dengan skor.
4. Bobot AHP bawaan: 57,60 / 15,25 / 15,25 / 5,95 / 5,95 (λmaks 5,094, CR 0,021). Pengguna boleh menggeser bobot, tetapi tombol "Kembalikan bobot AHP" harus tetap ada.
5. Kelas interval sama per tujuan: `min(5, floor((s - min) / ((max - min) / 5)) + 1)`. 1 Sangat rendah, 2 Rendah, 3 Sedang, 4 Tinggi, 5 Sangat tinggi.
6. Data kosong tidak boleh dianggap 0. Grid dengan kriteria kosong ditandai "skor belum lengkap".
7. Kecepatan jaringan yang mendasari data: arteri 50, kolektor 40, lokal 25, jalan lingkungan 10, setapak 4,5 km/jam, asumsi sepeda motor. Data OD sudah jadi. Dashboard tidak menghitung ulang jaringan.
8. Lima warna kelas tidak boleh diubah: `#b5452f`, `#e3924a`, `#ecd37a`, `#86b46a`, `#2f6b47`. Warna ini sama dengan peta di laporan.

## Uji wajib sebelum setiap commit

```bash
node tools/test_scoring.js . tools/acuan_tahap9.csv
```

Hasil wajib: `G0001 TP001 13.39 kelas 1`, `max |diff skor|` paling besar 0,005, `kelas berbeda 0 dari 85700`. Bila gagal, perubahan ditolak.

Uji manual:

```bash
python -m http.server 8000
```

Buka `http://localhost:8000`. Lencana status harus "Data OK" dan Console tanpa error merah. Jangan buka `index.html` lewat `file://`.

## Ponsel (wajib rapi dan lancar)

- Uji di DevTools mode perangkat pada 360, 390, dan 430 px, juga orientasi mendatar. Uji juga dengan throttling Fast 4G dan CPU 4x lebih lambat.
- Tidak boleh ada gulir horizontal. Teks minimal 14 px. Target sentuh minimal 44 × 44 px.
- Peta tetap terlihat dan bisa digeser dengan satu jari tanpa tertukar dengan gulir halaman. Pop-up dan legenda tidak menutupi lebih dari separuh peta. Di ponsel, pertimbangkan pop-up kost sebagai lembar bawah (bottom sheet).
- Tooltip yang hanya muncul saat hover harus punya padanan ketuk.
- Pemuatan awal: tampilkan indikator muat. Jangan memuat ulang CSV saat filter berubah. Rute dan foto dimuat saat dibutuhkan (`loading="lazy"`).
- Target Lighthouse mode Mobile: Performance minimal 80, Accessibility minimal 90. Bila tidak tercapai, laporkan penyebabnya.

## Foto kost

- Nama berkas foto sama persis dengan kolom `foto` di `data/akomodasi.geojson`, termasuk ekstensinya. Sumber lengkapnya folder Google Drive kelompok (140 berkas, sekitar 102,5 MB).
- Kondisi repo saat ini: `data/foto/` berisi 105 foto asli. 103 cocok dengan kost, 2 tidak terpakai (`KPI-PK-06.png`, `PGN-PW-01.png`, kostnya dikeluarkan karena di luar batas). Sebanyak 34 kost belum punya foto di repo, misalnya `KPA-PW-03.png`, `KPI-KJ-06.jpg`, `KPI-SD-11.jpg`. Ke-34 foto ini ada di Drive.
- Rencana: semua foto asli dipindah ke `foto_asli/` di root repo (masuk `.gitignore`, dilepas dari pelacakan git dengan `git rm --cached`). Pemilik repo melengkapi 34 foto dari Drive ke `foto_asli/`.
- Skrip `tools/optimasi_foto.py` (Python Pillow) mengubah setiap foto menjadi WebP: lebar maksimum 800 px, kualitas sekitar 75, target di bawah 150 KB, orientasi EXIF dibetulkan. Nama hasil = nama asli tanpa ekstensi + `.webp`, misalnya `KPI-KT-01.png` menjadi `data/foto/KPI-KT-01.webp`. Hanya hasil WebP yang ada di `data/foto/`.
- Kolom `foto` di data TIDAK diubah. Pemetaan nama diatur di `config.js` (misalnya `photoExt: '.webp'`).
- Pop-up dan panel Detail akomodasi menampilkan foto dengan `loading="lazy"`, `alt` berisi nama kost, rasio tetap agar tata letak tidak melompat, dan foto yang gagal dimuat disembunyikan tanpa error.
- Skrip melaporkan kost yang fotonya tidak ditemukan, foto tanpa pasangan kost, dan ukuran total sebelum dan sesudah.

## Deploy Vercel

- Proyek statis: Framework Preset "Other", tanpa build command, output directory root repo. Jangan menambahkan `package.json` dengan skrip build hanya untuk deploy.
- Semua path relatif dan huruf besar kecil harus persis sama dengan nama berkas.
- `vercel.json` boleh dipakai untuk header cache data dan foto. Jangan membuat rewrite yang menimpa berkas di `data/`.
- Setiap perubahan dicek dulu di preview deployment dari branch kerja, termasuk dibuka di ponsel asli, sebelum digabung ke branch utama.

## Aturan teknis

- Tetap statis. Jangan menambah framework (React, Vue, Tailwind build) atau bundler. Pustaka tambahan hanya bila benar-benar perlu, disimpan lokal di `lib/`.
- Semua pengaturan baru masuk `js/config.js`.
- Teks dari data selalu lewat `esc()` sebelum masuk HTML. Tautan luar hanya `https://`, dengan `rel="noopener"`.
- Peta dasar: OpenStreetMap standar `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, `maxZoom: 19`, atribusi `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors` wajib terlihat di desktop dan ponsel. Patuhi kebijakan tile OSM: tanpa unduhan massal dan tanpa prefetch berlebihan.
- Animasi memakai CSS transition atau Web Animations API, tanpa GSAP atau Lottie. Wajib menghormati `prefers-reduced-motion`. Setelah transisi yang mengubah ukuran peta, panggil `map.invalidateSize()`.

## Aturan tampilan dan bahasa

- Bahasa Indonesia baku dan sederhana. Istilah mengikuti laporan: kost (bukan kos), penginapan, tujuan kampus, kelas aksesibilitas, skor aksesibilitas.
- Jangan memakai tanda pisah panjang (em dash) dan titik koma dalam teks antarmuka.
- Arah gaya: netral dan fungsional seperti WebGIS instansi. Hindari gradien ungu, efek kaca, emoji sebagai ikon, kartu bertumpuk generik, bayangan berlebihan, dan teks pemasaran.
- Warna kelas tidak boleh menjadi satu-satunya pembeda. Sertakan label kelas.
- Kontras teks minimal WCAG AA. Semua kontrol bisa dipakai dengan keyboard dan punya label.

## Peran skill

- `ui-ux-pro-max`: hanya untuk usulan palet antarmuka, pasangan font, dan daftar cek UX. Hasil berupa variabel CSS, bukan Tailwind.
- `motion-design-skill`: animasi halaman awal ke dashboard, akordeon FAQ, dan transisi kecil lain.
- `taste-skill`: hanya halaman awal dan halaman Tentang. Aturan satu section per layar tidak berlaku untuk dashboard. Tanpa foto stok atau aset dari internet.
- Bila arahan skill bertentangan dengan berkas ini, ikuti berkas ini dan sebutkan bagian yang diabaikan.

## Kekurangan yang sudah diketahui

1. `README.txt` dan `data/routes/rute_kos_fakultas.geojson` adalah sisa data SIMULASI v3. Hapus setelah dikonfirmasi tidak dirujuk kode.
2. `centroid_to_laundry.csv` dan `centroid_to_religion.csv` tidak dipakai. Jangan dihapus tanpa persetujuan pemilik repo. Tanyakan dulu.
3. Foto masih asli dan berukuran besar, 34 kost belum punya foto di repo.
4. Filter fasilitas kost belum ada karena data fasilitas di dalam kost belum dikumpulkan. Jangan mengarang data.
5. `favicon` belum ada (404 di Console).
6. Basemap masih CARTO, harus diganti OSM.
7. Tombol "Lanjut" di Panduan pernah tidak terlihat (teks putih di latar putih). Sudah diperbaiki sejak v5 lewat `.ob-btns button.primary:not(.link)`. Pastikan tidak muncul lagi.
8. Antarmuka masih mencampur "kos" dan "kost".
9. `centroid_to_faculty.csv` sekitar 2,6 MB. Boleh dioptimalkan asalkan uji skor tetap lolos.

## Cara kerja yang diharapkan

1. Baca repo dulu, bandingkan dengan berkas ini, lalu laporkan perbedaan sebelum mengubah apa pun.
2. Susun rencana singkat dan tunggu persetujuan untuk perubahan besar.
3. Kerjakan di branch `perbaikan-ui`, commit kecil per tema, pesan commit dalam bahasa Indonesia.
4. Setelah tiap tema: uji skor, cek desktop dan ponsel, lalu ringkas apa yang berubah.
5. Jangan mengubah isi data kecuali kolom `foto`. Jangan menghapus `tools/`.
