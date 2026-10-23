"""읽기 전용 참가자의 발제·반박과 Master의 쟁점·결정 기록."""
import datetime as dt
import fcntl
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from pathlib import Path

from cg.calls import invoke
from cg.core import config, current_run, mask, root
from cg.discussion import OPEN_STATES, STATES, counts, discussions, issues, options, render_issues


def now():
    return dt.datetime.now().isoformat(timespec='seconds')


def save_meta(folder, meta):
    path = folder / 'meta.json'
    temporary = folder / 'meta.json.tmp'
    temporary.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)


def slugify(value):
    slug = re.sub(r'[^\w-]+', '-', value).strip('-')
    if not slug:
        raise ValueError('토의 slug에는 글자나 숫자가 필요합니다.')
    return slug


@contextmanager
def locked(folder):
    # 같은 토의의 중복 round·issue·close는 기다리지 않고 알린다.
    with (folder / '.lock').open('a') as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise ValueError('이 토의 기록을 다른 명령이 사용 중입니다. 끝난 뒤 다시 실행하세요.')
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def find(run, slug):
    matches = [(folder, meta) for folder, meta in discussions(run)
               if folder.name == slug or meta['slug'] == slugify(slug)]
    if len(matches) != 1:
        raise ValueError(f'토의를 하나로 찾을 수 없습니다: {slug}. discuss status의 폴더 이름을 쓰세요.')
    return matches[0]


def open_discussion(a, run):
    rounds, people = options(config())
    slug = slugify(a.slug)
    topic = Path(a.topic_file).read_text(encoding='utf-8')
    parent = run / '05-discussion'
    parent.mkdir(exist_ok=True)
    with locked(parent):
        existing = discussions(run)
        if any(meta['slug'].casefold() == slug.casefold() for _, meta in existing):
            raise ValueError(f'이미 있는 토의 slug: {slug}. 다른 slug를 쓰세요.')
        number = max([int(p.name.split('_', 1)[0]) for p in parent.iterdir()
                      if p.is_dir() and re.match(r'^\d+_', p.name)] or [0]) + 1
        folder = parent / f'{number:02d}_{slug}'
        (folder / 'turns').mkdir(parents=True)
        (folder / 'topic.md').write_text(topic, encoding='utf-8')
        (folder / 'issues.jsonl').touch()
        render_issues(folder)
        save_meta(folder, {'slug': slug, 'status': 'open', 'participants': people,
                           'created': now(), 'round': 0, 'rounds': rounds})
    print(folder.relative_to(root()))


def turn_path(folder, number, name):
    return folder / 'turns' / f'R{number}_{name}.md'


def round_discussion(a, run, folder, meta):
    people = meta['participants']
    current = meta.get('round', 0)
    expected = meta.get('round_participants', [])
    missing = [name for name in expected if not turn_path(folder, current, name).exists()]
    selected = a.only.split(',') if a.only is not None else None
    names = [p['name'] for p in people]
    if selected is not None and (not selected or len(set(selected)) != len(selected) or set(selected) - set(names)):
        raise ValueError('--only에는 중복 없이 설정된 참가자 이름을 씁니다.')
    if missing:
        if selected is None or set(selected) - set(missing):
            raise ValueError('미완료 라운드입니다. --only로 발언이 없는 참가자만 재호출하세요: ' + ', '.join(missing))
        number = current
    else:
        number = current + 1
    if number == 1 and (a.sequential or (selected is not None and not missing)):
        raise ValueError('라운드 1은 전원 동시·새 세션입니다. --only·--sequential은 쓸 수 없습니다(실패한 참가자 --only 재호출 제외).')
    if number - 1 > meta['rounds'] and not a.extend and not missing:
        raise ValueError('반박 라운드 상한입니다. 실험하거나 사용자에게 결정을 요청하세요. 계속하려면 --extend를 씁니다.')
    chosen = [p for p in people if selected is None or p['name'] in selected]
    task = Path(a.prompt_file).read_text(encoding='utf-8')
    if not missing:
        meta.update(round=number, round_participants=[p['name'] for p in chosen])
        save_meta(folder, meta)
    opened = [key for key, row in issues(folder).items() if row['status'] in OPEN_STATES]
    prior = [(n, p['name'], turn_path(folder, n, p['name']))
             for n in range(1, number) for p in people
             if turn_path(folder, n, p['name']).exists()]
    def speak(person, same_round):
        name = person['name']
        guidance = f"토의 {folder.name} · 참가자 {name} · 라운드 {number}\n주제 원문: {folder / 'topic.md'}"
        if number == 1:
            guidance += '\n독립 발제: 다른 참가자의 발언을 읽지 않는다.'
        else:
            paths = [str(path) for _, who, path in prior if who != name]
            paths += [str(path) for path in same_round]
            guidance += '\n상대 발언 원문 파일(직접 읽고 확인한다):\n' + '\n'.join(paths)
            guidance += f"\n쟁점 장부: {folder / 'issues.md'}\n열린 쟁점 ID: {', '.join(opened) or '없음'}"
        fresh_guidance = ''
        if number > 1:
            fresh_guidance = '새 세션 복구: 주제와 이전 발언 원문을 읽는다.\n' + str(folder / 'topic.md')
            fresh_guidance += '\n' + '\n'.join(str(path) for _, _, path in prior)
        try:
            result = invoke(person['engine'], 'discussant', task, run=run,
                            effort=a.effort or person.get('effort'), model=person.get('model'),
                            effort_source='participant' if not a.effort and person.get('effort') else None,
                            session_key=f'{folder.name}:{name}', discussion=folder.name, participant=name,
                            round_number=number, fresh=number == 1, extra_guidance=guidance,
                            fresh_guidance=fresh_guidance)
            if result['state'] == 'ok':
                turn_path(folder, number, name).write_text(mask(result['reply']), encoding='utf-8')
            return result['state'], result['stderr']
        except (Exception, SystemExit) as exc:
            return 'failed', mask(str(exc))

    results = {}
    if a.sequential:
        for person in chosen:
            name = person['name']
            earlier = [turn_path(folder, number, who) for who in names[:names.index(name)]
                       if turn_path(folder, number, who).exists()]
            results[name] = speak(person, earlier)
    else:
        with ThreadPoolExecutor(max_workers=len(chosen)) as pool:
            futures = {pool.submit(speak, p, []): p['name'] for p in chosen}
            for future in as_completed(futures):
                results[futures[future]] = future.result()
    for person in chosen:
        name = person['name']
        state, error = results[name]
        print(f'R{number} {name}: {state}' + (f' · {turn_path(folder, number, name)}' if state == 'ok' else ''))
        if state != 'ok':
            print(f'실패한 참가자: {name} ({state}) {error}', file=sys.stderr)
    failures = [state for state, _ in results.values() if state != 'ok']
    if failures:
        sys.exit(3 if all(s in ('timeout', 'stalled') for s in failures) else 1)


