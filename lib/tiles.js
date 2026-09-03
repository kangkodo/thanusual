export const OUR_HOST = "thanusual.pages.dev";

// Tiles the proxy will fetch: Seoul plus enough margin for a wide desktop
// viewport at minZoom 10. Anything outside is a 400, not a key spend.
export const TILE_ZOOM = { min: 10, max: 18 };
export const TILE_BBOX = { south: 36.6, north: 38.5, west: 125.5, east: 128.4 };

function lngToX(lng, z) {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

function latToY(lat, z) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

export function tileAllowed({ z, x, y }) {
  if (z < TILE_ZOOM.min || z > TILE_ZOOM.max) return false;
  const x0 = lngToX(TILE_BBOX.west, z);
  const x1 = lngToX(TILE_BBOX.east, z);
  const y0 = latToY(TILE_BBOX.north, z);
  const y1 = latToY(TILE_BBOX.south, z);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

export function parseTilePath(raw) {
  const s = String(raw || "").replace(/^\/+/, "");
  const m = /^(0|[1-9]\d*)\/(0|[1-9]\d*)\/(0|[1-9]\d*)(@2x)?\.png$/.exec(s);
  if (!m) return null;
  const z = Number(m[1]);
  const x = Number(m[2]);
  const y = Number(m[3]);
  if (!Number.isInteger(z) || z < 0 || z > 18) return null;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) return null;
  const n = 2 ** z;
  if (x >= n || y >= n) return null;
  return { z, x, y, retina: Boolean(m[4]) };
}

function isOurHost(host) {
  return host === OUR_HOST || host.endsWith(`.${OUR_HOST}`);
}

// wrangler pages dev: localhost, loopback, or a LAN address when testing from a phone.
export function isLocalHost(host) {
  const h = host.replace(/^\[|\]$/g, "");
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".local")) return true;
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
}

// Referer is hotlink hygiene, not authentication: any non-browser client can forge it.
// The real quota bound is tileAllowed + the edge cache. The request host is not
// checked: Cloudflare only routes hosts bound to this project here, and pinning
// it would 403 a future custom domain.
export function refererAllowed(requestUrl, refererHeader, secFetchSite) {
  let host;
  try {
    host = new URL(requestUrl).hostname;
  } catch {
    return false;
  }
  let refHost = "";
  if (refererHeader) {
    try {
      refHost = new URL(refererHeader).hostname;
    } catch {
      return false;
    }
  }
  if (isLocalHost(host)) {
    return !refHost || isLocalHost(refHost);
  }
  if (secFetchSite === "same-origin") return true;
  if (!refHost) return false;
  return refHost === host || isOurHost(refHost);
}

// Bump when tile semantics change (headers, style, a bad cached batch): pages.dev
// has no zone purge, so this is the only way to drop stale Cache API entries.
export const TILE_CACHE_VERSION = "v1";

// Workers' Cache API needs an absolute URL. Build it from the parsed tile so
// aliases (leading zeros, doubled slashes, query strings) share one entry.
export function cacheKeyUrl(requestUrl, tile) {
  const origin = new URL(requestUrl).origin;
  const r = tile.retina ? "@2x" : "";
  return `${origin}/tiles/${TILE_CACHE_VERSION}/${tile.z}/${tile.x}/${tile.y}${r}.png`;
}

export function upstreamUrl(z, x, y, retina, key) {
  const r = retina ? "@2x" : "";
  return `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}${r}.png?key=${encodeURIComponent(key)}`;
}
