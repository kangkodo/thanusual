const CATS = ["전체", "인구밀집지역", "공원", "발달상권", "관광특구", "고궁·문화유산"];
const LEVEL_RANK = { "붐빔": 4, "약간 붐빔": 3, "보통": 2, "여유": 1 };
const DATA_URLS = [
  "https://raw.githubusercontent.com/kangkodo/thanusual/data/current.json",
  "https://cdn.jsdelivr.net/gh/kangkodo/thanusual@data/current.json",
  "./data/current.json",
];

const state = { cat: "전체", data: null };

function fmtPeople(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("ko-KR").format(n);
}

function laterText(place) {
  const now = place.mid;
  const later = place.forecast_2h && place.forecast_2h.mid;
  if (now == null || later == null || now <= 0) return "2시간 뒤 —";
  const pct = Math.round(((later - now) / now) * 100);
  if (pct === 0) return "2시간 뒤 유지";
  const sign = pct > 0 ? "+" : "";
  return `2시간 뒤 ${sign}${pct}%`;
}

function pillClass(level) {
  if (!level) return "pill";
  return `pill lvl-${level.replace(/\s+/g, "-")}`;
}

function sortedPlaces(data, cat) {
  const rows = (data.places || []).filter((p) => p.state === "fresh");
  const filtered = cat === "전체" ? rows : rows.filter((p) => p.category === cat);
  return filtered.slice().sort((a, b) => {
    const lr = (LEVEL_RANK[b.level] || 0) - (LEVEL_RANK[a.level] || 0);
    if (lr) return lr;
    return (b.mid || 0) - (a.mid || 0);
  });
}

function renderTabs() {
  const nav = document.getElementById("tabs");
  nav.innerHTML = "";
  for (const cat of CATS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = cat === "인구밀집지역" ? "인구밀집" : cat === "고궁·문화유산" ? "고궁" : cat;
    btn.setAttribute("aria-pressed", String(cat === state.cat));
    btn.addEventListener("click", () => {
      state.cat = cat;
      render();
    });
    nav.appendChild(btn);
  }
}

function render() {
  const data = state.data;
  const stamp = document.getElementById("stamp");
  const banner = document.getElementById("banner");
  const board = document.getElementById("board");
  renderTabs();
  if (!data) {
    stamp.textContent = "데이터를 불러오지 못했습니다.";
    board.innerHTML = `<li class="empty">current.json을 읽지 못했습니다.</li>`;
    return;
  }
  const source = data.source_at || data.generated_at;
  stamp.textContent = `데이터 기준 ${source} · ${data.ok}/${data.total}곳`;
  banner.hidden = false;
  banner.textContent = data.warming
    ? "평소 대비 %는 아직 집계 중입니다. 아래는 지금 붐빔 순입니다."
    : "같은 요일·같은 시간대 표본으로 평소 대비를 계산합니다.";
  const places = sortedPlaces(data, state.cat);
  board.innerHTML = "";
  if (!places.length) {
    board.innerHTML = `<li class="empty">이 분류에 장소가 없습니다.</li>`;
    return;
  }
  places.forEach((place, i) => {
    const li = document.createElement("li");
    li.className = "row";
    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = String(i + 1).padStart(2, "0");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = place.name;
    const people = document.createElement("span");
    people.className = "people-col people";
    people.textContent = fmtPeople(place.mid);
    const meta = document.createElement("div");
    meta.className = "meta";
    const lvl = document.createElement("span");
    lvl.className = pillClass(place.level);
    lvl.textContent = place.level || "—";
    const cat = document.createElement("span");
    cat.textContent = place.category;
    const later = document.createElement("span");
    later.className = "later";
    later.textContent = laterText(place);
    meta.append(lvl, cat, later);
    li.append(rank, name, people, meta);
    board.appendChild(li);
  });
}

function newer(a, b) {
  if (!a) return b;
  if (!b) return a;
  const ak = a.source_at || a.generated_at || "";
  const bk = b.source_at || b.generated_at || "";
  return ak >= bk ? a : b;
}

async function loadJson(url) {
  const bust = url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
  const res = await fetch(bust, { cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

async function load() {
  let best = null;
  for (const url of DATA_URLS) {
    try {
      best = newer(best, await loadJson(url));
    } catch (_) {
      /* try next */
    }
  }
  state.data = best;
  render();
}

load();
