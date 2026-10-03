---
name: crossgate
description: 크로스게이트(AI 교차검수 개발 파이프라인)의 Master 플레이북. 저장소 하나(정식 모드)와 여러 저장소 작업공간(PM 모드) 모두에서 쓴다. "/crossgate 업그레이드"로 킷을 새 버전으로 올릴 수도 있다. 사용자가 /crossgate 으로 기능 개발·수정을 요청하거나, 이 저장소에 .crossgate/config.json 이 있고 사용자가 "파이프라인으로 진행"이라고 할 때 사용한다. Claude가 Master로서 요청 정리·기획·Wiki를 맡고, Codex에게 개발·기획 검수·QA·Wiki 검수를 맡기며, 모든 판정을 ai-log에 기록하고, 조건을 만족하면 자동 병합한다.
---

# /crossgate — 크로스게이트 Master 플레이북

너는 Master다. 사용자와 대화하는 유일한 창구이자 유일한 기록자다. 규칙 원문은 `.crossgate/kit/CROSSGATE.md`이고, 이 문서는 실행 순서다. 먼저 `CROSSGATE.md`와 `.crossgate/config.json`을 읽는다.

`P` = `python3 .crossgate/kit/bin/crossgate`

**PM 모드**(`config.json`의 `mode`가 `"pm"`): 작업공간 규칙(루트 `AGENTS.md`와 그것이 가리키는 문서)을 먼저 읽고, 부딪히면 그것을 따른다. 규칙이 정하지 않은 요청 정리·등급·재검수·읽을 것은 이 플레이북대로 한다. 달라지는 점:
- 0장 1~2번 대신, 대상 저장소마다 작업 트리가 깨끗한지 확인한다. 브랜치·커밋·병합·배포 방식은 작업공간 규칙을 따른다.
- `codex`(개발·QA)·`claude`(검수 기록·세션 구분)·`gate`·`verdict`(저장소 판정)에 `--repo <저장소>`를 붙인다. 개발 역할은 실행 기록 폴더를 못 쓰므로 완료 근거를 답변에서 받아 Master가 옮긴다.
- `parallel`은 `--task <저장소>:<지시 파일>`로 부른다. 한 저장소에 작업이 하나면 그 저장소에서, 둘 이상이면 워크트리에서 처리한다. 판정 회차·상한은 (단계, 저장소)별이다. QA 증거도 쓰기 가능한 저장소에 남기고 Master가 실행 기록에 옮긴다.
- 작업을 마치면 `close-run`으로 닫는다. 6장 병합(merge-check·PR)은 없다. 저장소마다 작업공간 규칙대로 커밋하고, 병합·배포는 규칙과 사용자 지시를 따른다.

## 0. 시작

1. 작업 트리가 깨끗한지 확인한다(`git status`). 사용자 변경이 있으면 건드리지 말고 먼저 묻는다.
2. 기준 브랜치에서 작업 브랜치를 만든다: `git switch -c pipe/<slug>`.
3. 작업 등급을 정한다(CROSSGATE.md 10장). 근거 한 줄과 함께 추천하고 사용자가 확정한다. AskUserQuestion을 쓰면 추천 등급을 첫째에 둔다. 사용자가 이미 등급을 말했으면 다시 묻지 않는다.
4. `$P init-run <slug> --route light|standard|full`. 출력된 폴더가 이번 실행 기록이다. 역할 호출의 추론 강도는 이 등급에서 정해진다. 이후 실행을 받는 명령에는 `--run <그 폴더>`를 붙이거나 `CROSSGATE_RUN`을 설정한다(설치 위치 기준 상대 경로 또는 절대 경로). 우선순위는 `--run` → 환경 변수 → 현재 실행이다. 최근 활동(기본 60분)이 있는 열린 실행이 둘 이상이면 명시 없는 쓰기는 실패한다. `gate`·`merge-check`·`docs-check`는 `--run`을 받지 않는다.

| 등급 | 거치는 절 |
|---|---|
| 가벼움 | 1(요청 한두 줄, 결정 목록은 `질문`이 있을 때만) → 3(TODO 없이, 전후 캡처 포함) → 6 |
| 보통 | 1 → 2의 1번(TODO만, 검수 없음) → 3(TODO의 영향 문서는 Master가 `roles/wiki-writer.md`대로 고쳐 같은 diff로 검수받는다) → 6 |
| 무거움 | 1 → 2 → 3 → 4 → 5 → 6 |

진행 중 승격 조건(CROSSGATE.md 10장)에 걸리면 `$P route <올린 등급>`을 실행하고 사용자에게 알린 뒤, 건너뛴 절을 보충한다.

