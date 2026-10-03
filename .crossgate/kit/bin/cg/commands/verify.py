from cg.core import require_sealed


def cmd_verify(a):
    require_sealed()
    print("킷 봉인 유지: 설치 당시와 같음")


def register(subparsers):
    p = subparsers.add_parser("verify"); p.set_defaults(fn=cmd_verify)
    p._crossgate_order = 4
