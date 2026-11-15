/* Navigasi halaman, onboarding, Tentang, dan FAQ. Dashboard tetap di bawah (peta tidak dibuat ulang). */
const Pages = (() => {
  const $ = id => document.getElementById(id), KEY = 'sinduadi.onboarded', R = CONFIG.research;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = d => `<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#14532d" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const SLIDES = [
    { t: 'Pilih Fakultas Tujuan', i: ic('<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>'),
      x: 'Pilih fakultas tujuan pada panel Parameter analisis. Pilihan ini menentukan jarak jaringan jalan dari setiap grid ke fakultas, sehingga skor dan peringkat kawasan ikut diperbarui.' },
    { t: 'Pilih Jenis Akomodasi', i: ic('<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/>'),
      x: 'Filter titik akomodasi: semua akomodasi, kos putra, kos putri, kos campur (jika tersedia), atau penginapan. Pilihan jenis yang muncul mengikuti data. Filter tidak mengubah skor WSM.' },
    { t: 'Eksplorasi Kawasan', i: ic('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'),
      x: 'Warna grid (hijau-kuning-merah) menunjukkan tingkat aksesibilitas hasil perhitungan WSM; hijau berarti skor lebih tinggi. Ubah bobot enam kriteria lalu tekan "Terapkan bobot" untuk melihat perubahan peringkat kawasan.' },
    { t: 'Lihat Detail dan Rute', i: ic('<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
      x: 'Klik titik kos pada peta untuk melihat informasi akomodasi, lalu tekan "Lihat Rute ke Fakultas" untuk menampilkan rute jaringan jalan menuju fakultas yang sedang dipilih.' }
  ];
  const FAQ = [
    ['Apa itu Sinduadi Spatial?', 'Dashboard WebGIS untuk menjelajahi persebaran kos dan penginapan di Kalurahan Sinduadi serta menilai aksesibilitas kawasannya terhadap fakultas dan fasilitas umum.'],
    ['Apa yang dimaksud dengan grid atau kawasan pada peta?', 'Grid adalah petak poligon yang membagi wilayah studi. Grid adalah unit analisis: skor dihitung per grid, bukan per titik kos. Beberapa kos dalam satu grid memakai skor grid yang sama.'],
    ['Bagaimana cara membaca warna pada peta aksesibilitas?', 'Warna bergradasi hijau-kuning-merah menurut skor WSM: hijau = skor relatif lebih tinggi, merah = lebih rendah. Abu-abu berarti data jarak grid belum lengkap sehingga skor tidak dihitung.'],
    ['Apa arti skor aksesibilitas?', 'Skor 0-100 yang membandingkan satu grid dengan grid lain pada data yang sama. Skor bersifat relatif (bukan nilai absolut) dan bergantung pada fakultas tujuan serta bobot yang dipilih.'],
    ['Apa itu metode Weighted Sum Model (WSM)?', 'Metode pemeringkatan yang menjumlahkan nilai tiap kriteria dikalikan bobotnya. Di sini nilai tiap jarak dinormalisasi (min-max terbalik, jarak lebih pendek = nilai lebih tinggi), lalu dijumlahkan dengan bobot yang total 100%.'],
    ['Mengapa saya perlu memilih fakultas tujuan?', 'Jarak ke fakultas adalah salah satu kriteria dan berbeda untuk tiap fakultas. Pilihan fakultas juga menentukan tujuan rute dari titik kos.'],
    ['Apa saja kriteria yang digunakan untuk menghitung aksesibilitas?', 'Enam kriteria jarak jaringan jalan dari centroid grid: ke fakultas tujuan, fasilitas kesehatan terdekat, laundry terdekat, minimarket/swalayan terdekat, rumah ibadah terdekat, dan halte terdekat.'],
    ['Bagaimana cara mengubah bobot kriteria?', 'Geser slider pada panel "Bobot kriteria" (persentase ternormalisasi langsung berubah), lalu tekan "Terapkan bobot" agar peta dan peringkat dihitung ulang. Total bobot selalu 100%. Tombol Reset mengembalikan bobot awal.'],
    ['Apakah semakin tinggi skor berarti semakin mudah dijangkau?', 'Ya, secara relatif terhadap grid lain: skor tinggi berarti jarak jaringan jalan ke fakultas dan fasilitas (menurut bobot yang dipilih) cenderung lebih dekat. Skor tidak menjamin kualitas hunian.'],
    ['Bagaimana cara melihat informasi kos atau penginapan?', 'Klik titik akomodasi pada peta untuk membuka popup dan panel "Detail akomodasi", atau pilih grid lalu klik "Lihat di peta" pada daftar akomodasinya.'],
    ['Bagaimana cara melihat rute dari kos menuju fakultas?', 'Pilih fakultas tujuan, klik titik kos, lalu tekan "Lihat Rute ke Fakultas" pada popup atau panel detail. Gunakan "Tutup Rute" untuk menghapusnya.'],
    ['Apakah rute yang ditampilkan mengikuti jaringan jalan?', 'Rute berasal dari hasil analisis jaringan jalan QNEAT3 yang sudah disiapkan (file GeoJSON), bukan garis lurus dan bukan hasil pencarian rute otomatis di browser. Catatan: rute pada paket contoh ini adalah data SIMULASI dan akan diberi label tersebut.'],
    ['Apakah seluruh kos yang ditampilkan memiliki rute yang tersedia?', 'Belum tentu. Rute hanya tersedia untuk kombinasi kos dan fakultas yang ada di data. Jika tidak ada, dashboard menampilkan "Data rute untuk akomodasi dan fakultas ini belum tersedia" dan tidak menggambar rute pengganti.'],
    ['Apakah peringkat kawasan akan berubah ketika saya mengganti fakultas tujuan?', 'Ya. Nilai kriteria jarak ke fakultas berubah, sehingga skor dan peringkat dihitung ulang. Rute yang sedang tampil juga dihapus.'],
    ['Bagaimana cara menggunakan filter jenis akomodasi?', 'Pilih jenis pada dropdown "Jenis akomodasi". Titik di peta, jumlah di Ringkasan, dan daftar akomodasi per grid menyesuaikan. Skor dan peringkat grid tidak berubah.']
  ];
  const store = { get() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }, set() { try { localStorage.setItem(KEY, '1'); } catch (e) { /* abaikan */ } } };

  function show(v) {
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + v));
    document.querySelectorAll('[data-view]').forEach(a => a.classList.toggle('current', a.dataset.view === v));
    $('navLinks').classList.remove('open'); $('burger').setAttribute('aria-expanded', 'false'); window.scrollTo(0, 0);
  }
  let step = 0;
  function renderStep() {
    const s = SLIDES[step];
    $('obIcon').innerHTML = s.i; $('obStep').textContent = `Langkah ${step + 1} dari ${SLIDES.length}`; $('obTitle').textContent = s.t; $('obText').textContent = s.x;
    $('obDots').innerHTML = SLIDES.map((_, i) => `<i class="${i === step ? 'on' : i < step ? 'done' : ''}"></i>`).join('');
    $('obBack').disabled = step === 0; $('obNext').textContent = step === SLIDES.length - 1 ? 'Mulai' : 'Selanjutnya';
  }
  function openGuide() { step = 0; renderStep(); $('onboard').hidden = false; $('obNext').focus(); }
  function closeGuide() { $('onboard').hidden = true; store.set(); show('dashboard'); }
  function start() { store.get() ? show('dashboard') : openGuide(); }

  function build() {
    $('aboutBody').innerHTML = `<h1>Tentang</h1>
      <h2>Tentang Website</h2><p>SINDUADI SPATIAL adalah dashboard WebGIS untuk mengeksplorasi persebaran kos dan penginapan serta menganalisis aksesibilitas kawasan di Kalurahan Sinduadi, Kapanewon Mlati, Kabupaten Sleman.</p>
      <h2>Latar Belakang</h2><p>Memilih hunian di sekitar kampus bergantung pada seberapa mudah kawasan itu menjangkau fakultas dan fasilitas sehari-hari. Informasi spasial yang terstruktur tentang persebaran akomodasi dan aksesibilitasnya membantu mahasiswa maupun masyarakat umum membandingkan kawasan secara lebih objektif.</p>
      <h2>Tujuan</h2><ul><li>Menampilkan persebaran kos dan penginapan.</li><li>Menganalisis aksesibilitas kawasan berdasarkan jaringan jalan.</li><li>Menghasilkan pemeringkatan kawasan menggunakan metode WSM.</li><li>Menyediakan informasi spasial yang interaktif dan mudah dipahami.</li></ul>
      <h2>Metodologi</h2><ol><li>Pengolahan data spasial menggunakan QGIS.</li><li>Analisis jaringan jalan menggunakan QNEAT3.</li><li>Jarak aksesibilitas dihitung dari centroid grid melalui OD Matrix (jarak ke fasilitas terdekat; untuk fakultas, jarak ke tiap fakultas).</li><li>Normalisasi nilai kriteria: jarak yang lebih pendek mendapat nilai lebih tinggi (min-max terbalik).</li><li>Pembobotan dan pemeringkatan dengan Weighted Sum Model (WSM) dengan bobot yang dapat diubah pengguna.</li><li>Visualisasi hasil dengan Leaflet.js.</li></ol>
      <p class="note">Data pada paket ini adalah data SIMULASI untuk pengujian. Bobot awal hanyalah contoh dan bukan bobot final penelitian; hasil penelitian akan tersedia setelah data aktual dimasukkan.</p>
      <h2>Informasi Penelitian</h2><table class="info"><tr><th>Judul</th><td>${esc(R.judul)}</td></tr><tr><th>Peneliti</th><td>${esc(R.peneliti)}</td></tr><tr><th>Program Studi</th><td>${esc(R.prodi)}</td></tr><tr><th>Fakultas</th><td>${esc(R.fakultas)}</td></tr><tr><th>Tahun</th><td>${esc(R.tahun)}</td></tr></table>
      <p><button class="primary" data-view="dashboard">Buka Dashboard</button></p>`;
    $('faqList').innerHTML = FAQ.map((f, i) => `<details><summary>${i + 1}. ${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join('');
    $('faqList').addEventListener('toggle', e => { if (e.target.open) $('faqList').querySelectorAll('details').forEach(d => { if (d !== e.target) d.open = false; }); }, true);
  }
  build(); show('welcome');
  document.addEventListener('click', e => {
    const v = e.target.closest('[data-view]'); if (v) { e.preventDefault(); return show(v.dataset.view); }
    const a = e.target.closest('[data-action]'); if (a) { e.preventDefault(); return a.dataset.action === 'start' ? start() : openGuide(); }
  });
  $('burger').onclick = () => { const o = $('navLinks').classList.toggle('open'); $('burger').setAttribute('aria-expanded', String(o)); };
  $('obNext').onclick = () => step < SLIDES.length - 1 ? (step++, renderStep()) : closeGuide();
  $('obBack').onclick = () => { if (step > 0) { step--; renderStep(); } };
  $('obSkip').onclick = closeGuide;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('onboard').hidden) closeGuide(); });
  return { show, openGuide, start };
})();
