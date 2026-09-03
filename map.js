import { $, RANK, hasCoords, rowsOf, state } from "./shared.js";
import { radiusPx, STYLE } from "./map-radius.js";

const SEOUL = [37.55, 126.98];
const BOUNDS = [
  [37.42, 126.76],
  [37.7, 127.18],
];

let map;
let overlays;
let tileFailed = false;
let onPick = null;

export function setMapPickHandler(fn) {
  onPick = fn;
}

function pinPlace(place, zoom) {
  return zoom >= 13 && (place.level === "붐빔" || place.level === "약간 붐빔");
}

function circleStyle(place, peers, selected) {
  const s = STYLE[place.level] || { color: "#525252", fillOpacity: 0.4 };
  return {
    radius: radiusPx(place, peers),
    color: selected ? "#171717" : s.color,
    fillColor: s.color,
    weight: selected ? 2 : 1,
    fillOpacity: s.fillOpacity,
    opacity: 1,
  };
}

function drawOverlays() {
  if (!map || !state.data) return;
  if (!overlays) overlays = window.L.layerGroup().addTo(map);
  overlays.clearLayers();
  const zoom = map.getZoom();
  const rows = rowsOf(state.data, state.cat);
  const ranked = [...rows].filter(hasCoords).sort((a, b) => (RANK[a.level] || 0) - (RANK[b.level] || 0));
  let selectedLayer = null;
  for (const place of ranked) {
    const selected = place.name === state.selected;
    const peers = rows.filter((p) => p.level === place.level);
    let layer;
    if (pinPlace(place, zoom)) {
      const icon = window.L.divIcon({
        className: selected ? "pin-hot pin-selected" : "pin-hot",
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      layer = window.L.marker([place.lat, place.lng], { icon, keyboard: false });
    } else {
      layer = window.L.circleMarker([place.lat, place.lng], circleStyle(place, peers, selected));
    }
    layer.on("click", () => {
      state.selected = place.name;
      state.view = "list";
      state.focus = false;
      onPick?.();
    });
    overlays.addLayer(layer);
    if (selected) selectedLayer = layer;
  }
  if (selectedLayer && selectedLayer.bringToFront) selectedLayer.bringToFront();
}

export function syncMap() {
  const skip = $("skip");
  const views = $("views");
  const status = $("map-status");
  const pane = $("map");
  const mapBtn = views && views.querySelector('[data-view="map"]');
  const listBtn = views && views.querySelector('[data-view="list"]');
  if (skip) {
    skip.href = state.view === "map" ? "#map" : "#board";
    skip.textContent = state.view === "map" ? "지도로" : "목록으로";
  }
  if (listBtn) listBtn.setAttribute("aria-pressed", String(state.view === "list"));
  if (mapBtn) {
    mapBtn.disabled = !state.data;
    mapBtn.setAttribute("aria-pressed", String(state.view === "map"));
  }
  document.body.classList.toggle("map-view", state.view === "map");

  if (!state.data) {
    if (status) {
      status.hidden = false;
      status.textContent = "목록을 읽지 못했습니다.";
    }
    return;
  }
  if (status && !tileFailed) status.hidden = true;

  if (state.view !== "map" || !window.L || !pane) return;

  if (!map) {
    map = window.L.map(pane, {
      minZoom: 10,
      maxBounds: BOUNDS,
      maxBoundsViscosity: 1,
    }).setView(SEOUL, 11);
    window.L.tileLayer("/tiles/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; OpenStreetMap &copy; CARTO",
      maxZoom: 18,
    })
      .on("tileerror", () => {
        if (tileFailed || !status) return;
        tileFailed = true;
        status.hidden = false;
        status.textContent = "지도를 불러오지 못했습니다. 목록은 그대로입니다.";
      })
      .addTo(map);
    map.on("zoomend", drawOverlays);
  }

  requestAnimationFrame(() => {
    map.invalidateSize();
    drawOverlays();
    if (state.focus && state.selected) {
      const place = (state.data.places || []).find((p) => p.name === state.selected && hasCoords(p));
      if (place) map.setView([place.lat, place.lng], 14);
      state.focus = false;
    }
  });
}
