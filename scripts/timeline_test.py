#!/usr/bin/env python3
"""Run with python scripts/timeline_test.py; uses synthetic inputs, no API calls."""
import datetime
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from collect import KST, collect, forecast_at, forecasts, parse_time
from timeline import update
from unittest.mock import patch


def check():
    now = datetime.datetime(2026, 9, 13, 12, tzinfo=KST)
    stamp = lambda dt: dt.strftime("%Y-%m-%d %H:%M:%S")
    place = {"name": "테스트", "state": "fresh", "source_at": stamp(now),
             "mid": 150, "min": 100, "max": 200, "level": "여유"}
    current = {"source_at": stamp(now), "places": [place, {"name": "누락", "state": "missing"}]}
    result = update({}, current, now)
    assert len(result["frames"]) == 1 and len(result["frames"][0]["places"]) == 1
    assert "state" not in result["frames"][0]["places"][0]
    place["mid"] = 160
    result = update(result, current, now)
    assert len(result["frames"]) == 1 and result["frames"][0]["places"][0]["mid"] == 160
    # Different timestamp precision still represents the same observation time.
    current["source_at"] = "2026-09-13 12:00"
    assert len(update(result, current, now)["frames"]) == 1
    for empty in ({}, {"source_at": stamp(now), "places": []},
                  {"source_at": stamp(now), "places": [{"state": "missing"}]},
                  {"source_at": "bad", "places": [place]}):
        assert update(result, empty, now) == result
    frames = [{"at": stamp(now - datetime.timedelta(minutes=i * 10)), "places": [place]}
              for i in range(310)]
    result = update({"frames": frames}, current, now)
    assert len(result["frames"]) == 288
    assert all(parse_time(f["at"]) >= now.replace(tzinfo=None) - datetime.timedelta(hours=48)
               for f in result["frames"])
    assert [parse_time(f["at"]) for f in result["frames"]] == sorted(parse_time(f["at"]) for f in result["frames"])

    row = {"FCST_PPLTN": [
        {"FCST_TIME": "2026-09-13 15:00", "FCST_PPLTN_MIN": "200", "FCST_PPLTN_MAX": "400", "FCST_CONGEST_LVL": "보통"},
        {"FCST_TIME": "bad"},
        {"FCST_TIME": "2026-09-13 14:00", "FCST_PPLTN_MIN": "100", "FCST_PPLTN_MAX": "200", "FCST_CONGEST_LVL": "여유"},
    ]}
    values = forecasts(row)
    assert len(values) == 2 and values[0]["mid"] == 150
    assert set(values[0]) == {"at", "mid", "min", "max", "level"}
    assert forecast_at(row, now.replace(tzinfo=None), 2) == values[0]
    assert forecasts({}) == [] and forecast_at(row, None, 2) is None
    with patch("collect.fetch_place", return_value=(dict(row, PPLTN_TIME=stamp(now)), None)):
        assert collect([{"name": "테스트"}], "unused")["places"][0]["forecasts"] == values
    with patch("collect.fetch_place", return_value=(None, "empty")), patch("collect.time.sleep"):
        missing = collect([{"name": "테스트"}], "unused")["places"][0]
        assert missing["forecasts"] == [] and missing["forecast_2h"] is None

    # Exercise atomic CLI persistence and keep the previous bytes on empty input.
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        source, output = root / "current.json", root / "timeline.json"
        actual = stamp(datetime.datetime.now(KST))
        source.write_text(json.dumps({"source_at": actual, "places": [dict(place, source_at=actual)]}))
        command = [sys.executable, str(Path(__file__).with_name("timeline.py")),
                   "--current", str(source), "--timeline", str(output)]
        subprocess.run(command, check=True)
        before = output.read_bytes()
        assert len(json.loads(before)["frames"]) == 1
        source.write_text('{"places":[]}')
        subprocess.run(command, check=True)
        assert output.read_bytes() == before
        assert sorted(p.name for p in root.iterdir()) == ["current.json", "timeline.json"]
    print("PASS timeline retention, dedup, missing, forecasts, atomic persistence")


class TimelineTest(unittest.TestCase):
    def test_timeline_pipeline(self):
        check()


if __name__ == "__main__":
    unittest.main()
