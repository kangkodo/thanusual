import { $, BOUNDS, RANK, hasCoords, rowsOf, state } from "./shared.js";
import { radiusPx, STYLE } from "./map-radius.js";

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
    if (map && state.view === "map") drawOverlays();
  });
}

function drawOverlays() {
  if (!map || !state.data) return;
  if (!overlays) overlays = window.L.layerGroup().addTo(map);
  if (!theme) readTheme();
  overlays.clearLayers();
  const zoom = map.getZoom();
  pinsDrawn = zoom >= PIN_ZOOM;
  const rows = rowsOf(state.data, state.cat);
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
      state.view = "list";
      state.focus = false;
      onPick?.();
    };
    layer.on("click", pick);
    // Small 보통/여유 circles are under the 44px touch target; add an invisible hit area.
    if (layer.getRadius && layer.getRadius() < TAP_RADIUS) {
      const hit = window.L.circleMarker([place.lat, place.lng], { radius: TAP_RADIUS, stroke: false, fillOpacity: 0 });
      hit.on("click", pick);
      overlays.addLayer(hit);
    }
    overlays.addLayer(layer);
    if (selected) selectedLayer = layer;
  }
  if (!selectedLayer) return;
  if (selectedLayer.bringToFront) selectedLayer.bringToFront();
  if (selectedLayer.setZIndexOffset) selectedLayer.setZIndexOffset(1000);
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
  }).setView(SEOUL, 11);
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
  const views = $("views");
  const status = $("map-status");
  const pane = $("map");
  const mapBtn = views && views.querySelector('[data-view="map"]');
  const listBtn = views && views.querySelector('[data-view="list"]');
  const leafletOk = Boolean(window.L && pane);

  if (!leafletOk && state.view === "map") state.view = "list";

  if (skip) {
    skip.href = state.view === "map" ? "#map" : "#board";
    skip.textContent = state.view === "map" ? "지도로" : "목록으로";
  }
  if (listBtn) listBtn.setAttribute("aria-pressed", String(state.view === "list"));
  if (mapBtn) {
    mapBtn.disabled = !state.data || !leafletOk;
    mapBtn.setAttribute("aria-pressed", String(state.view === "map"));
  }
  document.body.classList.toggle("map-view", state.view === "map");

  if (!state.data) {
    showStatus(status, "목록을 읽지 못했습니다.");
    return;
  }
  if (!leafletOk) {
    showStatus(status, TILE_FAIL_COPY);
    return;
  }
  if (status && !tileFailed) status.hidden = true;

  if (state.view !== "map") return;

  if (!map) createMap(pane, status);

  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    if (state.view !== "map") return;
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
