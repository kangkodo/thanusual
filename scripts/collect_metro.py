#!/usr/bin/env python3
"""Monthly station on/off by hour, joined to 역사 좌표. Same Seoul key. Never print the key."""
from __future__ import annotations

import argparse
import datetime
import json
from pathlib import Path

from seoul_api import fetch_all, fetch_rows, load_key

KST = datetime.timezone(datetime.timedelta(hours=9))
ROOT = Path(__file__).resolve().parents[1]


def _float(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def latest_month(key: str, now: datetime.datetime) -> tuple[str, list[dict]]:
    y, m = now.year, now.month
    for _ in range(8):
        stamp = f"{y}{m:02d}"
        rows, err = fetch_rows(key, "CardSubwayTime", 1, 1000, stamp)
        if rows:
            return stamp, rows
        if err not in ("INFO-200", "empty"):
            print(f"CardSubwayTime {stamp} {err}", flush=True)
        m -= 1
        if m == 0:
            y -= 1
            m = 12
    raise SystemExit("CardSubwayTime month not found")


def hours_of(row: dict) -> list[int]:
    out = []
    for h in range(24):
        on = _float(row.get(f"HR_{h}_GET_ON_NOPE")) or 0
        off = _float(row.get(f"HR_{h}_GET_OFF_NOPE")) or 0
        out.append(int(on + off))
    return out


def collect(key: str) -> dict:
    now = datetime.datetime.now(KST).replace(tzinfo=None)
    month, flows = latest_month(key, now)
    coords, errors = fetch_all(key, "subwayStationMaster", cap=2000)
    if errors and not coords:
        raise SystemExit(f"subwayStationMaster {errors}")
    loc = {}
    for row in coords:
        lat = _float(row.get("LAT"))
        lng = _float(row.get("LOT"))
        name = (row.get("BLDN_NM") or "").strip()
        line = (row.get("ROUTE") or "").strip()
        if lat is None or lng is None or not name:
            continue
        loc[(line, name)] = (round(lat, 6), round(lng, 6))
    stations = []
    for row in flows:
        name = (row.get("STTN") or "").strip()
        line = (row.get("SBWY_ROUT_LN_NM") or "").strip()
        point = loc.get((line, name))
        if not point:
            continue
        stations.append(
            {
                "name": name,
                "line": line,
                "lat": point[0],
                "lng": point[1],
                "hours": hours_of(row),
            }
        )
    return {
        "generated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "month": month,
        "note": "월 시간대 승하차. 지금 칸 혼잡이 아닙니다.",
        "ok": len(stations),
        "stations": stations,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(ROOT / "data" / "metro.json"))
    args = parser.parse_args()
    payload = collect(load_key())
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"metro {payload['ok']} {payload['month']} -> {out}", flush=True)


if __name__ == "__main__":
    main()
