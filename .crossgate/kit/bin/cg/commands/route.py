import datetime as dt
import json
import sys
from cg.core import ROUTES, config, current_run, route_conf


def cmd_route(a):
    run = current_run(a.run, writing=True)
    f = run / "meta.json"
    meta = json.loads(f.read_text(encoding="utf-8"))
    order = list(ROUTES)
    old = "standard" if meta["route"] == "quick" else meta["route"]
    if order.index(a.route) <= order.index(old):
        sys.exit(f"등급은 올리기만 한다({old} → {a.route} 불가). 낮추려면 사용자 확인 뒤 새 실행을 만든다.")
    meta["route"] = a.route
    meta.setdefault("promoted", []).append({"from": old, "to": a.route, "ts": dt.datetime.now().isoformat(timespec="seconds")})
    f.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"등급 승격: {old} → {a.route}. 필수 단계: {', '.join(route_conf(config(), a.route)['stages'])}")


def register(subparsers):
    p = subparsers.add_parser("route"); p.add_argument("route", choices=list(ROUTES)); p.add_argument("--run")
    p.set_defaults(fn=cmd_route)
    p._crossgate_order = 3
