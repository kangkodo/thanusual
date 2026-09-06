import { defaultLayerState } from "./lib/layers.js";

export const CATS = [
  ["전체", "전체"],
  ["인구밀집지역", "인구밀집"],
  ["공원", "공원"],
  ["발달상권", "발달상권"],
  ["관광특구", "관광특구"],
  ["고궁·문화유산", "고궁"],
];
export const RANK = { 붐빔: 4, "약간 붐빔": 3, 보통: 2, 여유: 1 };
export const DATA_URLS = [
  "https://raw.githubusercontent.com/kangkodo/thanusual/data/current.json",
  "https://cdn.jsdelivr.net/gh/kangkodo/thanusual@data/current.json",
  "./data/current.json",
];

export const $ = (id) => document.getElementById(id);
export const state = {
  cat: "전체",
  q: "",
  data: null,
  selected: null,
  focus: false,
  layers: defaultLayerState(),
  layerData: {},
  dongGeo: null,
};

export const fmt = (n) => (n == null || Number.isNaN(n) ? "자료 없음" : n.toLocaleString("ko-KR"));

// The API forecast is for a fixed clock hour (nearest to source + 2h), so the label names that hour.
export function later(place) {
  const at = place.forecast_2h && place.forecast_2h.at;
  const label = at ? `${at.slice(11, 13)}시 예측` : "예측";
  const a = place.mid;
  const b = place.forecast_2h && place.forecast_2h.mid;
  if (!(a > 0) || b == null) return { label, value: "없음" };
  const pct = Math.round(((b - a) / a) * 100);
  return { label, value: pct ? `${pct > 0 ? "+" : ""}${pct}%` : "유지" };
}

// usual comes from scripts/baseline.py: same weekday, same 30-minute bin, past weeks only.
export function usualPct(place) {
  const u = place.usual;
  if (!u || !(u.mid > 0) || !(place.mid > 0)) return null;
  return Math.round(((place.mid - u.mid) / u.mid) * 100);
}

export function usualText(pct) {
  if (pct == null) return null;
  if (Math.abs(pct) < 5) return "평소와 비슷";
  return `평소보다 ${pct > 0 ? "+" : ""}${pct}%`;
}

const byLevel = (a, b) => (RANK[b.level] || 0) - (RANK[a.level] || 0) || (b.mid || 0) - (a.mid || 0);

export function rowsOf(data, cat) {
  const rows = (data.places || []).filter((p) => p.state === "fresh" && (cat === "전체" || p.category === cat));
  if (data.warming !== false) return rows.sort(byLevel);
  // Baseline ready: 평소보다 붐비는 순. Rows without a usual value keep the grade order below them.
  const key = (p) => {
    const v = usualPct(p);
    return v == null ? -Infinity : v;
  };
  return rows.sort((a, b) => key(b) - key(a) || byLevel(a, b));
}

const norm = (s) => String(s || "").replace(/[\s·()]/g, "").toLowerCase();

export function visibleRows(data, cat, q) {
  const rows = rowsOf(data, cat);
  const needle = norm(q);
  if (!needle) return rows;
  return rows.filter((p) => norm(p.name).includes(needle) || norm(p.category).includes(needle));
}

export function newer(a, b) {
  if (!a) return b;
  if (!b) return a;
  // A snapshot with nothing in it never beats one with data, whatever its timestamp.
  if ((a.ok > 0) !== (b.ok > 0)) return a.ok > 0 ? a : b;
  return (a.source_at || a.generated_at || "") >= (b.source_at || b.generated_at || "") ? a : b;
}

// "YYYY-MM-DD HH:MM" from the Seoul API is KST wall-clock time.
export function ageMinutes(stamp, now = Date.now()) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(stamp || "");
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 9, +m[5]);
  return Math.max(0, Math.round((now - t) / 60000));
}

export function ageText(min) {
  if (min == null) return "";
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h}시간 ${r}분 전` : `${h}시간 전`;
}

export function summaryText(data) {
  const fresh = (data.places || []).filter((p) => p.state === "fresh");
  const count = (level) => fresh.filter((p) => p.level === level).length;
  const hot = count("붐빔");
  const warm = count("약간 붐빔");
  const rest = fresh.length - hot - warm;
  const bits = [];
  if (hot) bits.push(`붐빔 ${hot}`);
  if (warm) bits.push(`약간 붐빔 ${warm}`);
  bits.push(bits.length ? `나머지 ${rest}곳 보통·여유` : `${rest}곳 모두 보통·여유`);
  return bits.join(" · ");
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Seoul map bounds: Leaflet maxBounds and the coordinate sanity check share them.
export const BOUNDS = [
  [37.42, 126.76],
  [37.7, 127.18],
];

export function hasCoords(place) {
  const { lat, lng } = place;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= BOUNDS[0][0] && lat <= BOUNDS[1][0] && lng >= BOUNDS[0][1] && lng <= BOUNDS[1][1];
}
