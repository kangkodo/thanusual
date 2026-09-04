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
      if (btn.dataset.view === "map") {
        enterMap();
        render();
        return;
      }
      leaveMap();
      render();
      window.scrollTo({ top: listScrollY, behavior: "instant" });
    });
    nav.dataset.ready = "1";
  }
}

let listScrollY = 0;

function enterMap() {
  if (state.view === "list") listScrollY = window.scrollY;
  state.view = "map";
}

function leaveMap() {
  state.view = "list";
}

function bindBoard() {
  const board = $("board");
  if (board.dataset.ready) return;
  board.addEventListener("click", (e) => {
    const li = e.target.closest(".row");
    if (!li || !li.dataset.name) return;
    state.selected = li.dataset.name;
    state.focus = true;
    enterMap();
    render();
    $("map").focus({ preventScroll: true });
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
  stamp.replaceChildren(el("time", "stamp-time", data.source_at || data.generated_at), el("span", "stamp-count", `${data.ok}/${data.total}곳`));
  banner.hidden = !data.warming;
  banner.textContent = data.warming ? "평소 대비 %는 같은 요일·시간대 자료가 3주 쌓인 뒤 표시됩니다. 지금은 인원 순입니다." : "";
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
  leaveMap();
  render();
  const name = state.selected;
  if (!name) return;
  const row = $("board").querySelector(`[data-name="${CSS.escape(name)}"]`);
  if (!row) return;
  row.scrollIntoView({ block: "center" });
  row.querySelector(".row-btn")?.focus({ preventScroll: true });
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