def issue_discussion(a, folder):
    if not re.fullmatch(r'T-[1-9][0-9]*', a.id):
        raise ValueError('쟁점 ID는 T-n 형식의 양수입니다.')
    previous = issues(folder).get(a.id)
    if not previous and not (a.title and a.title.strip()):
        raise ValueError('새 쟁점 ID에는 --title이 필요합니다.')
    row = {**(previous or {}), 'id': a.id, 'status': a.status, 'ts': now()}
    for field in ('title', 'note', 'evidence'):
        value = getattr(a, field)
        if value is not None:
            row[field] = [mask(v) for v in value] if isinstance(value, list) else mask(value)
    with (folder / 'issues.jsonl').open('a', encoding='utf-8') as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + '\n')
    render_issues(folder)
    print(f'{a.id}: {a.status}')


def close_discussion(a, folder, meta):
    rows = issues(folder)
    opened = [key for key, row in rows.items() if row['status'] in OPEN_STATES]
    if opened and not a.force:
        raise ValueError('열린 쟁점이 남았습니다: ' + ', '.join(opened) + '. 닫으려면 --force가 필요합니다.')
    decision = Path(a.decision_file).read_text(encoding='utf-8')
    (folder / 'decision.md').write_text(decision, encoding='utf-8')
    meta.update(status='closed', closed=now(), forced=bool(a.force))
    save_meta(folder, meta)
    print(f'닫은 토의: {folder.name}')
    users = [key for key, row in rows.items() if row['status'] == 'user']
    if users:
        print('사용자에게 물을 쟁점: ' + ', '.join(users))


def status_discussion(a, run):
    entries = [find(run, a.slug)] if a.slug else discussions(run)
    if not entries:
        print('토의 없음')
    for folder, meta in entries:
        number = meta.get('round', 0)
        print(f"{folder.name}: {meta['status']} · 라운드 {number} · 반박 {max(0, number - 1)}/{meta['rounds']} · {counts(folder)}")
        for person in meta['participants']:
            paths = [turn_path(folder, n, person['name']) for n in range(number, 0, -1)]
            latest = next((p for p in paths if p.exists()), None)
            print(f"  {person['name']}: {latest or '발언 없음'}")


def cmd_discuss(a):
    try:
        run = current_run(a.run, writing=a.action != 'status')
        if a.action == 'open':
            open_discussion(a, run)
        elif a.action == 'status':
            status_discussion(a, run)
        else:
            folder, _ = find(run, a.slug)
            with locked(folder):
                meta = json.loads((folder / 'meta.json').read_text(encoding='utf-8'))
                if meta['status'] != 'open':
                    raise ValueError('닫힌 토의에는 쓸 수 없습니다.')
                if a.action == 'round':
                    round_discussion(a, run, folder, meta)
                elif a.action == 'issue':
                    issue_discussion(a, folder)
                else:
                    close_discussion(a, folder, meta)
    except (OSError, ValueError) as exc:
        sys.exit(mask(str(exc)))


def register(subparsers):
    parser = subparsers.add_parser('discuss', help='선택 토의: 독립 발제·반박·쟁점·결정')
    actions = parser.add_subparsers(dest='action', required=True)
    for action in ('open', 'round', 'issue', 'close', 'status'):
        p = actions.add_parser(action)
        p.add_argument('slug', **({'nargs': '?'} if action == 'status' else {}))
        p.add_argument('--run')
        p.set_defaults(fn=cmd_discuss)
        if action == 'open':
            p.add_argument('--topic-file', required=True)
        elif action == 'round':
            p.add_argument('--prompt-file', required=True)
            p.add_argument('--only')
            p.add_argument('--sequential', action='store_true')
            p.add_argument('--effort')
            p.add_argument('--extend', action='store_true')
        elif action == 'issue':
            p.add_argument('--id', required=True)
            p.add_argument('--status', required=True, choices=STATES)
            p.add_argument('--title')
            p.add_argument('--note')
            p.add_argument('--evidence', nargs='+')
        elif action == 'close':
            p.add_argument('--decision-file', required=True)
            p.add_argument('--force', action='store_true')
