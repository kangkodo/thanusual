import { $, CATS, DATA_URLS, ageMinutes, ageText, el, fmt, later, newer, pickSnapshot, summaryText, usualPct, usualText, visibleRows, state } from "./shared.js";
import { setMapPickHandler, syncMap } from "./map.js";
import { DONG_GEO_URL, LAYERS, daysAgo, kstDate, kstHour, layerUrls, livingSlice, metroFlow } from "./lib/layers.js";
import { mapSnapshot, timeOptions, distanceKm, hasCoords } from "./shared.js";

const STALE_MIN = 60;
const REFRESH_MS = 5 * 60 * 1000;
const SNAPSHOT_FRESH_MIN = 20;  // generated_at is the collector heartbeat, every 10 minutes
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
  if (state.timeMode !== "now") { note.hidden = true; return; }
  const bits = [];
  const hour = kstHour();
  const living = state.layerData.dong;
  if (state.layers.dong && living?.ymd) {
    const slice = livingSlice(living, hour);
    const days = daysAgo(living.ymd);
    const date = `${Number(living.ymd.slice(4, 6))}월 ${Number(living.ymd.slice(6, 8))}일`;
    const when = days != null ? `${days}일 전(${date})` : date;
    bits.push(`동네는 ${when} ${Number(slice?.tt ?? living.tt)}시 생활인구입니다.`);
  }
  const metro = state.layerData.metro;
  if (state.layers.metro && metro?.month) {
    const active = (metro.stations || []).filter((s) => metroFlow(s, hour) > 0).length;
    bits.push(`지하철은 ${metro.month.slice(0, 4)}년 ${Number(metro.month.slice(4, 6))}월 ${hour}시대 한 달 승하차 합계입니다. 지금 칸 혼잡이 아닙니다.`);
    if (active < 10) bits.push("이 시간대 승하차 자료가 거의 없습니다.");
  }
  const street = state.layerData.street;
  if (state.layers.street && street) {
    bits.push(`거리 자료는 ${String(street.generated_at || "").slice(11, 16)} 기준이고 따릉이는 확대하면 보입니다.`);
  }
  const today = state.layerData.today;
  if (state.layers.today && today?.date) {
    const n = (today.events || []).length;
    const date = `${Number(today.date.slice(5, 7))}월 ${Number(today.date.slice(8, 10))}일`;
    bits.push(today.date === kstDate() ? `오늘 행사 ${n}건입니다.` : `오늘 행사 자료가 아직 없어 ${date} 행사 ${n}건입니다.`);
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
    // Static vendored file: let the browser cache it.
    state.dongGeo = await fetch(DONG_GEO_URL).then((r) => (r.ok ? r.json() : null)).catch(() => null);
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
  const bits = [`최근 ${when} 기준`];
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
  if (summaryLine) parts.push(" ", el("span", "stamp-summary", summaryLine));
  if (staleText) parts.push(" ", el("span", "stamp-stale", staleText));
  stamp.replaceChildren(...parts);
  if (sheetStamp) sheetStamp.textContent = staleText ? `${text} · ${staleText.replace(/\.$/, "")}` : text;
  if (summary) summary.textContent = state.timeMode === "now" ? summaryLine || "지금 붐비는 곳부터" : state.timeMode === "grid" ? "250m 상세 분포 · 목록은 최근 장소 집계" : `${{history:"과거 집계",forecast:"예측",usual:"평소 대비"}[state.timeMode]} · ${state.timeAt || "같은 요일·시간대"}`;
}

