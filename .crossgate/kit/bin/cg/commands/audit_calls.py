"""Codex 세션 메타 정보로 크로스게이트 밖 호출을 알린다."""
import datetime as dt
import json
import os
import re
from pathlib import Path
from cg.core import current_run, root


UTC = dt.timezone.utc
SESSION_NAME = re.compile(r'^rollout-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-.+\.jsonl$')
# 대화 payload는 파싱하지 않는다. 줄 앞부분에 메타 type이 보이는 줄만 읽고, 최상위 type을 다시 확인한다.
META_LINE = re.compile(r'"type"\s*:\s*"(?:session_meta|turn_context)"')


def utc(value):
    # 옛 기록의 시간대 없는 시각과 파일 이름은 현지 시각이다.
    return dt.datetime.fromisoformat(value.replace('Z', '+00:00')).astimezone(UTC)


def session_metadata(path):
    meta, context = None, None
    with path.open(encoding='utf-8') as f:
        for line in f:
            if not META_LINE.search(line[:300]):
                continue
            row = json.loads(line)
            if row.get('type') not in ('session_meta', 'turn_context'):
                continue
            payload = row.get('payload')
            if not isinstance(payload, dict):
                raise ValueError('세션 메타 형식')
            if row['type'] == 'session_meta' and meta is None:
                meta = {key: payload.get(key) for key in ('cwd', 'source')}
                if isinstance(meta['source'], dict):
                    # 다른 세션이 띄운 보조 에이전트 세션이다.
                    meta['source'] = 'subagent'
            elif row['type'] == 'turn_context' and context is None:
                context = {key: payload.get(key) for key in ('model', 'effort')}
            if meta is not None and context is not None:
                break
    if meta is None or context is None:
        raise ValueError('세션 메타 누락')
    result = {**meta, **context}
    if any(not isinstance(result[key], str) or not result[key] for key in ('cwd', 'source', 'model')):
        raise ValueError('세션 메타 형식')
    if result['effort'] is not None and not isinstance(result['effort'], str):
        raise ValueError('추론 강도 형식')
    if not Path(result['cwd']).is_absolute():
        raise ValueError('작업 폴더 형식')
    return result


def call_starts(base):
    """전체 실행의 시작 기록과 시작 기록이 없는 옛 끝 기록을 읽는다."""
    calls = []
    for path in sorted((base / 'ai-log').rglob('usage.jsonl')):
        records = [json.loads(line) for line in path.read_text(encoding='utf-8').splitlines() if line.strip()]
        records = [r for r in records if r.get('engine', 'codex') == 'codex']
        starts = {r['id'] for r in records if r.get('event') == 'start' and r.get('id')}
        for row in records:
            if row.get('event') == 'start':
                when = utc(row['ts'])
            elif row.get('event', 'end') == 'end' and row.get('id') not in starts:
                when = utc(row['ts']) - dt.timedelta(seconds=float(row['seconds']))
            else:
                continue
            calls.append((when, row['model']))
    return calls


def session_paths(folder):
    # Path.rglob은 일부 접근 오류를 숨기므로 walk의 오류를 명시적으로 받는다.
    def failed(error):
        raise error
    if not folder.is_dir():
        raise OSError('세션 기록 폴더에 접근할 수 없습니다')
    for directory, _, names in os.walk(folder, onerror=failed):
        for name in sorted(names):
            if name.endswith('.jsonl'):
                yield Path(directory) / name


