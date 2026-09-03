import { cacheKeyUrl, parseTilePath, refererAllowed, upstreamUrl } from "../../lib/tiles.js";

const PNG = { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" };

export async function onRequestGet({ request, env, waitUntil }) {
  const url = new URL(request.url);
  const parsed = parseTilePath(url.pathname.replace(/^\/tiles\//, ""));
  if (!parsed) return new Response("bad tile", { status: 400 });

  if (!refererAllowed(request.url, request.headers.get("Referer"), request.headers.get("Sec-Fetch-Site"))) {
    return new Response("forbidden", { status: 403 });
  }

  const key = env && env.CARTO_API_KEY;
  if (!key) return new Response("tiles unavailable", { status: 503 });

  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheReq = new Request(cacheKeyUrl(request.url), { method: "GET" });
  if (cache) {
    const hit = await cache.match(cacheReq);
    if (hit) return hit;
  }

  const upstream = await fetch(upstreamUrl(parsed.z, parsed.x, parsed.y, parsed.retina, key));
  if (!upstream.ok) return new Response("tile upstream error", { status: 502 });

  const body = await upstream.arrayBuffer();
  const out = new Response(body, { status: 200, headers: PNG });
  if (cache && waitUntil) waitUntil(cache.put(cacheReq, out.clone()));
  return out;
}
