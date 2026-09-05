export const LAYERS = [
  { id: "now", label: "지금", blurb: "실시간 121곳", file: null, defaultOn: true },
  { id: "dong", label: "동네", blurb: "생활인구 · 4일 전", file: "living.json", defaultOn: false },
  { id: "metro", label: "지하철", blurb: "월 시간대 승하차", file: "metro.json", defaultOn: false },
  { id: "street", label: "거리", blurb: "따릉이 · 도로 돌발", file: "street.json", defaultOn: false },
  { id: "today", label: "오늘", blurb: "오늘 있는 행사", file: "today.json", defaultOn: false },
];

export const DONG_GEO_URL = "./vendor/seoul-dongs.geojson";

const DATA_HOSTS = [
  "https://raw.githubusercontent.com/kangkodo/thanusual/data/",
  "https://cdn.jsdelivr.net/gh/kangkodo/thanusual@data/",
  "./data/",
];

export function layerUrls(file) {
  if (!file) return [];
  return DATA_HOSTS.map((host) => `${host}${file}`);
}

export function defaultLayerState() {
  return Object.fromEntries(LAYERS.map((layer) => [layer.id, layer.defaultOn]));
}

export function dongCode(value) {
  const code = String(value || "").trim();
  if (code.length >= 10 && code.endsWith("00")) return code.slice(0, 8);
  return code.slice(0, 8);
}

export function kstHour(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  return Number(parts.find((p) => p.type === "hour")?.value || 0);
}

export function metroFlow(station, hour) {
  const hours = station && station.hours;
  if (!Array.isArray(hours)) return null;
  const n = hours[hour];
  return Number.isFinite(n) ? n : null;
}

export function quantileBreaks(values, parts = 5) {
  const sorted = values.filter((n) => n > 0).sort((a, b) => a - b);
  if (sorted.length < 2) return [];
  const breaks = [];
  for (let i = 1; i < parts; i += 1) {
    const t = (i / parts) * (sorted.length - 1);
    const lo = Math.floor(t);
    const hi = Math.ceil(t);
    breaks.push(sorted[lo] + (sorted[hi] - sorted[lo]) * (t - lo));
  }
  return breaks;
}

export function bandIndex(value, breaks) {
  if (!(value > 0) || !breaks.length) return 0;
  let i = 0;
  while (i < breaks.length && value > breaks[i]) i += 1;
  return i;
}
