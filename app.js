import { $, CATS, DATA_URLS, ageMinutes, ageText, el, fmt, later, newer, pickSnapshot, summaryText, usualPct, usualText, visibleRows, state } from "./shared.js";
import { setMapPickHandler, syncMap } from "./map.js";
import { DONG_GEO_URL, LAYERS, layerUrls } from "./lib/layers.js";

const STALE_MIN = 60;
const REFRESH_MS = 5 * 60 * 1000;
const PHONE = "(max-width: 47.99rem)";

function renderTabs() {
  const nav = $("tabs");
  if (!nav.dataset.ready) {
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      state.cat = btn.dataset.cat;
      render();
    });
    for (const [cat, label] of CATS) {
      const btn = el("button");
      btn.type = "button";
      btn.dataset.cat = cat;
      btn.textContent = label;
      nav.append(btn);
    }
    nav.dataset.ready = "1";
  }
  for (const btn of nav.children) {
    btn.setAttribute("aria-pressed", String(btn.dataset.cat === state.cat));
  }
}

function bindSearch() {
  const form = $("place-search");
  if (!form || form.dataset.ready) return;
  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || input.id !== "q") return;
    state.q = input.value;
    render();
  });
  form.dataset.ready = "1";
}

function bindLayers() {
  const form = $("layers");
  if (!form || form.dataset.ready) return;
  for (const layer of LAYERS) {
    const label = el("label", "layer");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "layer";
    input.value = layer.id;
    input.checked = Boolean(state.layers[layer.id]);
    const text = el("span", "layer-text");
    text.append(el("span", "layer-name", layer.label), el("span", "layer-blurb", layer.blurb));
    label.append(input, text);
    form.append(label);
  }
  form.addEventListener("change", async (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || input.name !== "layer") return;
    const id = input.value;
    if (input.checked) {
      const ok = await ensureLayer(id);
      if (!ok) {
        input.checked = false;
        state.layers[id] = false;
        const note = $("layer-note");
        if (note) {
          note.hidden = false;
          note.textContent = "이 레이어 자료가 아직 없습니다. 수집이 돌면 켜집니다.";
        }
        return;
      }
    }
    state.layers[id] = input.checked;
    updateLayerNote();
    syncMap();
  });
  form.dataset.ready = "1";
}

function updateLayerNote() {
  const note = $("layer-note");
  if (!note) return;
  const bits = [];
  const living = state.layerData.dong;
  if (state.layers.dong && living?.ymd) {
    bits.push(
      `동네는 ${living.ymd.slice(0, 4)}.${living.ymd.slice(4, 6)}.${living.ymd.slice(6, 8)} ${living.tt}시 생활인구입니다.`,
    );
  }
  if (state.layers.metro && state.layerData.metro?.month) {
    bits.push(`지하철은 ${state.layerData.metro.month} 승하차입니다.`);
  }
  if (state.layers.street && state.layerData.street) {
    bits.push("따릉이는 확대하면 보입니다.");
  }
  note.hidden = !bits.length;
  note.textContent = bits.join(" ");
}

async function ensureLayer(id) {
  const spec = LAYERS.find((layer) => layer.id === id);
  if (!spec) return false;
  if (!spec.file) return true;
  if (!state.layerData[id]) {
    const data = await loadFirst(layerUrls(spec.file));
    if (!data) return false;
    state.layerData[id] = data;
  }
  if (id === "dong" && !state.dongGeo) {
    state.dongGeo = await loadJson(DONG_GEO_URL).catch(() => null);
    if (!state.dongGeo) return false;
  }
  return true;
}

function setSheet(open) {
  document.body.classList.toggle("map-sheet-open", open);
  $("sheet-handle")?.setAttribute("aria-expanded", String(open));
}

function bindSheet() {
  const btn = $("sheet-handle");
  if (!btn || btn.dataset.ready) return;
  btn.addEventListener("click", () => {
    setSheet(!document.body.classList.contains("map-sheet-open"));
    syncMap();
  });
  btn.dataset.ready = "1";
}

// Selection lives in the hash so a place can be shared: /#p=이태원역
function select(name, focus) {
  state.selected = name;
  state.focus = focus;
  try {
    history.replaceState(null, "", name ? `#p=${encodeURIComponent(name)}` : location.pathname + location.search);
  } catch {
    // history can be unavailable in odd embeds; the selection still works.
  }
}

