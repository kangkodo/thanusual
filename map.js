import { $, BOUNDS, RANK, el, fmt, hasCoords, mapSnapshot, state } from "./shared.js";
import { radiusPx, STYLE } from "./map-radius.js";
import { bandIndex, dongCode, kstHour, livingSlice, metroFlow, quantileBreaks } from "./lib/layers.js";
import { cellCorners } from "./lib/grid-cells.js";

const SEOUL = [37.55, 126.98];
// Must match TILE_BBOX in lib/tiles.js so Leaflet never asks for a tile the proxy rejects.
const TILE_BOUNDS = [
  [36.6, 125.5],
  [38.5, 128.4],
];
const PIN_ZOOM = 13;
const FOCUS_ZOOM = 15;
const TAP_RADIUS = 14;
const TILE_FAIL_COPY = "지도를 불러오지 못했습니다. 목록은 그대로입니다.";

let map;
let tiles;
let overlays;
const extra = {};
let tileFailed = false;
let tileErrors = 0;
let pinsDrawn = null;
let suppressZoomDraw = false;
let frame = 0;
let onPick = null;
let gridScaleData = null;
let gridBreaks = [];

export function setMapPickHandler(fn) {
  onPick = fn;
}

function pinPlace(place, zoom) {
  return (!state.timeMode || state.timeMode === "now") && !state.compare && zoom >= PIN_ZOOM && (place.level === "붐빔" || place.level === "약간 붐빔");
}

let theme = null;

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#8f8f8f";
}

function readTheme() {
  theme = { ink: token("--text"), down: token("--change-down"), neutral: token("--chart-neutral") };
  for (const [level, s] of Object.entries(STYLE)) theme[level] = token(s.token);
}

function circleStyle(place, peers, selected, referenceMax) {
  const s = STYLE[place.level] || STYLE.보통;
  const temporal = state.timeMode && state.timeMode !== "now";
  const compare = (temporal && state.compare) || state.timeMode === "usual";
  const color = compare
    ? !Number.isFinite(place.delta) || Math.abs(place.delta) < 5 ? theme.neutral : place.delta < 0 ? theme.down : theme.붐빔
    : theme[place.level] || theme.보통;
  return {
    radius: temporal || compare ? Math.max(4, 26 * Math.sqrt(Math.max(0, place.mid || 0) / referenceMax)) : radiusPx(place, peers),
    color: selected ? theme.ink : color,
    fillColor: color,
    weight: selected ? 2 : 1,
    fillOpacity: temporal || compare ? 0.65 : s.fillOpacity,
  };
}

// The tile proxy serves CARTO light_all or dark_all; follow the page theme without a switcher.
const darkQuery = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
const tileUrl = () => `/tiles/${darkQuery && darkQuery.matches ? "dark" : "light"}/{z}/{x}/{y}{r}.png`;

if (darkQuery) {
  darkQuery.addEventListener("change", () => {
    readTheme();
    tileErrors = 0; // the removed tiles can no longer error; do not let an old miss pin the banner
    if (tiles) tiles.setUrl(tileUrl());
    if (map) drawOverlays();
  });
}

function group(id) {
  if (!extra[id]) extra[id] = window.L.layerGroup().addTo(map);
  return extra[id];
}

function drawGroup(id, enabled, paint) {
  const g = group(id);
  g.clearLayers();
  if (!enabled) return;
  paint(g);
}

function hoverTip(layer, text) {
  layer.bindTooltip(el("span", "", text), {
    direction: "top",
    opacity: 1,
    className: "place-label detail-tooltip",
  });
}