def audit(base, folder, since, now):
    calls = call_starts(base)
    groups = {'크로스게이트 호출': [], '크로스게이트 밖 호출': [], '대화형 세션': []}
    skipped = 0
    for path in session_paths(folder):
        try:
            match = SESSION_NAME.fullmatch(path.name)
            if not match:
                raise ValueError('세션 파일 이름')
            when = dt.datetime.strptime(match[1], '%Y-%m-%dT%H-%M-%S').astimezone(UTC)
            if not since <= when <= now:
                continue
            meta = session_metadata(path)
            cwd = Path(meta['cwd']).resolve()
            if cwd != base and base not in cwd.parents:
                continue
        except (ValueError, UnicodeError):
            skipped += 1
            continue
        if 'auto-review' in meta['model'] or meta['source'] == 'subagent':
            continue
        if any(model == meta['model'] and abs((when - start).total_seconds()) <= 30 for start, model in calls):
            group = '크로스게이트 호출'
        elif meta['source'] != 'exec':
            group = '대화형 세션'
        else:
            group = '크로스게이트 밖 호출'
        groups[group].append((when, meta))
    lines = [f'기간(UTC): {since.isoformat()} ~ {now.isoformat()}']
    for group in ('크로스게이트 밖 호출', '대화형 세션'):
        lines += ['', group, '| 시각(UTC) | 모델 | 강도 | 작업 폴더 |', '|---|---|---|---|']
        for when, meta in sorted(groups[group], key=lambda row: row[0]):
            values = (when.isoformat(), meta['model'], meta['effort'] or '-', meta['cwd'])
            lines.append('| ' + ' | '.join(v.replace('|', '\\|').replace('\n', ' ').replace('\r', ' ') for v in values) + ' |')
    lines += [''] + [f'{name}: {len(rows)}' for name, rows in groups.items()]
    lines += ['보조 세션: 제외', f'건너뛴 세션 파일: {skipped}']
    return '\n'.join(lines) + '\n'


def cmd_audit_calls(a):
    run = None
    try:
        base, now = root().resolve(), dt.datetime.now(UTC)
        if a.run or os.environ.get('CROSSGATE_RUN') or (base / '.crossgate/current-run').exists():
            run = current_run(a.run)
        if a.since:
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', a.since):
                raise ValueError('시작 날짜는 YYYY-MM-DD 형식이어야 합니다')
            since = utc(a.since)
        elif a.days is not None:
            days = int(a.days)
            if days < 0:
                raise ValueError('기간은 0일 이상이어야 합니다')
            since = now - dt.timedelta(days=days)
        elif run is not None:
            since = utc(json.loads((run / 'meta.json').read_text(encoding='utf-8'))['created'])
        else:
            since = now - dt.timedelta(days=7)
        folder = Path(os.environ.get('CODEX_HOME') or Path.home() / '.codex') / 'sessions'
        report = audit(base, folder, since, now)
    except (OSError, ValueError, KeyError, TypeError, AttributeError, OverflowError, SystemExit) as error:
        report = f'확인할 수 없음: 세션 기록·호출 기록 또는 기간을 확인하세요. ({error})\n'
    print(report, end='')
    if a.save:
        if run is None:
            print('저장할 실행이 없습니다. --run 으로 실행을 지정하세요.')
            return
        try:
            # 보고서는 설치 위치 아래의 실행 raw/에만 쓴다. 바깥을 가리키는 링크도 거부한다.
            run = run.resolve()
            run.relative_to(base / 'ai-log')
            if not (run / 'meta.json').is_file():
                raise ValueError('실행 메타 정보가 없습니다')
            raw = (run / 'raw').resolve()
            if raw.parent != run:
                raise ValueError('raw 폴더가 실행 폴더 밖을 가리킵니다')
            raw.mkdir(exist_ok=True)
            output = raw / f'audit-calls-{dt.datetime.now(UTC):%Y%m%dT%H%M%S%fZ}.md'
            output.write_text(report, encoding='utf-8')
            print(f'저장: {output.relative_to(base)}')
        except (OSError, ValueError) as error:
            print(f'저장할 수 없음: {error}')


def register(subparsers):
    p = subparsers.add_parser('audit-calls', help='크로스게이트 밖 호출 찾기',
                             description='Codex 세션 메타 정보로 호출을 분류합니다. 세션을 남기지 않게 설정한 호출은 찾을 수 없습니다.')
    p.add_argument('--since', metavar='YYYY-MM-DD', help='현지 날짜의 자정부터 확인 (--days보다 우선)')
    p.add_argument('--days', metavar='수', help='최근 일수 (기본: 현재 실행 생성 시각부터, 실행이 없으면 7일)')
    p.add_argument('--run', metavar='실행', help='기준 실행 폴더')
    p.add_argument('--save', action='store_true', help='실행 폴더의 raw/에도 보고서 저장')
    p.set_defaults(fn=cmd_audit_calls)
