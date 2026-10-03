import datetime as dt
import fcntl
import json
import os
import selectors
import signal
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path
from cg.core import READ_ONLY_ROLES, WRITE_ROLES, config, current_run, git, is_pm, mask, read_usage, repo_dir, request_approved, root, route_conf
from cg.prompt import build_prompt


USAGE_KEYS = ("input_tokens", "cached_input_tokens", "output_tokens", "reasoning_output_tokens")
CLAUDE_TOOLS = "Read,Grep,Glob"
EFFORTS = ("minimal", "low", "medium", "high", "xhigh", "max")


def sum_usage(jsonl):
    """codex exec --json 출력에서 turn.completed 이벤트의 토큰을 합친다."""
    total = dict.fromkeys(USAGE_KEYS, 0)
    for line in jsonl.splitlines():
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if isinstance(e, dict) and e.get("type") == "turn.completed":
            for k in USAGE_KEYS:
                total[k] += e.get("usage", {}).get(k) or 0
    return total


def resolve_effort(cfg, run, role, engine, override=None):
    """강도와 출처를 함께 정하고 등급보다 낮춘 명시값을 알린다."""
    route = json.loads((run / "meta.json").read_text(encoding="utf-8")).get("route", "full")
    route = "standard" if route == "quick" else route
    c = cfg.get(engine, {})
    value = route_conf(cfg, route).get("effort", {}).get(role)
    source = "route"
    if not value:
        value = c.get("effort", {}).get(role) or c.get("default_effort")
        source = "config"
    if not value:
        value, source = ("medium" if engine == "codex" else None), "default"
    if override:
        if route in ("standard", "full") and override in EFFORTS and value in EFFORTS:
            if EFFORTS.index(override) < EFFORTS.index(value):
                print(f"경고: --effort {override}는 {route} 등급·설정의 강도 {value}보다 낮습니다.", file=sys.stderr)
        return override, "flag"
    return value, source


def append_usage(run, record):
    """동시 호출도 한 줄씩 잠금 아래 한 번의 쓰기로 덧붙인다."""
    data = (json.dumps(record, ensure_ascii=False) + "\n").encode("utf-8")
    with open(run / "usage.jsonl", "ab", buffering=0) as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            if f.write(data) != len(data):
                raise OSError("사용량 기록을 끝까지 쓰지 못했습니다.")
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)


