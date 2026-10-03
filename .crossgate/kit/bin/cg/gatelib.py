import subprocess
from cg.core import git, match


TODO_FILE = "ai-log/*/01-planning/todo.md"
USAGE_FILE = "ai-log/*/usage.jsonl"


def appended_only(ref, path):
    """파이프라인 CLI가 쓰는 사용량 기록처럼, 기존 줄은 그대로 두고 줄만 덧붙였는지."""
    diff = git("diff", "-U0", ref, "--", path, strip=False).splitlines()
    body = [l for l in diff if l[:1] in "+-" and not l.startswith(("+++", "---"))]
    return all(l.startswith("+") for l in body)


def todo_checks_only(ref, path):
    """개발 역할이 todo.md에서 체크([ ]→[x])와 '완료 근거:' 줄만 바꿨는지."""
    diff = git("diff", "-U0", ref, "--", path, strip=False).splitlines()
    lines = [l for l in diff if l[:1] in "+-" and not l.startswith(("+++", "---"))]
    minus = [l[1:] for l in lines if l.startswith("-")]
    plus = [l[1:] for l in lines if l.startswith("+")]
    if any(m.replace("- [ ]", "- [x]", 1) not in plus for m in minus):
        return False
    return all(p.replace("- [x]", "- [ ]", 1) in minus or p.strip().startswith("완료 근거:") for p in plus)


def protected_changes(ref, cfg, cwd=None):
    """보호 경로 변경 목록. TODO 체크와 사용량 덧붙이기는 허용한다."""
    changed = set(git("diff", "--name-only", ref, cwd=cwd).splitlines())
    changed |= set(git("ls-files", "--others", "--exclude-standard", cwd=cwd).splitlines())
    return sorted(f for f in changed if match(f, cfg.get("protected", []))
                  and not (match(f, [TODO_FILE]) and todo_checks_only(ref, f))
                  and not (match(f, [USAGE_FILE]) and appended_only(ref, f)))


def run_gates(cfg, cwd):
    """설정의 검사 명령을 모두 실행하고 실패한 이름을 돌려준다."""
    failed = []
    # config는 보호 경로이며, 명령은 package.json 스크립트와 같은 신뢰 수준이다.
    for g in cfg.get("gate", []):
        print(f"▶ {g['name']}: {g['run']}", flush=True)
        if subprocess.run(g["run"], shell=True, cwd=cwd).returncode:
            failed.append(g["name"])
    return failed
