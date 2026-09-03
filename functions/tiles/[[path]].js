import { cacheKeyUrl, parseTilePath, refererAllowed, tileAllowed, upstreamUrl } from "../../lib/tiles.js";

const PNG = {
  "Content-Type": "image/png",
  "Cache-Control": "public, max-age=86400",
  "X-Content-Type-Options": "nosniff",
};
// Short negative cache so a CARTO 429/5xx does not turn into a retry storm.
const UPSTREAM_ERROR = { "Content-Type": "text/plain", "Cache-Control": "public, max-age=30" };

export async function onRequestGet({ request, env, waitUntil }) {
  const url = new URL(request.url);
  const tile = parseTilePath(url.pathname.replace(/^\/tiles\//, ""));
  if (!tile || !tileAllowed(tile)) return new Response("bad tile", { status: 400 });

  if (!refererAllowed(request.url, request.headers.get("Referer"), request.headers.get("Sec-Fetch-Site"))) {
    return new Response("forbidden", { status: 403 });
  }

  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheReq = new Request(cacheKeyUrl(request.url, tile), { method: "GET" });
  if (cache) {
    const hit = await cache.match(cacheReq);
    if (hit) return hit;
  }

  const key = env && env.CARTO_API_KEY;
  if (!key) return new Response("tiles unavailable", { status: 503 });

  let upstream;
  try {
    upstream = await fetch(upstreamUrl(tile.z, tile.x, tile.y, tile.retina, key));
  } catch {
    return new Response("tile upstream error", { status: 502 });
  }
  const type = upstream.headers.get("Content-Type") || "";
  if (!upstream.ok || !type.startsWith("image/")) {
    const bad = new Response("tile upstream error", { status: 502, headers: UPSTREAM_ERROR });
    if (cache && waitUntil) waitUntil(cache.put(cacheReq, bad.clone()));
    return bad;
  }

  const body = await upstream.arrayBuffer();
  const out = new Response(body, { status: 200, headers: PNG });
  if (cache && waitUntil) waitUntil(cache.put(cacheReq, out.clone()));
  return out;
}
