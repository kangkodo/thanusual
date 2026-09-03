const CATS = [
  ["전체", "전체"],
  ["인구밀집지역", "인구밀집"],
  ["공원", "공원"],
  ["발달상권", "발달상권"],
  ["관광특구", "관광특구"],
  ["고궁·문화유산", "고궁"],
];
const RANK = { "붐빔": 4, "약간 붐빔": 3, "보통": 2, "여유": 1 };
const DATA_URLS = [
  "https://raw.githubusercontent.com/kangkodo/thanusual/data/current.json",
  "https://cdn.jsdelivr.net/gh/kangkodo/thanusual@data/current.json",
  "./data/current.json",
];

const $ = (id) => document.getElementById(id);
const state = { cat: "전체", data: null };

const fmt = (n) => (n == null || Number.isNaN(n) ? "—" : n.toLocaleString("ko-KR"));

function later(place) {
  const a = place.mid;
  const b = place.forecast_2h && place.forecast_2h.mid;
  if (!(a > 0) || b == null) return "2시간 뒤 —";
  const pct = Math.round(((b - a) / a) * 100);
  return pct ? `2시간 뒤 ${pct > 0 ? "+" : ""}${pct}%` : "2시간 뒤 유지";
}

function rowsOf(data, cat) {
  return (data.places || [])
    .filter((p) => p.state === "fresh" && (cat === "전체" || p.category === cat))
    .sort((a, b) => (RANK[b.level] || 0) - (RANK[a.level] || 0) || (b.mid || 0) - (a.mid || 0));
}

function newer(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (a.source_at || a.generated_at || "") >= (b.source_at || b.generated_at || "") ? a : b;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

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

function render() {
  renderTabs();
  const data = state.data;
  const stamp = $("stamp");
  const banner = $("banner");
  const board = $("board");
  if (!data) {
    stamp.textContent = "데이터를 불러오지 못했습니다.";
    board.replaceChildren(el("li", "empty", "목록을 읽지 못했습니다."));
    return;
  }
  stamp.textContent = `${data.source_at || data.generated_at} · ${data.ok}/${data.total}곳`;
  banner.hidden = !data.warming;
  banner.textContent = data.warming ? "평소 대비는 3주 뒤. 지금은 붐빔 순." : "";
  const rows = rowsOf(data, state.cat);
  if (!rows.length) {
    board.replaceChildren(el("li", "empty", "이 분류에 장소가 없습니다."));
    return;
  }
  const frag = document.createDocumentFragment();
  const showCat = state.cat === "전체";
  rows.forEach((place, i) => {
    const li = el("li", "row");
    const meta = el("div", "meta");
    const lvl = el("span", place.level ? `lvl-${place.level.replace(/\s+/g, "-")}` : "", place.level || "—");
    meta.append(lvl);
    if (showCat) meta.append(el("span", "", place.category));
    meta.append(el("span", "later", later(place)));
    li.append(
      el("span", "rank", String(i + 1)),
      el("span", "name", place.name),
      el("span", "people", fmt(place.mid)),
      meta,
    );
    frag.append(li);
  });
  board.replaceChildren(frag);
}

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
