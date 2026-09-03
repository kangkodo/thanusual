import { test } from "node:test";
import assert from "node:assert/strict";
import { cacheKeyUrl, isLocalHost, parseTilePath, refererAllowed, tileAllowed, upstreamUrl } from "./tiles.js";

const PROD = "https://thanusual.pages.dev/tiles/11/1748/796.png";
const PREVIEW = "https://abc123.thanusual.pages.dev/tiles/11/1748/796.png";
const LOCAL = "http://localhost:8788/tiles/11/1748/796.png";

test("cache key is versioned, canonical across aliases, and drops the query", () => {
  const tile = { z: 11, x: 1748, y: 796, retina: false };
  const want = "https://thanusual.pages.dev/tiles/v1/11/1748/796.png";
  assert.equal(cacheKeyUrl("https://thanusual.pages.dev/tiles/11/1748/796.png?t=123", tile), want);
  assert.equal(cacheKeyUrl("https://thanusual.pages.dev/tiles//11/01748/796.png", tile), want);
  assert.equal(cacheKeyUrl(PROD, { ...tile, retina: true }).endsWith("/796@2x.png"), true);
  assert.doesNotThrow(() => new Request(cacheKeyUrl(PROD, tile)));
});

test("parses png and @2x", () => {
  assert.deepEqual(parseTilePath("11/1748/796.png"), { z: 11, x: 1748, y: 796, retina: false });
  assert.deepEqual(parseTilePath("/11/1748/796@2x.png"), { z: 11, x: 1748, y: 796, retina: true });
  assert.deepEqual(parseTilePath("0/0/0.png"), { z: 0, x: 0, y: 0, retina: false });
  assert.deepEqual(parseTilePath("18/262143/262143.png"), { z: 18, x: 262143, y: 262143, retina: false });
});

test("rejects bad tile paths", () => {
  assert.equal(parseTilePath("11/1748/796.gif"), null);
  assert.equal(parseTilePath("19/0/0.png"), null);
  assert.equal(parseTilePath("1/99/0.png"), null);
  assert.equal(parseTilePath("1/0/99.png"), null);
  assert.equal(parseTilePath("1/-1/0.png"), null);
  assert.equal(parseTilePath("011/1748/796.png"), null);
  assert.equal(parseTilePath("../11/0/0.png"), null);
  assert.equal(parseTilePath(""), null);
  assert.equal(parseTilePath(null), null);
});

test("tileAllowed keeps Seoul at z10-18 and rejects the rest of the planet", () => {
  assert.equal(tileAllowed({ z: 11, x: 1748, y: 796 }), true);
  assert.equal(tileAllowed({ z: 10, x: 873, y: 398 }), true);
  assert.equal(tileAllowed({ z: 14, x: 13974, y: 6368 }), true);
  assert.equal(tileAllowed({ z: 9, x: 436, y: 199 }), false);
  assert.equal(tileAllowed({ z: 0, x: 0, y: 0 }), false);
  assert.equal(tileAllowed({ z: 18, x: 232798, y: 103246 }), false);
  assert.equal(tileAllowed({ z: 11, x: 1700, y: 796 }), false);
});

test("production denies missing, localhost, third-party, and spoofed referers", () => {
  assert.equal(refererAllowed(PROD, "", null), false);
  assert.equal(refererAllowed(PROD, "http://localhost:8788/", null), false);
  assert.equal(refererAllowed(PROD, "https://evil.example/", "cross-site"), false);
  assert.equal(refererAllowed(PROD, "https://thanusual.pages.dev.evil.example/", null), false);
  assert.equal(refererAllowed(PROD, "https://evilthanusual.pages.dev/", null), false);
  assert.equal(refererAllowed(PROD, "not a url", null), false);
});

test("production allows our referer, preview hosts, and same-origin", () => {
  assert.equal(refererAllowed(PROD, "https://thanusual.pages.dev/", null), true);
  assert.equal(refererAllowed(PREVIEW, "https://abc123.thanusual.pages.dev/", null), true);
  assert.equal(refererAllowed(PROD, "", "same-origin"), true);
});

test("a future custom domain works because the page host matches the referer", () => {
  assert.equal(refererAllowed("https://thanusual.kr/tiles/1/0/0.png", "https://thanusual.kr/", null), true);
  assert.equal(refererAllowed("https://thanusual.kr/tiles/1/0/0.png", "https://evil.example/", null), false);
  assert.equal(refererAllowed("https://thanusual.kr/tiles/1/0/0.png", "", null), false);
});

test("local hosts allow missing or local referer only", () => {
  assert.equal(refererAllowed(LOCAL, "", null), true);
  assert.equal(refererAllowed(LOCAL, "http://localhost:8788/", null), true);
  assert.equal(refererAllowed(LOCAL, "https://evil.example/", null), false);
  assert.equal(refererAllowed("http://192.168.0.12:8788/tiles/1/0/0.png", "http://192.168.0.12:8788/", null), true);
  assert.equal(refererAllowed("http://[::1]:8788/tiles/1/0/0.png", "", null), true);
  assert.equal(isLocalHost("172.31.9.9"), true);
  assert.equal(isLocalHost("172.32.0.1"), false);
  assert.equal(isLocalHost("thanusual.pages.dev"), false);
});

test("upstream url puts the key in the query string and honors @2x", () => {
  const url = upstreamUrl(11, 1, 2, false, "secret-test");
  assert.equal(url.startsWith("https://a.basemaps.cartocdn.com/light_all/11/1/2.png?key="), true);
  assert.equal(url.includes("/secret-test"), false);
  assert.equal(upstreamUrl(11, 1, 2, true, "k&=x"), "https://a.basemaps.cartocdn.com/light_all/11/1/2@2x.png?key=k%26%3Dx");
});
