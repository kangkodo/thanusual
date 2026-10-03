import sys
from cg.core import config, is_pm, repo_dir, require_sealed, root
from cg.gatelib import protected_changes, run_gates


def cmd_gate(a):
    require_sealed()
    cfg, r = config(), root()
    repo = repo_dir(cfg, a.repo)
    if is_pm(cfg) and not repo:
        sys.exit("PM 모드의 gate 는 --repo 가 필요합니다.")
    rc, cwd = (cfg["repos"][a.repo], repo) if repo else (cfg, r)
    failed = []
    if a.protect_since:
        hit = protected_changes(a.protect_since, rc, cwd)
        if hit:
            failed.append("보호 경로 변경: " + ", ".join(hit))
    failed.extend(run_gates(rc, cwd))
    if failed:
        sys.exit("gate 실패: " + " / ".join(failed))
    print("gate 통과")


def register(subparsers):
    p = subparsers.add_parser("gate"); p.add_argument("--protect-since"); p.add_argument("--repo"); p.set_defaults(fn=cmd_gate)
    p._crossgate_order = 5
