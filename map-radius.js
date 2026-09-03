export const BASE = { 붐빔: 22, "약간 붐빔": 16, 보통: 11, 여유: 6 };

// Colors are CSS custom properties from styles.css so the map follows the
// light/dark theme. map.js resolves them at draw time.
export const STYLE = {
  붐빔: { token: "--hot", fillOpacity: 0.85 },
  "약간 붐빔": { token: "--hot", fillOpacity: 0.7 },
  보통: { token: "--chart-neutral", fillOpacity: 0.4 },
  여유: { token: "--calm", fillOpacity: 0.25 },
};

export function radiusPx(place, peers) {
  const base = BASE[place.level] || 6;
  const mids = (peers || []).map((p) => p.mid).filter((n) => n > 0);
  if (!(place.mid > 0) || mids.length < 2) return base;
  const lo = Math.min(...mids);
  const hi = Math.max(...mids);
  if (hi === lo) return base;
  const t = (place.mid - lo) / (hi - lo);
  return base * (0.8 + 0.4 * t);
}
