import sys
from cg.calls import call_codex


def cmd_codex(a):
    result = call_codex(a)
    rec, usage = result['record'], result['usage']
    print(result['reply'])
    print(f"\n[codex {a.role} · {result['sandbox']} · {rec['effort']} · {rec['seconds']}s · "
          f"in {usage['input_tokens']:,} / out {usage['output_tokens']:,} tok · exit {result['exit']}]", file=sys.stderr)
    if result['state'] in ('timeout', 'stalled'):
        print("호출이 시간 제한 또는 멈춤 감지로 끝났습니다. 이 회차를 BLOCKED로 기록하세요.", file=sys.stderr)
    if result['exit']:
        print(result['stderr'], file=sys.stderr)
        sys.exit(result['exit'])


def register(subparsers):
    p = subparsers.add_parser("codex"); p.add_argument("role"); p.add_argument("--prompt-file", required=True)
    p.add_argument("--run"); p.add_argument("--repo"); p.add_argument("--effort"); p.set_defaults(fn=cmd_codex)
    p.add_argument("--fresh", action="store_true", help="이전 검수 세션을 이어 쓰지 않고 새로 호출")
    p._crossgate_order = 1
