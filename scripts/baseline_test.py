import json
import unittest

import baseline


def snap(at, mid, name="A", total=None):
    cur = {"generated_at": at + ":00", "places": [{"name": name, "state": "fresh", "mid": mid, "source_at": at}]}
    if total:
        cur["places"] += [{"name": f"P{i}", "state": "missing", "mid": None, "source_at": None} for i in range(total - 1)]
    return cur


def weeks(b, mondays, mids):
    """Three slots (19:05, 19:15, 19:25) per Monday, one 30-minute bin."""
    for day in mondays:
        for k, minute in enumerate(("05", "15", "25")):
            baseline.update(b, snap(f"2026-09-{day:02d} 19:{minute}", mids[k]))


class BaselineTest(unittest.TestCase):
    def test_usual_needs_two_past_weeks_of_the_same_30_minute_bin(self):
        b = {}
        weeks(b, [7], [1000, 1200, 1400])            # one past Monday: n=3, not shown
        cur = baseline.update(b, snap("2026-09-14 19:05", 1000))
        self.assertEqual(cur["places"][0]["usual"], {"n": 3, "mid": None})
        weeks(b, [14], [1000, 1200, 1400])           # second Monday completes the bin (19:05 already counted)
        cur = baseline.update(b, snap("2026-09-21 19:15", 9999))
        self.assertEqual(cur["places"][0]["usual"], {"n": 6, "mid": 1200})  # mean of two past weeks, not 9999

    def test_today_is_excluded_from_its_own_usual(self):
        b = {}
        weeks(b, [7, 14], [1000, 1000, 1000])
        baseline.update(b, snap("2026-09-21 19:05", 9000))
        cur = baseline.update(b, snap("2026-09-21 19:15", 9000))  # earlier 9000 today must not leak in
        self.assertEqual(cur["places"][0]["usual"], {"n": 6, "mid": 1000})

    def test_one_sample_per_slot_per_day(self):
        b = {}
        baseline.update(b, snap("2026-09-07 19:01", 1000))
        baseline.update(b, snap("2026-09-07 19:08", 5000))  # same slot, same day: not counted
        idx = baseline.slot_index(baseline.parse_time("2026-09-07 19:05"))
        self.assertEqual((b["places"]["A"]["n"][idx], b["places"]["A"]["sum"][idx]), (1, 1000))
        baseline.update(b, snap("2026-09-14 19:03", 2000))  # new day resets today
        self.assertEqual(b["places"]["A"]["today"], {str(idx): 2000})

    def test_migrates_version_1_entries(self):
        idx = baseline.slot_index(baseline.parse_time("2026-09-06 05:35"))  # same 05:30 bin as the new sample
        n = [0] * baseline.WEEK
        s = [0] * baseline.WEEK
        n[idx], s[idx] = 1, 7000
        b = {"version": 1, "places": {"A": {"n": n, "sum": s, "last": f"2026-09-06/{idx}", "last_mid": 7000}}}
        cur = baseline.update(b, snap("2026-09-06 05:45", 8000))
        e = b["places"]["A"]
        self.assertNotIn("last", e)
        self.assertEqual(e["today"], {str(idx): 7000, str(idx + 1): 8000})
        self.assertEqual(cur["places"][0]["usual"], {"n": 0, "mid": None})  # today's 7000 excluded

    def test_warming_flips_once_and_stays(self):
        b = {}
        weeks(b, [7, 14], [1000, 1000, 1000])
        cur = baseline.update(b, snap("2026-09-21 19:05", 1000, total=2))  # 1 of 2 ready = half
        self.assertFalse(cur["warming"])
        self.assertTrue(b["ready_since"])
        cur = baseline.update(b, snap("2026-09-21 03:05", 1000, total=2))  # a bin with no history
        self.assertEqual(cur["usual_ready"], 0)
        self.assertFalse(cur["warming"])

    def test_missing_or_zero_samples_are_skipped(self):
        b = {}
        cur = baseline.update(b, {"places": [
            {"name": "A", "state": "missing", "mid": None, "source_at": None},
            {"name": "B", "state": "fresh", "mid": 0, "source_at": "2026-09-07 19:05"},
        ]})
        self.assertEqual(b["places"], {})
        self.assertTrue(cur["warming"])
        self.assertIsNone(cur["places"][0]["usual"])

    def test_slot_index_and_size(self):
        self.assertEqual(baseline.slot_index(baseline.parse_time("2026-09-07 00:00")), 0)
        self.assertEqual(baseline.slot_index(baseline.parse_time("2026-09-13 23:59")), 6 * 144 + 143)
        b = {}
        baseline.update(b, {"places": [{"name": f"P{i}", "state": "fresh", "mid": 12345, "source_at": "2026-09-07 19:05"} for i in range(121)]})
        self.assertLess(len(json.dumps(b, separators=(",", ":"))), 1_400_000)


if __name__ == "__main__":
    unittest.main()
