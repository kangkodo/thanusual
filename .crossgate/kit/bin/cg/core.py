import fnmatch
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path


KIT = Path(__file__).resolve().parents[2]
DIRS = ["00-request", "01-planning", "02-development", "03-qa", "04-wiki", "raw"]
VERDICTS = ["READY", "APPROVED", "REJECTED", "BLOCKED", "PASSED", "FAILED", "ESCALATED"]
LABEL = {"READY": "READY", "APPROVED": "승인", "REJECTED": "반려", "BLOCKED": "BLOCKED",
         "PASSED": "PASSED", "FAILED": "FAILED", "ESCALATED": "사람 조정 요청"}
REVIEW = {"APPROVED", "REJECTED", "PASSED", "FAILED", "BLOCKED"}
READ_ONLY_ROLES = {"request-reviewer", "plan-reviewer", "wiki-reviewer", "dev-reviewer"}
# 작업 등급: CROSSGATE.md 10장.
ROUTES = {"light": {"stages": ["request", "dev"], "effort": {"developer": "low", "dev-reviewer": "low"}},
          "standard": {"stages": ["request", "dev"]},
          "full": {"stages": ["request", "plan", "dev", "qa", "wiki"]}}
WRITE_ROLES = {"developer", "qa"}
# ponytail: 정규식 마스킹이라 형식이 특이한 비밀은 놓칠 수 있다. 누락이 나오면 패턴을 늘리거나 gitleaks로 바꾼다.
SECRET = re.compile(
    r"(?i)((?:api[_-]?key|token|secret|password|passwd|authorization)[\"']?\s*[:=]\s*[\"']?(?:bearer\s+)?)([^\s\"',]{6,})"
    r"|\b(sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})")
MANIFEST = "MANIFEST.sha256"
SKIP = {MANIFEST, ".DS_Store"}
RECENT_MIN = 60


def mask(text):
    return SECRET.sub(lambda m: m.group(1) + "***" if m.group(1) else "***", text)


def git(*args, check=True, strip=True, cwd=None):
    # quotepath=false: 한글 경로를 이스케이프하지 않아야 경로 비교가 맞는다
    r = subprocess.run(["git", "-c", "core.quotepath=false", *args], capture_output=True, text=True, cwd=cwd)
    if check and r.returncode:
        sys.exit(f"git {' '.join(args)} 실패: {r.stderr.strip()}")
    return r.stdout.strip() if strip else r.stdout


def root():
    # 설치된 킷(<루트>/.crossgate/kit)은 자기 루트를 안다. git이 아닌 작업공간 루트도 이것으로 찾는다.
    if KIT.parent.name == ".crossgate":
        return KIT.parent.parent
    return Path(git("rev-parse", "--show-toplevel"))


def match(path, patterns):
    # fnmatch의 *는 /도 넘는다. 그래서 "docs/**"는 하위 전체, "*.md"는 모든 깊이의 md에 맞는다.
    return any(fnmatch.fnmatch(path, p) for p in patterns)


def kit_files(base):
    return sorted(str(p.relative_to(base)) for p in base.rglob("*")
                  if p.is_file() and p.name not in SKIP and "__pycache__" not in p.parts)


def verify_kit(base=KIT):
    """설치된 킷 복사본이 설치 당시 그대로인지. 문제 목록을 돌려준다(빈 목록 = 봉인 유지). 봉인 파일은 install.sh가 쓴다."""
    m = base / MANIFEST
    if not m.exists():
        return [f"{MANIFEST} 없음 (install.sh로 다시 설치하세요)"]
    want = {}
    for line in m.read_text(encoding="utf-8").splitlines():
        if line and not line.startswith("#"):
            digest, name = line.split("  ", 1)
            want[name] = digest
    problems = []
    for name in kit_files(base):
        if name not in want:
            problems.append(f"추가됨: {name}")
        elif hashlib.sha256((base / name).read_bytes()).hexdigest() != want.pop(name):
            problems.append(f"변경됨: {name}")
    problems += [f"삭제됨: {name}" for name in want]
    return problems


