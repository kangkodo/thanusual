import { visibleRows } from "../shared.js";

export const PIN_KEY = "thanusual.pins.v1";

export function readPins(storage) {
  try {
    const names = JSON.parse(storage.getItem(PIN_KEY));
    return new Set(Array.isArray(names) ? names.filter((name) => typeof name === "string") : []);
  } catch {
    return new Set();
  }
}

export function writePins(storage, pins) {
  try {
    storage.setItem(PIN_KEY, JSON.stringify([...pins].filter((name) => typeof name === "string")));
    return true;
  } catch {
    return false;
  }
}

export function togglePin(pins, name) {
  const next = new Set(pins);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  return next;
}

export function pinnedRows(original, snapshot, pins) {
  const members = (original?.places || []).filter((p) => pins.has(p.name));
  const names = new Set(members.map((p) => p.name));
  const rows = visibleRows(snapshot || {}, "전체", "").filter((p) => names.has(p.name));
  const present = new Set(rows.map((p) => p.name));
  const missing = members.filter((p) => !present.has(p.name))
    .map(({ name, category }) => ({ name, category, missing: true }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return [...rows, ...missing];
}
