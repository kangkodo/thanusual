const LETTERS = "가나다라마바사아자차카타파하";
const cache = new Map();
const RAD = Math.PI / 180;
const A = 6378137;
const F = 1 / 298.257222101;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const E1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
const M = 1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256;
const ORIGIN = A * (M * 38 * RAD
  - (3 * E2 / 8 + 3 * E2 ** 2 / 32 + 45 * E2 ** 3 / 1024) * Math.sin(76 * RAD)
  + (15 * E2 ** 2 / 256 + 45 * E2 ** 3 / 1024) * Math.sin(152 * RAD)
  - 35 * E2 ** 3 / 3072 * Math.sin(228 * RAD));

// Inverse transverse Mercator: EPSG:5179, GRS80, lon0=127.5°, lat0=38°.
function latLng(x, y) {
  const mu = (ORIGIN + (y - 2000000) / 0.9996) / (A * M);
  const phi = mu + (3 * E1 / 2 - 27 * E1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * E1 ** 2 / 16 - 55 * E1 ** 4 / 32) * Math.sin(4 * mu)
    + 151 * E1 ** 3 / 96 * Math.sin(6 * mu)
    + 1097 * E1 ** 4 / 512 * Math.sin(8 * mu);
  const w = 1 - E2 * Math.sin(phi) ** 2;
  const n = A / Math.sqrt(w);
  const r = A * (1 - E2) / w ** 1.5;
  const t = Math.tan(phi) ** 2;
  const c = EP2 * Math.cos(phi) ** 2;
  const d = (x - 1000000) / (n * 0.9996);
  const lat = phi - n * Math.tan(phi) / r * (d ** 2 / 2
    - (5 + 3 * t + 10 * c - 4 * c ** 2 - 9 * EP2) * d ** 4 / 24
    + (61 + 90 * t + 298 * c + 45 * t ** 2 - 252 * EP2 - 3 * c ** 2) * d ** 6 / 720);
  const lng = (d - (1 + 2 * t + c) * d ** 3 / 6
    + (5 - 2 * c + 28 * t - 3 * c ** 2 + 8 * EP2 + 24 * t ** 2) * d ** 5 / 120) / Math.cos(phi);
  return [lat / RAD, 127.5 + lng / RAD];
}

export function cellCorners(id) {
  if (typeof id !== "string" || id.length !== 10 || !/^[가-힣]{2}[0-9]{8}$/.test(id)) return null;
  const east = LETTERS.indexOf(id[0]), north = LETTERS.indexOf(id[1]);
  if (east < 0 || north < 0) return null;
  if (!cache.has(id)) {
    const x = 700000 + east * 100000 + Number(id.slice(2, 6)) * 10;
    const y = 1300000 + north * 100000 + Number(id.slice(6)) * 10;
    // Integer meter coordinates give adjacent cells bit-identical shared corners.
    cache.set(id, [latLng(x, y), latLng(x + 250, y), latLng(x + 250, y + 250), latLng(x, y + 250)]);
  }
  return cache.get(id);
}