function readHash() {
  const m = /[#&]p=([^&]+)/.exec(location.hash);
  if (!m) return;
  let name;
  try {
    name = decodeURIComponent(m[1]);
  } catch {
    return;
  }
  if ((state.data?.places || []).some((p) => p.name === name)) {
    state.selected = name;
    state.focus = true;
  }
}

function bindBoard() {
  const board = $("board");
  if (board.dataset.ready) return;
  board.addEventListener("click", (e) => {
    const li = e.target.closest(".row");
    if (!li || !li.dataset.name) return;
    select(li.dataset.name, true);
    // On the phone the list covers the map; tapping a row means "show me", so give the map back.
    if (window.matchMedia(PHONE).matches) setSheet(false);
    render();
    $("map")?.focus({ preventScroll: true });
  });
  board.dataset.ready = "1";
}

function renderStamp() {
  const data = state.data;
  const stamp = $("stamp");
  const sheetStamp = $("sheet-stamp");
  const summary = $("sheet-summary");
  if (!data) {
    stamp.textContent = "데이터를 불러오지 못했습니다.";
    if (sheetStamp) sheetStamp.textContent = "데이터를 불러오지 못했습니다.";
    return;
  }
  const at = data.source_at || data.generated_at || "";
  const age = ageMinutes(at);
  const when = age != null && age >= 1440 ? at.slice(5, 16) : at.slice(11, 16);
  const bits = [`${when} 기준`];
  if (age != null) bits.push(ageText(age));
  bits.push(`${data.ok}/${data.total}곳`);
  const text = bits.join(" · ");
  // generated_at is the collector's heartbeat (every 10 minutes). Fresh heartbeat + old source = Seoul's feed stalled.
  const genAge = ageMinutes(data.generated_at);
  let staleText = "";
  if (age != null && age > STALE_MIN) staleText = genAge != null && genAge <= 20 ? "서울시 집계가 멈춰 있습니다." : "자료가 오래됐습니다.";
  const time = el("time", "stamp-time", text);
  if (at) time.dateTime = `${at.slice(0, 16).replace(" ", "T")}+09:00`;
  const summaryLine = summaryText(data);
  const parts = [time];
  if (summaryLine) parts.push(el("span", "stamp-summary", summaryLine));
  if (staleText) parts.push(el("span", "stamp-stale", staleText));
  stamp.replaceChildren(...parts);
  if (sheetStamp) sheetStamp.textContent = staleText ? `${text} · ${staleText.replace(/\.$/, "")}` : text;
  if (summary) summary.textContent = summaryLine || "지금 붐비는 곳부터";
}

function render() {
  renderTabs();
  bindSearch();
  bindSheet();
  bindBoard();
  bindLayers();
  const data = state.data;
  const banner = $("banner");
  const board = $("board");
  renderStamp();
  if (!data) {
    board.replaceChildren(el("li", "empty", "목록을 읽지 못했습니다."));
    syncMap();
    return;
  }
  const warming = data.warming !== false;
  const rows = visibleRows(data, state.cat, state.q);
  // After the flip a 30-minute bin can still lack history; say so instead of silently reverting the order.
  const noUsual = !warming && rows.length > 0 && !rows.some((p) => usualPct(p) != null);
  banner.hidden = !(warming || noUsual);
  if (warming) banner.textContent = "평소보다 %는 같은 요일·같은 30분대 자료가 2주 쌓인 뒤 표시됩니다. 지금은 붐빔 등급 순, 같은 등급은 인원 순입니다.";
  else banner.textContent = noUsual ? "이 시간대는 평소 자료가 아직 없어 붐빔 등급 순입니다." : "";
  if (!rows.length) {
    const empty = state.q.trim() ? "이 이름에 맞는 장소가 없습니다." : "이 분류에 장소가 없습니다.";
    board.replaceChildren(el("li", "empty", empty));
    syncMap();
    return;
  }
  const frag = document.createDocumentFragment();
  const showCat = state.cat === "전체";
  rows.forEach((place, i) => {
    const selected = place.name === state.selected;
    const li = el("li", selected ? "row is-selected" : "row");
    li.dataset.name = place.name;
    const btn = el("button", "row-btn");
    btn.type = "button";
    if (selected) btn.setAttribute("aria-current", "true");
    const name = el("span", "name");
    name.append(el("span", "", place.name));
    if (showCat) name.append(el("span", "cat", place.category));
    const value = el("span", "value");
    const usual = usualText(usualPct(place));
    if (usual) value.append(el("span", "usual", usual));
    value.append(el("span", "count", fmt(place.mid)));
    const meta = el("div", "meta");
    const lvl = el("span", place.level ? `level lvl-${place.level.replace(/\s+/g, "-")}` : "level", place.level || "등급 없음");
    const fc = later(place);
    const lat = el("span", "later");
    lat.append(el("span", "later-label", fc.label), " ", el("span", "later-value", fc.value));
    meta.append(lvl, lat);
    btn.append(el("span", "rank", String(i + 1)), name, value, meta);
    li.append(btn);
    frag.append(li);
  });
  // A background refresh must not throw a keyboard user out of the list.
  const keep = document.activeElement?.closest?.(".row")?.dataset.name;
  board.replaceChildren(frag);
  if (keep) board.querySelector(`[data-name="${CSS.escape(keep)}"] .row-btn`)?.focus({ preventScroll: true });
  syncMap();
}

function selectedRow() {
  return state.selected ? $("board").querySelector(`[data-name="${CSS.escape(state.selected)}"]`) : null;
}

setMapPickHandler(() => {
  select(state.selected, false);
  render();
  const row = selectedRow();
  if (!row) return;
  row.scrollIntoView({ block: "nearest" });
  row.querySelector(".row-btn")?.focus({ preventScroll: true });
});

async function loadJson(url) {
  const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

async function loadFirst(urls) {
  const hits = await Promise.all(urls.map((url) => loadJson(url).catch(() => null)));
  return hits.reduce(newer, null);
}

let loading = false;

async function load() {
  if (loading) return;
  loading = true;
  try {
    const hits = await Promise.all(DATA_URLS.map((url) => loadJson(url).catch(() => null)));
    const first = !state.data;
    // Never let a slower or cached host roll the board back to an older snapshot.
    const best = newer(state.data, pickSnapshot(hits));
    const changed = Boolean(best) && best !== state.data;
    if (changed) state.data = best;
    if (first) {
      readHash();
      render();
      selectedRow()?.scrollIntoView({ block: "nearest" });
    } else if (changed) {
      render();
    }
  } finally {
    loading = false;
  }
}

load();
window.addEventListener("hashchange", () => {
  readHash();
  render();
  selectedRow()?.scrollIntoView({ block: "nearest" });
});
// The data moves every 10 minutes; a tab left open should follow it.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") load();
});
setInterval(load, REFRESH_MS);
setInterval(() => {
  if (state.data) renderStamp();
}, 60 * 1000);