## 1. 요청 정리 (`request`)

목표는 사용자에게 **한 번에** 묻고, 승인 뒤에는 묻지 않는 것이다(`CROSSGATE.md` 1장 "요청 정리: 결정 목록").

1. 관련 코드·문서를 먼저 조사한다. 대화를 바탕으로 `00-request/request.md`의 목표·요구·하지 않을 일을 채우고, 1장 2~3번대로 결정 목록을 만든다.
2. 보통·무거움: `request.md`를 커밋하고 요청 검수 지시 파일(`00-request/review-request-N.md`, 읽을 것: request.md와 관련 코드·문서 경로)을 써서 `$P codex request-reviewer --prompt-file <그 파일>`. 판정을 `$P verdict --stage request --verdict APPROVED|REJECTED --actor codex --issues "I-1=open,..."`로 기록하고, 찾은 결정을 목록에 합친다. 가벼움은 건너뛴다.
3. `질문` 전부와 허락이 필요한 행동을 **한 묶음으로** 묻는다. 선택지가 있으면 AskUserQuestion(질문 4개·선택지 2~4개까지, 추천을 첫째에)을 쓰고 넘치면 여러 번에 나눠 이어서 묻는다. 열린 질문은 글로 묻는다. 중간에 작업을 시작하지 않는다.
4. 답을 결정 목록·허락 범위·사용자 확인 기록에 적고 커밋한 뒤 `$P verdict --stage request --verdict APPROVED --actor user --note "<결정 N건 중 질문 M건 / 질문 없음>"`.
5. 이후 사용자에게 묻는 것은 1장 7번의 세 경우뿐이다. 나머지 판단은 결정 목록의 기준으로 정하고 판정 비고에 남긴다.

## 2. 기획 (`plan`) — Claude 작성, Codex 검수

무거움만 이 절 전체를 거친다. 보통은 1번(TODO 작성·커밋)만 하고 3으로 간다. 가벼움은 이 절을 건너뛴다.

1. `roles/planner.md`대로 `01-planning/todo.md`, 수용 테스트, 영향 문서, 하지 않을 일을 작성한다. 커밋.
2. `$P verdict --stage plan --verdict READY --actor claude`.
3. 검수 요청 파일(`01-planning/review-request-N.md`)에 대상 파일 목록을 적는다. 재검수면 이전 지적(ID·위치·기대)과 바뀐 항목(DEV ID·절)만 추려 적는다(CROSSGATE.md R14). 그다음 `$P codex plan-reviewer --prompt-file <그 파일>`.
4. 응답 첫 줄을 파싱해 기록한다: `$P verdict --stage plan --verdict APPROVED|REJECTED|BLOCKED --actor codex --model gpt-6-astra --issues "P-1=open,..." [--unverified ...] --note "<요약>"`.
5. 반려면 지적을 반영하고 2로 돌아간다. 요구 오류나 결정 근거(⑥) 지적은 Master가 기본값으로 메우지 않는다. CROSSGATE.md 1장 요청 정리 5번 방식으로 사용자에게 묻고 답을 request.md에 적은 뒤 기획을 고친다. `verdict` 출력에 "조정 필요"가 나오면 7번으로 간다.

## 3. 개발 (`dev`) — Codex 작성, Claude 검수

