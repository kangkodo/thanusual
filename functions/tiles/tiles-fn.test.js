import { after, test } from "node:test";
import assert from "node:assert/strict";
import { onRequestGet } from "./[[path]].js";

const GOOD = "https://thanusual.pages.dev/tiles/11/1748/796.png";
const OURS = { Referer: "https://thanusual.pages.dev/" };
const req = (url, headers = OURS) => new Request(url, { headers });
const env = { CARTO_API_KEY: "test-key" };
const realFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = realFetch;
});

test("400 on malformed or out-of-Seoul tiles", async () => {
  assert.equal((await onRequestGet({ request: req("https://thanusual.pages.dev/tiles/x.png"), env })).status, 400);
  assert.equal((await onRequestGet({ request: req("https://thanusual.pages.dev/tiles/0/0/0.png"), env })).status, 400);
});

test("403 on third-party referer", async () => {
  const r = await onRequestGet({ request: req(GOOD, { Referer: "https://evil.example/" }), env });
  assert.equal(r.status, 403);
});

test("503 without CARTO_API_KEY and no upstream call", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("");
  };
  const r = await onRequestGet({ request: req(GOOD), env: {} });
  assert.equal(r.status, 503);
  assert.equal(called, false);
});

test("502 on upstream failure or non-image body, never leaks the key", async () => {
  globalThis.fetch = async () => new Response("nope", { status: 500 });
  const a = await onRequestGet({ request: req(GOOD), env });
  assert.equal(a.status, 502);
  globalThis.fetch = async () => new Response("<html>API key required</html>", { status: 200, headers: { "Content-Type": "text/html" } });
  const b = await onRequestGet({ request: req(GOOD), env });
  assert.equal(b.status, 502);
  assert.equal((await b.text()).includes("test-key"), false);
  globalThis.fetch = async () => {
    throw new TypeError("network");
  };
  const c = await onRequestGet({ request: req(GOOD), env });
  assert.equal(c.status, 502);
});

test("200 png with cache headers and nosniff; @2x forwarded upstream", async () => {
  let seen = "";
  globalThis.fetch = async (u) => {
    seen = String(u);
    return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { "Content-Type": "image/png" } });
  };
  const r = await onRequestGet({ request: req(GOOD.replace(".png", "@2x.png")), env, waitUntil: () => {} });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("Content-Type"), "image/png");
  assert.equal(r.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(r.headers.get("Cache-Control"), "public, max-age=86400");
  assert.equal(seen.includes("/light_all/11/1748/796@2x.png?key=test-key"), true);
  await onRequestGet({ request: req(GOOD.replace("/tiles/", "/tiles/dark/")), env, waitUntil: () => {} });
  assert.equal(seen.includes("/dark_all/11/1748/796.png?key=test-key"), true);
});
