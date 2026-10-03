import json
from cg.core import LABEL, at, config, config_value, current_run, escalation, load, open_ids, read_usage, reviews, root, run_state


def cmd_status(a):
    cfg = config()
    run, cap = current_run(a.run), config_value(cfg, "cap", 3)
    recs = load(run)
    meta = json.loads((run / "meta.json").read_text(encoding="utf-8"))
    print(f"{run.relative_to(root())} · 경로 {meta['route']} · {run_state(run, cfg)}")
    calls = read_usage(run)
    for engine in ("codex", "claude"):
        cs = [c for c in calls if c.get("engine", "codex") == engine]
        if cs:
            cost = sum(c.get("cost_usd") or 0 for c in cs)
            print(f"  {engine} 호출 {len(cs)}회 · 입력 {sum(c['input_tokens'] for c in cs):,} · 출력 "
                  f"{sum(c['output_tokens'] for c in cs):,} 토큰 · {sum(c['seconds'] for c in cs)}초"
                  + (f" · ${cost:.2f}" if cost else ""))
    for st in ["request", "plan", "dev", "qa", "wiki"]:
        repos = sorted({x.get("repo") for x in recs if x["stage"] == st}, key=lambda x: x or "") or [None]
        for repo in repos:
            rv = reviews(recs, st, repo)
            last = rv[-1] if rv else None
            esc = escalation(recs, st, cap, repo)
            state = f"{LABEL[last['verdict']]} @ {at(last)}" if last else "-"
            opened = ", ".join(sorted(open_ids(last))) if last else ""
            label = f"{st} [{repo}]" if repo else st
            count = sum(x["verdict"] != "BLOCKED" for x in rv)
            print(f"  {label:<8} 검수 {count}/{cap}  최신 {state}  {('미해결 ' + opened) if opened else ''}"
                  f"{('  ⚠ ' + esc) if esc else ''}")


def register(subparsers):
    p = subparsers.add_parser("status"); p.add_argument("--run"); p.set_defaults(fn=cmd_status)
    p._crossgate_order = 7
