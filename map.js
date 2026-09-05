import { $, BOUNDS, RANK, hasCoords, visibleRows, state } from "./shared.js";
import { radiusPx, STYLE } from "./map-radius.js";
import { bandIndex, dongCode, kstHour, metroFlow, quantileBreaks } from "./lib/layers.js";

const SEOUL = [37.55, 126.98];
// Must match TILE_BBOX in lib/tiles.js so Leaflet never asks for a tile the proxy rejects.
const TILE_BOUNDS = [
  [36.6, 125.5],
  [38.5, 128.4],
];
const PIN_ZOOM = 13;
const FOCUS_ZOOM = 14;
const TAP_RADIUS = 14;
const TILE_FAIL_COPY = "지도를 불러오지 못했습니다. 목록은 그대로입니다.";

let map;
let overlays;
const extra = {};
let tileFailed = false;
let tileErrors = 0;
let pinsDrawn = null;
let suppressZoomDraw = false;
let frame = 0;
let onPick = null;

export function setMapPickHandler(fn) {
  onPick = fn;
}

function pinPlace(place, zoom) {
  return zoom >= PIN_ZOOM && (place.level === "붐빔" || place.level === "약간 붐빔");
}

let theme = null;

function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#8f8f8f";
}

function readTheme() {
  theme = { ink: token("--text") };
  for (const [level, s] of Object.entries(STYLE)) theme[level] = token(s.token);
}

function circleStyle(place, peers, selected) {
  const s = STYLE[place.level] || STYLE.보통;
  const color = theme[place.level] || theme.보통;
  return {
    radius: radiusPx(place, peers),
    color: selected ? theme.ink : color,
    fillColor: color,
    weight: selected ? 2 : 1,
    fillOpacity: s.fillOpacity,
  };
}

if (typeof window !== "undefined" && window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    readTheme();
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
  layer.bindTooltip(text, {
    direction: "top",
    opacity: 1,
    className: "place-label",
  });
}

function drawDong(g) {
  const geo = state.dongGeo;
  const living = state.layerData.dong;
  if (!geo || !living) return;
  const pops = new Map();
  for (const row of living.dongs || []) pops.set(row.code, row.spop);
  const breaks = quantileBreaks([...pops.values()]);
  const canvas = window.L.canvas({ padding: 0.5 });
  window.L.geoJSON(geo, {
    renderer: canvas,
    style(feature) {
      const spop = pops.get(dongCode(feature.properties.code));
      const band = bandIndex(spop, breaks);
      return {
        color: theme.ink,
        weight: 0.4,
        fillColor: spop ? theme.붐빔 : theme.보통,
        fillOpacity: spop ? 0.12 + band * 0.12 : 0.04,
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
      color: theme.붐빔,
      fillColor: theme.붐빔,
      weight: 1,
      fillOpacity: 0.25 + band * 0.12,
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
      radius: 8,
      color: theme.ink,
      fillColor: theme.붐빔,
      weight: 1,
      fillOpacity: 0.85,
    });
    hoverTip(layer, acc.text || "돌발");
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

function drawOverlays() {
  if (!map) return;
  if (!overlays) overlays = window.L.layerGroup().addTo(map);
  if (!theme) readTheme();
  overlays.clearLayers();
  const zoom = map.getZoom();
  pinsDrawn = zoom >= PIN_ZOOM;
  const layers = state.layers || {};

  if (state.data && layers.now) {
    const rows = visibleRows(state.data, state.cat, state.q);
    const peersByLevel = new Map();
    for (const p of rows) {
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
        layer = window.L.circleMarker([place.lat, place.lng], circleStyle(place, peersByLevel.get(place.level), selected));
      }
      const pick = () => {
        state.selected = place.name;
        state.focus = false;
        onPick?.();
      };
      layer.on("click", pick);
      if (layer.getRadius && layer.getRadius() < TAP_RADIUS) {
        const hit = window.L.circleMarker([place.lat, place.lng], { radius: TAP_RADIUS, stroke: false, fillOpacity: 0 });
        hit.on("click", pick);
        overlays.addLayer(hit);
      }
      if (zoom >= PIN_ZOOM) {
        const pad = layer.getRadius ? Math.round(layer.getRadius()) + 4 : 12;
        layer.bindTooltip(place.name, {
          permanent: true,
          direction: "right",
          offset: [pad, 0],
          className: selected ? "place-label place-label-selected" : "place-label",
          opacity: 1,
        });
      }
      overlays.addLayer(layer);
      if (selected) selectedLayer = layer;
    }
    if (selectedLayer) {
      if (selectedLayer.bringToFront) selectedLayer.bringToFront();
      if (selectedLayer.setZIndexOffset) selectedLayer.setZIndexOffset(1000);
    }
  }

  drawGroup("dong", layers.dong, drawDong);
  drawGroup("metro", layers.metro, drawMetro);
  drawGroup("street", layers.street, (g) => drawStreet(g, zoom));
  drawGroup("today", layers.today, drawToday);
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
  window.L.tileLayer("/tiles/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
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
      const place = (state.data.places || []).find((p) => p.name === state.selected && hasCoords(p));
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
