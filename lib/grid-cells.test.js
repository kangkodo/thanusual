import { test } from "node:test";
import assert from "node:assert/strict";
import { cellCorners } from "./grid-cells.js";

test("cell corners reuse the ID cache and validate the whole input", () => {
  const corners = cellCorners("다사54504050");
  assert.strictEqual(cellCorners("다사54504050"), corners);
  for (const id of ["가가00000000", "하하99999999"]) {
    assert.ok(cellCorners(id).flat().every(Number.isFinite));
  }
  for (const id of ["다사54504050\n", "다사54504050 ", " 다사54504050", "다사５４５０４０５０", new String("다사54504050")]) {
    assert.equal(cellCorners(id), null);
  }
});