function placeTip(place) {
  const mode = state.timeMode || "now";
  const stamp = place.source_at || "시각 자료 없음";
  const latest = (state.data?.places || []).find((p) => p.name === place.name);
  const source = mode === "forecast" ? `${stamp} 예측 (${latest?.source_at || "시각 자료 없음"} 집계 기준)` : `${stamp} 집계`;
  const count = place.mid == null ? "인구 자료 없음" : `인구 약 ${fmt(place.mid)}명`;
  const base = mode === "usual" ? "평소 대비" : "최신 집계 대비";
  const delta = Number.isFinite(place.delta) ? `${base} ${place.delta > 0 ? "+" : ""}${place.delta}%` : "비교 자료 없음";
  return `${place.name} · ${source} · ${place.level || "등급 자료 없음"} · ${count} · ${delta} · 구역 대표 지점이며 이 지점 주변의 국소 밀도를 뜻하지 않습니다.`;
}

function drawDong(g) {
  const geo = state.dongGeo;
  const living = state.layerData.dong;
  if (!geo || !living) return;
  const slice = livingSlice(living, kstHour());
  if (!slice) return;
  const pops = slice.pops;
  const breaks = quantileBreaks([...pops.values()]);
  // Same renderer as the circles, drawn first, so polygons sit under them for paint and hit-testing.
  window.L.geoJSON(geo, {
    style(feature) {
      const spop = pops.get(dongCode(feature.properties.code));
      const band = bandIndex(spop, breaks);
      // Ink ramp, not --hot: orange on the map means crowded now, and only that.
      return {
        color: theme.ink,
        weight: 0.4,
        fillColor: theme.ink,
        fillOpacity: spop ? 0.06 + band * 0.1 : 0.02,
      };
    },
    onEachFeature(feature, layer) {
      const name = feature.properties.name;
      const spop = pops.get(dongCode(feature.properties.code));
      hoverTip(layer, spop ? `${name} ${spop.toLocaleString("ko-KR")}명` : name);
    },
  }).addTo(g);
}

function drawMetro(g) {
  const data = state.layerData.metro;
  if (!data) return;
  const hour = kstHour();
  const flows = (data.stations || [])
    .map((s) => ({ s, n: metroFlow(s, hour) }))
    .filter((x) => x.n > 0 && hasCoords(x.s));
  const breaks = quantileBreaks(flows.map((x) => x.n));
  for (const { s, n } of flows) {
    const band = bandIndex(n, breaks);
    const layer = window.L.circleMarker([s.lat, s.lng], {
      radius: 4 + band,
      color: theme.ink,
      fillColor: theme.ink,
      weight: 1,
      fillOpacity: 0.2 + band * 0.12,
    });
    hoverTip(layer, `${s.line} ${s.name}`);
    g.addLayer(layer);
  }
}

function drawStreet(g, zoom) {
  const data = state.layerData.street;
  if (!data) return;
  if (zoom >= PIN_ZOOM) {
    for (const bike of data.bikes || []) {
      if (!hasCoords(bike)) continue;
      const empty = bike.bikes === 0;
      const layer = window.L.circleMarker([bike.lat, bike.lng], {
        radius: 3,
        color: empty ? theme.보통 : theme.여유,
        fillColor: empty ? theme.보통 : theme.여유,
        weight: 1,
        fillOpacity: empty ? 0.3 : 0.7,
      });
      hoverTip(layer, `${bike.name} ${bike.bikes}대`);
      g.addLayer(layer);
    }
  }
  for (const acc of data.incidents || []) {
    if (!hasCoords(acc)) continue;
    const layer = window.L.circleMarker([acc.lat, acc.lng], {
      radius: 7,
      color: theme.ink,
      fillColor: theme.ink,
      weight: 2,
      fillOpacity: 0.35,
    });
    hoverTip(layer, acc.text || "도로 통제");
    g.addLayer(layer);
  }
}

function drawToday(g) {
  const data = state.layerData.today;
  if (!data) return;
  for (const ev of data.events || []) {
    if (!hasCoords(ev)) continue;
    const layer = window.L.circleMarker([ev.lat, ev.lng], {
      radius: 6,
      color: theme.ink,
      fillColor: theme.여유,
      weight: 1,
      fillOpacity: 0.8,
    });
    hoverTip(layer, ev.title);
    g.addLayer(layer);
  }
}

