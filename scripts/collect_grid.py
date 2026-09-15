#!/usr/bin/env python3
"""D-4 Seoul 250m population; official centers in vendor/seoul-grid.geojson."""
import argparse
import datetime
import json
import math
import os
import tempfile
import time
from pathlib import Path

from seoul_api import fetch_raw, load_key

ROOT = Path(__file__).resolve().parents[1]
SERVICE = 'Se250MSpopLocalResd'
SLICES = tuple(f'{h:02}' for h in range(0, 24, 3))
KST = datetime.timezone(datetime.timedelta(hours=9))


def number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) and n >= 0 else None
    except (ValueError, TypeError):
        return None


def collect(key, fetch=fetch_raw):
    slices = {tt: {} for tt in SLICES}
    day = None
    total = None
    start = 1
    seen = set()
    while total is None or start <= total:
        raw, err = fetch(key, SERVICE, start, start + 999)
        if err:
            raise ValueError(f'grid API failed: {err}')
        try:
            block = json.loads(raw)[SERVICE]
            count = int(block['list_total_count'])
            rows = block['row']
            assert block['RESULT']['CODE'] == 'INFO-000'
            assert 0 < count <= 500000
            assert len(rows) == min(1000, count - start + 1)
            assert total is None or count == total
        except (KeyError, TypeError, ValueError, AssertionError):
            raise ValueError('grid API incomplete or changed during pagination') from None
        total = count
        for row in rows:
            ymd = str(row.get('YMD', '')).strip()
            datetime.datetime.strptime(ymd, '%Y%m%d')
            if day is None:
                day = ymd
            if ymd != day:
                raise ValueError('grid API mixed observation dates')
            tt = str(row.get('TT', '')).strip().zfill(2)
            cell = str(row.get('CELL_ID', '')).strip()
            dong = str(row.get('H_DNG_CD', '')).strip()
            identity = (tt, cell, dong)
            if not cell or tt not in {f'{h:02}' for h in range(24)} or identity in seen:
                raise ValueError('grid API invalid or duplicated row')
            seen.add(identity)
            if tt not in slices:
                continue
            n = number(row.get('SPOP'))
            # A grid can cross administrative dongs. Suppressed parts stay unknown.
            if cell in slices[tt]:
                old = slices[tt][cell]
                n = old + n if old is not None and n is not None else None
            slices[tt][cell] = n
        start += len(rows)
        if start <= total:
            time.sleep(0.05)
    if not all(slices.values()):
        raise ValueError('grid missing required hourly slices')
    return {'ymd': day, 'generated_at': datetime.datetime.now(KST).isoformat(timespec='seconds'), 'slices': slices}


def write_snapshot(out, payload):
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    temp = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=out.parent, delete=False) as f:
            temp = Path(f.name)
            json.dump(payload, f, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
            f.flush()
            os.fsync(f.fileno())
        temp.replace(out)
    finally:
        if temp is not None:
            temp.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', default=str(ROOT / 'data' / 'grid.json'))
    args = parser.parse_args()
    try:
        payload = collect(load_key())
        write_snapshot(args.out, payload)
    except (ValueError, OSError) as exc:
        raise SystemExit(f'grid snapshot unchanged: {type(exc).__name__}') from None
    print(f"grid {payload['ymd']} {len(payload['slices'])} slices")


if __name__ == '__main__':
    main()
