import hashlib
import json
import re
import subprocess
import sys
from cg.core import LABEL, config, git, is_pm, load, match, require_sealed, reviews, root, route_conf


def infra_upgrade(base, changed):
    """실행 기록 없는 킷 업그레이드를 기준 커밋과 비교한다."""
    def blob(ref, path):
        result = subprocess.run(["git", "show", f"{ref}:{path}"], capture_output=True)
        return result.stdout if result.returncode == 0 else None

    def content(ref, path):
        value = blob(ref, path)
        return value.decode("utf-8") if value is not None else ""

    def fail(condition, reason):
        sys.exit(f"✗ 인프라 PR 자동 병합 불가 (조건 {condition}): {reason}")

    prefixes = (".crossgate/kit/", ".claude/skills/crossgate/")
    allowed = {".claude/agents/crossgate-reviewer.md", ".crossgate/config.json",
               ".gitignore", "AGENTS.md", "CLAUDE.md"}
    outside = [p for p in changed if not p.startswith(prefixes) and p not in allowed]
    if outside:
        fail(1, "허용 범위 밖 변경: " + ", ".join(outside))
    old_version = content(base, ".crossgate/kit/VERSION").strip()
    if not old_version:
        fail(7, "기준 쪽에 킷이 없는 처음 설치는 업그레이드가 아닙니다")
    try:
        old_cfg = json.loads(content(base, ".crossgate/config.json"))
        new_cfg = json.loads(content("HEAD", ".crossgate/config.json"))
        if not isinstance(old_cfg, dict) or not isinstance(new_cfg, dict):
            raise ValueError()
    except ValueError:
        fail(2, "기준 또는 새 설정을 읽을 수 없습니다")
    old_cfg.pop("kit_version", None)
    configured_version = new_cfg.pop("kit_version", None)
    if old_cfg != new_cfg:
        fail(2, ".crossgate/config.json은 kit_version만 바뀔 수 있습니다")

    # 기존 줄의 순서를 보존하며 킷 항목만 끼워 넣을 수 있다.
    old_lines = content(base, ".gitignore").splitlines(keepends=True)
    new_lines = content("HEAD", ".gitignore").splitlines(keepends=True)
    snippet = set(content("HEAD", ".crossgate/kit/templates/gitignore-snippet").splitlines())
    index = 0
    for line in new_lines:
        if index < len(old_lines) and line == old_lines[index]:
            index += 1
        elif line.rstrip("\r\n") not in snippet:
            fail(3, ".gitignore에 킷 항목이 아닌 줄이 추가되거나 기존 줄이 변경됐습니다")
    if index != len(old_lines):
        fail(3, ".gitignore의 기존 줄이 삭제되거나 변경됐습니다")

    start, end = "<!-- crossgate:start -->", "<!-- crossgate:end -->"
    def outside_marker(text):
        if start not in text and end not in text:
            return text
        if text.count(start) != 1 or text.count(end) != 1 or text.index(start) > text.index(end):
            fail(4, "크로스게이트 표시 주석이 올바르지 않습니다")
        return text[:text.index(start)] + text[text.index(end) + len(end):]

    for name in ("AGENTS.md", "CLAUDE.md"):
        if outside_marker(content(base, name)) != outside_marker(content("HEAD", name)):
            fail(4, f"{name}의 크로스게이트 표시 주석 밖 내용이 바뀌었습니다")

    manifest = content("HEAD", ".crossgate/kit/MANIFEST.sha256")
    expected = {}
    try:
        for line in manifest.splitlines():
            if line and not line.startswith("#"):
                digest, name = line.split("  ", 1)
                if name in expected or not re.fullmatch(r"[0-9a-f]{64}", digest):
                    raise ValueError()
                expected[name] = digest
    except ValueError:
        fail(5, "킷 봉인 파일 형식이 올바르지 않습니다")
    names = git("ls-tree", "-r", "--name-only", "-z", "HEAD", ".crossgate/kit/", strip=False).split("\0")
    actual = {}
    for path in filter(None, names):
        name = path[len(".crossgate/kit/"):]
        if name.split("/")[-1] in {"MANIFEST.sha256", ".DS_Store"} or "__pycache__" in name.split("/"):
            continue
        actual[name] = hashlib.sha256(blob("HEAD", path)).hexdigest()
    if not expected or expected != actual:
        fail(5, "커밋된 킷의 봉인이 맞지 않습니다")
    sources = [line for line in manifest.splitlines() if line.startswith("# source:")]
    if len(sources) != 1 or not sources[0].startswith("# source: v"):
        fail(6, "봉인 파일의 출처가 v로 시작하는 태그 설치가 아닙니다")
    new_version = content("HEAD", ".crossgate/kit/VERSION").strip()
    if configured_version != new_version:
        fail(7, "설정의 kit_version과 킷 버전이 다릅니다")
    if not all(re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", v) for v in (old_version, new_version)):
        fail(7, "킷 버전을 세 부분의 숫자로 비교할 수 없습니다")
    if tuple(map(int, new_version.split("."))) <= tuple(map(int, old_version.split("."))):
        fail(7, f"킷 버전이 기준보다 높지 않습니다: {old_version} → {new_version}")
    print(f"✓ 인프라 PR(킷 업그레이드 {old_version} → {new_version})")


def cmd_merge_check(a):
    require_sealed()
    cfg = config()
    if is_pm(cfg):
        sys.exit("PM 모드에는 merge-check 가 없습니다. 저장소별 병합은 작업공간 규칙(AGENTS.md 등)을 따릅니다.")
    base = git("merge-base", a.base, "HEAD")
    changed = git("diff", "--name-only", base, "HEAD").splitlines()
    runs = sorted({"/".join(f.split("/")[:3]) for f in changed if f.startswith("ai-log/") and f.count("/") >= 3})
    kit_changed = any(f.startswith((".crossgate/kit/", ".claude/skills/crossgate/"))
                      or f == ".claude/agents/crossgate-reviewer.md" for f in changed)
    if not runs and kit_changed:
        # 이름 변경도 원래 경로의 삭제와 새 경로의 추가로 검사한다.
        infra_changed = git("diff", "--no-renames", "--name-only", "-z", base, "HEAD", strip=False).split("\0")[:-1]
        infra_upgrade(base, infra_changed)
        return
    if len(runs) != 1:
        sys.exit(f"✗ 이 변경에 연결된 실행 기록이 {len(runs)}개입니다. 1개여야 합니다: {runs}")
    run = root() / runs[0]
    recs = load(run)
    meta = json.loads((run / "meta.json").read_text(encoding="utf-8"))
    stages = route_conf(cfg, meta["route"])["stages"]
    problems = []
    hit = [f for f in changed if not f.startswith("ai-log/") and match(f, cfg.get("forbidden", []))]
    if hit:
        problems.append("금지 경로 변경: " + ", ".join(hit))
    if any(x["verdict"] == "ESCALATED" for x in recs):
        problems.append("사람 조정 요청(ESCALATED) 기록이 있음")
    for st in stages:
        rv = reviews(recs, st)
        want = "PASSED" if st == "qa" else "APPROVED"
        if not rv or rv[-1]["verdict"] != want:
            problems.append(f"{st}: 최종 판정이 {LABEL[want]}이 아님 ({LABEL[rv[-1]['verdict']] if rv else '없음'})")
            continue
        if rv[-1].get("unverified"):
            problems.append(f"{st}: 미검증 항목 {rv[-1]['unverified']}")
        # ponytail: request·plan은 버전 대조를 하지 않는다. 기획 문서가 승인 뒤 바뀌는 사고가 나오면 대조 대상에 넣는다.
        if st in ("dev", "qa", "wiki"):
            skip = ["ai-log/*"] + (cfg.get("doc_paths", []) if st != "wiki" else [])
            moved = [f for f in git("diff", "--name-only", rv[-1]["commit"], "HEAD").splitlines() if not match(f, skip)]
            if moved:
                problems.append(f"{st} 승인 뒤 바뀐 파일: " + ", ".join(moved[:10]))
    if problems:
        print(f"✗ 자동 병합 불가 ({runs[0]})")
        for p in problems:
            print(f"  - {p}")
        sys.exit(1)
    print(f"✓ 자동 병합 조건 충족 ({runs[0]}, 단계 {', '.join(stages)})")


def register(subparsers):
    p = subparsers.add_parser("merge-check"); p.add_argument("--base", required=True); p.set_defaults(fn=cmd_merge_check)
    p._crossgate_order = 8
