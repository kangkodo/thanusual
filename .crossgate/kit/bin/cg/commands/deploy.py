import subprocess
import sys
from cg.core import config, root


def cmd_deploy(a):
    d = config().get("deploy") or sys.exit("config.deploy 가 없습니다.")
    subprocess.run(d["preview"], shell=True, cwd=root())
    if not a.yes:
        print("\n위 변경이 배포됩니다. 사용자 지시를 받은 뒤 --yes 로 실행합니다.")
        return
    sys.exit(subprocess.run(d["command"], shell=True, cwd=root()).returncode)


def register(subparsers):
    p = subparsers.add_parser("deploy"); p.add_argument("--yes", action="store_true"); p.set_defaults(fn=cmd_deploy)
    p._crossgate_order = 9