def require_sealed():
    problems = verify_kit()
    if problems:
        sys.exit("킷 복사본이 원본과 다릅니다. 프로젝트에서 킷을 고치지 말고 원본에서 고쳐 다시 설치하세요.\n  "
                 + "\n  ".join(problems[:10]))


def config():
    p = root() / ".crossgate" / "config.json"
    if not p.exists():
        sys.exit(".crossgate/config.json 이 없습니다. 킷의 install.sh 로 설치하세요.")
    cfg = json.loads(p.read_text(encoding="utf-8"))
    kv = (KIT / "VERSION").read_text().strip() if (KIT / "VERSION").exists() else "?"
    if cfg.get("kit_version") != kv:
        print(f"경고: config kit_version={cfg.get('kit_version')} / 설치된 킷 {kv}", file=sys.stderr)
    return cfg


def route_conf(cfg, route):
    """등급 설정: 기본값 위에 config.routes 를 덮는다. 0.4 이하 설정(required_stages·quick_stages)과 옛 실행의 "quick"도 읽는다."""
    route = "standard" if route == "quick" else route
    r = {**ROUTES[route], **cfg.get("routes", {}).get(route, {})}
    legacy = {"full": "required_stages", "standard": "quick_stages"}.get(route)
    if "routes" not in cfg and legacy in cfg:
        r["stages"] = cfg[legacy]
    return r


def effort_for(cfg, run, role, engine, override=None):
    """추론 강도: --effort > 이번 실행 등급의 effort > 엔진 설정의 역할별 값 > 엔진 기본값."""
    route = json.loads((run / "meta.json").read_text(encoding="utf-8")).get("route", "full")
    e = cfg.get(engine, {})
    return (override or route_conf(cfg, route).get("effort", {}).get(role)
            or e.get("effort", {}).get(role) or e.get("default_effort"))


def is_pm(cfg):
    return cfg.get("mode") == "pm"


def repo_dir(cfg, name):
    """PM 모드에서 --repo 로 고른 저장소 폴더. 이름이 없으면 None."""
    if not name:
        return None
    rc = cfg.get("repos", {}).get(name)
    if rc is None:
        sys.exit(f"config.repos 에 없는 저장소: {name}")
    d = root() / rc.get("path", name)
    if not (d / ".git").exists():
        sys.exit(f"git 저장소가 아닙니다: {d}")
    return d


def recent_activity(run, cfg):
    """실행 기록 세 파일 중 하나가 최근에 바뀌었는지."""
    cutoff = time.time() - cfg.get("recent_minutes", RECENT_MIN) * 60
    return any(p.exists() and p.stat().st_mtime >= cutoff
               for p in (run / name for name in ("meta.json", "verdicts.jsonl", "usage.jsonl")))


def run_state(run, cfg):
    """옛 실행도 같은 기준으로 열림·끝남·닫힘을 판정한다."""
    meta = json.loads((run / "meta.json").read_text(encoding="utf-8"))
    if "closed" in meta:
        return "닫힘"
    recs = load(run)
    for stage in route_conf(cfg, meta.get("route", "full"))["stages"]:
        latest = {}
        for rec in recs:
            if rec["stage"] == stage:
                latest[rec.get("repo")] = rec["verdict"]
        expected = "PASSED" if stage == "qa" else "APPROVED"
        if not latest or any(v != expected for v in latest.values()):
            return "열림"
    return "끝남"


