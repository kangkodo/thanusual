import json
import os
import re
import subprocess
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from cg.calls import invoke
from cg.core import config, current_run, git, is_pm, repo_dir, require_sealed, root
from cg.gatelib import protected_changes, run_gates


GUIDANCE = "TODO 파일을 고치지 않고 완료 근거를 답변에 적는다. 지시 파일에 적힌 대상 파일만 고친다."


def git_result(cwd, *args):
    result = subprocess.run(['git', '-c', 'core.quotepath=false', *args], cwd=cwd,
                            capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError('git 작업 실패: ' + result.stderr.strip())
    return result.stdout.strip()


def next_number(run, targets, worktrees):
    """정리한 갈래도 번호를 재사용하지 않도록 raw에 마지막 번호를 둔다."""
    counter = run / 'raw' / 'parallel-number'
    numbers = [int(counter.read_text())] if counter.exists() else [0]
    prefix = f'refs/heads/cg/{run.name}/'
    for target in targets:
        refs = git('for-each-ref', '--format=%(refname)', prefix, cwd=target)
        for ref in refs.splitlines():
            suffix = ref[len(prefix):]
            if suffix.isdigit():
                numbers.append(int(suffix))
        for line in git('worktree', 'list', '--porcelain', cwd=target).splitlines():
            if line.startswith('worktree '):
                match = re.search(re.escape(run.name) + r'-(\d+)$', line)
                if match:
                    numbers.append(int(match[1]))
    if worktrees.exists():
        for path in worktrees.iterdir():
            match = re.search(re.escape(run.name) + r'-(\d+)$', path.name)
            if match:
                numbers.append(int(match[1]))
    return max(numbers) + 1, counter


def develop(task, run):
    try:
        result = invoke('codex', 'developer', task['prompt'], run=run,
                        repo=task['repo'], workdir=task['workdir'], extra_guidance=GUIDANCE)
        return result['state']
    except (Exception, SystemExit) as exc:
        task['note'] = str(exc)
        return 'failed'


def finish(task):
    cwd, target = task['workdir'], task['target']
    # 기존 gate의 TODO·사용량 예외 검사도 이 워크트리를 보게 한다.
    # 호출 스레드가 모두 끝난 뒤의 순차 처리에서만 폴더를 바꾼다.
    previous = Path.cwd()
    try:
        os.chdir(cwd)
        hit = protected_changes(task['ref'], task['cfg'], cwd)
    finally:
        os.chdir(previous)
    if hit:
        task['note'] = '보호 경로 변경: ' + ', '.join(hit)
        return 'protected'
    failed = run_gates(task['cfg'], cwd)
    if failed:
        task['note'] = 'gate 실패: ' + ', '.join(failed)
        return 'gate-failed'
    git_result(cwd, 'add', '-A')
    if git_result(cwd, 'diff', '--cached', '--name-only'):
        git_result(cwd, 'commit', '-m', f"크로스게이트 동시 개발 {task['number']}")
    if task['branch']:
        try:
            git_result(target, 'merge', '--no-edit', task['branch'])
        except RuntimeError as exc:
            # 충돌 상태를 남기지 않고, 갈래와 워크트리는 보존한다.
            task['note'] = str(exc)
            if git('rev-parse', '-q', '--verify', 'MERGE_HEAD', check=False, cwd=target):
                git_result(target, 'merge', '--abort')
                return 'conflict'
            return 'failed'
        git_result(target, 'worktree', 'remove', '--force', str(cwd))
        git_result(target, 'branch', '-d', task['branch'])
    return 'merged'


def cmd_parallel(a):
    require_sealed()
    cfg, r = config(), root().resolve()
    run = current_run(a.run, writing=True).resolve()
    meta = json.loads((run / 'meta.json').read_text(encoding='utf-8'))
    if meta.get('route') == 'light':
        sys.exit('light 등급에서는 동시 개발을 실행할 수 없습니다.')
    options = cfg.get('parallel', {})
    limit = a.max if a.max is not None else options.get('max', 3)
    if isinstance(limit, bool) or not isinstance(limit, int) or limit < 1:
        sys.exit('동시 호출 수는 1 이상의 정수여야 합니다.')
    tasks = []
    for value in a.task:
        name, sep, filename = value.partition(':')
        if not sep:
            name, filename = None, value
        if is_pm(cfg) and not name:
            sys.exit('PM 모드에서는 --task <저장소>:<지시 파일> 형식이 필요합니다.')
        if name and (name in ('.', '..') or '/' in name or '\\' in name):
            sys.exit('저장소 이름에는 경로 구분자를 쓸 수 없습니다.')
        target = (repo_dir(cfg, name) or r).resolve()
        if not is_pm(cfg) and target != r:
            sys.exit('정식 모드에서는 현재 저장소에서만 동시 개발을 실행합니다.')
        try:
            prompt = Path(filename).read_text(encoding='utf-8')
        except OSError as exc:
            sys.exit(f'지시 파일을 읽을 수 없습니다: {filename}: {exc}')
        tasks.append({'repo': name, 'input': value, 'target': target, 'prompt': prompt,
                      'cfg': cfg['repos'][name] if is_pm(cfg) else cfg,
                      'state': None, 'note': '', 'branch': None, 'workdir': target})
    targets = list(dict.fromkeys(t['target'] for t in tasks))
    bases = {}
    for target in targets:
        if git('status', '--porcelain', cwd=target):
            sys.exit(f'작업 트리가 깨끗해야 합니다: {target}')
        if not git('symbolic-ref', '--quiet', '--short', 'HEAD', check=False, cwd=target):
            sys.exit(f'현재 작업 브랜치가 필요합니다: {target}')
        bases[target] = git('rev-parse', 'HEAD', cwd=target)
        if a.protect_since:
            git('rev-parse', '--verify', a.protect_since + '^{commit}', cwd=target)
    if not is_pm(cfg):
        try:
            record = str((run / 'meta.json').relative_to(r))
        except ValueError:
            sys.exit('정식 모드의 실행 기록은 현재 저장소 안에 있어야 합니다.')
        if not git('ls-tree', 'HEAD', '--', record, cwd=r):
            sys.exit('실행 기록을 커밋한 뒤 동시 개발을 실행하세요.')
    counts = Counter(t['target'] for t in tasks)
    worktrees = r / '.crossgate' / 'worktrees'
    number, counter = next_number(run, targets, worktrees)
    for task in tasks:
        task['number'] = number
        counter.parent.mkdir(parents=True, exist_ok=True)
        counter.write_text(str(number), encoding='utf-8')
        task['ref'] = a.protect_since or bases[task['target']]
        if counts[task['target']] > 1:
            task['branch'] = f'cg/{run.name}/{number}'
            prefix = task['repo'] + '-' if is_pm(cfg) else ''
            task['workdir'] = worktrees / f'{prefix}{run.name}-{number}'
            try:
                worktrees.mkdir(parents=True, exist_ok=True)
                git_result(task['target'], 'worktree', 'add', '-b', task['branch'],
                           str(task['workdir']), bases[task['target']])
                if options.get('setup'):
                    result = subprocess.run(options['setup'], shell=True, cwd=task['workdir'])
                    if result.returncode:
                        task['state'], task['note'] = 'failed', '워크트리 준비 명령 실패'
            except (OSError, RuntimeError) as exc:
                task['state'], task['note'] = 'failed', str(exc)
        number += 1
    with ThreadPoolExecutor(max_workers=limit) as pool:
        futures = [(task, pool.submit(develop, task, run)) for task in tasks if task['state'] is None]
        for task, future in futures:
            task['state'] = future.result()
    # 모든 호출이 끝난 뒤에만 검사와 병합을 순서대로 한다.
    for task in tasks:
        if task['state'] == 'ok':
            try:
                task['state'] = finish(task)
            except (Exception, SystemExit) as exc:
                task['state'], task['note'] = 'failed', str(exc)
    final_failed = []
    for target in targets:
        rc = next(t['cfg'] for t in tasks if t['target'] == target)
        final_failed.extend(run_gates(rc, target))
    print('| 작업 | 결과 | 남긴 경로 |')
    print('|---|---|---|')
    for task in tasks:
        path = str(task['workdir']) if task['state'] != 'merged' else '-'
        print(f"| {task['input']} | {task['state']} | {path} |")
        if task['note']:
            print(f"작업 {task['number']}: {task['note']}", file=sys.stderr)
    print('마지막 gate ' + ('실패: ' + ', '.join(final_failed) if final_failed else '통과'))
    print('Master가 합쳐진 변경 전체로 개발 검수를 한 번 맡깁니다.')
    if final_failed or any(t['state'] != 'merged' for t in tasks):
        sys.exit(1)


def register(subparsers):
    p = subparsers.add_parser('parallel')
    p.add_argument('--task', action='append', required=True)
    p.add_argument('--protect-since')
    p.add_argument('--max', type=int)
    p.add_argument('--run')
    p.set_defaults(fn=cmd_parallel)
