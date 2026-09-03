import { test } from "node:test";
import assert from "node:assert/strict";
import { cacheKeyUrl, parseTilePath, refererAllowed, upstreamUrl } from "./tiles.js";

test("cache key is absolute and drops the query", () => {
  assert.equal(
    cacheKeyUrl("https://thanusual.pages.dev/tiles/11/1/2.png?t=123"),
    "https://thanusual.pages.dev/tiles/11/1/2.png",
  );
  assert.doesNotThrow(() => new Request(cacheKeyUrl("https://thanusual.pages.dev/tiles/11/1/2.png")));
});

test("parses png and @2x", () => {
  assert.deepEqual(parseTilePath("11/1748/796.png"), { z: 11, x: 1748, y: 796, retina: false });
  assert.deepEqual(parseTilePath("/tiles/11/1748/796@2x.png".replace(/^\/tiles\//, "")), {
    z: 11,
    x: 1748,
    y: 796,
    retina: true,
  });
});

test("rejects bad tile paths", () => {
  assert.equal(parseTilePath("11/1748/796.gif"), null);
  assert.equal(parseTilePath("19/0/0.png"), null);
  assert.equal(parseTilePath("1/99/0.png"), null);
  assert.equal(parseTilePath("../11/0/0.png"), null);
});

test("localhost referer is rejected on production", () => {
  assert.equal(
    refererAllowed("https://thanusual.pages.dev/tiles/1/0/0.png", "http://localhost:8788/", null),
    false,
  );
});

test("production allows matching referer and same-origin", () => {
  assert.equal(
    refererAllowed("https://thanusual.pages.dev/tiles/1/0/0.png", "https://thanusual.pages.dev/", null),
    true,
  );
  assert.equal(
    refererAllowed("https://thanusual.pages.dev/tiles/1/0/0.png", "", "same-origin"),
    true,
  );
  assert.equal(refererAllowed("https://thanusual.pages.dev/tiles/1/0/0.png", "", null), false);
});

test("localhost host allows missing or local referer", () => {
  assert.equal(refererAllowed("http://localhost:8788/tiles/1/0/0.png", "", null), true);
  assert.equal(
    refererAllowed("http://localhost:8788/tiles/1/0/0.png", "http://localhost:8788/", null),
    true,
  );
});

test("upstream url puts the key in the query string", () => {
  const url = upstreamUrl(11, 1, 2, false, "secret-test");
  assert.equal(url.startsWith("https://a.basemaps.cartocdn.com/light_all/11/1/2.png?key="), true);
  assert.equal(url.includes("/secret-test"), false);
});