function drawGrid(g) {
  const data = state.layerData.grid;
  const slice = data?.slices?.[state.timeAt];
  if (!slice || !state.gridGeo || map.getZoom() < PIN_ZOOM) return;
  if (gridScaleData !== data) {
    gridBreaks = quantileBreaks(Object.values(data.slices).flatMap((values) => Object.values(values)).filter(Number.isFinite));
    gridScaleData = data;
  }
  const bounds = map.getBounds();
  // Conservatively include centers one 250m cell beyond each viewport edge.
  const latMargin = 250 / 110000;
  const lngMargin = latMargin / Math.cos(bounds.getNorth() * Math.PI / 180);
  const paddedBounds = window.L.latLngBounds(
    [bounds.getSouth() - latMargin, bounds.getWest() - lngMargin],
    [bounds.getNorth() + latMargin, bounds.getEast() + lngMargin],
  );
  const date = String(data.ymd || "").replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
  for (const feature of state.gridGeo.features || []) {
    if (feature.geometry?.type !== "Point") continue;
    const [lng, lat] = feature.geometry.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !paddedBounds.contains([lat, lng])) continue;
    const cell = feature.properties?.CELL_ID;
    const corners = cellCorners(cell);
    if (!corners) continue;
    const population = slice[cell];
    const available = Number.isFinite(population) && population >= 0;
    const opacity = available ? 0.2 + bandIndex(population, gridBreaks) * 0.16 : 0.12;
    const layer = window.L.polygon(corners, {
      color: available ? theme.ink : theme.neutral,
      fillColor: available ? theme.ink : theme.neutral,
      weight: 0.5,
      opacity: opacity / 4,
      fillOpacity: opacity,
    });
    hoverTip(layer, `${date} ${state.timeAt}:00 KST · 격자 ${cell} · ${available ? `생활인구 ${fmt(population)}명` : "비식별/자료 없음"} · 250m 격자`);
    layer.on("click", () => layer.openTooltip());
    g.addLayer(layer);
  }
}

