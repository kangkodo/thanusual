#!/usr/bin/env python3
"""Keep 48 hours of actual Seoul snapshots on the data branch, independent of git history."""
from __future__ import annotations

import argparse
import datetime
import json
import os
import tempfile
from pathlib import Path

from collect import KST, parse_time

FIELDS = ("name", "mid", "min", "max", "level", "source_at")
RETENTION_HOURS = 48
# One frame per half hour. The source itself lags about 30 minutes, so 10-minute frames
# tripled the file for detail the data cannot show: 3.7MB against 1.2MB for the same span.
STEP_MINUTES = 30
MAX_FRAMES = RETENTION_HOURS * 60 // STEP_MINUTES


def bucket(dt: datetime.datetime) -> datetime.datetime:
    return dt.replace(minute=dt.minute // STEP_MINUTES * STEP_MINUTES, second=0, microsecond=0)


def update(timeline: dict, current: dict, now: datetime.datetime | None = None) -> dict:
    now = (now or datetime.datetime.now(KST)).astimezone(KST).replace(tzinfo=None)
    cutoff = now - datetime.timedelta(hours=RETENTION_HOURS)
    at = parse_time(current.get("source_at"))
    places = [
        {key: place.get(key) for key in FIELDS}
        for place in current.get("places", [])
        if place.get("state") == "fresh"
        and place.get("name")
        and parse_time(place.get("source_at")) is not None
        and isinstance(place.get("mid"), int)
    ]
    # Failed/empty collections must not replace a previously useful frame.
    if not places or at is None:
        return timeline
    frames = {}
    for frame in timeline.get("frames", []):
        dt = parse_time(frame.get("at"))
        if dt is not None and cutoff <= dt <= now and frame.get("places"):
            frames[bucket(dt)] = frame
    if cutoff <= at <= now:
        frames[bucket(at)] = {"at": current["source_at"], "places": places}
    return {
        "version": 1,
        "generated_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "frames": [frames[dt] for dt in sorted(frames)[-MAX_FRAMES:]],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--current", required=True)
    parser.add_argument("--timeline", required=True)
    args = parser.parse_args()
    path = Path(args.timeline)
    current = json.loads(Path(args.current).read_text(encoding="utf-8"))
    timeline = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    result = update(timeline, current)
    if result == timeline:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as stream:
            temp = Path(stream.name)
            json.dump(result, stream, ensure_ascii=False, separators=(",", ":"))
        os.replace(temp, path)
    finally:
        if temp is not None:
            temp.unlink(missing_ok=True)
    print(f"timeline frames {len(result['frames'])}", flush=True)


if __name__ == "__main__":
    main()
