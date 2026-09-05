#!/usr/bin/env python3
"""Ttareungi availability + TOPIS incidents. Same Seoul key. Never print the key."""
from __future__ import annotations

import argparse
import datetime
import json
from pathlib import Path

from seoul_api import fetch_all, fetch_xml_rows, load_key, tm5181_to_wgs84

KST = datetime.timezone(datetime.timedelta(hours=9))
ROOT = Path(__file__).resolve().parents[1]


def _float(value) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def bikes(key: str) -> list[dict]:
    rows, errors = fetch_all(key, "bikeList", cap=4000)
    if errors and not rows:
        print("bikeList", errors, flush=True)
    out = []
    for row in rows:
        lat = _float(row.get("stationLatitude"))
        lng = _float(row.get("stationLongitude"))
        if lat is None or lng is None:
            continue
        out.append(
            {
                "id": row.get("stationId"),
                "name": row.get("stationName"),
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "bikes": int(_float(row.get("parkingBikeTotCnt")) or 0),
                "share": int(_float(row.get("shared")) or 0),
            }
        )
    return out


def incidents(key: str) -> list[dict]:
    rows, err = fetch_xml_rows(key, "AccInfo", 1, 1000)
    if rows is None:
        print("AccInfo", err, flush=True)
        return []
    out = []
    for row in rows:
        x = _float(row.get("grs80tm_x"))
        y = _float(row.get("grs80tm_y"))
        if x is None or y is None:
            continue
        lat, lng = tm5181_to_wgs84(x, y)
        text = " ".join((row.get("acc_info") or "").split())
        out.append(
            {
                "id": row.get("acc_id"),
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "text": text[:180],
            }
        )
    return out


def collect(key: str) -> dict:
    now = datetime.datetime.now(KST).replace(tzinfo=None)
    bike_rows = bikes(key)
    acc_rows = incidents(key)
    return {
        "generated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "bikes": bike_rows,
        "incidents": acc_rows,
        "ok": len(bike_rows) + len(acc_rows),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(ROOT / "data" / "street.json"))
    args = parser.parse_args()
    payload = collect(load_key())
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(
        f"street bikes {len(payload['bikes'])} incidents {len(payload['incidents'])} -> {out}",
        flush=True,
    )


if __name__ == "__main__":
    main()
