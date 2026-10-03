import argparse
import datetime as dt
import json
import math
import os
import subprocess
import time
from cg.core import config, config_value, current_run, is_pm, load, open_ids, recent_activity, reviews, root, route_conf, run_state


def stage_rows(cfg, meta, recs):
    """기존 status와 같이 저장소 없는 판정도 별도 묶음으로 읽는다."""
    for stage in route_conf(cfg, meta.get('route', 'full'))['stages']:
        repos = sorted({r.get('repo') for r in recs if r['stage'] == stage}, key=lambda x: x or '') or [None]
        for repo in repos:
            records = [r for r in recs if r['stage'] == stage and r.get('repo') == repo]
            rv = reviews(recs, stage, repo)
            last = records[-1] if records else None
            review = rv[-1] if rv else None
            label = f'{stage} [{repo}]' if repo else stage
            yield stage, label, last, review


def next_action(rows, recs, cfg):
    escalated = next((i for i in range(len(recs) - 1, -1, -1) if recs[i]['verdict'] == 'ESCALATED'), None)
    if escalated is not None and not any(r.get('actor') == 'user' and r['verdict'] != 'READY'
                                        for r in recs[escalated + 1:]):
        return '사용자 조정 대기'
    if not any(r['stage'] == 'request' and r['verdict'] == 'APPROVED' and r.get('actor') == 'user' for r in recs):
        return '요청 정리(결정 목록, 요청 검수, 한 번에 질문)'
    for stage, label, last, review in rows:
        if review is None:
            return f'{label}: 그 단계 시작 또는 검수 요청'
        verdict = review['verdict']
        if verdict in ('REJECTED', 'FAILED'):
            opened = ', '.join(sorted(open_ids(review))) or '없음'
            return f'{label}: 수정 후 재검수 (미해결 {opened})'
        if verdict == 'BLOCKED':
            return f'{label}: 환경 문제를 풀고 같은 회차 재검수'
        if verdict != ('PASSED' if stage == 'qa' else 'APPROVED') or last['verdict'] == 'READY':
            return f'{label}: 그 단계 시작 또는 검수 요청'
    return '작업공간 규칙대로 마무리하고 실행 닫기' if is_pm(cfg) else '병합 조건 검사 후 병합'


def interrupted_calls(run, cfg):
    path = run / 'usage.jsonl'
    if not path.exists():
        return []
    records = [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]
    ended = {r.get('id') for r in records if r.get('event', 'end') == 'end'}
    minutes = config_value(cfg, 'timeouts.call_minutes', {})
    now = time.time()
    interrupted = []
    for rec in records:
        if rec.get('event') != 'start' or rec.get('id') in ended:
            continue
        role = rec['role']
        limit = float(minutes.get(role, minutes.get('default', 40 if role in ('developer', 'qa') else 20)))
        started = dt.datetime.fromisoformat(rec['ts'].replace('Z', '+00:00')).timestamp()
        if now - started > limit * 60:
            interrupted.append(rec)
    return interrupted


def worktree(path):
    """status의 인덱스 갱신을 끄고, 이름 변경·줄바꿈 파일도 파일 하나로 센다."""
    if not (path / '.git').exists():
        return '확인할 수 없음'
    def git_read(*args):
        return subprocess.run(['git', '--no-optional-locks', *args], cwd=path,
                              capture_output=True, text=True)
    try:
        branch = git_read('rev-parse', '--abbrev-ref', 'HEAD')
        status = git_read('status', '--porcelain', '-z', '--untracked-files=all')
    except OSError:
        return '확인할 수 없음'
    if branch.returncode or status.returncode:
        return '확인할 수 없음'
    entries = iter(status.stdout.split('\0'))
    count = 0
    for entry in entries:
        if not entry:
            continue
        count += 1
        if 'R' in entry[:2] or 'C' in entry[:2]:
            next(entries, None)
    return f'브랜치 {branch.stdout.strip()} · 커밋되지 않은 변경 {count}개'


