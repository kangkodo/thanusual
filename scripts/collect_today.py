#!/usr/bin/env python3
"""Culture-portal events that overlap today. Same Seoul key. Never print the key."""
from __future__ import annotations

import argparse
import datetime
import json
from pathlib import Path

from seoul_api import fetch_all, load_key

KST = datetime.timezone(datetime.timedelta(hours=9))
ROOT = Path(__file__).resolve().parents[1]


def _float(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _day(value: str | None) -> str:
    return str(value or "")[:10]


def collect(key: str) -> dict:
    now = datetime.datetime.now(KST).replace(tzinfo=None)
    today = now.strftime("%Y-%m-%d")
    rows, errors = fetch_all(key, "culturalEventInfo", cap=20_000)
    if errors and not rows:
        raise SystemExit(f"culturalEventInfo {errors}")
    events = []
    for row in rows:
        start = _day(row.get("STRTDATE"))
        end = _day(row.get("END_DATE")) or start
        if start > today or end < today:
            continue
        lat = _float(row.get("LAT"))
        lng = _float(row.get("LOT"))
        if lat is None or lng is None:
            continue
        events.append(
            {
                "title": row.get("TITLE"),
                "place": row.get("PLACE"),
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "free": row.get("IS_FREE") == "무료",
            }
        )
    return {
        "generated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "date": today,
        "ok": len(events),
        "events": events,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(ROOT / "data" / "today.json"))
    args = parser.parse_args()
    payload = collect(load_key())
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"today {payload['ok']} {payload['date']} -> {out}", flush=True)


if __name__ == "__main__":
    main()
