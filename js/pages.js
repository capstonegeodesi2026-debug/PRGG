/* Navigasi halaman, onboarding, Tentang, dan FAQ. Dashboard tetap di bawah (peta tidak dibuat ulang). */
const Pages = (() => {
  const $ = id => document.getElementById(id), KEY = 'sinduadi.onboarded', R = CONFIG.research;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = d => `<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#0F2A44" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const SLIDES = [
    { t: 'Pilih Tujuan Kampus', i: ic('<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>'),
      x: 'Ada 20 tujuan berupa gerbang fakultas dan titik jemput di kampus UGM. Tujuan yang dipilih menentukan waktu tempuh dari setiap grid, sehingga warna peta dan peringkat ikut berubah.' },
    { t: 'Baca Warna Grid', i: ic('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'),
      x: 'Grid dibagi ke lima kelas aksesibilitas. Hijau tua berarti sangat tinggi, merah bata berarti sangat rendah. Klik satu grid untuk melihat nilai tiap kriteria dan kost yang ada di dalamnya.' },
    { t: 'Coba Bobot Sendiri', i: ic('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'),
      x: 'Bobot awal berasal dari AHP penelitian. Anda boleh menggesernya, lalu tekan "Terapkan bobot". Tombol "Kembalikan bobot AHP" memulihkan bobot penelitian.' },
    { t: 'Lihat Kost dan Rutenya', i: ic('<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
      x: 'Saring kost dengan jenis dan rentang harga. Klik titiknya untuk melihat harga, foto, dan waktu tempuh ke tujuan yang dipilih. Tombol "Lihat rute" menggambar jalur tercepat di jaringan jalan.' }
  ];
  const FAQ = [
    ['Apa itu Sinduadi Spatial?', 'Dashboard WebGIS untuk menjelajahi persebaran kost dan penginapan di Kalurahan Sinduadi serta menilai aksesibilitas kawasannya terhadap kampus UGM dan fasilitas sehari-hari.'],
    ['Apa yang dimaksud grid pada peta?', 'Grid adalah petak segi enam yang membagi wilayah studi menjadi 4.285 unit analisis. Skor dihitung dari titik pusat tiap grid, bukan dari titik kost. Kost di dalam satu grid memakai skor grid yang sama.'],
    ['Bagaimana membaca warna peta?', 'Setiap grid masuk ke salah satu dari lima kelas: sangat rendah, rendah, sedang, tinggi, dan sangat tinggi. Batas kelas dibuat dengan interval sama antara skor terendah dan tertinggi untuk tujuan yang sedang dipilih.'],
    ['Apa arti skor aksesibilitas?', 'Skor 0 sampai 100 yang bersifat relatif. Nilai tinggi berarti grid tersebut lebih unggul dibanding grid lain di Sinduadi pada kriteria yang dipakai. Skor tidak menilai kualitas atau harga hunian.'],
    ['Kriteria apa saja yang dipakai?', 'Lima kriteria: waktu tempuh ke tujuan kampus, jarak jaringan ke halte Trans Jogja terdekat, ke minimarket terdekat, ke fasilitas kesehatan terdekat, serta kerapatan simpang dalam radius 500 m. Laundry, rumah ibadah, dan fotokopi hanya ditampilkan sebagai informasi pendukung. Harga, foto, dan rating kost juga tidak ikut menentukan skor.'],
    ['Seberapa besar pengaruh tujuan kampus terhadap skor?', 'Waktu tempuh ke tujuan menyumbang sekitar 66% ragam skor, lebih besar daripada bobotnya yang 57,60%. Kawasan kelas 5 rata-rata berjarak 5,2 menit dari tujuan, sedangkan kelas 1 rata-rata 12,2 menit. Rincian sumbangan tiap kriteria terlihat pada kolom Poin di panel Detail grid.'],
    ['Bagaimana skor dihitung?', 'Nilai tiap kriteria diubah menjadi persentil (percent rank) terhadap seluruh grid. Waktu dan jarak yang lebih pendek mendapat persentil lebih tinggi, sedangkan simpang yang lebih rapat mendapat persentil lebih tinggi. Persentil lalu dikalikan bobot dan dijumlahkan.'],
    ['Dari mana bobot awal berasal?', 'Dari perbandingan berpasangan AHP penelitian: waktu tempuh 57,60%, halte 15,25%, minimarket 15,25%, fasilitas kesehatan 5,95%, dan simpang 5,95% dengan rasio konsistensi 0,021.'],
    ['Bolehkah saya mengubah bobot?', 'Boleh. Geser slider pada panel Bobot kriteria lalu tekan "Terapkan bobot". Label di atas slider menunjukkan apakah peta memakai bobot penelitian atau bobot ubahan Anda.'],
    ['Mengapa memakai waktu tempuh, bukan jarak, ke kampus?', 'Rute terpendek belum tentu tercepat. Waktu tempuh dihitung dari panjang ruas dibagi kecepatan sesuai kelas jalan (arteri 50, kolektor 40, lokal 25, jalan lingkungan 10, setapak 4,5 km/jam) dengan asumsi sepeda motor.'],
    ['Mengapa jalan lingkungan memakai 10 km/jam?', 'Sinduadi termasuk Kawasan Perkotaan Yogyakarta (Perbup Sleman 6.1/2019), sehingga jalan lingkungannya diperlakukan sebagai jalan lingkungan sekunder. PP 34/2006 Pasal 20 ayat (1) menetapkan kecepatan rencana jalan ini paling rendah 10 km/jam. Uji dengan 15 km/jam memindahkan sekitar 13% kawasan satu kelas tanpa ada yang berpindah dua kelas.'],
    ['Apakah rute mengikuti jaringan jalan?', 'Ya. Rute adalah jalur tercepat pada jaringan jalan yang sama dengan analisis OD Matrix QNEAT3. Selisih waktu rute yang digambar dengan hasil QNEAT3 di bawah 0,4 detik untuk seluruh 2.740 pasangan kost dan tujuan.'],
    ['Mengapa panjang rute kadang berbeda dengan jarak terpendek?', 'Rute yang digambar adalah jalur tercepat. Jalur terpendek bisa melewati jalan lingkungan yang lebih lambat, sehingga panjangnya lebih pendek tetapi waktunya lebih lama.'],
    ['Apakah semua kost punya rute?', 'Semua 137 kost punya rute ke 20 tujuan. Bila suatu saat data rute tidak ditemukan, dashboard menampilkan pesan dan tidak menggambar garis lurus pengganti.'],
    ['Bagaimana memakai filter jenis dan harga?', 'Pilih jenis pada menu Jenis akomodasi dan rentang pada menu Rentang harga. Harga kost dihitung per bulan, sedangkan penginapan per malam. Titik di peta, jumlah di Ringkasan, dan daftar kost per grid menyesuaikan. Skor grid tidak berubah karena filter ini.']
  ];
  const store = { get() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }, set() { try { localStorage.setItem(KEY, '1'); } catch (e) { /* abaikan */ } } };

  /* ---------- Animasi (CSS transition dan Web Animations API saja) ---------- */
  const M = CONFIG.motion;
  const reduced = () => !Element.prototype.animate || matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = null, running = [];
  const finishAll = () => { running.forEach(a => { try { a.finish(); } catch (e) { /* sudah selesai */ } }); running = []; };
  function mapReady() {   // ukuran peta dihitung ulang setelah transisi selesai
    if (typeof MapView === 'undefined') return;
    MapView.showBasemap();
    if (!show.fitted) { show.fitted = true; MapView.fit(); } else MapView.invalidate();
  }
  /* Halaman awal ke dashboard: halaman awal memudar dan naik sedikit, lalu peta, panel kiri, dan panel kanan muncul berurutan.
     Total M.pageOut*0.8 + 2*M.stagger + M.enter, di bawah 600 ms. Hanya transform dan opacity yang dianimasikan. */
  function welcomeToDashboard(welcome) {
    finishAll();
    const small = innerWidth <= CONFIG.ui.mobileMax;
    const out = welcome.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateY(${-M.shift}px)` }],
      { duration: M.pageOut, easing: M.easeIn, fill: 'forwards' });
    const items = [['.mapwrap', `translateY(${M.shift}px)`], ['.panel.left', small ? `translateY(${M.shift}px)` : `translateX(${-M.shift}px)`],
                   ['.panel.right', small ? `translateY(${M.shift}px)` : `translateX(${M.shift}px)`]];
    const ins = items.map(([sel, from], i) => document.querySelector(sel).animate([{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }],
      { duration: M.enter, delay: Math.round(M.pageOut * 0.8) + i * M.stagger, easing: M.easeOut, fill: 'backwards' }));
    running = [out, ...ins];
    out.finished.then(() => { welcome.classList.remove('active'); out.cancel(); }).catch(() => {});
    Promise.all(ins.map(a => a.finished)).then(() => { running = []; mapReady(); }).catch(() => {});
  }
  function show(v) {
    const prev = current; current = v;
    const welcome = $('page-welcome');
    const animate = prev === 'welcome' && v === 'dashboard' && !reduced() && welcome.classList.contains('active');
    document.querySelectorAll('.page').forEach(p => { if (!(animate && p === welcome)) p.classList.toggle('active', p.id === 'page-' + v); });
    // Dashboard disembunyikan (visibility) selama halaman lain menutupinya: tidak ada kerja render dan pergeseran tata letak di belakang layar.
    document.body.classList.toggle('on-page', v !== 'dashboard');
    document.querySelectorAll('[data-view]').forEach(a => a.classList.toggle('current', a.dataset.view === v));
    $('navLinks').classList.remove('open'); $('burger').setAttribute('aria-expanded', 'false'); window.scrollTo(0, 0);
    if (animate) welcomeToDashboard(welcome);
    else { finishAll(); if (v === 'dashboard') mapReady(); }
  }

  /* ---------- Akordeon FAQ ---------- */
  // Tombol asli menangani Enter dan Spasi. aria-expanded dan hidden selalu mengikuti keadaan panel.
  function setFaq(btn, open) {
    const panel = $(btn.getAttribute('aria-controls')); if (!panel) return;
    if ((btn.getAttribute('aria-expanded') === 'true') === open) return;
    btn.setAttribute('aria-expanded', String(open));
    if (panel._anim) { panel._anim.cancel(); panel._anim = null; }
    if (reduced()) { panel.hidden = !open; return; }
    if (open) panel.hidden = false;
    const h = panel.scrollHeight;
    const a = panel.animate(open ? [{ height: '0px', opacity: 0 }, { height: h + 'px', opacity: 1 }] : [{ height: h + 'px', opacity: 1 }, { height: '0px', opacity: 0 }],
      { duration: open ? M.accOpen : M.accClose, easing: open ? M.easeOut : M.easeIn });
    panel._anim = a;
    a.finished.then(() => { panel._anim = null; if (!open) panel.hidden = true; }).catch(() => {});
  }
  function faqClick(e) {
    const btn = e.target.closest('.faq-q'); if (!btn) return;
    const open = btn.getAttribute('aria-expanded') !== 'true';
    if (open) $('faqList').querySelectorAll('.faq-q[aria-expanded="true"]').forEach(b => { if (b !== btn) setFaq(b, false); });
    setFaq(btn, open);
  }
  let step = 0;
  function renderStep() {
    const s = SLIDES[step];
    $('obIcon').innerHTML = s.i; $('obStep').textContent = `Langkah ${step + 1} dari ${SLIDES.length}`; $('obTitle').textContent = s.t; $('obText').textContent = s.x;
    $('obDots').innerHTML = SLIDES.map((_, i) => `<i class="${i === step ? 'on' : i < step ? 'done' : ''}"></i>`).join('');
    $('obBack').disabled = step === 0; $('obNext').textContent = step === SLIDES.length - 1 ? 'Mulai' : 'Lanjut';
  }
  let opener = null;
  function openGuide() { opener = document.activeElement; step = 0; renderStep(); $('onboard').hidden = false; $('obNext').focus(); }
  function closeGuide() { $('onboard').hidden = true; store.set(); show('dashboard');
    // Fokus dikembalikan ke kontrol pertama dashboard (pemicu di halaman awal sudah tidak terlihat).
    const back = opener && opener.offsetParent && !opener.closest('.page') ? opener : $('facultySelect'); if (back) back.focus({ preventScroll: true }); }
  /* Tab dan Shift+Tab berputar di dalam Panduan selama Panduan terbuka. */
  function trapFocus(e) {
    const f = [...$('onboard').querySelectorAll('button')].filter(b => !b.disabled);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!$('onboard').contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function start() { store.get() ? show('dashboard') : openGuide(); }

  function build() {
    /* Halaman Tentang: empat bagian, masing-masing setinggi satu layar di desktop. Teks dari laporan, foto kost dari data/foto. */
    const photoSrc = name => CONFIG.photoDir + (CONFIG.photoExt ? String(name).replace(/\.[^./]+$/, '') + CONFIG.photoExt : name);
    const ph = (i, cls) => { const p = (CONFIG.aboutPhotos || [])[i]; return p ? `<div class="ph${cls ? ' ' + cls : ''}"><img src="${esc(photoSrc(p.foto))}" alt="${esc('Foto ' + p.nama)}" width="800" height="600" loading="lazy" decoding="async"></div>` : ''; };
    const crit = CONFIG.criteria, tot = crit.reduce((s, c) => s + c.weight, 0);
    const pct = v => (v / tot * 100).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
    $('heroLegend').innerHTML = CONFIG.classes.slice().reverse().map(c => `<li><span class="sw" style="background:${c.color}"></span>${c.k} ${esc(c.label)}</li>`).join('');
    $('aboutBody').innerHTML = `
      <section class="ab-sec" aria-labelledby="ab1"><div class="ab-wrap ab-split">
        <div class="ab-text"><p class="eyebrow">Tentang</p><h1 id="ab1">Tentang Sinduadi Spatial</h1>
          <p class="lead">SINDUADI SPATIAL adalah dashboard WebGIS untuk mengeksplorasi persebaran kost dan penginapan serta menganalisis aksesibilitas kawasan di Kalurahan Sinduadi, Kapanewon Mlati, Kabupaten Sleman.</p>
          <h2>Latar belakang</h2><p>Memilih hunian di sekitar kampus bergantung pada seberapa mudah kawasan itu menjangkau fakultas dan fasilitas sehari-hari. Informasi spasial yang terstruktur tentang persebaran akomodasi dan aksesibilitasnya membantu mahasiswa maupun masyarakat umum membandingkan kawasan secara lebih objektif.</p></div>
        <div class="ab-photos ab-photos-3">${ph(0, 'tall')}${ph(1)}${ph(2)}</div></div></section>
      <section class="ab-sec" aria-labelledby="ab2"><div class="ab-wrap ab-split ab-rev">
        <div class="ab-photos ab-photos-2">${ph(3)}${ph(4)}</div>
        <div class="ab-text"><h2 id="ab2">Tujuan penelitian</h2><ol class="ab-list"><li>Menampilkan persebaran 137 kost dan penginapan di Sinduadi.</li><li>Mengukur aksesibilitas kawasan ke 20 gerbang dan titik jemput kampus UGM melalui jaringan jalan.</li><li>Mengelompokkan kawasan ke lima kelas aksesibilitas.</li><li>Menyediakan peta interaktif yang bisa dibuka di laptop maupun ponsel.</li></ol></div></div></section>
      <section class="ab-sec" aria-labelledby="ab3"><div class="ab-wrap">
        <h2 id="ab3">Metodologi</h2>
        <div class="ab-method"><ol class="ab-steps"><li>Jaringan jalan Kabupaten Sleman dan Kota Yogyakarta dipotong pada penyangga 1,5 km, dibersihkan topologinya, lalu diberi kecepatan menurut kelas jalan. Dasarnya PM 111/2015 untuk arteri, kolektor, dan lokal, serta UU 2/2022 dan PP 34/2006 untuk jalan lingkungan sekunder di kawasan perkotaan.</li><li>Wilayah dibagi menjadi 4.285 grid segi enam. Titik pusat grid menjadi titik asal.</li><li>OD Matrix QNEAT3 menghitung waktu tempuh ke 20 tujuan dan jarak jaringan ke halte, minimarket, dan fasilitas kesehatan terdekat.</li><li>Kerapatan simpang (derajat simpul tiga atau lebih) dihitung dalam radius 500 m dari titik pusat grid.</li><li>Setiap kriteria diubah ke persentil, dikalikan bobot AHP (CR 0,021), lalu dijumlahkan menjadi skor 0 sampai 100. Mengubah satu bobot sebesar 20% hanya memindahkan 1,1% sampai 10,4% kawasan satu kelas.</li><li>Skor dibagi menjadi lima kelas dengan interval sama dan ditampilkan dengan Leaflet.js.</li></ol>
          <div class="ab-weights"><h3>Bobot kriteria AHP</h3>${crit.map(c => `<div class="wb"><span class="wb-l">${esc(c.label)}</span><span class="wb-bar" aria-hidden="true"><i style="width:${(c.weight / tot * 100).toFixed(2)}%"></i></span><b>${pct(c.weight)}</b></div>`).join('')}
            <h3>Kelas aksesibilitas</h3><ul class="hero-legend ab-classes">${CONFIG.classes.slice().reverse().map(c => `<li><span class="sw" style="background:${c.color}"></span>${c.k} ${esc(c.label)}</li>`).join('')}</ul></div></div></div></section>
      <section class="ab-sec" aria-labelledby="ab4"><div class="ab-wrap ab-split">
        <div class="ab-text"><h2 id="ab4">Keterbatasan</h2><p>Kecepatan memakai batas dan kecepatan rencana menurut kelas jalan, bukan kecepatan lalu lintas aktual, sehingga waktu pada jam sibuk dapat lebih lama. Arah jalan satu arah belum dimodelkan. Skor bersifat relatif terhadap grid lain di Sinduadi. Data fasilitas di dalam kost belum tersedia sehingga belum dapat dipakai sebagai filter.</p>
          <p class="cta"><button type="button" class="primary big" data-view="dashboard">Buka dashboard</button></p></div>
        <div class="ab-text"><h2>Informasi penelitian</h2><table class="info"><tr><th>Judul</th><td>${esc(R.judul)}</td></tr><tr><th>Peneliti</th><td>${esc(R.peneliti)}</td></tr><tr><th>Program Studi</th><td>${esc(R.prodi)}</td></tr><tr><th>Fakultas</th><td>${esc(R.fakultas)}</td></tr><tr><th>Tahun</th><td>${esc(R.tahun)}</td></tr></table></div></div></section>`;
    const chev = '<svg class="chev" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    $('faqList').innerHTML = FAQ.map((f, i) => `<div class="faq-item"><h2 class="faq-h"><button type="button" class="faq-q" id="faq-q-${i}" aria-expanded="false" aria-controls="faq-a-${i}"><span>${i + 1}. ${esc(f[0])}</span>${chev}</button></h2>
      <div class="faq-a" id="faq-a-${i}" role="region" aria-labelledby="faq-q-${i}" hidden><p>${esc(f[1])}</p></div></div>`).join('');
    $('faqList').addEventListener('click', faqClick);
  }
  build(); show('welcome');
  document.addEventListener('click', e => {
    const v = e.target.closest('[data-view]'); if (v) { e.preventDefault(); return show(v.dataset.view); }
    const a = e.target.closest('[data-action]'); if (a) { e.preventDefault(); return a.dataset.action === 'start' ? start() : openGuide(); }
  });
  $('burger').onclick = () => { const o = $('navLinks').classList.toggle('open'); $('burger').setAttribute('aria-expanded', String(o)); };
  $('obNext').onclick = () => step < SLIDES.length - 1 ? (step++, renderStep()) : closeGuide();
  $('obBack').onclick = () => { if (step > 0) { step--; renderStep(); if (step === 0) $('obNext').focus(); } };   // tombol Kembali nonaktif di langkah 1, fokus dipindah
  $('obSkip').onclick = closeGuide;
  document.addEventListener('keydown', e => { if ($('onboard').hidden) return; if (e.key === 'Escape') closeGuide(); else if (e.key === 'Tab') trapFocus(e); });
  return { show, openGuide, start };
})();