def list_runs(cfg, days):
    runs = []
    recent_cfg = {**cfg, 'recent_minutes': days * 24 * 60}
    for path in (root() / 'ai-log').glob('*/*/meta.json'):
        run = path.parent
        if run_state(run, cfg) != '열림' or not recent_activity(run, recent_cfg):
            continue
        activity = max(p.stat().st_mtime for p in (run / n for n in ('meta.json', 'verdicts.jsonl', 'usage.jsonl')) if p.exists())
        runs.append((activity, run))
    if not runs:
        print(f'최근 {days:g}일 안에 활동한 열린 실행이 없습니다.')
        return
    print('실행 | 등급 | 마지막 활동 | 다음 할 일')
    for activity, run in sorted(runs, reverse=True):
        meta = json.loads((run / 'meta.json').read_text(encoding='utf-8'))
        recs = load(run)
        route = meta.get('route', 'full')
        route = 'standard' if route == 'quick' else route
        action = next_action(stage_rows(cfg, meta, recs), recs, cfg)
        stamp = dt.datetime.fromtimestamp(activity).isoformat(timespec='seconds')
        print(f'{run.name} | {route} | {stamp} | {action}')


def cmd_resume(a):
    cfg = config()
    if a.list or (not a.run and not os.environ.get('CROSSGATE_RUN') and not (root() / '.crossgate/current-run').exists()):
        list_runs(cfg, a.days)
        return
    run = current_run(a.run)
    meta = json.loads((run / 'meta.json').read_text(encoding='utf-8'))
    route = meta.get('route', 'full')
    route = 'standard' if route == 'quick' else route
    state = run_state(run, cfg)
    print(f"실행 {run.name} · 등급 {route} · 만든 시각 {meta.get('created', '알 수 없음')} · 상태 {state} · 닫힘 여부 {'예' if state == '닫힘' else '아니오'}")
    recs = load(run)
    rows = list(stage_rows(cfg, meta, recs))
    cap = config_value(cfg, 'cap', 3)
    print('단계 | 최신 판정 | 회차/상한 | 미해결 지적')
    for stage, label, last, review in rows:
        verdict = last['verdict'] if last else '없음'
        attempt = last.get('attempt', 0) if last else 0
        opened = ', '.join(sorted(open_ids(review))) if review else ''
        print(f'{label} | {verdict} | {attempt}/{cap} | {opened or "없음"}')
    calls = interrupted_calls(run, cfg)
    print('중단된 호출:' + ('' if calls else ' 없음'))
    for call in calls:
        repo = f" [{call['repo']}]" if call.get('repo') else ''
        print(f"  {call['id']} · {call.get('engine', 'codex')} · {call['role']}{repo} · 시작 {call['ts']}")
    print('작업 트리:')
    if is_pm(cfg):
        for name, rc in cfg.get('repos', {}).items():
            print(f"  [{name}] {worktree(root() / rc.get('path', name))}")
        if not cfg.get('repos'):
            print('  등록된 저장소 없음')
    else:
        print('  ' + worktree(root()))
    print('다음 할 일: ' + next_action(rows, recs, cfg))


def positive_days(value):
    try:
        days = float(value)
    except ValueError:
        raise argparse.ArgumentTypeError('기간은 0보다 큰 수여야 합니다.')
    if not math.isfinite(days) or days <= 0:
        raise argparse.ArgumentTypeError('기간은 0보다 큰 수여야 합니다.')
    return days


def register(subparsers):
    p = subparsers.add_parser('resume', help='끊긴 작업의 상태와 다음 할 일 확인')
    p.add_argument('--run', help='확인할 실행 경로')
    p.add_argument('--list', action='store_true', help='최근 활동한 열린 실행 목록')
    p.add_argument('--days', type=positive_days, default=14, help='목록의 최근 활동 기간(일, 기본 14)')
    p.set_defaults(fn=cmd_resume)
