import { test } from "node:test";
import assert from "node:assert/strict";
import { ageMinutes, ageText, hasCoords, later, newer, rowsOf, summaryText, usualPct, usualText, visibleRows } from "./shared.js";

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
  assert.deepEqual(visibleRows(data, "전체", "강남 mice").map((p) => p.name), ["강남 MICE관광특구"]);
  assert.deepEqual(visibleRows(data, "전체", "관광 특구").map((p) => p.name), ["강남 MICE관광특구"]);
});

test("later names the forecast hour and handles missing, zero, and equal forecasts", () => {
  const at = "2026-09-06 01:00";
  assert.deepEqual(later({ mid: 0, forecast_2h: { at, mid: 10 } }), { label: "01시 예측", value: "없음" });
  assert.deepEqual(later({ mid: 100 }), { label: "예측", value: "없음" });
  assert.deepEqual(later({ mid: 100, forecast_2h: { at, mid: 100 } }), { label: "01시 예측", value: "유지" });
  assert.deepEqual(later({ mid: 100, forecast_2h: { at, mid: 150 } }), { label: "01시 예측", value: "+50%" });
  assert.deepEqual(later({ mid: 100, forecast_2h: { at, mid: 0 } }), { label: "01시 예측", value: "-100%" });
});

test("usualPct and usualText compare against the baseline value", () => {
  assert.equal(usualPct({ mid: 1400, usual: { n: 6, mid: 1000 } }), 40);
  assert.equal(usualPct({ mid: 1400, usual: { n: 3, mid: null } }), null);
  assert.equal(usualPct({ mid: 0, usual: { n: 6, mid: 1000 } }), null);
  assert.equal(usualPct({ mid: 1400 }), null);
  assert.equal(usualText(40), "평소보다 +40%");
  assert.equal(usualText(-25), "평소보다 -25%");
  assert.equal(usualText(3), "평소와 비슷");
  assert.equal(usualText(null), null);
});

test("rowsOf sorts by 평소보다 once warming is off, rows without usual last", () => {
  const data = {
    warming: false,
    places: [
      { state: "fresh", name: "a", level: "붐빔", mid: 100, category: "공원" },
      { state: "fresh", name: "b", level: "여유", mid: 150, usual: { mid: 100 }, category: "공원" },
      { state: "fresh", name: "c", level: "보통", mid: 90, usual: { mid: 100 }, category: "공원" },
      { state: "fresh", name: "d", level: "붐빔", mid: 500, usual: { mid: 100 }, category: "공원" },
    ],
  };
  assert.deepEqual(rowsOf(data, "전체").map((p) => p.name), ["d", "b", "c", "a"]);
  assert.deepEqual(rowsOf({ ...data, warming: true }, "전체").map((p) => p.name), ["d", "a", "c", "b"]);
});

test("newer prefers the later snapshot and tolerates nulls", () => {
  const a = { source_at: "2026-09-03 17:40" };
  const b = { source_at: "2026-09-03 17:50" };
  assert.equal(newer(a, b), b);
  assert.equal(newer(b, a), b);
  assert.equal(newer(null, a), a);
  assert.equal(newer(a, null), a);
  const blank = { ok: 0, generated_at: "2026-09-05 13:05:00" };
  const good = { ok: 121, source_at: "2026-09-05 09:23" };
  assert.equal(newer(blank, good), good);
  assert.equal(newer(good, blank), good);
});

test("ageMinutes reads KST stamps and ageText words them", () => {
  const now = Date.UTC(2026, 8, 5, 20, 55); // 05:55 KST on 9/6
  assert.equal(ageMinutes("2026-09-06 05:25", now), 30);
  assert.equal(ageMinutes("2026-09-05 23:20", now), 395);
  assert.equal(ageMinutes("nope", now), null);
  assert.equal(ageText(0), "방금");
  assert.equal(ageText(30), "30분 전");
  assert.equal(ageText(120), "2시간 전");
  assert.equal(ageText(395), "6시간 35분 전");
});

test("summaryText counts hot places and folds the rest", () => {
  const p = (level) => ({ state: "fresh", level });
  assert.equal(summaryText({ places: [p("붐빔"), p("약간 붐빔"), p("여유"), p("보통"), { state: "missing" }] }), "붐빔 1 · 약간 붐빔 1 · 나머지 2곳 보통·여유");
  assert.equal(summaryText({ places: [p("여유"), p("여유")] }), "2곳 모두 보통·여유");
});

test("hasCoords requires finite numbers inside Seoul", () => {
  assert.equal(hasCoords({ lat: 37.55, lng: 126.98 }), true);
  assert.equal(hasCoords({ lat: "37.55", lng: 126.98 }), false);
  assert.equal(hasCoords({ lat: 0, lng: 0 }), false);
  assert.equal(hasCoords({ lat: 126.98, lng: 37.55 }), false);
  assert.equal(hasCoords({}), false);
});