function drawOverlays() {
  if (!map) return;
  if (!overlays) overlays = window.L.layerGroup().addTo(map);
  if (!theme) readTheme();
  overlays.clearLayers();
  const zoom = map.getZoom();
  pinsDrawn = zoom >= PIN_ZOOM;
  const layers = state.layers || {};
  const current = !state.timeMode || state.timeMode === "now";

  drawGroup("dong", current && layers.dong, drawDong);
  drawGroup("grid", state.timeMode === "grid", drawGrid);

  if (state.timeMode !== "grid" && state.data && (!current || layers.now)) {
    const rows = (mapSnapshot().places || []).filter((p) => p.state === "fresh" && (state.cat === "전체" || p.category === state.cat));
    const reference = state.data.places || [];
    const referenceMax = Math.max(1, ...reference.map((p) => p.mid || 0));
    const peersByLevel = new Map();
    for (const p of reference) {
      if (!peersByLevel.has(p.level)) peersByLevel.set(p.level, []);
      peersByLevel.get(p.level).push(p);
    }
    const ranked = [...rows].filter(hasCoords).sort((a, b) => (RANK[a.level] || 0) - (RANK[b.level] || 0));
    let selectedLayer = null;
    for (const place of ranked) {
      const selected = place.name === state.selected;
      let layer;
      if (pinPlace(place, zoom)) {
        const icon = window.L.divIcon({
          className: selected ? "pin-hot pin-selected" : "pin-hot",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        layer = window.L.marker([place.lat, place.lng], { icon, title: place.name });
      } else {
        layer = window.L.circleMarker([place.lat, place.lng], circleStyle(place, peersByLevel.get(place.level), selected, referenceMax));
      }
      const pick = () => {
        state.selected = place.name;
        state.focus = true;
        onPick?.();
      };
      layer.on("click", pick);
      if (layer.getRadius && layer.getRadius() < TAP_RADIUS) {
        const hit = window.L.circleMarker([place.lat, place.lng], { radius: TAP_RADIUS, stroke: false, fillOpacity: 0 });
        hit.on("click", pick);
        overlays.addLayer(hit);
      }
      if (zoom >= PIN_ZOOM && current && !state.compare) {
        const pad = layer.getRadius ? Math.round(layer.getRadius()) + 4 : 12;
        layer.bindTooltip(el("span", "", place.name), {
          permanent: true,
          direction: "right",
          offset: [pad, 0],
          className: selected ? "place-label place-label-selected" : "place-label",
          opacity: 1,
        });
      } else {
        hoverTip(layer, placeTip(place));
      }
      overlays.addLayer(layer);
      if (selected) selectedLayer = layer;
    }
    if (selectedLayer) {
      if (selectedLayer.bringToFront) selectedLayer.bringToFront();
      if (selectedLayer.setZIndexOffset) selectedLayer.setZIndexOffset(1000);
    }
  }

  drawGroup("metro", current && layers.metro, drawMetro);
  drawGroup("street", current && layers.street, (g) => drawStreet(g, zoom));
  drawGroup("today", current && layers.today, drawToday);
}

function showStatus(status, text) {
  if (!status) return;
  status.hidden = false;
  status.textContent = text;
}

function createMap(pane, status) {
  map = window.L.map(pane, {
    minZoom: 10,
    maxBounds: BOUNDS,
    maxBoundsViscosity: 1,
    preferCanvas: true,
  }).setView(SEOUL, 11);
  map.zoomControl.setPosition("topright");
  pane.setAttribute("role", "region");
  pane.setAttribute("aria-label", "서울 지도");
  tiles = window.L.tileLayer(tileUrl(), {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a> · <a href="https://data.seoul.go.kr/dataList/OA-22784/S/1/datasetView.do">서울시</a> · <a href="https://sgis.kostat.go.kr/">SGIS</a>',
    maxZoom: 18,
    bounds: TILE_BOUNDS,
  })
    .on("loading", () => {
      tileErrors = 0;
    })
    .on("tileerror", () => {
      tileErrors += 1;
      if (tileFailed) return;
      tileFailed = true;
      showStatus(status, TILE_FAIL_COPY);
    })
    .on("load", () => {
      if (tileErrors || !tileFailed) return;
      tileFailed = false;
      if (status) status.hidden = true;
    })
    .addTo(map);
  map.on("zoomend", () => {
    if (suppressZoomDraw) return;
    if (pinsDrawn !== null && pinsDrawn === map.getZoom() >= PIN_ZOOM) return;
    drawOverlays();
  });
  map.on("moveend", () => {
    if (state.timeMode === "grid") drawOverlays();
  });
}

export function syncMap() {
  const skip = $("skip");
  const status = $("map-status");
  const pane = $("map");
  const leafletOk = Boolean(window.L && pane);

  if (skip) {
    skip.href = "#board";
    skip.textContent = "장소 목록으로";
  }

  if (!leafletOk) {
    showStatus(status, TILE_FAIL_COPY);
    return;
  }
  if (!state.data) {
    showStatus(status, "목록을 읽지 못했습니다.");
  } else if (status && !tileFailed) {
    status.hidden = true;
  }

  if (!map) createMap(pane, status);

  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    map.invalidateSize();
    if (state.focus && state.selected) {
      const place = (mapSnapshot().places || []).find((p) => p.name === state.selected && hasCoords(p));
      if (place) {
        suppressZoomDraw = true;
        map.setView([place.lat, place.lng], FOCUS_ZOOM, { animate: false });
        suppressZoomDraw = false;
      }
      state.focus = false;
    }
    drawOverlays();
  });
}
