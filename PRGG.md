# CLAUDE.md · Dashboard Sinduadi Spatial

Berkas ini adalah konteks proyek untuk Claude Code. Baca seluruhnya sebelum mengubah kode.

## Proyek

- Capstone Teknik Geodesi UGM, Kelompok 7 (Arimbi, Ariel, Agung, Diandra, Nova).
- Judul: Pembuatan Dashboard Spasial Persebaran dan Aksesibilitas Kost dan Penginapan di Kalurahan Sinduadi, Kapanewon Mlati, Kabupaten Sleman.
- Output: WebGIS statis (HTML, CSS, JavaScript, Leaflet, GeoJSON, CSV). Tidak ada server, tidak ada database, tidak ada build step saat deploy.
- Deploy: Vercel, terhubung ke repo GitHub ini. Push ke branch utama memperbarui produksi. Push ke branch lain menghasilkan preview deployment.
- Acuan metode adalah laporan antara revisi 3. Dashboard harus selalu sama dengan laporan. Bila ada perbedaan, laporan yang benar, kecuali pemilik repo berkata lain.

## Struktur berkas

| Path | Isi |
|---|---|
| `index.html` | Halaman tunggal: halaman awal, Dashboard, Tentang, Panduan, FAQ |
| `css/style.css` | Seluruh gaya |
| `js/config.js` | Semua pengaturan: nama file, nama kolom, bobot AHP, warna kelas, rentang harga, folder foto |
| `js/scoring.js` | Persentil, skor, kelas. Tanpa DOM, bisa diuji di Node |
| `js/map.js` | Leaflet: basemap, grid, titik, legenda, rute |
| `js/app.js` | Pemuatan data, validasi, filter, ranking, detail, pop-up, rute |
| `js/pages.js` | Halaman awal, onboarding Panduan, Tentang, FAQ |
| `js/crs.js` | Konversi UTM ke lon/lat bila data diekspor ulang dalam EPSG:32749 |
| `lib/leaflet/` | Leaflet 1.9.4 lokal |
| `data/` | Data aktual, EPSG:4326 |
| `data/foto/` | Foto kost hasil optimasi (lihat bagian Foto) |
| `tools/` | Skrip ekspor data, uji skor, file validasi, skrip optimasi foto |
| `vercel.json` | Opsional: header cache. Tidak boleh berisi build command |

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

Hasil wajib: `G0001 TP001 13.72 kelas 1`, `max |diff skor|` paling besar 0,005, `kelas berbeda 0 dari 85700`. Bila gagal, perubahan ditolak.

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

- Kolom `foto` di `akomodasi.geojson` berisi nama berkas, misalnya `KPI-KT-01.png`. Path foto diatur di `CONFIG.photoDir`.
- Foto asli dioptimasi sekali dengan skrip di `tools/` (misalnya Python Pillow): lebar maksimum 800 px, format WebP atau JPEG kualitas sekitar 75, target di bawah 150 KB per foto. Simpan hasilnya di `data/foto/`, lalu sesuaikan kolom `foto` atau aturan nama berkas di `config.js`.
- Foto asli berukuran besar tidak ikut di-commit bila sudah ada versi optimasi.
- Pop-up dan panel Detail akomodasi menampilkan foto dengan `loading="lazy"`, `alt` berisi nama kost, rasio tetap agar tata letak tidak melompat, dan foto yang gagal dimuat disembunyikan tanpa error.
- Laporkan kost yang fotonya tidak ditemukan dan foto yang tidak punya pasangan kost.

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

1. Filter fasilitas kost belum ada karena data fasilitas di dalam kost belum dikumpulkan. Jangan mengarang data.
2. Foto kost belum terpasang.
3. `favicon` belum ada (404 di Console).
4. Basemap masih CARTO, harus diganti OSM.
5. Tombol "Lanjut" di Panduan pernah tidak terlihat (teks putih di latar putih). Sudah diperbaiki di v5 lewat `.ob-btns button.primary:not(.link)`. Pastikan tidak muncul lagi.
6. Antarmuka masih mencampur "kos" dan "kost".
7. `centroid_to_faculty.csv` sekitar 2,6 MB. Boleh dioptimalkan asalkan uji skor tetap lolos.

## Cara kerja yang diharapkan

1. Baca repo dulu, bandingkan dengan berkas ini, lalu laporkan perbedaan sebelum mengubah apa pun.
2. Susun rencana singkat dan tunggu persetujuan untuk perubahan besar.
3. Kerjakan di branch `perbaikan-ui`, commit kecil per tema, pesan commit dalam bahasa Indonesia.
4. Setelah tiap tema: uji skor, cek desktop dan ponsel, lalu ringkas apa yang berubah.
5. Jangan mengubah isi data kecuali kolom `foto`. Jangan menghapus `tools/`.
