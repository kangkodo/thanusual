#!/usr/bin/env python3
"""Accumulate each place's usual crowd by weekday and 10-minute slot, and stamp current.json with it.

baseline.json (data branch): {"version": 2, "ready_since": "YYYY-MM-DD HH:MM:SS" | null,
  "places": {name: {"n": [1008], "sum": [1008], "day": "YYYY-MM-DD", "today": {"idx": mid}}}}
Index = weekday * 144 + hour * 6 + minute // 10, from the sample's source_at (the API's own time, not ours).
One sample per place per day per slot counts. usual = mean of mid over the same weekday and 30-minute bin
(3 slots) in past weeks; today's samples are excluded so a place never compares against itself.
Shown when n >= MIN_N (6 = two weeks of three slots). warming flips once and stays flipped.
ponytail: mean, not median; a festival week skews it. Store per-week samples if that shows.
"""
from __future__ import annotations

import argparse
import datetime
import json
from pathlib import Path

SLOTS = 144
WEEK = 7 * SLOTS
BIN = 3      # 10-minute slots per bin: weekday x 30 minutes
MIN_N = 6    # two weeks of a full bin


def parse_time(value):
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.datetime.strptime(value or "", fmt)
        except ValueError:
            continue
    return None


def slot_index(dt: datetime.datetime) -> int:
    return dt.weekday() * SLOTS + dt.hour * 6 + dt.minute // 10


def usual_for(entry: dict, idx: int) -> dict:
    start = idx - idx % BIN
    n = total = 0
    for j in range(start, start + BIN):
        n += entry["n"][j]
        total += entry["sum"][j]
        today_mid = entry["today"].get(str(j))
        if today_mid is not None:
            n -= 1
            total -= today_mid
    return {"n": n, "mid": round(total / n) if n >= MIN_N else None}


def _entry(places: dict, name: str) -> dict:
    entry = places.setdefault(name, {"n": [0] * WEEK, "sum": [0] * WEEK, "day": None, "today": {}})
    if "last" in entry:  # version 1 layout: one "YYYY-MM-DD/idx" key and its mid
        day, _, idx = entry.pop("last").partition("/")
        entry["day"] = day
        entry["today"] = {idx: entry.pop("last_mid", 0)}
    return entry


def update(baseline: dict, current: dict) -> dict:
    places = baseline.setdefault("places", {})
    baseline["version"] = 2
    ready = 0
    for place in current.get("places", []):
        place["usual"] = None
        dt = parse_time(place.get("source_at"))
        mid = place.get("mid")
        if place.get("state") != "fresh" or dt is None or not isinstance(mid, int) or mid <= 0:
            continue
        entry = _entry(places, place["name"])
        day = dt.strftime("%Y-%m-%d")
        if entry["day"] != day:
            entry["day"] = day
            entry["today"] = {}
        idx = slot_index(dt)
        place["usual"] = usual_for(entry, idx)
        if str(idx) not in entry["today"]:
            entry["n"][idx] += 1
            entry["sum"][idx] += mid
            entry["today"][str(idx)] = mid
        if place["usual"]["mid"] is not None:
            ready += 1
    total = len(current.get("places", [])) or 1
    current["usual_ready"] = ready
    if not baseline.get("ready_since") and ready * 2 >= total:
        baseline["ready_since"] = current.get("generated_at") or "yes"
    current["warming"] = not baseline.get("ready_since")
    return current


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--current", required=True)
    parser.add_argument("--baseline", required=True)
    args = parser.parse_args()
    cur_path, base_path = Path(args.current), Path(args.baseline)
    current = json.loads(cur_path.read_text(encoding="utf-8"))
    baseline = json.loads(base_path.read_text(encoding="utf-8")) if base_path.is_file() else {}
    update(baseline, current)
    base_path.write_text(json.dumps(baseline, separators=(",", ":")), encoding="utf-8")
    cur_path.write_text(json.dumps(current, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"baseline places {len(baseline['places'])} usual_ready {current['usual_ready']}/{current.get('total', '?')} warming {current['warming']}", flush=True)


if __name__ == "__main__":
    main()
