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


SLICES = ("00", "03", "06", "09", "12", "15", "18", "21")


def pick_day(key: str, now: datetime.datetime) -> tuple[str | None, dict[str, list[dict]]]:
    """Newest published day (4 to 11 days back) with its 3-hour slices, so the map can show this time of day."""
    for delta in range(4, 12):
        ymd = (now.date() - datetime.timedelta(days=delta)).strftime("%Y%m%d")
        slices: dict[str, list[dict]] = {}
        for tt in SLICES:
            rows, err = fetch_rows(key, "Spop250mLocalResdDong", 1, 1000, ymd, tt)
            if rows:
                slices[tt] = rows
            elif err not in ("INFO-200", "empty"):
                print(f"living skip {ymd}/{tt} {err}", flush=True)
        if slices:
            return ymd, slices
    return None, {}


def collect(key: str) -> dict:
    now = datetime.datetime.now(KST).replace(tzinfo=None)
    ymd, raw = pick_day(key, now)
    if not raw:
        raise SystemExit("living population slice not published yet")
    slices: dict[str, dict[str, int]] = {}
    for tt, rows in raw.items():
        pops: dict[str, int] = {}
        for row in rows:
            code = dong_code(row.get("H_DNG_CD"))
            spop = _num(row.get("SPOP"))
            if len(code) != 8 or spop is None:
                continue
            pops[code] = round(spop)
        if pops:
            slices[tt] = pops
    if not slices:
        raise SystemExit("living slices had no usable rows")
    # Older clients read one slice (tt + dongs): give them the one nearest the collection hour.
    near = f"{(now.hour // 3) * 3:02d}"
    tt = near if near in slices else sorted(slices)[0]
    dongs = [{"code": code, "spop": spop} for code, spop in slices[tt].items()]
    return {
        "generated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "ymd": ymd,
        "tt": tt,
        "ok": len(dongs),
        "dongs": dongs,
        "slices": slices,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(ROOT / "data" / "living.json"))
    args = parser.parse_args()
    payload = collect(load_key())
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"living {payload['ok']} {payload['ymd']} slices {sorted(payload['slices'])} -> {out}", flush=True)


if __name__ == "__main__":
    main()
