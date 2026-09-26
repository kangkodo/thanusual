---
name: pipeline
description: AI 교차검수 개발 파이프라인의 Master 플레이북. 사용자가 /pipeline 으로 기능 개발·수정을 요청하거나, 이 저장소에 .pipeline/config.json 이 있고 사용자가 "파이프라인으로 진행"이라고 할 때 사용한다. Claude가 Master로서 요청 정리·기획·Wiki를 맡고, Codex에게 개발·기획 검수·QA·Wiki 검수를 맡기며, 모든 판정을 ai-log에 기록하고, 조건을 만족하면 자동 병합한다.
---

# /pipeline — Master 플레이북

너는 Master다. 사용자와 대화하는 유일한 창구이자 유일한 기록자다. 규칙 원문은 `.pipeline/kit/PIPELINE.md`이고, 이 문서는 실행 순서다. 먼저 `PIPELINE.md`와 `.pipeline/config.json`을 읽는다.

`P` = `python3 .pipeline/kit/bin/pipeline`

## 0. 시작

1. 작업 트리가 깨끗한지 확인한다(`git status`). 사용자 변경이 있으면 건드리지 말고 먼저 묻는다.
2. 기준 브랜치에서 작업 브랜치를 만든다: `git switch -c pipe/<slug>`.
3. `$P init-run <slug>` (사용자가 "간단 수정"을 명시했을 때만 `--quick`). 출력된 폴더가 이번 실행 기록이다.

## 1. 요청 정리 (`request`)

1. 대화를 바탕으로 `00-request/request.md`를 채운다.
2. "AI가 새로 가정한 것"이 있으면 **그것만** 사용자에게 묻는다. 사용자가 이미 말한 내용은 다시 묻지 않는다.
3. 답을 "사용자 확인 기록"에 적고 커밋한 뒤 `$P verdict --stage request --verdict APPROVED --actor user --note "<가정 N건 확인 / 가정 없음>"`.

## 2. 기획 (`plan`) — Claude 작성, Codex 검수

1. `roles/planner.md`대로 `01-planning/todo.md`, 수용 테스트, 영향 문서, 하지 않을 일을 작성한다. 커밋.
2. `$P verdict --stage plan --verdict READY --actor claude`.
3. 검수 요청 파일(`01-planning/review-request-N.md`)에 대상 파일 목록과 이전 지적 ID를 적고: `$P codex plan-reviewer --prompt-file <그 파일>`.
4. 응답 첫 줄을 파싱해 기록한다: `$P verdict --stage plan --verdict APPROVED|REJECTED|BLOCKED --actor codex --model gpt-6-astra --issues "P-1=open,..." [--unverified ...] --note "<요약>"`.
5. 반려면 지적을 반영하고 2로 돌아간다. 요구 오류면 사용자에게 새 가정으로 묻는다. `verdict` 출력에 "조정 필요"가 나오면 7번으로 간다.

## 3. 개발 (`dev`) — Codex 작성, Claude 검수

1. 기획 산출물을 모두 커밋한다. 이 커밋을 `BASE`로 기억한다.
2. 작업 지시 파일(`02-development/task-N.md`)에 구현할 DEV 항목, 관련 파일, 이전 차단 지적을 적고: `$P codex developer --prompt-file <그 파일>`.
3. `$P gate --protect-since BASE`. 보호 경로 변경이 나오면 그 변경을 되돌리고(`git checkout BASE -- <경로>`) 반려로 처리한다. 검사 실패도 LLM 검수 없이 바로 2로 돌아간다.
4. 통과하면 커밋하고 `$P verdict --stage dev --verdict READY --actor codex`.
5. `git diff BASE..HEAD > <run>/raw/dev-diff-N.patch` 를 만든 뒤, Agent 도구로 `pipeline-reviewer` 서브에이전트에게 검수를 맡긴다. diff 경로, `todo.md`, 개발 루브릭, 이전 지적 ID를 넘긴다. 세션을 다른 폴더에서 시작해 `pipeline-reviewer`가 등록돼 있지 않으면, 읽기 전용 도구만 가진 에이전트(예: Explore)에 `.claude/agents/pipeline-reviewer.md` 본문을 그대로 지시로 넘기고, 판정 기록 비고에 대체 사실을 적는다.
6. 판정을 `$P verdict --stage dev ... --actor claude`로 기록한다. 반려면 2로 돌아간다.

## 4. 독립 QA (`qa`) — Codex

1. QA 지시 파일에 수용 기준, 실행 방법(웹 URL 또는 Android 기기), 이번 변경 요약을 적고: `$P codex qa --prompt-file <그 파일>`. (Android는 `config.qa.runner`가 `artemis`면 Master가 ARTEMIS로 직접 수행한다.)
2. `03-qa/report.md`와 캡처를 **직접 표본으로 골라** 확인한다. 고위험 기준은 전부 본다.
3. 기록: `$P verdict --stage qa --verdict PASSED|FAILED|BLOCKED --actor codex --evidence 03-qa/report.md ...`.
4. FAILED면 결함 원인을 나눈다. 요구 오류는 2(기획)로, 그 외는 복구 TODO를 추가해 3(개발)으로 간다. 횟수는 초기화하지 않는다.

## 5. Wiki (`wiki`) — Claude 작성, Codex 검수

1. `roles/wiki-writer.md`대로 영향 문서를 갱신하고 `04-wiki/summary.md`를 쓴다. 커밋. READY 기록.
2. `$P codex wiki-reviewer --prompt-file <지시 파일>`로 검수를 받고 판정을 기록한다.

## 6. 병합

1. ai-log를 커밋하고 브랜치를 푸시한 뒤 PR을 만든다(`gh pr create`). 본문에는 요청 요약, 판정 타임라인 링크, QA 증거 요약을 넣는다.
2. `$P merge-check --base origin/<기준 브랜치>`.
   - 통과: `gh pr merge --auto --squash`. 병합되면 사용자에게 한 줄로 보고한다: 무엇이 병합됐는지 · PR 링크 · 되돌리기 `git revert <sha>`.
   - 실패: 사유를 그대로 보여주고 병합할지 사용자에게 묻는다.
3. 배포는 하지 않는다. 사용자가 지시하면 `$P deploy`로 미리보기를 보여주고, 확인을 받은 뒤 `$P deploy --yes`.

## 7. 조정 요청

`verdict`가 "조정 필요"를 출력하면 더 반복하지 않는다.

1. `$P verdict --stage <단계> --verdict ESCALATED --note "<사유>"`.
2. 사용자에게 한 화면으로 보여준다: 쟁점 지적 ID, 작업 AI의 주장, 검수 AI의 주장, 선택지.
3. 사용자의 결정을 request.md 확인 기록에 남기고 이어서 진행한다. 이 실행은 자동 병합되지 않는다(merge-check 조건 4).

## 늘 지킬 것

- `ai-log/`와 판정은 `pipeline` 명령으로만 쓴다. 검수 AI에게 쓰기 권한을 주지 않는다.
- 사용자에게 보여주는 메시지에 비밀값을 넣지 않는다. raw는 저장할 때 마스킹된다.
- 단계마다 짧게 진행 상황을 알린다: 무엇을 했고, 판정이 무엇이고, 다음이 무엇인지.
- `$P status`로 언제든 현재 상태를 확인할 수 있다.
