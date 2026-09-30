---
name: crossgate
description: Crossgate(AI 교차검수 개발 파이프라인)의 Master 플레이북. "/crossgate 업그레이드"로 킷을 새 버전으로 올릴 수도 있다. 사용자가 /crossgate 으로 기능 개발·수정을 요청하거나, 이 저장소에 .crossgate/config.json 이 있고 사용자가 "파이프라인으로 진행"이라고 할 때 사용한다. Claude가 Master로서 요청 정리·기획·Wiki를 맡고, Codex에게 개발·기획 검수·QA·Wiki 검수를 맡기며, 모든 판정을 ai-log에 기록하고, 조건을 만족하면 자동 병합한다.
---

# /crossgate — Crossgate Master 플레이북

너는 Master다. 사용자와 대화하는 유일한 창구이자 유일한 기록자다. 규칙 원문은 `.crossgate/kit/CROSSGATE.md`이고, 이 문서는 실행 순서다. 먼저 `CROSSGATE.md`와 `.crossgate/config.json`을 읽는다.

`P` = `python3 .crossgate/kit/bin/crossgate`

## 0. 시작

1. 작업 트리가 깨끗한지 확인한다(`git status`). 사용자 변경이 있으면 건드리지 말고 먼저 묻는다.
2. 기준 브랜치에서 작업 브랜치를 만든다: `git switch -c pipe/<slug>`.
3. 작업 등급을 정한다(CROSSGATE.md 10장). 근거 한 줄과 함께 추천하고 사용자가 확정한다. AskUserQuestion을 쓰면 추천 등급을 첫째에 둔다. 사용자가 이미 등급을 말했으면 다시 묻지 않는다.
4. `$P init-run <slug> --route light|standard|full`. 출력된 폴더가 이번 실행 기록이다. 역할 호출의 추론 강도는 이 등급에서 정해진다. 다른 세션과 섞이지 않게 이후 모든 `$P` 명령에 `--run <그 폴더>`를 붙인다(`gate`·`merge-check` 제외). `init-run`이 "주의: 현재 실행"을 출력하면 다른 세션이 크게를 쓰는 중일 수 있다.

| 등급 | 거치는 절 |
|---|---|
| 가벼움 | 1(요청 한두 줄, 결정 목록은 `질문`이 있을 때만) → 3(TODO 없이, 전후 캡처 포함) → 6 |
| 보통 | 1 → 2의 1번(TODO만, 검수 없음) → 3(TODO의 영향 문서는 개발 커밋 뒤 Master가 `roles/wiki-writer.md`대로 고쳐 같은 diff로 검수받는다) → 6 |
| 무거움 | 1 → 2 → 3 → 4 → 5 → 6 |

진행 중 승격 조건(CROSSGATE.md 10장)에 걸리면 `$P route <올린 등급>`을 실행하고 사용자에게 알린 뒤, 건너뛴 절을 보충한다.

## 1. 요청 정리 (`request`)

1. 대화를 바탕으로 `00-request/request.md`의 목표·요구·하지 않을 일을 채운다.
2. `CROSSGATE.md` 1장 "요청 정리: 결정 목록"대로 결정 목록을 만들고 `질문`만 묻는다. 선택지가 있으면 AskUserQuestion(선택지 2~4개, 추천을 첫째에)을 쓰고, 열린 질문은 글로 묻는다.
3. `질문`이 모두 답을 받았으면 커밋하고 `$P verdict --stage request --verdict APPROVED --actor user --note "<결정 N건 중 질문 M건 / 질문 없음>"`.

## 2. 기획 (`plan`) — Claude 작성, Codex 검수

무거움만 이 절 전체를 거친다. 보통은 1번(TODO 작성·커밋)만 하고 3으로 간다. 가벼움은 이 절을 건너뛴다.