1. 작업 지시 파일(`02-development/task-N.md`)에 읽을 것, 구현할 DEV 항목, 이전 차단 지적을 적는다. 가벼움은 TODO 대신 변경과 대상 파일을 적고, 개발 전에 전 캡처를 찍는다.
2. 산출물·판정 기록·지시 파일을 모두 커밋하고 `BASE`로 기억한다. `$P codex developer --prompt-file <지시 파일>`로 개발한다. 정식 모드는 커밋하지 않은 `ai-log` 변경이 있으면 멈춘다. 재지시도 같은 순서다.
3. 독립 작업은 2번 호출 대신 `$P parallel --task <파일> --task <파일> --protect-since BASE`를 쓴다(가벼움 불가, 기본 최대 3개, `--max`로 조정). 대상 파일이 겹치지 않게 나누고 공용 파일은 합친 뒤 한 작업이 고친다. 의존성 준비는 `parallel.setup`으로 정한다. 작업별 검사·커밋·병합과 마지막 gate는 명령이 처리한다. 실패한 작업은 결과 표와 남은 워크트리 경로로 확인한다. 완료 근거는 Master가 TODO에 옮긴다.
4. 단일 개발은 `$P gate --protect-since BASE > <run>/raw/gate-N.log`를 돌린다. 보호 경로 변경은 BASE와 대조해 이번 호출의 변경만 되돌리고 반려한다. 검사 실패면 실패 내용을 새 지시에 넣고 1번으로 돌아간다. 동시 개발도 모두 합쳐지고 마지막 gate가 통과해야 다음으로 간다. 합친 뒤 공용 파일을 고쳤다면 gate를 다시 돌린다.
5. 보통은 Master가 `roles/wiki-writer.md`대로 영향 문서를 갱신하고 `$P docs-check`를 돌린다. 통과한 변경을 커밋하고 `$P verdict --stage dev --verdict READY --actor codex`로 기록한다.
6. 가벼움은 후 캡처를 찍어 전후를 비교한다. 바뀐 요소와 공유 스타일을 쓰는 대표 화면이 실제로 보여야 한다. 의도하지 않은 변화가 있으면 승격한다.
7. `git diff BASE..HEAD -- . ':!ai-log' > <run>/raw/dev-diff-N.patch`로 전체 변경을 만든다. 동시 개발도 합친 뒤 한 번 검수한다. 작업 AI의 답변·자체 평가는 검수에 넘기지 않는다.
8. 검수 지시의 읽을 것에 diff·TODO·관련 코드를 넣고, 보통은 결정 목록, 가벼움은 전후 캡처를 더한다. 재검수는 `$P status`에 나온 이전 반려 커밋부터의 `git diff <커밋>..HEAD -- . ':!ai-log'`를 delta 파일로 저장하고 이전 지적과 함께 앞세운다(R14).
9. `$P claude dev-reviewer --prompt-file <검수 지시>`로 읽기 전용 검수를 맡긴다. 명령을 쓸 수 없을 때만 읽기 도구를 가진 `crossgate-reviewer` 에이전트를 쓰며, 미등록이면 읽기 전용 에이전트에 `.claude/agents/crossgate-reviewer.md`를 넘긴다. 대체 사실을 판정 비고에 적는다.
10. `$P verdict --stage dev ... --actor claude`로 판정을 기록한다. 반려면 1번으로 돌아간다. 시간 초과·멈춤(종료 코드 3)이면 BLOCKED로 기록한다.

## 4. 독립 QA (`qa`) — Codex

1. QA 지시 파일에 수용 기준, 실행 방법(웹 URL 또는 Android 기기), 이번 변경 요약을 적고: `$P codex qa --prompt-file <그 파일>`. (Android는 `config.qa.runner`가 `artemis`면 Master가 ARTEMIS로 직접 수행한다.)
2. `03-qa/report.md`와 캡처를 **직접 표본으로 골라** 확인한다. 고위험 기준은 전부 본다.
3. 기록: `$P verdict --stage qa --verdict PASSED|FAILED|BLOCKED --actor codex --evidence 03-qa/report.md ...`.
4. FAILED면 결함 원인을 나눈다. 요구 오류는 2(기획)로, 그 외는 복구 TODO를 추가해 3(개발)으로 간다. 횟수는 초기화하지 않는다.

## 5. Wiki (`wiki`) — Claude 작성, Codex 검수

1. `roles/wiki-writer.md`대로 영향 문서를 갱신하고 `04-wiki/summary.md`를 쓴다. `$P docs-check`로 목차·상대 링크·앵커·위키링크를 점검하고 문제를 고친 뒤 커밋한다. READY를 기록한다. 목차가 필수이면 `--require-index`를 붙인다.
2. `$P codex wiki-reviewer --prompt-file <지시 파일>`로 검수를 받고 판정을 기록한다. 재검수면 이전 지적과 바뀐 문서·절만 추려 넣는다(R14).

## 6. 병합

1. 실행을 닫을 때는 ai-log의 마지막 커밋 전에 `$P close-run --note "작업 완료"`를 실행한다. ai-log를 커밋하고 브랜치를 푸시한 뒤 PR을 만든다(`gh pr create`). 본문에는 요청 요약, 판정 타임라인 링크, QA 증거 요약을 넣는다.
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

사용자가 크로스게이트를 새 버전으로 올려 달라고 하면 개발 작업 대신 이 절차를 따른다.