def current_run(arg=None, writing=False, *, allow_closed=False):
    """명시 인자 → 환경 변수 → 현재 실행. 묶기 검사는 이 함수에서만 한다.

    allow_closed는 닫기·다시 열기 명령만 사용한다. 최근 실행 묶기 검사는 그대로 한다.
    """
    env = os.environ.get("CROSSGATE_RUN")
    implicit = not arg and not env
    if arg:
        run = Path(arg).resolve()
    elif env:
        run = (root() / env).resolve()
    else:
        p = root() / ".crossgate" / "current-run"
        if not p.exists():
            sys.exit("현재 실행이 없습니다. crossgate init-run 을 먼저 실행하세요.")
        run = root() / p.read_text().strip()
    cfg = config()
    if writing and not allow_closed and run_state(run, cfg) == "닫힘":
        message = "닫힌 실행에는 쓸 수 없습니다. close-run --reopen 으로 다시 여세요."
        if implicit:
            message += " init-run 으로 새 실행을 만들거나 --run 으로 다른 실행을 지정하세요."
        sys.exit(message)
    if implicit:
        active = sorted(p.parent for p in (root() / "ai-log").glob("*/*/meta.json")
                        if recent_activity(p.parent, cfg) and run_state(p.parent, cfg) == "열림")
        if len(active) >= 2:
            message = "최근 활동이 있는 열린 실행이 여럿입니다: " + ", ".join(p.name for p in active)
            if writing:
                sys.exit(message + ". --run 을 붙여 실행을 지정하세요.")
            print("주의: " + message + ". current-run 을 사용합니다.", file=sys.stderr)
    return run


def load(run):
    f = run / "verdicts.jsonl"
    if not f.exists():
        return []
    return [json.loads(line) for line in f.read_text(encoding="utf-8").splitlines() if line.strip()]


def reviews(recs, stage, repo=None):
    return [x for x in recs if x["stage"] == stage and x.get("repo") == repo and x["verdict"] in REVIEW]


def attempt_number(recs, stage, verdict, repo=None):
    submissions = sum(x["stage"] == stage and x.get("repo") == repo and x["verdict"] == "READY"
                      for x in recs)
    if submissions or verdict == "READY":
        return submissions + (1 if verdict == "READY" else 0)
    return sum(x["verdict"] != "BLOCKED" for x in reviews(recs, stage, repo)) + 1


def request_approved(run):
    rv = reviews(load(run), "request")
    return bool(rv) and rv[-1]["verdict"] == "APPROVED"


def open_ids(rec):
    return {k for k, v in rec.get("issues", {}).items() if v != "resolved"}


def escalation(recs, stage, cap, repo=None):
    rv = [x for x in reviews(recs, stage, repo) if x["verdict"] != "BLOCKED"]
    if not rv or rv[-1]["verdict"] in ("APPROVED", "PASSED"):
        return None
    last = rv[-3:]
    if len(last) == 3:
        stuck = set.intersection(*(open_ids(x) for x in last))
        if stuck:
            return f"지적 {', '.join(sorted(stuck))}이(가) 두 번 수정한 뒤에도 남음"
    if len(rv) >= cap:
        return f"검수 {len(rv)}회로 상한({cap}회) 도달"
    return None


def at(x):
    """판정이 묶인 버전: 저장소@커밋. 버전에 묶이지 않은 판정은 '-'."""
    return (x["repo"] + "@" if x.get("repo") else "") + (x.get("commit") or "-")[:7]


def write_timeline(run):
    rows = ["# 판정 타임라인", "", "`crossgate verdict`가 자동 생성한다. 직접 수정하지 않는다.", "",
            "| 시각 | 단계 | 회차 | 판정 | 주체 | 커밋 | 지적 | 비고 |", "|---|---|---|---|---|---|---|---|"]
    for x in load(run):
        issues = ", ".join(f"{k}:{v}" for k, v in x.get("issues", {}).items())
        who = " ".join(filter(None, [x.get("actor"), x.get("model")]))
        note = (x.get("note") or "").replace("|", "/").replace("\n", " ")
        rows.append(f"| {x['ts'][5:16].replace('T', ' ')} | {x['stage']} | {x['attempt']} | {LABEL[x['verdict']]} "
                    f"| {who} | {at(x)} | {issues} | {note} |")
    (run / "timeline.md").write_text("\n".join(rows) + "\n", encoding="utf-8")


def config_value(cfg, key, default):
    """점으로 구분한 설정 경로를 읽는다. 기본값은 호출하는 모듈이 정한다."""
    value = cfg
    for part in key.split("."):
        if not isinstance(value, dict) or part not in value:
            return default
        value = value[part]
    return value


def read_usage(run):
    """끝난 호출만 읽는다. event가 없는 옛 기록도 끝 기록이다."""
    path = run / "usage.jsonl"
    if not path.exists():
        return []
    records = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    return [record for record in records if record.get("event", "end") == "end"]
