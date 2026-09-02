#!/usr/bin/env python3
"""10-minute official citydata_ppltn loop for quota + baseline. Not the public Pages deploy."""
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COLLECT = ROOT / "scripts" / "collect.py"
HISTORY = Path("/Users/doyun/Documents/projects/12_ideas/collect/_mine/official_poll/history.jsonl")
OUT = Path("/Users/doyun/Documents/projects/12_ideas/collect/_mine/official_poll/current.json")
INTERVAL = 10 * 60

def run_once() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    return subprocess.call(
        [
            sys.executable,
            str(COLLECT),
            "--places",
            str(ROOT / "places.json"),
            "--out",
            str(OUT),
            "--history",
            str(HISTORY),
        ]
    )


if __name__ == "__main__":
    while True:
        t0 = time.time()
        code = run_once()
        print("cycle_exit", code, flush=True)
        time.sleep(max(0, INTERVAL - (time.time() - t0)))
