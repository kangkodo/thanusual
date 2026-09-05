#!/usr/bin/env python3
"""Fetch citydata_ppltn for 121 places. Key from SEOUL_API_KEY or secrets/seoul.env. Never print the key."""
from __future__ import annotations

import argparse
import collections
import datetime
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from seoul_api import UA, load_key

ROOT = Path(__file__).resolve().parents[1]


def parse_time(value: str | None) -> datetime.datetime | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def mid(lo, hi) -> int | None:
    try:
        return int((int(lo) + int(hi)) / 2)
    except (TypeError, ValueError):
        return None


def forecast_at(row: dict, source: datetime.datetime | None, hours: int) -> dict | None:
    items = row.get("FCST_PPLTN") or []
    if not items or source is None:
        return None
    target = source + datetime.timedelta(hours=hours)
    best = None
    best_dt = None
    for item in items:
        t = parse_time(item.get("FCST_TIME"))
        if t is None:
            continue
        if best is None or abs((t - target).total_seconds()) < abs((best_dt - target).total_seconds()):
            best, best_dt = item, t
    if best is None:
        return None
    return {
        "at": best.get("FCST_TIME"),
        "level": best.get("FCST_CONGEST_LVL"),
        "min": _int(best.get("FCST_PPLTN_MIN")),
        "max": _int(best.get("FCST_PPLTN_MAX")),
        "mid": mid(best.get("FCST_PPLTN_MIN"), best.get("FCST_PPLTN_MAX")),
    }


def _int(value) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def fetch_place(key: str, name: str) -> tuple[dict | None, str | None]:
    url = (
        "http://openapi.seoul.go.kr:8088/"
        f"{key}/json/citydata_ppltn/1/5/{urllib.parse.quote(name)}"
    )
    try:
        raw = urllib.request.urlopen(
            urllib.request.Request(url, headers=UA), timeout=10
        ).read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return None, f"http-{e.code}"
    except Exception as e:
        return None, type(e).__name__
    raw = raw.replace(key, "")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None, "not-json"
    result = payload.get("RESULT") or payload.get("result")
    if isinstance(result, dict) and str(result.get("RESULT.CODE") or result.get("CODE") or "") not in (
        "",
        "INFO-000",
    ):
        return None, str(result.get("RESULT.CODE") or result.get("CODE"))
    block = payload.get("SeoulRtd.citydata_ppltn") or payload.get("citydata_ppltn")
    if not block:
        return None, "empty"
    return block[0], None


KST = datetime.timezone(datetime.timedelta(hours=9))
BUDGET_S = 420  # poll.sh kills the cycle at 8 min; stop early so a slow API yields a partial file, not nothing


def collect(places: list[dict], key: str) -> dict:
    now = datetime.datetime.now(KST).replace(tzinfo=None)
    out_places = []
    errors = []
    t0 = time.monotonic()
    for i, place in enumerate(places):
        name = place["name"]
        row = None
        err = "budget"
        if time.monotonic() - t0 < BUDGET_S:
            for _ in range(2):
                row, err = fetch_place(key, name)
                if row is not None:
                    break
                time.sleep(0.6)
        if row is None:
            errors.append({"name": name, "error": err})
            out_places.append(
                {
                    **place,
                    "state": "missing",
                    "level": None,
                    "min": None,
                    "max": None,
                    "mid": None,
                    "source_at": None,
                    "forecast_2h": None,
                }
            )
        else:
            source_at = row.get("PPLTN_TIME")
            source_dt = parse_time(source_at)
            out_places.append(
                {
                    **place,
                    "state": "fresh",
                    "level": row.get("AREA_CONGEST_LVL"),
                    "min": _int(row.get("AREA_PPLTN_MIN")),
                    "max": _int(row.get("AREA_PPLTN_MAX")),
                    "mid": mid(row.get("AREA_PPLTN_MIN"), row.get("AREA_PPLTN_MAX")),
                    "source_at": source_at,
                    "forecast_2h": forecast_at(row, source_dt, 2),
                }
            )
        if i + 1 < len(places) and err != "budget":
            time.sleep(0.3)
        if (i + 1) % 20 == 0:
            print(f"progress {i + 1}/{len(places)} ok {sum(p['state']=='fresh' for p in out_places)}", flush=True)
    ok = sum(p["state"] == "fresh" for p in out_places)
    times = [p["source_at"] for p in out_places if p.get("source_at")]
    return {
        "generated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "source_at": max(times) if times else None,
        "ok": ok,
        "total": len(places),
        "warming": True,
        "errors": errors,
        "places": out_places,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--places", default=str(ROOT / "places.json"))
    parser.add_argument("--out", default=str(ROOT / "data" / "current.json"))
    parser.add_argument("--history", default="")
    args = parser.parse_args()
    places = json.loads(Path(args.places).read_text(encoding="utf-8"))
    key = load_key()
    payload = collect(places, key)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    if args.history:
        hist = Path(args.history)
        hist.parent.mkdir(parents=True, exist_ok=True)
        with hist.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"ok {payload['ok']}/{payload['total']} source_at {payload['source_at']} -> {out}", flush=True)
    if payload["errors"]:
        codes = collections.Counter(e["error"] for e in payload["errors"])
        print("errors", len(payload["errors"]), dict(codes), [e["name"] for e in payload["errors"][:6]], flush=True)
    if payload["ok"] * 2 < payload["total"]:
        # A mostly empty snapshot must not replace the last good one (the site went blank on 2026-09-05).
        print("too few places, not publishing", flush=True)
        raise SystemExit(3)


if __name__ == "__main__":
    main()
