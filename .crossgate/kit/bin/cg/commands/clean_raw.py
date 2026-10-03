import shutil
import time
from cg.core import config, root


def cmd_clean_raw(a):
    days = a.days or config().get("raw_retention_days", 30)
    cutoff = time.time() - days * 86400
    for run in (root() / "ai-log").glob("*/*/"):
        for sub in ("raw", "03-qa/captures"):
            d = run / sub
            if d.is_dir() and d.stat().st_mtime < cutoff:
                shutil.rmtree(d)
                print(f"삭제: {d.relative_to(root())}")


def register(subparsers):
    p = subparsers.add_parser("clean-raw"); p.add_argument("--days", type=int); p.set_defaults(fn=cmd_clean_raw)
    p._crossgate_order = 10