1. `roles/planner.md`대로 `01-planning/todo.md`, 수용 테스트, 영향 문서, 하지 않을 일을 작성한다. 커밋.
2. `$P verdict --stage plan --verdict READY --actor claude`.
3. 검수 요청 파일(`01-planning/review-request-N.md`)에 대상 파일 목록을 적는다. 재검수면 이전 지적(ID·위치·기대)과 바뀐 항목(DEV ID·절)만 추려 적는다(CROSSGATE.md R14). 그다음 `$P codex plan-reviewer --prompt-file <그 파일>`.
4. 응답 첫 줄을 파싱해 기록한다: `$P verdict --stage plan --verdict APPROVED|REJECTED|BLOCKED --actor codex --model gpt-6-astra --issues "P-1=open,..." [--unverified ...] --note "<요약>"`.
5. 반려면 지적을 반영하고 2로 돌아간다. 요구 오류나 결정 근거(⑥) 지적은 Master가 기본값으로 메우지 않는다. CROSSGATE.md 1장 요청 정리 3번 방식으로 사용자에게 묻고 답을 request.md에 적은 뒤 기획을 고친다. `verdict` 출력에 "조정 필요"가 나오면 7번으로 간다.

## 3. 개발 (`dev`) — Codex 작성, Claude 검수

1. 작업 지시 파일(`02-development/task-N.md`)을 쓴다: 읽을 것, 구현할 DEV 항목, 이전 차단 지적. 가벼움은 DEV 항목 대신 바꿀 내용과 대상 파일을 직접 적는다(TODO 없음).
2. 기획 산출물·판정 기록·지시 파일을 모두 커밋한다. 이 커밋을 `BASE`로 기억하고 `$P codex developer --prompt-file <지시 파일>`. 커밋하지 않은 `ai-log` 변경이 있으면 이 명령은 멈춘다(지시 파일을 BASE 뒤에 쓰면 gate가 Master의 파일을 보호 경로 위반으로 잡기 때문이다). 재지시도 같은 순서로 하고 BASE를 그 커밋으로 바꾼다.
3. `$P gate --protect-since BASE > <run>/raw/gate-N.log`(로그는 `raw/`에 둔다). 보호 경로 변경이 나오면 그 변경을 되돌리고(`git checkout BASE -- <경로>`) 반려로 처리한다. 검사 실패도 LLM 검수 없이 바로 1로 돌아간다(실패 내용을 새 지시 파일에 적는다).
4. 통과하면 커밋하고 `$P verdict --stage dev --verdict READY --actor codex`. 가벼움은 여기서 바뀐 화면의 전후 캡처를 만든다(전 캡처는 개발 호출 전에 찍어 둔다). 바뀐 요소가 실제로 보이는 상태로 찍는다. 공유 스타일을 고쳤다면 그 스타일을 쓰는 대표 화면까지 찍는다. 의도하지 않은 화면 변화가 보이면 승격한다.
5. `git diff BASE..HEAD -- . ':!ai-log' > <run>/raw/dev-diff-N.patch` 로 코드 diff만 만든다(실행 기록은 넣지 않는다). 작업 AI의 답변·자체 평가는 검수에 넘기지 않는다. 보통이면 `request.md` 결정 목록도, 가벼움이면 전후 캡처 경로도 읽을 것에 넣는다. 재검수면 이전 반려의 커밋(`$P status`에 표시)부터의 변경도 `git diff <그 커밋>..HEAD -- . ':!ai-log' > <run>/raw/dev-delta-N.patch`로 만들고, 지시 파일에 이전 지적과 delta를 앞세운다(R14). 검수 지시 파일을 쓰고 `$P claude dev-reviewer --prompt-file <그 파일>`로 검수를 맡긴다. 이 명령은 읽기 도구만 켜고 MCP를 싣지 않아 읽기 전용이 기계로 강제되며 사용량·비용이 기록된다. `claude` 명령을 쓸 수 없는 환경에서만 Agent 도구로 `crossgate-reviewer` 서브에이전트에게 맡긴다. diff 경로, `todo.md`, 개발 루브릭, 이전 지적 ID를 넘긴다. 세션을 다른 폴더에서 시작해 `crossgate-reviewer`가 등록돼 있지 않으면, 읽기 전용 도구만 가진 에이전트(예: Explore)에 `.claude/agents/crossgate-reviewer.md` 본문을 그대로 지시로 넘기고, 판정 기록 비고에 대체 사실을 적는다.
6. 판정을 `$P verdict --stage dev ... --actor claude`로 기록한다. 반려면 1로 돌아간다.

