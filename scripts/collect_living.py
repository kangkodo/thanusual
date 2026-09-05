#!/usr/bin/env python3
"""Daily 행정동 생활인구 snapshot. Same Seoul key as citydata_ppltn. Never print the key."""
from __future__ import annotations

import argparse
import datetime
import json
from pathlib import Path

from seoul_api import fetch_rows, load_key

KST = datetime.timezone(datetime.timedelta(hours=9))
ROOT = Path(__file__).resolve().parents[1]


def _num(value) -> float | None:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    return n if n >= 0 else None


def dong_code(value: str | None) -> str:
    return str(value or "").strip()[:8]


def pick_slice(key: str, now: datetime.datetime) -> tuple[list[dict], str, str] | tuple[None, None, None]:
    hour = f"{now.hour:02d}"
    for delta in range(4, 12):
        ymd = (now.date() - datetime.timedelta(days=delta)).strftime("%Y%m%d")
        for tt in (hour, "12", "18", "00"):
            rows, err = fetch_rows(key, "Spop250mLocalResdDong", 1, 1000, ymd, tt)
            if rows:
                return rows, ymd, tt
            if err not in ("INFO-200", "empty"):
                print(f"living skip {ymd}/{tt} {err}", flush=True)
    return None, None, None


def collect(key: str) -> dict:
    now = datetime.datetime.now(KST).replace(tzinfo=None)
    rows, ymd, tt = pick_slice(key, now)
    if not rows:
        raise SystemExit("living population slice not published yet")
    dongs = []
    for row in rows:
        code = dong_code(row.get("H_DNG_CD"))
        spop = _num(row.get("SPOP"))
        if len(code) != 8 or spop is None:
            continue
        dongs.append({"code": code, "spop": round(spop)})
    return {
        "generated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "ymd": ymd,
        "tt": tt,
        "lag": "4일 전 이 시각 전후",
        "ok": len(dongs),
        "dongs": dongs,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(ROOT / "data" / "living.json"))
    args = parser.parse_args()
    payload = collect(load_key())
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"living {payload['ok']} {payload['ymd']} {payload['tt']} -> {out}", flush=True)


if __name__ == "__main__":
    main()
