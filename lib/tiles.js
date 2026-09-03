export function parseTilePath(raw) {
  const s = String(raw || "").replace(/^\/+/, "");
  const m = /^(\d+)\/(\d+)\/(\d+)(@2x)?\.png$/.exec(s);
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

export function refererAllowed(requestUrl, refererHeader, secFetchSite) {
  let host;
  try {
    host = new URL(requestUrl).hostname;
  } catch {
    return false;
  }
  const local = host === "localhost" || host === "127.0.0.1";
  let refHost = "";
  if (refererHeader) {
    try {
      refHost = new URL(refererHeader).hostname;
    } catch {
      return false;
    }
  }
  if (local) {
    return !refHost || refHost === "localhost" || refHost === "127.0.0.1";
  }
  const ours = host === "thanusual.pages.dev" || host.endsWith(".thanusual.pages.dev");
  if (!ours) return false;
  if (secFetchSite === "same-origin") return true;
  if (!refHost) return false;
  if (refHost === "localhost" || refHost === "127.0.0.1") return false;
  return (
    refHost === host ||
    refHost === "thanusual.pages.dev" ||
    refHost.endsWith(".thanusual.pages.dev")
  );
}

// Workers' Cache API needs an absolute URL; drop the query so cache-busting params share one entry.
export function cacheKeyUrl(requestUrl) {
  const u = new URL(requestUrl);
  return `${u.origin}${u.pathname}`;
}

export function upstreamUrl(z, x, y, retina, key) {
  const r = retina ? "@2x" : "";
  return `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}${r}.png?key=${encodeURIComponent(key)}`;
}
