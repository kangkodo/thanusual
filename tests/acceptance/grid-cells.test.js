// 수용 테스트: 250m 격자 정사각형 (ai-log/20260926/002_233253_grid-squares, AC-1~AC-4)
// 기획 단계에서 작성한다. 개발 역할은 이 파일을 수정하지 않는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cellCorners } from "../../lib/grid-cells.js";

const features = JSON.parse(readFileSync(new URL("../../vendor/seoul-grid.geojson", import.meta.url), "utf8")).features;

const id = (x, y) => `다사${String(x).padStart(4, "0")}${String(y).padStart(4, "0")}`;
// 250m 거리에는 GRS80 타원체의 국지 곡률반경으로 충분하다(구면 공식은 서울에서 약 0.2% 틀린다).
const meters = ([lat1, lng1], [lat2, lng2]) => {
  const r = Math.PI / 180, a = 6378137, e2 = 0.00669438002290, phi = ((lat1 + lat2) / 2) * r;
  const w = 1 - e2 * Math.sin(phi) ** 2;
  const m = (a * (1 - e2)) / w ** 1.5, n = a / Math.sqrt(w);
  return Math.hypot((lat2 - lat1) * r * m, (lng2 - lng1) * r * n * Math.cos(phi));
};

test("AC-1 corners average to the official center point for all cells", () => {
  assert.equal(features.length, 10125);
  let worst = 0;
  for (const f of features) {
    const corners = cellCorners(f.properties.CELL_ID);
    assert.ok(Array.isArray(corners) && corners.length === 4, f.properties.CELL_ID);
    const lat = corners.reduce((s, c) => s + c[0], 0) / 4;
    const lng = corners.reduce((s, c) => s + c[1], 0) / 4;
    const [plng, plat] = f.geometry.coordinates;
    worst = Math.max(worst, Math.abs(lat - plat), Math.abs(lng - plng));
  }
  assert.ok(worst <= 0.000002, `worst deviation ${worst}`);
});

test("AC-2 neighbours share corners exactly", () => {
  const [sw, se, ne, nw] = cellCorners(id(5450, 4050));
  assert.deepEqual(cellCorners(id(5475, 4050))[0], se, "east neighbour SW === SE");
  assert.deepEqual(cellCorners(id(5450, 4075))[0], nw, "north neighbour SW === NW");
  assert.deepEqual(cellCorners(id(5475, 4075))[0], ne, "north-east neighbour SW === NE");
  assert.ok(sw[0] < nw[0] && sw[1] < se[1], "SW, SE, NE, NW order");
});

test("AC-3 each side is 250 m on the ground", () => {
  for (const cell of [id(5450, 4050), features[0].properties.CELL_ID, features.at(-1).properties.CELL_ID]) {
    const [sw, se, ne, nw] = cellCorners(cell);
    for (const [a, b] of [[sw, se], [se, ne], [ne, nw], [nw, sw]]) {
      const d = meters(a, b);
      assert.ok(Math.abs(d - 250) <= 0.5, `${cell} side ${d}`);
    }
  }
});

test("AC-4 invalid ids return null without throwing", () => {
  for (const bad of ["", "다사5450405", "다사ABCD4050", "XY54504050", "다사545040501", "뷁사54504050", null, undefined, 123, {}]) {
    assert.equal(cellCorners(bad), null, String(bad));
  }
});
