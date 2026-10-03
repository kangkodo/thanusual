import datetime as dt
import json
import re
import shutil
import sys
from cg.core import DIRS, KIT, ROUTES, config, git, recent_activity, root


def cmd_init_run(a):
    r, now = root(), dt.datetime.now()
    day = r / "ai-log" / now.strftime("%Y%m%d")
    day.mkdir(parents=True, exist_ok=True)
    n = len([d for d in day.iterdir() if d.is_dir()]) + 1
    slug = re.sub(r"[^\w-]+", "-", a.slug).strip("-")
    run = day / f"{n:03d}_{now:%H%M%S}_{slug}"
    for d in DIRS:
        (run / d).mkdir(parents=True)
    shutil.copy(KIT / "templates" / "request.md", run / "00-request" / "request.md")
    meta = {"slug": slug, "route": "standard" if a.quick else a.route,
            "branch": git("rev-parse", "--abbrev-ref", "HEAD", check=False, cwd=r) or None, "created": now.isoformat(timespec="seconds")}
    (run / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    cur = r / ".crossgate" / "current-run"
    prev = r / cur.read_text().strip() if cur.exists() else None
    if prev and prev.is_dir() and recent_activity(prev, config()):
        print(f"주의: 현재 실행 {prev.name}에 최근 활동이 있습니다. 다른 세션이 쓰는 중이면 그 세션의 기록이 "
              f"이 새 실행으로 섞입니다. 모든 명령에 --run 을 붙이세요.", file=sys.stderr)
    cur.write_text(str(run.relative_to(r)))
    print(run.relative_to(r))


def register(subparsers):
    p = subparsers.add_parser("init-run"); p.add_argument("slug"); p.add_argument("--route", choices=list(ROUTES), default="full")
    p.add_argument("--quick", action="store_true", help="0.4 이하 호환: --route standard")
    p.set_defaults(fn=cmd_init_run)
    p._crossgate_order = 0