def run_process(cmd, prompt, cwd, seconds, stall_seconds=None):
    """출력 두 통로를 비우며 첫 작업 이벤트와 전체 제한을 감시한다."""
    started = time.monotonic()
    output = {"stdout": bytearray(), "stderr": bytearray()}
    pending = b""
    working = False
    state = None
    # 큰 지시도 stdin 쓰기에서 막히지 않게 파일로 전달한다.
    with tempfile.TemporaryFile() as task, selectors.DefaultSelector() as selector:
        task.write(prompt.encode("utf-8"))
        task.seek(0)
        try:
            p = subprocess.Popen(cmd, stdin=task, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                 cwd=cwd, start_new_session=True)
        except OSError as e:
            return "failed", 1, "", f"호출 실행 실패: {e}"
        for name in output:
            selector.register(getattr(p, name), selectors.EVENT_READ, name)
        try:
            while selector.get_map() or p.poll() is None:
                elapsed = time.monotonic() - started
                if elapsed >= seconds:
                    state = "timeout"
                    break
                if stall_seconds is not None and not working and elapsed >= stall_seconds:
                    state = "stalled"
                    break
                wait = min(0.05, seconds - elapsed)
                if stall_seconds is not None and not working:
                    wait = min(wait, stall_seconds - elapsed)
                for key, _ in selector.select(max(0, wait)):
                    chunk = os.read(key.fileobj.fileno(), 65536)
                    if not chunk:
                        selector.unregister(key.fileobj)
                        continue
                    output[key.data].extend(chunk)
                    if key.data == "stdout" and stall_seconds is not None and not working:
                        pending += chunk
                        lines = pending.split(b"\n")
                        pending = lines.pop()
                        for line in lines:
                            try:
                                event = json.loads(line)
                            except ValueError:
                                continue
                            if isinstance(event, dict) and str(event.get("type", "")).startswith("item."):
                                working = True
                if not selector.get_map() and p.poll() is None:
                    time.sleep(min(0.01, max(0, seconds - (time.monotonic() - started))))
        finally:
            if state or p.poll() is None:
                try:
                    os.killpg(p.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            p.wait()
            p.stdout.close()
            p.stderr.close()
    code = 3 if state else p.returncode
    return state or ("ok" if code == 0 else "failed"), code, output["stdout"].decode("utf-8", "replace"), output["stderr"].decode("utf-8", "replace")


def validate_codex(cfg, r, run, role, repo):
    if role not in READ_ONLY_ROLES | WRITE_ROLES:
        sys.exit(f"Codex가 맡을 수 없는 역할: {role}")
    sandbox = "read-only" if role in READ_ONLY_ROLES else "workspace-write"
    if is_pm(cfg) and sandbox == "workspace-write" and not repo:
        sys.exit("PM 모드의 개발·QA 역할은 --repo 가 필요합니다(쓰기를 저장소 하나로 제한).")
    if not is_pm(cfg) and sandbox == "workspace-write":
        dirty = [l for l in git("status", "--porcelain", "--", "ai-log", strip=False, cwd=r).splitlines()
                 if l.strip() and "/raw/" not in l and "/03-qa/captures/" not in l and not l.rstrip().endswith("usage.jsonl")]
        if dirty:
            sys.exit("ai-log에 커밋하지 않은 변경이 있습니다. 지시 파일까지 커밋한 뒤 부르고, 그 커밋을 gate --protect-since 에 줍니다"
                     "(아니면 gate가 Master의 파일을 보호 경로 위반으로 잡는다).\n" + "\n".join(dirty[:5]))
    if role in ("plan-reviewer", "developer") and not request_approved(run):
        print("주의: 이 실행에는 요청 단계 승인이 없다. 결정 목록을 한 번에 묻고 승인한 뒤 진행한다(CROSSGATE.md 1장).", file=sys.stderr)


def invoke(engine, role, task, *, run=None, repo=None, workdir=None, effort=None, extra_guidance="", fresh=False):
    """공용 호출. run은 실행 이름 또는 Path, repo는 설정의 저장소 이름이다.

    workdir는 Codex의 실제 작업 폴더다. Claude는 설치 위치에서 검수한다.
    state, reply, session, usage, record(끝 기록), exit, stderr를 돌려준다.
    이어 쓰기 대체와 멈춤 재시도도 실제 호출마다 독립된 시작·끝 기록과 원문을 남긴다.
    """
    cfg, r = config(), root()
    run = current_run(str(run) if run is not None else None, writing=True)
    if engine not in ("codex", "claude"):
        raise ValueError("지원하지 않는 호출 엔진입니다.")
    target = repo_dir(cfg, repo) if engine == "codex" else None
    if engine == "codex":
        validate_codex(cfg, r, run, role, target)
    elif role not in READ_ONLY_ROLES:
        sys.exit(f"크로스게이트 claude는 검수 역할만 맡는다: {sorted(READ_ONLY_ROLES)}")
    sandbox = "read-only" if role in READ_ONLY_ROLES else "workspace-write"
    effort, source = resolve_effort(cfg, run, role, engine, effort)
    c = cfg.get(engine, {})
    model = c.get("model", "gpt-6-astra" if engine == "codex" else "claude-opus-5-5")
    prompt = build_prompt(role, run, task, target, engine == "codex" and sandbox == "workspace-write")
    if workdir is not None and engine == "codex":
        prompt += f"\n\n이번 호출의 실제 작업 폴더: `{Path(workdir).resolve()}`. 작업은 이 폴더에서 진행한다."
    if extra_guidance:
        prompt += "\n\n" + extra_guidance
    resume_prompt = task + ("\n\n" + extra_guidance if extra_guidance else "")
    resume_session = None
    if role in READ_ONLY_ROLES and not fresh and cfg.get("resume_reviews", True) \
            and not (engine == "codex" and c.get("ephemeral")):
        resume_session = next((rec["session"] for rec in reversed(read_usage(run))
                               if rec.get("engine") == engine and rec.get("role") == role
                               and rec.get("repo") == repo and rec.get("state") == "ok"
                               and rec.get("session")), None)
    limits = cfg.get("timeouts", {})
    minutes = limits.get("call_minutes", {})
    seconds = float(minutes.get(role, minutes.get("default", 40 if role in WRITE_ROLES else 20))) * 60
    stall = float(limits.get("stall_seconds", 180)) if engine == "codex" else None
    if seconds <= 0 or (stall is not None and stall <= 0):
        sys.exit("호출 시간 제한과 멈춤 감지 시간은 0보다 커야 합니다.")
    stall_retried = False
    while True:
        call_id = uuid.uuid4().hex[:8]
        stamp = dt.datetime.now().strftime("%H%M%S")
        base = run / "raw" / f"{stamp}_{call_id}_{role}"
        out = Path(str(base) + "_reply.md")
        Path(str(base) + "_task.md").write_text(mask(task), encoding="utf-8")
        if engine == "codex":
            cmd = ["codex", "exec"]
            if resume_session:
                cmd += ["resume", resume_session, "-c", 'sandbox_mode="read-only"']
            else:
                cmd += ["-s", sandbox, "-C", str(workdir or target or r)]
            cmd += ["-m", model, "-c", f"model_reasoning_effort={effort}",
                    "--skip-git-repo-check", "--json", "-o", str(out), "-"]
            if c.get("ephemeral") and not resume_session:
                cmd.insert(-1, "--ephemeral")
            if sandbox == "workspace-write" and c.get("network"):
                cmd[1:1] = ["-c", "sandbox_workspace_write.network_access=true"]
        else:
            cmd = ["claude", "-p", "--model", model, "--tools", CLAUDE_TOOLS, "--permission-mode", "dontAsk",
                   "--strict-mcp-config", "--output-format", "json"]
            if resume_session:
                cmd += ["--resume", resume_session]
            if effort:
                cmd += ["--effort", effort]
        common = {"id": call_id, "engine": engine, "role": role, "model": model,
                  "effort": effort, "effort_source": source, "repo": repo}
        append_usage(run, {**common, "event": "start", "ts": dt.datetime.now().isoformat(timespec="seconds")})
        started = time.monotonic()
        cwd = (workdir or target or r) if engine == "codex" and resume_session else r
        state, code, stdout, stderr = run_process(cmd, resume_prompt if resume_session else prompt,
                                                cwd, seconds, stall)
        session = None
        if engine == "codex":
            usage = {**sum_usage(stdout), "cost_usd": None}
            for line in stdout.splitlines():
                try:
                    event = json.loads(line)
                except ValueError:
                    continue
                if isinstance(event, dict) and event.get("type") == "thread.started":
                    session = event.get("thread_id")
            reply = mask(out.read_text(encoding="utf-8")) if out.exists() else ""
        else:
            try:
                data = json.loads(stdout)
            except ValueError:
                data = {}
            if not isinstance(data, dict):
                data = {}
            if (not data or data.get("is_error")) and state == "ok":
                state, code = "failed", 1
            u = data.get("usage") or {}
            usage = {"input_tokens": (u.get("input_tokens") or 0) + (u.get("cache_creation_input_tokens") or 0) + (u.get("cache_read_input_tokens") or 0),
                     "cached_input_tokens": u.get("cache_read_input_tokens") or 0, "output_tokens": u.get("output_tokens") or 0,
                     "reasoning_output_tokens": 0, "cost_usd": data.get("total_cost_usd")}
            session = data.get("session_id")
            reply = mask(data.get("result") or "")
        if resume_session and state == "ok" and not session:
            state, code = "failed", 1
            stderr += "\n이어 쓴 호출에서 세션 번호를 받지 못했습니다."
        out.write_text(reply, encoding="utf-8")
        rec = {**common, "event": "end", "ts": dt.datetime.now().isoformat(timespec="seconds"),
               "seconds": round(time.monotonic() - started), "exit": code, **usage,
               "session": session, "resumed": bool(resume_session) and state == "ok", "state": state}
        append_usage(run, rec)
        if resume_session and state != "ok":
            resume_session = None
            continue
        if state == "stalled" and not stall_retried:
            stall_retried = True
            continue
        return {"state": state, "reply": reply, "session": session, "usage": usage,
                "record": rec, "exit": code, "stderr": mask(stderr[-2000:]), "sandbox": sandbox}


def call_codex(a):
    return invoke("codex", a.role, Path(a.prompt_file).read_text(encoding="utf-8"),
                  run=a.run, repo=a.repo, effort=a.effort, fresh=getattr(a, "fresh", False))


def call_claude(a):
    return invoke("claude", a.role, Path(a.prompt_file).read_text(encoding="utf-8"),
                  run=a.run, repo=getattr(a, "repo", None), effort=a.effort, fresh=getattr(a, "fresh", False))
