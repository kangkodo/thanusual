"""토의 설정과 기록 조회. 판정·필수 단계와 독립적이다."""
import json
import re
from collections import Counter


DEFAULT_PARTICIPANTS = [{'name': 'codex', 'engine': 'codex'}, {'name': 'claude', 'engine': 'claude'}]
STATES = ('open', 'agreed', 'rejected', 'deferred', 'experiment', 'user')
OPEN_STATES = {'open', 'experiment'}


def options(cfg):
    value = cfg.get('discussion', {})
    if not isinstance(value, dict):
        raise ValueError('discussion은 객체여야 합니다.')
    rounds = value.get('rounds', 3)
    if isinstance(rounds, bool) or not isinstance(rounds, int) or rounds < 0:
        raise ValueError('discussion.rounds는 0 이상의 정수여야 합니다.')
    people = value.get('participants', DEFAULT_PARTICIPANTS)
    if not isinstance(people, list) or not people:
        raise ValueError('discussion.participants는 비어 있지 않은 목록이어야 합니다.')
    names = set()
    for person in people:
        if not isinstance(person, dict):
            raise ValueError('discussion 참가자는 이름과 엔진을 가진 객체여야 합니다.')
        name = person.get('name')
        if not isinstance(name, str) or not re.fullmatch(r'[A-Za-z0-9_-]+', name):
            raise ValueError('discussion 참가자 이름에는 영숫자·-·_만 쓸 수 있습니다.')
        # 대소문자를 구별하지 않는 파일 시스템에서도 발언 파일이 겹치지 않는다.
        if name.lower() in names:
            raise ValueError('discussion 참가자 이름은 중복될 수 없습니다(대소문자 포함).')
        names.add(name.lower())
        if person.get('engine') not in ('codex', 'claude'):
            raise ValueError('discussion 참가자 engine은 codex|claude만 가능합니다.')
        for key in ('model', 'effort'):
            if key in person and (not isinstance(person[key], str) or not person[key].strip()):
                raise ValueError(f'discussion 참가자의 {key}은 비어 있지 않은 문자열이어야 합니다.')
    return rounds, people


def discussions(run):
    return [(p.parent, json.loads(p.read_text(encoding='utf-8')))
            for p in sorted((run / '05-discussion').glob('*/meta.json'))]


def issues(folder):
    result = {}
    path = folder / 'issues.jsonl'
    if path.exists():
        for line in path.read_text(encoding='utf-8').splitlines():
            if line.strip():
                row = json.loads(line)
                result[row['id']] = row
    return result


def render_issues(folder):
    def cell(value):
        return str(value).replace('|', '\\|').replace('\n', ' ').replace('\r', ' ')
    lines = ['# 쟁점 장부', '', '`discuss issue`가 자동 생성한다.', '',
             '| ID | 제목 | 상태 | 마지막 비고 | 증거 |', '|---|---|---|---|---|']
    for row in issues(folder).values():
        lines.append('| ' + ' | '.join(cell(v) for v in
                     (row['id'], row['title'], row['status'], row.get('note', ''),
                      ', '.join(row.get('evidence', [])))) + ' |')
    (folder / 'issues.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')


def summary(run):
    opened = []
    for folder, meta in discussions(run):
        if meta['status'] == 'open':
            count = sum(row['status'] in OPEN_STATES for row in issues(folder).values())
            opened.append(f"{folder.name} (라운드 {meta.get('round', 0)}, 열린 쟁점 {count})")
    return '열린 토의: ' + ('; '.join(opened) if opened else '없음')


def counts(folder):
    values = Counter(row['status'] for row in issues(folder).values())
    return ', '.join(f'{state} {values[state]}' for state in STATES)
