import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LAYERS,
  bandIndex,
  daysAgo,
  defaultLayerState,
  dongCode,
  kstDate,
  kstHour,
  layerUrls,
  livingSlice,
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

test("kstDate and daysAgo work across the UTC day boundary", () => {
  const now = new Date("2026-09-05T16:00:00Z"); // 01:00 KST on 9/6
  assert.equal(kstDate(now), "2026-09-06");
  assert.equal(daysAgo("20260901", now), 5);
  assert.equal(daysAgo("20260906", now), 0);
  assert.equal(daysAgo("nope", now), null);
});

test("livingSlice picks the nearest 3-hour slice and falls back to the single-slice file", () => {
  const living = { ymd: "20260901", slices: { "03": { a: 1 }, "12": { a: 2 }, "18": { a: 3 } } };
  assert.equal(livingSlice(living, 13).tt, "12");
  assert.equal(livingSlice(living, 17).tt, "18");
  assert.equal(livingSlice(living, 23).tt, "03"); // 23 rounds to 0; 03 and 21 tie at 3 hours, first key wins
  assert.equal(livingSlice({ slices: { "03": {}, "12": {}, "21": {} } }, 22).tt, "21"); // 22 rounds to 21
  assert.equal(livingSlice(living, 13).pops.get("a"), 2);
  assert.equal(livingSlice({ slices: { "3": { a: 4 } } }, 4).tt, "03"); // unpadded keys still resolve
  assert.equal(livingSlice({ slices: { "3": { a: 4 } } }, 4).pops.get("a"), 4);
  const legacy = { ymd: "20260901", tt: "03", dongs: [{ code: "a", spop: 9 }] };
  assert.equal(livingSlice(legacy, 13).tt, "03");
  assert.equal(livingSlice(legacy, 13).pops.get("a"), 9);
  assert.equal(livingSlice(null, 13), null);
});
