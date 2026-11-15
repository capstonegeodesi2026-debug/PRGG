/* Konversi koordinat UTM WGS84 (EPSG:326xx utara / 327xx selatan) -> lon/lat EPSG:4326.
   Rumus invers Krueger (galat < 1 mm). Dijalankan sekali saat data dimuat; Leaflet tetap memakai lon/lat. */
const CRS = (() => {
  const A = 6378137, FL = 1 / 298.257223563, K0 = 0.9996, n = FL / (2 - FL), n2 = n * n, n3 = n2 * n, n4 = n3 * n;
  const AA = A / (1 + n) * (1 + n2 / 4 + n4 / 64);
  const beta = [n / 2 - 2 * n2 / 3 + 37 * n3 / 96 - n4 / 360, n2 / 48 + n3 / 15 - 437 * n4 / 1440, 17 * n3 / 480 - 37 * n4 / 840, 4397 * n4 / 161280];
  const delta = [2 * n - 2 * n2 / 3 - 2 * n3 + 116 * n4 / 45, 7 * n2 / 3 - 8 * n3 / 5 - 227 * n4 / 45, 56 * n3 / 15 - 136 * n4 / 35, 4279 * n4 / 630];
  /* Ambil nomor EPSG dari 'EPSG:32749', 'urn:ogc:def:crs:EPSG::32749', dsb. 'CRS84' dianggap 4326. */
  function codeNum(s) {
    if (s === undefined || s === null) return null; s = String(s);
    if (/CRS84/i.test(s)) return 4326;
    const m = s.match(/(\d{4,5})(?!.*\d)/); return m ? +m[1] : null;
  }
  /* Mengembalikan fungsi (x,y)->[lon,lat]; null bila 4326 (tanpa konversi); undefined bila CRS tidak didukung. */
  function converter(code) {
    if (code === 4326) return null;
    const north = code >= 32601 && code <= 32660, south = code >= 32701 && code <= 32760;
    if (!north && !south) return undefined;
    const zone = code - (north ? 32600 : 32700), lam0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180, N0 = south ? 1e7 : 0;
    return (x, y) => {
      const xi = (y - N0) / (K0 * AA), eta = (x - 500000) / (K0 * AA); let xp = xi, ep = eta;
      for (let j = 1; j <= 4; j++) { xp -= beta[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta); ep -= beta[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta); }
      const chi = Math.asin(Math.sin(xp) / Math.cosh(ep)); let phi = chi;
      for (let j = 1; j <= 4; j++) phi += delta[j - 1] * Math.sin(2 * j * chi);
      const lam = lam0 + Math.atan2(Math.sinh(ep), Math.cos(xp));
      return [lam * 180 / Math.PI, phi * 180 / Math.PI];
    };
  }
  return { codeNum, converter };
})();
if (typeof module !== 'undefined') module.exports = CRS;
