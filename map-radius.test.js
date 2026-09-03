import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE, radiusPx } from "./map-radius.js";

test("missing mid uses base", () => {
  assert.equal(radiusPx({ level: "붐빔" }, [{ mid: 100 }, { mid: 200 }]), BASE["붐빔"]);
});

test("unknown level without peers uses 6", () => {
  assert.equal(radiusPx({ level: "?", mid: 10 }, []), 6);
});

test("n<2 uses base", () => {
  assert.equal(radiusPx({ level: "여유", mid: 10 }, [{ mid: 10 }]), BASE["여유"]);
});

test("identical mids use base", () => {
  const peers = [{ mid: 1750 }, { mid: 1750 }, { mid: 1750 }];
  assert.equal(radiusPx({ level: "보통", mid: 1750 }, peers), BASE["보통"]);
});

test("min-max lerp at ends", () => {
  const peers = [{ mid: 100 }, { mid: 200 }];
  const lo = radiusPx({ level: "여유", mid: 100 }, peers);
  const hi = radiusPx({ level: "여유", mid: 200 }, peers);
  assert.equal(lo, BASE["여유"] * 0.8);
  assert.ok(Math.abs(hi - BASE["여유"] * 1.2) < 1e-9);
});

test("midpoint and duplicate mids share one t", () => {
  const peers = [{ mid: 100 }, { mid: 150 }, { mid: 150 }, { mid: 200 }];
  assert.ok(Math.abs(radiusPx({ level: "보통", mid: 150 }, peers) - BASE["보통"]) < 1e-9);
});

test("non-positive or missing peer mids are ignored", () => {
  assert.equal(radiusPx({ level: "여유", mid: 100 }, [{ mid: null }, { mid: 0 }, { mid: 100 }]), BASE["여유"]);
  assert.equal(radiusPx({ level: "붐빔", mid: 5 }, undefined), BASE["붐빔"]);
});
