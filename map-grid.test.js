import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { cellCorners } from "./lib/grid-cells.js";
import { bandIndex, quantileBreaks } from "./lib/layers.js";

test("grid paints each band once without strokes and keeps individual tooltip hit areas", () => {
  const ids = ["다사54005000", "다사54255000", "다사54505000"];
  const state = {
    timeAt: "12", layerData: { grid: { ymd: "20260922", slices: { 12: { [ids[0]]: 10, [ids[1]]: 10, [ids[2]]: null } } } },
    gridGeo: { features: ids.map(CELL_ID => ({ properties: { CELL_ID }, geometry: { type: "Point", coordinates: [126.98, 37.55] } })) },
  };
  const layers = [];
  const bounds = { getNorth: () => 38, getSouth: () => 37, getWest: () => 126, getEast: () => 128 };
  const source = readFileSync(new URL("./map.js", import.meta.url), "utf8");
  const draw = runInNewContext(source.slice(source.indexOf("function drawGrid("), source.indexOf("function drawOverlays(")) + "\ndrawGrid", {
    state, cellCorners, bandIndex, quantileBreaks, gridScaleData: null, gridBreaks: [], PIN_ZOOM: 13,
    map: { getZoom: () => 13, getBounds: () => bounds }, theme: { ink: "black", neutral: "gray" }, fmt: String,
    hoverTip: (layer, text) => { layer.tip = text; },
    window: { L: {
      latLngBounds: () => ({ contains: () => true }),
      polygon: (rings, options) => ({ rings, options, on(event, fn) { this[event] = fn; }, openTooltip() { this.opened = true; } }),
    } },
  });
  const group = { addLayer: layer => layers.push(layer) };
  draw(group);
  const paint = layers.filter(layer => layer.options.interactive === false);
  assert.equal(paint.length, 2, "same-band cells share one Canvas fill");
  assert.deepEqual(paint.map(layer => layer.rings.length), [2, 1]);
  for (const layer of paint) {
    assert.equal(layer.options.stroke, false);
    assert.equal(layer.options.fillRule, "nonzero");
  }
  assert.deepEqual(paint.map(layer => [layer.options.fillColor, layer.options.fillOpacity]), [["black", 0.2], ["gray", 0.12]]);
  const hits = layers.filter(layer => layer.tip);
  assert.equal(hits.length, 3);
  hits.forEach((layer, i) => {
    assert.equal(layer.options.stroke, false);
    assert.equal(layer.options.fill, false, "hit areas cannot paint seams");
    assert.strictEqual(layer.rings, cellCorners(ids[i]));
    assert.ok(layer.tip.includes(ids[i]));
    layer.click();
    assert.equal(layer.opened, true);
  });
  assert.match(hits[2].tip, /비식별\/자료 없음/);
  state.timeAt = "missing";
  layers.length = 0;
  draw(group);
  assert.equal(layers.length, 0);
});
