import json
import unittest

import baseline


def snap(at, mid, name="A"):
    return {"places": [{"name": name, "state": "fresh", "mid": mid, "source_at": at}]}


class BaselineTest(unittest.TestCase):
    def test_usual_needs_three_past_weeks_and_excludes_itself(self):
        b = {}
        # 2026-09-07 is a Monday. Same weekday, same 10-minute slot, four weeks running.
        for week, mid in enumerate([1000, 1200, 1400, 9999]):
            day = 7 + 7 * week
            cur = baseline.update(b, snap(f"2026-09-{day:02d} 19:05", mid))
            usual = cur["places"][0]["usual"]
            if week < 3:
                self.assertIsNone(usual["mid"])
                self.assertEqual(usual["n"], week)
            else:
                self.assertEqual(usual, {"n": 3, "mid": 1200})  # mean of the three past weeks, not of 9999
                self.assertFalse(cur["warming"])

    def test_one_sample_per_slot_per_day(self):
        b = {}
        for day in (7, 14, 21):
            baseline.update(b, snap(f"2026-09-{day:02d} 19:05", 1000))
        baseline.update(b, snap("2026-09-28 19:01", 1000))
        cur = baseline.update(b, snap("2026-09-28 19:08", 5000))  # same slot, same day: not counted
        idx = baseline.slot_index(baseline.parse_time("2026-09-28 19:05"))
        self.assertEqual(b["places"]["A"]["n"][idx], 4)
        self.assertEqual(b["places"]["A"]["sum"][idx], 4000)
        self.assertEqual(cur["places"][0]["usual"], {"n": 3, "mid": 1000})  # past weeks only, today excluded

    def test_missing_or_zero_samples_are_skipped(self):
        b = {}
        cur = baseline.update(b, {"places": [
            {"name": "A", "state": "missing", "mid": None, "source_at": None},
            {"name": "B", "state": "fresh", "mid": 0, "source_at": "2026-09-07 19:05"},
        ]})
        self.assertEqual(b["places"], {})
        self.assertTrue(cur["warming"])
        self.assertIsNone(cur["places"][0]["usual"])

    def test_slot_index_uses_weekday_and_ten_minutes(self):
        self.assertEqual(baseline.slot_index(baseline.parse_time("2026-09-07 00:00")), 0)
        self.assertEqual(baseline.slot_index(baseline.parse_time("2026-09-13 23:59")), 6 * 144 + 143)

    def test_file_size_stays_small(self):
        b = {}
        cur = {"places": [{"name": f"P{i}", "state": "fresh", "mid": 12345, "source_at": "2026-09-07 19:05"} for i in range(121)]}
        baseline.update(b, cur)
        self.assertLess(len(json.dumps(b, separators=(",", ":"))), 1_400_000)


if __name__ == "__main__":
    unittest.main()
