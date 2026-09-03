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
export const state = { cat: "전체", data: null, view: "list", selected: null, focus: false };

export const fmt = (n) => (n == null || Number.isNaN(n) ? "—" : n.toLocaleString("ko-KR"));

export function later(place) {
  const a = place.mid;
  const b = place.forecast_2h && place.forecast_2h.mid;
  if (!(a > 0) || b == null) return "2시간 뒤 —";
  const pct = Math.round(((b - a) / a) * 100);
  return pct ? `2시간 뒤 ${pct > 0 ? "+" : ""}${pct}%` : "2시간 뒤 유지";
}

export function rowsOf(data, cat) {
  return (data.places || [])
    .filter((p) => p.state === "fresh" && (cat === "전체" || p.category === cat))
    .sort((a, b) => (RANK[b.level] || 0) - (RANK[a.level] || 0) || (b.mid || 0) - (a.mid || 0));
}

export function newer(a, b) {
  if (!a) return b;
  if (!b) return a;
  return (a.source_at || a.generated_at || "") >= (b.source_at || b.generated_at || "") ? a : b;
}

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function hasCoords(place) {
  return Number.isFinite(place.lat) && Number.isFinite(place.lng);
}
