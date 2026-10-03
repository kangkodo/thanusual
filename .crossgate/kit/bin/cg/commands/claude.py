import sys
from cg.calls import call_claude


def cmd_claude(a):
    result = call_claude(a)
    rec, usage = result['record'], result['usage']
    print(result['reply'])
    print(f"\n[claude {a.role} · 읽기 전용(Read,Grep,Glob) · {rec['seconds']}s · in {usage['input_tokens']:,} / "
          f"out {usage['output_tokens']:,} tok · ${usage['cost_usd'] or 0:.2f} · exit {result['exit']}]", file=sys.stderr)
    if result['state'] in ('timeout', 'stalled'):
        print("호출이 시간 제한 또는 멈춤 감지로 끝났습니다. 이 회차를 BLOCKED로 기록하세요.", file=sys.stderr)
    if result['exit']:
        print(result['stderr'], file=sys.stderr)
        sys.exit(result['exit'])


def register(subparsers):
    p = subparsers.add_parser("claude"); p.add_argument("role"); p.add_argument("--prompt-file", required=True)
    p.add_argument("--run"); p.add_argument("--repo"); p.add_argument("--effort"); p.set_defaults(fn=cmd_claude)
    p.add_argument("--fresh", action="store_true", help="이전 검수 세션을 이어 쓰지 않고 새로 호출")
    p._crossgate_order = 2
