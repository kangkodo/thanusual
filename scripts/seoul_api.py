#!/usr/bin/env python3
"""Seoul Open Data Plaza client. Key from SEOUL_API_KEY or secrets/seoul.env. Never print the key."""
from __future__ import annotations

import json
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UA = {"User-Agent": "thanusual/0.1 (https://thanusual.pages.dev)"}
BASE = "http://openapi.seoul.go.kr:8088"


def load_key() -> str:
    env = os.environ.get("SEOUL_API_KEY", "").strip().strip('"').strip("'")
    if env:
        return env
    for path in (
        ROOT.parent / "secrets" / "seoul.env",
        ROOT / "secrets" / "seoul.env",
        Path.home() / ".config" / "thanusual" / "seoul.env",
    ):
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            if k.strip() == "SEOUL_API_KEY":
                val = v.strip().strip('"').strip("'")
                if val:
                    return val
    raise SystemExit("SEOUL_API_KEY missing")


def _url(key: str, fmt: str, service: str, start: int, end: int, parts: tuple[str, ...]) -> str:
    tail = "/".join(
        [urllib.parse.quote(str(p), safe="") for p in (key, fmt, service, start, end, *parts)]
    )
    return f"{BASE}/{tail}"


def _scrub(text: str, key: str) -> str:
    return text.replace(key, "") if key else text


def fetch_raw(key: str, service: str, start: int, end: int, *parts: str, fmt: str = "json") -> tuple[str | None, str | None]:
    url = _url(key, fmt, service, start, end, parts)
    try:
        raw = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25).read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return None, f"http-{e.code}"
    except Exception as e:
        return None, type(e).__name__
    return _scrub(raw, key), None


def _result_code(payload: dict) -> str:
    result = payload.get("RESULT") or payload.get("result")
    if isinstance(result, dict):
        return str(result.get("RESULT.CODE") or result.get("CODE") or "")
    for value in payload.values():
        if isinstance(value, dict) and isinstance(value.get("RESULT"), dict):
            return str(value["RESULT"].get("CODE") or "")
    return ""


def fetch_rows(key: str, service: str, start: int, end: int, *parts: str) -> tuple[list[dict] | None, str | None]:
    raw, err = fetch_raw(key, service, start, end, *parts, fmt="json")
    if raw is None:
        return None, err
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return None, "not-json"
    code = _result_code(payload)
    if code and code not in ("INFO-000",):
        return None, code
    block = payload.get(service)
    if isinstance(block, dict) and isinstance(block.get("row"), list):
        return block["row"], None
    if service == "bikeList":
        rows = (payload.get("rentBikeStatus") or {}).get("row")
        if isinstance(rows, list):
            return rows, None
    return None, "empty"


def fetch_all(key: str, service: str, *parts: str, page: int = 1000, cap: int = 20_000) -> tuple[list[dict], list[str]]:
    rows: list[dict] = []
    errors: list[str] = []
    start = 1
    while start <= cap:
        end = min(start + page - 1, cap)
        chunk, err = fetch_rows(key, service, start, end, *parts)
        if chunk is None:
            if err in ("INFO-200", "empty") and rows:
                break
            errors.append(err or "empty")
            break
        rows.extend(chunk)
        if len(chunk) < page:
            break
        start = end + 1
        time.sleep(0.2)
    return rows, errors


def fetch_xml_rows(key: str, service: str, start: int, end: int, *parts: str) -> tuple[list[dict] | None, str | None]:
    raw, err = fetch_raw(key, service, start, end, *parts, fmt="xml")
    if raw is None:
        return None, err
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        return None, "not-xml"
    code = ""
    result = root.find("RESULT")
    if result is not None and result.findtext("CODE"):
        code = result.findtext("CODE") or ""
    if code and code not in ("INFO-000",):
        return None, code
    rows = []
    for node in root.findall("row"):
        rows.append({child.tag: (child.text or "") for child in node})
    if not rows:
        return None, "empty"
    return rows, None


def _meridional(phi: float, a: float, e2: float) -> float:
    e4 = e2 * e2
    e6 = e4 * e2
    return a * (
        (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * phi
        - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * math.sin(2 * phi)
        + (15 * e4 / 256 + 45 * e6 / 1024) * math.sin(4 * phi)
        - (35 * e6 / 3072) * math.sin(6 * phi)
    )


def tm5181_to_wgs84(easting: float, northing: float) -> tuple[float, float]:
    """EPSG:5181 (Korea 2000 / Central Belt 2010) to WGS84 lat, lng."""
    a = 6378137.0
    f = 1 / 298.257222101
    e2 = f * (2 - f)
    e4 = e2 * e2
    e6 = e4 * e2
    lon0 = math.radians(127.0)
    lat0 = math.radians(38.0)
    k0 = 1.0
    x = easting - 200000.0
    m = _meridional(lat0, a, e2) + (northing - 500000.0) / k0
    mu = m / (a * (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    fp = (
        mu
        + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
        + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
        + (151 * e1**3 / 96) * math.sin(6 * mu)
        + (1097 * e1**4 / 512) * math.sin(8 * mu)
    )
    e_2 = e2 / (1 - e2)
    sin_fp = math.sin(fp)
    cos_fp = math.cos(fp)
    tan_fp = math.tan(fp)
    n1 = a / math.sqrt(1 - e2 * sin_fp**2)
    r1 = a * (1 - e2) / (1 - e2 * sin_fp**2) ** 1.5
    c1 = e_2 * cos_fp**2
    t1 = tan_fp**2
    d = x / (n1 * k0)
    lat = fp - (n1 * tan_fp / r1) * (
        d**2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * e_2) * d**4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * e_2 - 3 * c1**2) * d**6 / 720
    )
    lon = lon0 + (
        d
        - (1 + 2 * t1 + c1) * d**3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * e_2 + 24 * t1**2) * d**5 / 120
    ) / cos_fp
    return math.degrees(lat), math.degrees(lon)