1. 설치된 버전은 `.crossgate/kit/VERSION`, 원본 위치는 `.crossgate/local.json`의 `kit_source`(이 컴퓨터 전용, git 제외)다. 그 폴더가 없으면 `kit_remote`를 임시 폴더에 clone해서 쓴다. `local.json`이 없으면(다른 컴퓨터에서 받은 저장소) 사용자에게 원본 위치를 묻는다.
2. 원본에 원격이 있으면 `git -C <원본> fetch -q --tags` 후, 최신 태그를 `git -C <원본> tag --sort=-v:refname | head -1`로 찾는다.
3. 설치된 버전과 같으면 "최신입니다"라고 보고하고 끝낸다.
4. 다르면 작업 트리가 깨끗한지 확인하고 브랜치 `crossgate-<버전>`을 만든다. 그다음 `sh <원본>/install.sh --ref <태그> .`로 설치하고(`config.json`의 `kit_version`은 설치기가 맞춘다), `$P verify`와 `$P gate`를 돌린다.
5. 원본 `CHANGELOG.md`에서 두 버전 사이 항목을 PR 본문에 옮긴다. 커밋·푸시·PR 순서로 진행한다.
6. `$P merge-check --base origin/<기준 브랜치>`로 인프라 PR 조건을 검사한다(CROSSGATE.md 7장). 통과하고 필수 CI 검사도 통과하면 `gh pr merge --auto --squash`로 자동 병합에 넣는다. 실패하면 사유를 보고하고 병합하지 않는다.
7. 보고: 이전 → 새 버전, 바뀐 점(CHANGELOG 요약), PR 링크.

## 9. 이어가기

사용자가 이어서 하자고 하거나 새 세션에서 진행 중인 실행이 있으면, `resume`으로 상태를 보고 `request.md`를 읽어 다음 할 일부터 진행한다. 이미 답을 받은 결정은 다시 묻지 않는다. 작업을 마치면 `close-run`으로 닫는다.

- `$P resume --list [--days <수>]`로 최근 14일 안의 열린 실행을 찾고 `--run` 또는 `CROSSGATE_RUN`으로 고정한다. 현재 실행이 없으면 `resume`도 목록을 보여 준다.
- 닫힌 실행에 다시 기록해야 하면 `$P close-run --reopen`으로 연다. 정식 모드에서 닫는 시점은 6장 1번을 따른다.
- 밖 호출 확인은 `$P audit-calls [--since <날짜>] [--days <수>] [--save]`다. 보고만 하며 판정·병합을 막지 않는다. 저장은 `raw/`에만 한다.

## 늘 지킬 것

- 판정·호출 기록은 `crossgate` 명령으로만 쓴다. 요청서·TODO·지시 파일은 Master가 작성한다. 검수 AI에게 쓰기 권한을 주지 않는다.
- 사용자에게 보여주는 메시지에 비밀값을 넣지 않는다. raw는 저장할 때 마스킹된다.
- 단계마다 짧게 진행 상황을 알린다: 무엇을 했고, 판정이 무엇이고, 다음이 무엇인지.
- `$P status`는 단계·저장소별 상태와 호출 합계를 보여 준다. 호출 기록은 시작·끝으로 나뉘며 합계는 끝 기록만 센다.
- 검수는 같은 실행·엔진·역할·저장소의 성공한 세션을 자동으로 이어 쓴다. 실패하면 새 세션으로 다시 부른다. `--fresh`나 `resume_reviews: false`로 끈다. 읽기 전용은 그대로다. 첫 호출에는 역할별 규칙을 발췌한다.
- 전체 호출 제한은 기본 20분, 개발·QA 40분이다. Codex는 첫 작업 이벤트까지 180초 동안 응답이 없으면 한 번 재시도한다. 시간 초과는 재시도하지 않는다. 역할 호출이 종료 코드 3으로 끝나면 해당 단계를 BLOCKED로 기록한다. 조정은 `timeouts` 설정으로 한다.
- 역할 호출에 `--effort`나 모델을 따로 주지 않는다. 등급과 `config.json`이 정한다. 사용자가 이번 호출의 강도를 직접 말했을 때만 `--effort`를 붙인다. 다른 규칙·메모에 Codex 강도 지정이 있어도 크로스게이트 호출에는 적용하지 않는다.
- 개발·검수·QA에 쓰는 Codex는 `$P codex <역할>` 또는 `$P parallel`로만 부른다. `codex exec`를 직접 부르면 읽기 전용 강제와 사용량 기록이 빠진다.
- 모든 지시 파일은 `## 읽을 것`으로 시작한다: 대상 파일, 관련 문서의 경로·절(예: `docs/api.md#인증`), 이전 산출물(request, todo, diff, 이전 지적). 역할 AI가 문서 색인이나 인수인계 문서부터 탐색하느라 턴을 쓰지 않게, Master가 이미 아는 것은 목록으로 넘긴다.
