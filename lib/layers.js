export const LAYERS = [
  { id: "now", label: "지금", blurb: "10분마다 갱신 · 서울시 집계 30분 지연", file: null, defaultOn: true },
  { id: "dong", label: "동네", blurb: "생활인구 · 며칠 전 이 시간대", file: "living.json", defaultOn: false },
  { id: "metro", label: "지하철", blurb: "월간 시간대 승하차 · 실시간 아님", file: "metro.json", defaultOn: false },
  { id: "street", label: "거리", blurb: "따릉이 · 도로 통제", file: "street.json", defaultOn: false },
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

// KST calendar date as YYYY-MM-DD.
export function kstDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

// Whole days between a YYYYMMDD stamp and today in KST.
export function daysAgo(ymd, now = new Date()) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(ymd || ""));
  if (!m) return null;
  const [y, mo, d] = kstDate(now).split("-").map(Number);
  return Math.round((Date.UTC(y, mo - 1, d) - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86400000);
}

// living.json carries 3-hour slices of one day; pick the one nearest the clock hour.
// Older files have a single slice as tt + dongs.
export function livingSlice(living, hour) {
  if (!living) return null;
  const slices = living.slices || {};
  const keyed = Object.keys(slices)
    .map((k) => [Number(k), k])
    .filter(([n]) => Number.isFinite(n))
    .sort((a, b) => a[0] - b[0]);
  if (keyed.length) {
    const want = (Math.round(hour / 3) * 3) % 24;
    const dist = (t) => Math.min(Math.abs(t - want), 24 - Math.abs(t - want)); // on the 24-hour circle
    let best = keyed[0];
    for (const k of keyed) if (dist(k[0]) < dist(best[0])) best = k;
    return { tt: best[1].padStart(2, "0"), pops: new Map(Object.entries(slices[best[1]] || {})) };
  }
  if (Array.isArray(living.dongs)) {
    return { tt: living.tt, pops: new Map(living.dongs.map((row) => [row.code, row.spop])) };
  }
  return null;
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
