// 수용 테스트: 관심 장소 고정 (ai-log/20260926/001_212957_pin-places, AC-1~AC-7)
// 기획 단계에서 작성한다. 개발 역할은 이 파일을 수정하지 않는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PIN_KEY, pinnedRows, readPins, togglePin, writePins } from "../../lib/pins.js";
import { visibleRows } from "../../shared.js";

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), raw: m };
};
const broken = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };

const data = (warming) => ({
  warming,
  places: [
    { name: "가", state: "fresh", level: "여유", mid: 5, category: "공원", usual: { mid: 10 } },
    { name: "나", state: "fresh", level: "붐빔", mid: 1, category: "공원", usual: { mid: 1 } },
    { name: "다", state: "fresh", level: "붐빔", mid: 7, category: "관광특구", usual: { mid: 2 } },
    { name: "라", state: "stale", level: "붐빔", mid: 9, category: "공원" },
    { name: "마", state: "fresh", level: "보통", mid: 3, category: "발달상권" },
    { name: "바", state: "stale", level: "여유", mid: 2, category: "공원" },
  ],
});
const names = (rows) => rows.map((p) => p.name);

test("AC-1 togglePin adds and removes without mutating the input", () => {
  const before = new Set(["가"]);
  const added = togglePin(before, "나");
  assert.deepEqual([...added].sort(), ["가", "나"]);
  assert.deepEqual([...before], ["가"]);
  const removed = togglePin(added, "가");
  assert.deepEqual([...removed], ["나"]);
  assert.deepEqual([...added].sort(), ["가", "나"], "해제도 입력 Set을 바꾸지 않는다");
  assert.notEqual(removed, added);
});

test("AC-2 writePins then readPins round-trips under the fixed key", () => {
  const s = memory();
  assert.equal(PIN_KEY, "thanusual.pins.v1");
  assert.equal(writePins(s, new Set(["가", "다"])), true);
  assert.ok(s.raw.has(PIN_KEY));
  assert.deepEqual([...readPins(s)].sort(), ["가", "다"]);
});

test("AC-3 missing or throwing storage never throws", () => {
  assert.deepEqual([...readPins(null)], []);
  assert.deepEqual([...readPins(undefined)], []);
  assert.deepEqual([...readPins(broken)], []);
  assert.equal(writePins(null, new Set(["가"])), false);
  assert.equal(writePins(broken, new Set(["가"])), false);
});

test("AC-4 corrupted stored values are filtered safely", () => {
  for (const raw of ["{", '"가"', "42", "null", "{}"]) {
    const s = memory();
    s.setItem(PIN_KEY, raw);
    assert.deepEqual([...readPins(s)], [], raw);
  }
  const s = memory();
  s.setItem(PIN_KEY, JSON.stringify(["가", 1, null, { x: 1 }, "나"]));
  assert.deepEqual([...readPins(s)].sort(), ["가", "나"]);
});

test("AC-5 unknown names are ignored; non-fresh pinned places become missing rows, sorted by name, after the rest", () => {
  const d = data(true);
  const rows = pinnedRows(d, d, new Set(["바", "가", "라", "없는곳"]));
  assert.deepEqual(names(rows), ["가", "라", "바"]);
  assert.equal(rows[0].missing, undefined);
  assert.deepEqual(rows.slice(1).map((p) => p.missing), [true, true]);
  assert.deepEqual(rows[1], { name: "라", category: "공원", missing: true });
  assert.deepEqual(pinnedRows(d, d, new Set()), []);
});

test("AC-6 rows with values keep the board order, before and after the warming flip", () => {
  const pins = new Set(["가", "나", "다", "마"]);
  for (const warming of [true, false]) {
    const d = data(warming);
    const expected = names(visibleRows(d, "전체", "").filter((p) => pins.has(p.name)));
    assert.deepEqual(names(pinnedRows(d, d, pins)), expected, `warming=${warming}`);
  }
  // 두 정렬 규칙이 실제로 다른 순서를 만드는지 확인해서, 위 비교가 의미 있게 한다.
  assert.notDeepEqual(names(pinnedRows(data(true), data(true), pins)), names(pinnedRows(data(false), data(false), pins)));
});

test("AC-7 membership follows the original even when the snapshot has fewer places", () => {
  const original = data(false);
  // 과거·예측 스냅숏처럼 일부 장소만, 관측값으로 덮여 있다.
  const snapshot = { warming: true, places: [
    { name: "마", state: "fresh", level: "붐빔", mid: 30, category: "발달상권" },
    { name: "라", state: "fresh", level: "여유", mid: 1, category: "공원" },
  ] };
  const rows = pinnedRows(original, snapshot, new Set(["가", "라", "마"]));
  assert.deepEqual(names(rows), ["마", "라", "가"]);
  assert.equal(rows[0].mid, 30, "값은 스냅숏에서 온다");
  assert.equal(rows[2].missing, true);
  assert.deepEqual(pinnedRows({}, {}, new Set(["가"])), []);
  assert.deepEqual(pinnedRows(null, null, new Set(["가"])), []);
  assert.deepEqual(names(pinnedRows(original, { places: [] }, new Set(["가"]))), ["가"]);
});
