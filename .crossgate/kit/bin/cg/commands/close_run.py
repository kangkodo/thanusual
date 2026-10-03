import datetime as dt
import json
from cg.core import current_run


def cmd_close_run(a):
    run = current_run(a.run, writing=True, allow_closed=True)
    path = run / "meta.json"
    meta = json.loads(path.read_text(encoding="utf-8"))
    if a.reopen:
        if "closed" not in meta:
            print(f"닫혀 있지 않은 실행입니다: {run.name}")
            return
        del meta["closed"]
    else:
        if "closed" in meta:
            print(f"이미 닫힌 실행입니다: {run.name}")
            return
        meta["closed"] = dt.datetime.now().isoformat(timespec="seconds")
        meta["close_note"] = a.note
    path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{'다시 연' if a.reopen else '닫은'} 실행: {run.name}")


def register(subparsers):
    p = subparsers.add_parser("close-run")
    p.add_argument("--run"); p.add_argument("--note"); p.add_argument("--reopen", action="store_true")
    p.set_defaults(fn=cmd_close_run)
