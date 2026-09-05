import { $, CATS, DATA_URLS, el, fmt, later, newer, visibleRows, state } from "./shared.js";
import { setMapPickHandler, syncMap } from "./map.js";
import { DONG_GEO_URL, LAYERS, layerUrls } from "./lib/layers.js";

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

function bindSheet() {
  const btn = $("sheet-handle");
  if (!btn || btn.dataset.ready) return;
  btn.addEventListener("click", () => {
    const open = document.body.classList.toggle("map-sheet-open");
    btn.setAttribute("aria-expanded", String(open));
    syncMap();
  });
  btn.dataset.ready = "1";
}

function bindBoard() {
  const board = $("board");
  if (board.dataset.ready) return;
  board.addEventListener("click", (e) => {
    const li = e.target.closest(".row");
    if (!li || !li.dataset.name) return;
    state.selected = li.dataset.name;
    state.focus = true;
    render();
    $("map")?.focus({ preventScroll: true });
  });
  board.dataset.ready = "1";
}

function render() {
  renderTabs();
  bindSearch();
  bindSheet();
  bindBoard();
  bindLayers();
  const data = state.data;
  const stamp = $("stamp");
  const banner = $("banner");
  const board = $("board");
  if (!data) {
    stamp.textContent = "데이터를 불러오지 못했습니다.";
    board.replaceChildren(el("li", "empty", "목록을 읽지 못했습니다."));
    syncMap();
    return;
  }
  stamp.replaceChildren(el("time", "stamp-time", data.source_at || data.generated_at), el("span", "stamp-count", `${data.ok}/${data.total}곳`));
  banner.hidden = !data.warming;
  banner.textContent = data.warming ? "평소 대비 %는 같은 요일·시간대 자료가 3주 쌓인 뒤 표시됩니다. 지금은 인원 순입니다." : "";
  const rows = visibleRows(data, state.cat, state.q);
  if (!rows.length) {
    const empty = state.q.trim() ? "이 이름에 맞는 장소가 없습니다." : "이 분류에 장소가 없습니다.";
    board.replaceChildren(el("li", "empty", empty));
    syncMap();
    return;
  }
  const frag = document.createDocumentFragment();
  const showCat = state.cat === "전체";
  rows.forEach((place, i) => {
    const li = el("li", place.name === state.selected ? "row is-selected" : "row");
    li.dataset.name = place.name;
    const btn = el("button", "row-btn");
    btn.type = "button";
    const name = el("span", "name");
    name.append(el("span", "", place.name));
    if (showCat) name.append(el("span", "cat", place.category));
    const meta = el("div", "meta");
    const lvl = el("span", place.level ? `level lvl-${place.level.replace(/\s+/g, "-")}` : "level", place.level || "—");
    const lat = el("span", "later");
    lat.append(el("span", "later-label", "2시간 뒤"), el("span", "later-value", later(place).replace(/^2시간 뒤\s*/, "")));
    meta.append(lvl, lat);
    btn.append(el("span", "rank", String(i + 1)), name, el("span", "people", fmt(place.mid)), meta);
    li.append(btn);
    frag.append(li);
  });
  board.replaceChildren(frag);
  syncMap();
}

setMapPickHandler(() => {
  render();
  const name = state.selected;
  if (!name) return;
  const row = $("board").querySelector(`[data-name="${CSS.escape(name)}"]`);
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

async function load() {
  const hits = await Promise.all(DATA_URLS.map((url) => loadJson(url).catch(() => null)));
  state.data = hits.reduce(newer, null);
  render();
}

load();
