import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LAYERS,
  bandIndex,
  defaultLayerState,
  dongCode,
  kstHour,
  layerUrls,
  metroFlow,
  quantileBreaks,
} from "./layers.js";

test("five map layers, 지금 on by default", () => {
  assert.deepEqual(LAYERS.map((l) => l.id), ["now", "dong", "metro", "street", "today"]);
  const on = defaultLayerState();
  assert.equal(on.now, true);
  assert.equal(on.dong, false);
  assert.equal(on.metro, false);
});

test("layerUrls keep the data-branch hosts", () => {
  const urls = layerUrls("living.json");
  assert.equal(urls.length, 3);
  assert.ok(urls[0].endsWith("/living.json"));
  assert.ok(urls.at(-1).startsWith("./data/"));
  assert.deepEqual(layerUrls(null), []);
});

test("dongCode trims and shortens 10-digit codes", () => {
  assert.equal(dongCode("11110515     "), "11110515");
  assert.equal(dongCode("1111051500"), "11110515");
});

test("metroFlow reads the clock hour", () => {
  const station = { hours: [1, 2, 3] };
  assert.equal(metroFlow(station, 2), 3);
  assert.equal(metroFlow(station, 9), null);
  assert.equal(metroFlow({}, 0), null);
});

test("quantileBreaks and bandIndex", () => {
  const breaks = quantileBreaks([1, 2, 3, 4, 5], 4);
  assert.equal(breaks.length, 3);
  assert.equal(bandIndex(1, breaks), 0);
  assert.equal(bandIndex(5, breaks), 3);
  assert.equal(bandIndex(0, breaks), 0);
});

test("kstHour is 0-23", () => {
  const h = kstHour(new Date("2026-09-04T16:00:00Z"));
  assert.equal(h, 1);
});
