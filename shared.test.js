import { test } from "node:test";
import assert from "node:assert/strict";
import { hasCoords, later, newer, rowsOf, visibleRows } from "./shared.js";

test("rowsOf keeps fresh rows, sorted by grade then mid", () => {
  const data = {
    places: [
      { state: "fresh", level: "여유", mid: 5, category: "공원" },
      { state: "stale", level: "붐빔", mid: 9, category: "공원" },
      { state: "fresh", level: "붐빔", mid: 1, category: "공원" },
      { state: "fresh", level: "붐빔", mid: 7, category: "관광특구" },
      { state: "fresh", level: "?", category: "공원" },
    ],
  };
  assert.deepEqual(rowsOf(data, "전체").map((p) => p.mid), [7, 1, 5, undefined]);
  assert.deepEqual(rowsOf(data, "공원").map((p) => p.mid), [1, 5, undefined]);
  assert.deepEqual(rowsOf({}, "전체"), []);
});

test("visibleRows filters by name without changing sort", () => {
  const data = {
    places: [
      { state: "fresh", name: "강남역", level: "붐빔", mid: 9, category: "인구밀집지역" },
      { state: "fresh", name: "서울숲", level: "여유", mid: 2, category: "공원" },
      { state: "fresh", name: "강남 MICE관광특구", level: "보통", mid: 4, category: "관광특구" },
    ],
  };
  assert.deepEqual(visibleRows(data, "전체", "").map((p) => p.name), ["강남역", "강남 MICE관광특구", "서울숲"]);
  assert.deepEqual(visibleRows(data, "전체", " 강남 ").map((p) => p.name), ["강남역", "강남 MICE관광특구"]);
  assert.deepEqual(visibleRows(data, "공원", "강남").map((p) => p.name), []);
});

test("later handles missing, zero, and equal forecasts", () => {
  assert.equal(later({ mid: 0, forecast_2h: { mid: 10 } }), "2시간 뒤 —");
  assert.equal(later({ mid: 100 }), "2시간 뒤 —");
  assert.equal(later({ mid: 100, forecast_2h: { mid: 100 } }), "2시간 뒤 유지");
  assert.equal(later({ mid: 100, forecast_2h: { mid: 150 } }), "2시간 뒤 +50%");
  assert.equal(later({ mid: 100, forecast_2h: { mid: 0 } }), "2시간 뒤 -100%");
});

test("newer prefers the later snapshot and tolerates nulls", () => {
  const a = { source_at: "2026-09-03 17:40" };
  const b = { source_at: "2026-09-03 17:50" };
  assert.equal(newer(a, b), b);
  assert.equal(newer(b, a), b);
  assert.equal(newer(null, a), a);
  assert.equal(newer(a, null), a);
});

test("hasCoords requires finite numbers inside Seoul", () => {
  assert.equal(hasCoords({ lat: 37.55, lng: 126.98 }), true);
  assert.equal(hasCoords({ lat: "37.55", lng: 126.98 }), false);
  assert.equal(hasCoords({ lat: 0, lng: 0 }), false);
  assert.equal(hasCoords({ lat: 126.98, lng: 37.55 }), false);
  assert.equal(hasCoords({}), false);
});
