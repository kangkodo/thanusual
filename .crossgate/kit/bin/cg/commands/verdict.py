import datetime as dt
import json
import sys
from cg.core import LABEL, REVIEW, VERDICTS, at, attempt_number, config, config_value, current_run, escalation, git, is_pm, load, read_usage, repo_dir, write_timeline


def cmd_verdict(a):
    cfg, run = config(), current_run(a.run, writing=True)
    recs = load(run)
    repo = repo_dir(cfg, a.repo)
    # PM 모드에서 저장소를 고르지 않은 판정(요청·기획 등)은 코드 버전에 묶지 않는다
    versioned = bool(repo) or not is_pm(cfg)
    if a.verdict in ("APPROVED", "PASSED"):
        if a.unverified:
            sys.exit("미검증 항목이 있으면 승인할 수 없습니다 (R13).")
        dirty = versioned and [line for line in git("status", "--porcelain", strip=False, cwd=repo).splitlines()
                 if line.strip() and not line[3:].strip('"').startswith("ai-log/")]
        if dirty:
            sys.exit("커밋되지 않은 변경이 있습니다. 승인은 커밋된 상태에만 기록합니다.\n" + "\n".join(dirty[:10]))
    attempt = a.attempt or attempt_number(recs, a.stage, a.verdict, a.repo)
    issues = dict(kv.split("=", 1) for kv in a.issues.split(",")) if a.issues else {}
    model = a.model
    # 검수 판정의 모델은 그 엔진의 마지막 호출 기록에서 채운다. 손으로 적은 값이 다르면 알린다
    if a.verdict in REVIEW and a.actor in ("claude", "codex") and (run / "usage.jsonl").exists():
        used = read_usage(run)
        last = next((u["model"] for u in reversed(used) if u.get("engine", "codex") == a.actor), None)
        if last and not model:
            model = last
        elif last and model != last:
            print(f"주의: --model {model} 이 마지막 {a.actor} 호출의 모델 {last} 과 다르다. 그대로 기록한다.", file=sys.stderr)
    rec = {"ts": dt.datetime.now().isoformat(timespec="seconds"), "stage": a.stage, "attempt": attempt,
           "verdict": a.verdict, "actor": a.actor, "model": model,
           "commit": git("rev-parse", "HEAD", cwd=repo) if versioned else None, "repo": a.repo,
           "issues": issues, "unverified": a.unverified or [], "evidence": a.evidence or [],
           "tokens": a.tokens, "note": a.note}
    with open(run / "verdicts.jsonl", "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    write_timeline(run)
    print(f"기록: {a.stage} #{attempt} {LABEL[a.verdict]} @ {at(rec)} → {run.name}")
    esc = escalation(load(run), a.stage, config_value(cfg, "cap", 3), a.repo)
    if esc:
        print(f"조정 필요: {esc}. ESCALATED를 기록하고 사용자에게 묻습니다.")


def register(subparsers):
    p = subparsers.add_parser("verdict")
    p.add_argument("--stage", required=True, choices=["request", "plan", "dev", "qa", "wiki"])
    p.add_argument("--verdict", required=True, choices=VERDICTS)
    p.add_argument("--attempt", type=int); p.add_argument("--actor"); p.add_argument("--model")
    p.add_argument("--issues", help="P-1=open,P-2=resolved"); p.add_argument("--unverified", nargs="*")
    p.add_argument("--evidence", nargs="*"); p.add_argument("--tokens", type=int); p.add_argument("--note")
    p.add_argument("--run"); p.add_argument("--repo"); p.set_defaults(fn=cmd_verdict)
    p._crossgate_order = 6
