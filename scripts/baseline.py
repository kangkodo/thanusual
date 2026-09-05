#!/usr/bin/env python3
"""Accumulate each place's usual crowd by weekday and 10-minute slot, and stamp current.json with it.

baseline.json (data branch): {"version": 1, "places": {name: {"n": [1008], "sum": [1008], "last": "YYYY-MM-DD/idx", "last_mid": int}}}
Index = weekday * 144 + hour * 6 + minute // 10, from the sample's source_at (the API's own time, not ours).
One sample per place per day per slot counts, so n is literally the number of past weeks. usual = mean of mid
over the same bin in past weeks, never including today, so a place never compares against itself. Shown when n >= MIN_N.
ponytail: mean, not median; a festival week skews it. Store per-week samples if that shows.
"""
from __future__ import annotations

import argparse
import datetime
import json
from pathlib import Path

SLOTS = 144
WEEK = 7 * SLOTS
MIN_N = 3


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
    # ponytail: one 10-minute slot per README. A wider bin needs per-slot dates to keep today's neighbours out.
    n, total = entry["n"][idx], entry["sum"][idx]
    return {"n": n, "mid": round(total / n) if n >= MIN_N else None}


def update(baseline: dict, current: dict) -> dict:
    places = baseline.setdefault("places", {})
    baseline["version"] = 1
    ready = 0
    for place in current.get("places", []):
        place["usual"] = None
        dt = parse_time(place.get("source_at"))
        mid = place.get("mid")
        if place.get("state") != "fresh" or dt is None or not isinstance(mid, int) or mid <= 0:
            continue
        entry = places.setdefault(place["name"], {"n": [0] * WEEK, "sum": [0] * WEEK, "last": None, "last_mid": 0})
        idx = slot_index(dt)
        key = f"{dt:%Y-%m-%d}/{idx}"
        if entry["last"] != key:
            place["usual"] = usual_for(entry, idx)
            entry["n"][idx] += 1
            entry["sum"][idx] += mid
            entry["last"] = key
            entry["last_mid"] = mid
        else:
            # Second sample in the same slot today (run start, or the API did not move): count only the first,
            # and report what past weeks say without today's sample.
            entry["n"][idx] -= 1
            entry["sum"][idx] -= entry["last_mid"]
            place["usual"] = usual_for(entry, idx)
            entry["n"][idx] += 1
            entry["sum"][idx] += entry["last_mid"]
        if place["usual"]["mid"] is not None:
            ready += 1
    # warming stays as collect.py set it until the client can render usual; usual_ready is the diagnostic.
    current["usual_ready"] = ready
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
    print(f"baseline places {len(baseline['places'])} usual_ready {current['usual_ready']}/{current['total'] if 'total' in current else '?'}", flush=True)


if __name__ == "__main__":
    main()