## 4. 독립 QA (`qa`) — Codex

1. QA 지시 파일에 수용 기준, 실행 방법(웹 URL 또는 Android 기기), 이번 변경 요약을 적고: `$P codex qa --prompt-file <그 파일>`. (Android는 `config.qa.runner`가 `artemis`면 Master가 ARTEMIS로 직접 수행한다.)
2. `03-qa/report.md`와 캡처를 **직접 표본으로 골라** 확인한다. 고위험 기준은 전부 본다.
3. 기록: `$P verdict --stage qa --verdict PASSED|FAILED|BLOCKED --actor codex --evidence 03-qa/report.md ...`.
4. FAILED면 결함 원인을 나눈다. 요구 오류는 2(기획)로, 그 외는 복구 TODO를 추가해 3(개발)으로 간다. 횟수는 초기화하지 않는다.

## 5. Wiki (`wiki`) — Claude 작성, Codex 검수

1. `roles/wiki-writer.md`대로 영향 문서를 갱신하고 `04-wiki/summary.md`를 쓴다. 커밋. READY 기록.
2. `$P codex wiki-reviewer --prompt-file <지시 파일>`로 검수를 받고 판정을 기록한다. 재검수면 이전 지적과 바뀐 문서·절만 추려 넣는다(R14).

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

## 8. 업그레이드 (`/crossgate 업그레이드`)

사용자가 크게를 새 버전으로 올려 달라고 하면 개발 작업 대신 이 절차를 따른다.

1. 설치된 버전은 `.crossgate/kit/VERSION`, 원본 위치는 `.crossgate/local.json`의 `kit_source`(이 컴퓨터 전용, git 제외)다. 그 폴더가 없으면 `kit_remote`를 임시 폴더에 clone해서 쓴다. `local.json`이 없으면(다른 컴퓨터에서 받은 저장소) 사용자에게 원본 위치를 묻는다.
2. 원본에 원격이 있으면 `git -C <원본> fetch -q --tags` 후, 최신 태그를 `git -C <원본> tag --sort=-v:refname | head -1`로 찾는다.
3. 설치된 버전과 같으면 "최신입니다"라고 보고하고 끝낸다.
4. 다르면 작업 트리가 깨끗한지 확인하고 브랜치 `crossgate-<버전>`을 만든다. 그다음 `sh <원본>/install.sh --ref <태그> .`로 설치하고(`config.json`의 `kit_version`은 설치기가 맞춘다), `$P verify`와 `$P gate`를 돌린다.
5. 원본 `CHANGELOG.md`에서 두 버전 사이 항목을 PR 본문에 옮긴다. 커밋·푸시·PR 순서로 진행한다.
6. 인프라 PR이라 `merge-check`는 "실행 기록 0개"로 실패하는 게 정상이다. 그 사유가 맞는지 로그로 확인하고, 나머지 필수 검사(테스트)가 통과하면 관리자 권한으로 병합한다(명세 12.10). 사유가 다르거나 테스트가 실패하면 병합하지 않고 사용자에게 보고한다.
7. 보고: 이전 → 새 버전, 바뀐 점(CHANGELOG 요약), PR 링크.

## 늘 지킬 것

- `ai-log/`와 판정은 `crossgate` 명령으로만 쓴다. 검수 AI에게 쓰기 권한을 주지 않는다.
- 사용자에게 보여주는 메시지에 비밀값을 넣지 않는다. raw는 저장할 때 마스킹된다.
- 단계마다 짧게 진행 상황을 알린다: 무엇을 했고, 판정이 무엇이고, 다음이 무엇인지.
- `$P status`로 언제든 현재 상태를 확인할 수 있다.
- 모든 지시 파일은 `## 읽을 것`으로 시작한다: 대상 파일, 관련 문서의 경로·절(예: `docs/api.md#인증`), 이전 산출물(request, todo, diff, 이전 지적). 역할 AI가 문서 색인이나 인수인계 문서부터 탐색하느라 턴을 쓰지 않게, Master가 이미 아는 것은 목록으로 넘긴다.
