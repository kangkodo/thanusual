#!/usr/bin/env python3
"""Run: python3 scripts/grid_test.py"""
import json
import tempfile
from pathlib import Path
from collect_grid import SERVICE, SLICES, collect, number, write_snapshot

assert number('*') is None and number('nan') is None and number(-1) is None
rows = [{'YMD': '20260908', 'TT': tt, 'CELL_ID': 'cell', 'H_DNG_CD': 'a', 'SPOP': '2.5'} for tt in SLICES]
rows += [{'YMD': '20260908', 'TT': '00', 'CELL_ID': 'cell', 'H_DNG_CD': 'b', 'SPOP': '*'}]
rows += [{'YMD': '20260908', 'TT': '03', 'CELL_ID': 'cell', 'H_DNG_CD': 'b', 'SPOP': '1'}]
rows += [{'YMD': '20260908', 'TT': '01', 'CELL_ID': f'filler{i}', 'H_DNG_CD': 'a', 'SPOP': '1'} for i in range(1000)]
calls = []

def fetch(key, service, start, end):
    calls.append(start)
    return json.dumps({SERVICE: {'RESULT': {'CODE': 'INFO-000'}, 'list_total_count': len(rows), 'row': rows[start-1:end]}}), None

p = collect('unused', fetch)
assert calls == [1, 1001]
assert p['ymd'] == '20260908' and p['slices']['00']['cell'] is None
assert p['slices']['03']['cell'] == 3.5
with tempfile.TemporaryDirectory() as d:
    out = Path(d) / 'grid.json'
    write_snapshot(out, p)
    before = out.read_bytes()
    rows.append(rows[0])
    try:
        write_snapshot(out, collect('unused', fetch))
        raise AssertionError('duplicate accepted')
    except ValueError:
        pass
    assert out.read_bytes() == before
    def broken_page(key, service, start, end):
        return (None, 'http-503') if start > 1 else fetch(key, service, start, end)
    try:
        write_snapshot(out, collect('unused', broken_page))
        raise AssertionError('partial download accepted')
    except ValueError:
        pass
    assert out.read_bytes() == before
    try:
        write_snapshot(out, {'bad': float('nan')})
        raise AssertionError('invalid JSON accepted')
    except ValueError:
        pass
    assert out.read_bytes() == before and len(list(Path(d).iterdir())) == 1
geometry = json.loads((Path(__file__).resolve().parents[1] / 'vendor/seoul-grid.geojson').read_text())
assert len(geometry['features']) == 10125
assert len({f['properties']['CELL_ID'] for f in geometry['features']}) == 10125
assert all(f['geometry']['type'] == 'Point' for f in geometry['features'])
print('grid tests PASS')
