"""Optimasi foto kost untuk dashboard (dijalankan sekali, bukan saat deploy).

Membaca foto asli dari foto_asli/ (tidak di-commit), lalu menulis WebP ke data/foto/:
  - orientasi EXIF dibetulkan
  - lebar maksimum 800 px (rasio dipertahankan, tidak diperbesar)
  - kualitas awal 75, diturunkan bertahap bila hasil masih di atas 150 KB
  - nama hasil = nama asli tanpa ekstensi + .webp (KPI-KT-01.png -> KPI-KT-01.webp)

Hanya foto yang dirujuk kolom `foto` di data/akomodasi.geojson yang diproses.
Kolom `foto` di data tidak diubah. Pemetaan nama diatur di js/config.js (photoExt).

Pemakaian (dari root repo):
  python tools/optimasi_foto.py [folder_asli] [folder_hasil] [akomodasi.geojson]
Butuh Python 3 dan Pillow dengan dukungan WebP (pip install Pillow).
"""
import json
import os
import sys

from PIL import Image, ImageOps

SRC = sys.argv[1] if len(sys.argv) > 1 else 'foto_asli'
DST = sys.argv[2] if len(sys.argv) > 2 else 'data/foto'
GEOJSON = sys.argv[3] if len(sys.argv) > 3 else 'data/akomodasi.geojson'
FIELD_ID, FIELD_NAME, FIELD_PHOTO = 'id_kos', 'nama_kos', 'foto'
MAX_W = 800
QUALITY = 75
MIN_QUALITY = 50
TARGET = 150 * 1024
OUT_EXT = '.webp'


def kb(n):
    return f'{n / 1024:,.0f} KB'


def mb(n):
    return f'{n / 1024 / 1024:,.1f} MB'


def to_rgb(im):
    """Foto dengan transparansi ditempel di atas latar putih agar tidak menjadi hitam."""
    if im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info):
        im = im.convert('RGBA')
        bg = Image.new('RGB', im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert('RGB')


def optimise(src_path, dst_path):
    with Image.open(src_path) as im:
        im = ImageOps.exif_transpose(im)
        im = to_rgb(im)
        if im.width > MAX_W:
            im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
        q = QUALITY
        while True:
            im.save(dst_path, 'WEBP', quality=q, method=6)
            size = os.path.getsize(dst_path)
            if size <= TARGET or q <= MIN_QUALITY:
                return size, q, im.size
            q -= 5


def main():
    with open(GEOJSON, encoding='utf-8') as f:
        feats = [x['properties'] for x in json.load(f)['features']]
    if not os.path.isdir(SRC):
        sys.exit(f'Folder foto asli tidak ditemukan: {SRC}')
    os.makedirs(DST, exist_ok=True)
    src_files = set(os.listdir(SRC))

    used, missing, empty, rows, big = set(), [], [], [], []
    before = after = 0
    for p in feats:
        name = (p.get(FIELD_PHOTO) or '').strip()
        if not name:
            empty.append(p.get(FIELD_ID))
            continue
        if name not in src_files:
            missing.append(f'{p.get(FIELD_ID)}  {name}  ({p.get(FIELD_NAME)})')
            continue
        used.add(name)
        src = os.path.join(SRC, name)
        out = os.path.join(DST, os.path.splitext(name)[0] + OUT_EXT)
        size, q, dim = optimise(src, out)
        before += os.path.getsize(src)
        after += size
        rows.append((name, os.path.getsize(src), size, q, dim))
        if size > TARGET:
            big.append(f'{name} {kb(size)}')

    unused = sorted(src_files - used)
    expected = {os.path.splitext(n)[0] + OUT_EXT for n in used}
    stale = sorted(n for n in os.listdir(DST) if n not in expected)
    all_src = sum(os.path.getsize(os.path.join(SRC, n)) for n in src_files)

    print(f'Foto diproses        : {len(rows)} dari {len(feats)} kost')
    print(f'Ukuran sebelum       : {mb(before)} (foto yang dipakai), {mb(all_src)} (seluruh folder {SRC})')
    print(f'Ukuran sesudah       : {mb(after)} ({len(rows)} WebP, rata-rata {kb(after / max(len(rows), 1))})')
    print(f'Terbesar             : ' + ', '.join(f'{r[0]} {kb(r[2])}' for r in sorted(rows, key=lambda r: -r[2])[:3]))
    print(f'Di atas 150 KB       : {len(big)}' + (' -> ' + ', '.join(big) if big else ''))
    print(f'Kost tanpa foto      : {len(missing) + len(empty)}')
    for m in missing:
        print('  berkas tidak ada  :', m)
    for e in empty:
        print('  kolom foto kosong :', e)
    print(f'Foto tanpa pasangan kost: {len(unused)}' + (' -> ' + ', '.join(unused) if unused else ''))
    if stale:
        print(f'Peringatan: berkas lain di {DST} yang bukan hasil skrip ini: ' + ', '.join(stale))


if __name__ == '__main__':
    main()
