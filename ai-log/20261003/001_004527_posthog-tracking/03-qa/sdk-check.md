# 실제 SDK 확인 (Master, S-1~S-5)

Codex QA는 네트워크 없이 로더 대기열까지만 본다. 실제 posthog-js가 설정대로 움직이는지는 Master가 따로 확인했다(request C-27, 허락 범위 "외부 요청").

## 방법

- 검증 버전: 코드 `c6fc824`(이후 커밋은 `ai-log`만 바뀜). 2026-10-03, posthog-js 1.435.7.
- 저장소 루트를 `python3 -m http.server 8791 --bind 127.0.0.1`로 띄우고 `http://thanusual.localhost:8791/`로 열었다(로컬 목록에 없는 호스트라 PostHog가 뜬다).
- Playwright Chromium. `us-assets.i.posthog.com`(SDK 파일, GET)만 통과시키고, `us.i.posthog.com`으로 가는 요청은 전부 가로채 본문만 기록한 뒤 가짜 200으로 답했다. **실제 PostHog에는 이벤트가 들어가지 않았다.** 그 밖의 외부 요청은 막았다.
- 헤드리스 Chromium은 posthog-js의 봇 판별에 걸려 이벤트가 조용히 버려진다. 확인용으로만 `navigator.userAgentData`를 가리고 일반 사용자 에이전트와 `--disable-blink-features=AutomationControlled`를 썼다. 앱 코드는 이 판별을 건드리지 않는다.
- 스크립트와 결과: `captures/S-sdk-check.mjs`, `captures/S-result.json`, `captures/S-bodies.json`(가로챈 본문 전체), `captures/S-5-*.png`. `captures/`는 git 제외다.

## 결과

| ID | 결과 | 관찰 |
|---|---|---|
| S-1 | 통과 | `/?email=a@b.c&x=1#p=이태원역`으로 열었다. 첫 이벤트는 `$pageview`, `service=thanusual`, `$current_url`은 `http://thanusual.localhost:8791/`. 가로챈 본문 전체에 `email`, `a@b.c`, `a%40b.c`, `이태원역`(원문·인코딩), `p=`, `x=1`이 없다. 주소 형태 속성(`$current_url`, `$session_entry_url`)은 모두 경로까지만이다. 상세는 이태원역으로 복원됐고 복원으로는 `core_action`이 나가지 않았다 |
| S-2 | 통과 | 복원된 장소의 행을 다시 누름 → 0건. 다른 행 → 1건, 「가까운 다른 장소」 → 2건, 닫기 → 그대로, 닫은 뒤 같은 장소 → 3건. 셋 모두 `service=thanusual`, `action=place_open`. `$`로 시작하지 않는 속성은 `service`, `action`과 SDK가 붙이는 `distinct_id`, `token`뿐이고 장소 이름은 본문에 없다 |
| S-3 | 통과 | 검색 입력, 분류 탭, ☆, 시간 모드 변경, 페이지 이탈을 했다. 이벤트 이름은 `$pageview`, `core_action`, `$exception` 셋뿐이다. 모든 이벤트에 `service=thanusual`. PostHog 요청은 SDK 파일 셋(`array.js`, `exception-autocapture.js`, 프로젝트 `config.js`)과 이벤트 전송(`/e/`, `/i/v0/e/`)뿐이고 `/flags`·녹화·설문 요청은 없다. 검색어는 어떤 본문에도 없다. `$process_person_profile`은 `false`(익명) |
| S-4 | 통과 | 잡히지 않은 오류를 일으키자 `$exception` 1건이 `service=thanusual`과 함께 나갔다. 메시지는 그대로, 주소는 잘린 값 |
| S-5 | 통과 | 전송 요청을 모두 실패시킨 상태(SDK는 로드됨)와 SDK 다운로드를 실패시킨 상태(대기열 상태로 남음) 모두에서 장소 선택 → 상세 → `#p=` 갱신 → 닫기가 동작했고 `pageerror`는 0건이다. 콘솔에는 브라우저의 네트워크 진단 줄만 있다(타일 404 포함). 쿠키는 `thanusual.localhost`에만 생겼다(`ph_phc_…_posthog`). 대조로 `127.0.0.1`에서는 `window.posthog`가 없고 PostHog 요청이 0건이다 |

## 이 확인이 보지 않은 것

- 실제 PostHog 수집과 jelly-studio 집계. 배포 뒤 jelly-studio 루트에서 `python3 bin/jelly resume thanusual`로 본다.
- 지도 점·핀 선택의 `core_action`은 Codex QA-2(대기열)에서 확인했다. 여기서는 목록 행과 「가까운 다른 장소」만 실제 SDK로 봤다.
