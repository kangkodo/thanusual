import { $, CATS, DATA_URLS, el, fmt, later, newer, rowsOf, state } from "./shared.js";
import { setMapPickHandler, syncMap } from "./map.js";

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

function renderViews() {
  const nav = $("views");
  if (!nav.dataset.ready) {
    nav.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn || btn.disabled) return;
      state.view = btn.dataset.view;
      render();
    });
    nav.dataset.ready = "1";
  }
}

function bindBoard() {
  const board = $("board");
  if (board.dataset.ready) return;
  board.addEventListener("click", (e) => {
    const li = e.target.closest(".row");
    if (!li || !li.dataset.name) return;
    state.selected = li.dataset.name;
    state.view = "map";
    state.focus = true;
    render();
  });
  board.dataset.ready = "1";
}

function render() {
  renderTabs();
  renderViews();
  bindBoard();
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
  stamp.textContent = `${data.source_at || data.generated_at} · ${data.ok}/${data.total}곳`;
  banner.hidden = !data.warming;
  banner.textContent = data.warming ? "평소 대비는 3주 뒤. 지금은 붐빔 순." : "";
  const rows = rowsOf(data, state.cat);
  if (!rows.length) {
    board.replaceChildren(el("li", "empty", "이 분류에 장소가 없습니다."));
    syncMap();
    return;
  }
  const frag = document.createDocumentFragment();
  const showCat = state.cat === "전체";
  rows.forEach((place, i) => {
    const li = el("li", "row");
    li.dataset.name = place.name;
    const meta = el("div", "meta");
    const lvl = el("span", place.level ? `lvl-${place.level.replace(/\s+/g, "-")}` : "", place.level || "—");
    meta.append(lvl);
    if (showCat) meta.append(el("span", "", place.category));
    meta.append(el("span", "later", later(place)));
    li.append(el("span", "rank", String(i + 1)), el("span", "name", place.name), el("span", "people", fmt(place.mid)), meta);
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
  row?.scrollIntoView({ block: "center" });
});

async function loadJson(url) {
  const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

async function load() {
  const hits = await Promise.all(DATA_URLS.map((url) => loadJson(url).catch(() => null)));
  state.data = hits.reduce(newer, null);
  render();
}

load();