function render() {
  renderTabs();
  bindSearch();
  bindSheet();
  bindBoard();
  bindLayers();
  updateLayerNote(); // the note names the hour the map is drawing; keep them in step as time passes
  renderTime();
  renderDetail();
  const data = state.data ? mapSnapshot() : null;
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
  banner.hidden = state.timeMode !== "now" || !(warming || noUsual);
  if (warming) banner.textContent = "평소보다 %는 같은 요일·같은 30분대 자료가 2주 쌓인 뒤 표시됩니다. 지금은 붐빔 등급 순, 같은 등급은 인원 순입니다.";
  else banner.textContent = noUsual ? "이 시간대는 평소 자료가 아직 없어 붐빔 등급 순입니다." : "";
  if (!rows.length) {
    const empty = state.timeMode !== "now" ? "선택한 시각의 자료가 없습니다. 다른 시각이나 최근 집계를 선택하세요." : state.q.trim() ? "이 이름에 맞는 장소가 없습니다. 지도에는 주변 장소가 유지됩니다." : "이 분류에 장소가 없습니다.";
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
    const fc = ["now", "grid"].includes(state.timeMode) ? later(place) : { label: state.timeMode === "usual" ? "평소 대비" : "최근 대비", value: place.delta == null ? "자료 없음" : `${place.delta > 0 ? "+" : ""}${place.delta}%` };
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

function renderTime() {
  document.querySelector(".layer-stack").hidden = state.timeMode !== "now";
  const options = timeOptions();
  if (options.length && !options.includes(state.timeAt)) state.timeAt = options.at(-1);
  const slider = $("time-slider");
  slider.hidden = !options.length;
  slider.max = Math.max(0, options.length - 1);
  slider.value = Math.max(0, options.indexOf(state.timeAt));
  slider.setAttribute("aria-valuetext", state.timeAt);
  $("compare-label").hidden = !["history", "forecast"].includes(state.timeMode);
  const kind = { now: "최근 집계 · 서울시 집계 약 30분 지연", history: options.length ? `${state.timeAt} 집계` : "과거 자료 수집 전입니다. 배포 후 최대 48시간 보관합니다.", forecast: options.length ? `${state.timeAt} 예측 · 관측값 아님` : "제공된 예측 자료가 없습니다.", usual: "같은 요일·30분대의 과거 평균 대비 · 표본 부족은 회색" };
  kind.grid = options.length && state.gridGeo ? `${state.layerData.grid.ymd} · ${state.timeAt}시 · 내국인 생활인구 추정(실시간 아님). 확대 후 점을 누르면 인원이 나옵니다. 진할수록 많음 · 회색 비식별/누락 · 좌표 없는 격자 제외. 목록은 최근 장소 집계.` : "250m 자료를 불러오지 못했습니다. 수집 완료 후 사용할 수 있습니다.";
  $("time-note").textContent = kind[state.timeMode] + (state.timeMode === "grid" ? "" : state.timeMode === "usual" || (state.compare && options.length) ? " · 주황 증가 / 파랑 감소 / 회색 비교 불가·비슷" : " · 점은 구역 대표 위치");
}

function renderDetail() {
  const box = $("place-detail");
  const original = state.data?.places.find((p) => p.name === state.selected);
  box.hidden = !original;
  if (!original) return;
  const p = mapSnapshot().places.find((p) => p.name === state.selected);
  const close = el("button", "detail-close", "닫기");
  close.type = "button";
  close.onclick = () => { select(null, false); render(); };
  const title = el("h2", "detail-title", original.name);
  const count = p ? `${p.level || "등급 없음"} · ${fmt(p.min ?? p.mid)}~${fmt(p.max ?? p.mid)}명` : "이 시각 자료 없음";
  const when = state.timeMode === "forecast" ? `${state.timeAt} 예측` : p?.source_at || state.data.source_at;
  const nearby = (state.data.places || []).filter((x) => x.name !== original.name && hasCoords(x) && x.state === "fresh")
    .map((x) => ({ ...x, km: distanceKm(original, x) })).sort((a, b) => a.km - b.km).slice(0, 3);
  const links = el("div", "nearby");
  for (const x of nearby) {
    const current = mapSnapshot().places.find((p) => p.name === x.name);
    const btn = el("button", "nearby-place", `${x.name} · 직선 ${x.km.toFixed(1)}km · ${current?.level || "이 시각 자료 없음"}`);
    btn.type = "button";
    btn.onclick = () => { select(x.name, true); state.cat = "전체"; state.q = ""; $("q").value = ""; render(); };
    links.append(btn);
  }
  box.replaceChildren(close, title, el("p", "", count), el("p", "detail-note", when || "시각 없음"), el("p", "detail-note", "구역 전체 추정 인구입니다. 골목·건물별 인원은 알 수 없습니다."), el("p", "", "가까운 다른 장소"), links);
}

$("time-mode").addEventListener("change", async (e) => {
  state.timeMode = e.target.value;
  state.timeAt = "";
  if (state.timeMode === "now") { state.compare = false; $("time-compare").checked = false; }
  render();
  if (["history", "grid"].includes(state.timeMode)) $("time-note").textContent = "선택한 지도 자료를 불러오는 중입니다.";
  if (state.timeMode === "history") state.timeline = await loadFirst(layerUrls("timeline.json"));
  if (state.timeMode === "grid") {
    state.layerData.grid ||= await loadFirst(layerUrls("grid.json"));
    state.gridGeo ||= await fetch("./vendor/seoul-grid.geojson").then((r) => r.ok ? r.json() : null).catch(() => null);
    state.focus = Boolean(state.selected);
  }
  render();
});
$("time-slider").addEventListener("input", (e) => { state.timeAt = timeOptions()[Number(e.target.value)] || ""; render(); });
$("time-compare").addEventListener("change", (e) => { state.compare = e.target.checked; render(); });

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
  const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

// current.json is fetched every few minutes, so one host is enough while it is current.
// A stale or failed first answer is the only case worth spending the other two requests on,
// and pickSnapshot still keeps a slower host from rolling the board back.
async function loadSnapshot() {
  const first = await loadJson(DATA_URLS[0]).catch(() => null);
  // generated_at, not source_at: the Seoul feed is always about 30 minutes behind by design,
  // so judging the host by source_at would send us to the other two on every refresh.
  const age = first ? ageMinutes(first.generated_at || first.source_at) : null;
  if (first && first.ok > 0 && age != null && age <= SNAPSHOT_FRESH_MIN) return first;
  const rest = await Promise.all(DATA_URLS.slice(1).map((url) => loadJson(url).catch(() => null)));
  return pickSnapshot([first, ...rest]);
}

// Layer files are big (street.json ~300KB) and the first host is the freshest, so stop at the first success.
async function loadFirst(urls) {
  for (const url of urls) {
    try {
      return await loadJson(url);
    } catch {
      // try the next host
    }
  }
  return null;
}

let loading = false;

async function load() {
  if (loading) return;
  loading = true;
  try {
    const first = !state.data;
    // Never let a slower or cached host roll the board back to an older snapshot.
    const best = newer(state.data, await loadSnapshot());
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
// A hidden tab has nothing to show; visibilitychange above catches it up when it returns.
setInterval(() => {
  if (document.visibilityState === "visible") load();
}, REFRESH_MS);
setInterval(() => {
  if (state.data) renderStamp();
}, 60 * 1000);
